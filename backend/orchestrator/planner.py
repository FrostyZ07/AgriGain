import json
import logging
from typing import Any, Dict, Optional
from backend.orchestrator.prompts import PLANNER_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

class Planner:
    def __init__(self, gemini_model: Any = None) -> None:
        self.gemini_model = gemini_model

    def initialize(self) -> None:
        """Fetch Gemini model if not bound."""
        if not self.gemini_model:
            try:
                from main import app_state
                if app_state.rag_service and app_state.rag_service.model:
                    self.gemini_model = app_state.rag_service.model
                    logger.info("Planner successfully bound to global Gemini model.")
            except Exception as e:
                logger.warning(f"Planner: Could not load global Gemini model on init: {e}")

    def plan(self, query: str, retries: int = 1) -> Dict[str, Any]:
        """
        Runs Gemini to generate the structured intent and tool execution plan.
        """
        self.initialize()
        
        if not self.gemini_model:
            logger.warning("Gemini model not initialized in Planner. Returning fallback plan.")
            return self._get_fallback_plan(query, "Gemini model unavailable")

        prompt = PLANNER_SYSTEM_PROMPT.replace("{query}", query)

        for attempt in range(1, retries + 2):
            try:
                response = self.gemini_model.generate_content(prompt)
                text = response.text.strip()
                
                # Clean Markdown block syntax if returned by the LLM
                if text.startswith("```json"):
                    text = text[7:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()

                parsed = json.loads(text)
                
                # Basic validation of keys
                if "intent" in parsed and "execution_plan" in parsed:
                    logger.info(f"Generated execution plan: intent={parsed['intent'].get('primary')}, tools={parsed['intent'].get('requires_tools')}")
                    return parsed
                else:
                    raise ValueError("JSON missing required plan keys ('intent' or 'execution_plan')")
            except Exception as e:
                logger.warning(f"Planner attempt {attempt} failed: {e}")
                if attempt > retries:
                    return self._get_fallback_plan(query, f"Failed to generate plan after retries: {str(e)}")

        return self._get_fallback_plan(query, "Plan execution reached end without success")

    def _get_fallback_plan(self, query: str, reason: str) -> Dict[str, Any]:
        """
        Returns a conservative fallback plan to route to RAG + Calculator.
        """
        logger.info(f"Returning fallback plan: {reason}")
        return {
            "intent": {
                "primary": "fallback_routing",
                "confidence": 0.5,
                "requires_tools": ["calculator", "rag"]
            },
            "execution_plan": {
                "parallel": True,
                "tools": [
                    {"name": "calculator", "priority": 1},
                    {"name": "rag", "priority": 1}
                ]
            },
            "parsed_input": {
                "crop": None,
                "waste_type": None,
                "quantity": None,
                "unit": None
            }
        }
