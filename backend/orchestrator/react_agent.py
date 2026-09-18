import hashlib
import json
import logging
from typing import Any, Dict, List, Optional

from backend.orchestrator.prompts import AGENT_SYSTEM_INSTRUCTION
from backend.registry.tool_registry import global_registry

logger = logging.getLogger(__name__)

# Tool-calling rounds allowed before the loop is forced to synthesize with whatever
# evidence it has. Sized for the common case: our 3-tool decision_support intent
# needs at most one call per tool, and Gemini reliably issues one tool call per
# turn for this tool set (verified against the live API) - so 3 turns covers
# gathering calculator + rag + web_search before the cap forces a stop.
MAX_TURNS = 3


def call_key(tool_name: str, args: Dict[str, Any]) -> str:
    """Dedupe key for a (tool, args) pair, so the loop can't repeat an identical call."""
    normalized = json.dumps(args, sort_keys=True, default=str)
    digest = hashlib.sha256(normalized.encode()).hexdigest()[:12]
    return f"{tool_name}:{digest}"


class ReactAgent:
    """
    The ReAct 'brain' of the orchestrator. Each call to decide() is ONE turn: given
    the conversation so far - including the results of tools already called - it
    asks Gemini's native function calling to either request more tool calls or
    stop. The loop in graph.py keeps calling this until it stops requesting tools
    or the turn cap is hit.

    This replaces the old one-shot Planner, which asked an LLM to hand-write a JSON
    execution plan *before* any tool ran and never revisited it - not a loop, no
    observation step, and its fallback plan routed to the calculator with an empty
    input that was guaranteed to fail validation.
    """

    def __init__(self, gemini_model: Any = None) -> None:
        # `gemini_model` is the shared model instance from RAGService, built with no
        # tools/system_instruction bound (it's reused for plain-text generation
        # elsewhere). generate_content() has no per-call system_instruction param, so
        # we rebuild a model with the same model_name but with tools + the ReAct
        # system instruction bound - done once and cached, not per turn.
        self.gemini_model = gemini_model
        self._react_model = None

    def _model_for_react(self) -> Optional[Any]:
        if self._react_model is None and self.gemini_model is not None:
            import google.generativeai as genai
            self._react_model = genai.GenerativeModel(
                model_name=self.gemini_model.model_name,
                tools=global_registry.to_function_declarations(),
                system_instruction=AGENT_SYSTEM_INSTRUCTION,
            )
        return self._react_model

    def decide(self, chat_history: List[Dict[str, Any]], turn: int) -> Dict[str, Any]:
        """
        Returns:
            {
                "pending_calls": [{"tool": str, "args": dict}, ...],
                "model_content": <Content dict to append to history, or None>,
                "finish_reason": Optional[str],
            }
        """
        if turn > MAX_TURNS:
            logger.info(f"ReactAgent: turn cap ({MAX_TURNS}) reached, forcing finish")
            return {"pending_calls": [], "model_content": None, "finish_reason": "turn_cap"}

        model = self._model_for_react()
        if not model:
            logger.warning("ReactAgent: no Gemini model available - cannot plan, forcing finish")
            return {"pending_calls": [], "model_content": None, "finish_reason": "no_model"}

        try:
            response = model.generate_content(chat_history)
            candidate = response.candidates[0]
        except Exception as e:
            logger.error(f"ReactAgent: Gemini call failed on turn {turn}: {e}")
            return {"pending_calls": [], "model_content": None, "finish_reason": f"model_error: {e}"}

        function_calls = [p.function_call for p in candidate.content.parts if p.function_call]

        if not function_calls:
            # Model chose to answer in plain text: it considers the evidence
            # sufficient, or - on turn 1, with nothing gathered yet - the query is
            # out of scope (replaces the old fragile "no waste" in message.lower()
            # substring check).
            reason = "out_of_scope" if turn == 1 else "model_done"
            return {
                "pending_calls": [],
                "model_content": {"role": "model", "parts": list(candidate.content.parts)},
                "finish_reason": reason,
            }

        return {
            "pending_calls": [{"tool": fc.name, "args": dict(fc.args)} for fc in function_calls],
            "model_content": {"role": "model", "parts": list(candidate.content.parts)},
            "finish_reason": None,
        }
