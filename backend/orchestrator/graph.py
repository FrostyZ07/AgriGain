import time
import uuid
import logging
from typing import Dict, Any, Optional
from langgraph.graph import StateGraph, START, END

from backend.orchestrator.state import AgentState
from backend.orchestrator.react_agent import ReactAgent, call_key
from backend.orchestrator.router import router_edge
from backend.orchestrator.executor import calculator_node, rag_node, web_search_node
from backend.agents.response_synthesizer import ResponseSynthesizer
from backend.models.tool_models import ToolResponse

logger = logging.getLogger(__name__)


def agent_node(state: AgentState) -> Dict[str, Any]:
    """
    The ReAct loop's single decision point (B2 fix). Every pass through this node:
    1. Folds any tool observations gathered since the last pass into ONE bundled
       function-response turn in chat_history. This node is the sole writer of
       chat_history, so parallel tool nodes racing to append their own turns is
       structurally impossible - they only append to the reducer-safe
       observations_this_turn list.
    2. Asks the ReactAgent for this turn's decision: call more tools, or stop.
    3. Dedupes requested calls against everything already called this run, so an
       identical (tool, args) pair can never repeat.
    """
    turn = state.get("turn", 0) + 1

    history = list(state.get("chat_history") or [])
    if not history:
        history.append({"role": "user", "parts": [{"text": state["user_query"]}]})

    observations = state.get("observations_this_turn") or []
    consumed = state.get("observations_consumed", 0)
    new_observations = observations[consumed:]
    if new_observations:
        import google.generativeai as genai
        response_parts = [
            genai.protos.Part(function_response=genai.protos.FunctionResponse(
                name=obs["tool"], response={"result": obs["payload"]}
            ))
            for obs in new_observations
        ]
        history.append({"role": "user", "parts": response_parts})

    agent = ReactAgent(gemini_model=state.get("gemini_model"))
    decision = agent.decide(chat_history=history, turn=turn)

    if decision["model_content"]:
        history.append(decision["model_content"])

    already_called = set(state.get("called_tools") or [])
    accepted_calls = []
    new_keys = []
    for call in decision["pending_calls"]:
        key = call_key(call["tool"], call["args"])
        if key in already_called:
            logger.info(f"Skipping duplicate call: {call['tool']}({call['args']})")
            continue
        already_called.add(key)
        new_keys.append(key)
        accepted_calls.append(call)

    finish_reason = decision["finish_reason"]
    if decision["pending_calls"] and not accepted_calls:
        # Every call this turn was a repeat - nothing new to learn from another
        # round trip, so stop here rather than looping forever.
        finish_reason = "no_new_calls"

    return {
        "turn": turn,
        "chat_history": history,
        "observations_consumed": len(observations),
        "pending_calls": accepted_calls,
        "called_tools": new_keys,
        "finish_reason": finish_reason,
    }


def synthesizer_node(state: AgentState) -> Dict[str, Any]:
    """
    Executes the Response Synthesizer to combine all tool outputs. Now backed by
    an LLM (see ResponseSynthesizer._llm_synthesize_recommendations) instead of
    pure dict-merging - graph.py previously built ResponseSynthesizer() with no
    arguments even though __init__ already accepted a gemini_model, so that
    reasoning step never ran.
    """
    logger.info("Executing Synthesizer Node...")

    tool_results_models = {}
    for tool_name, result_dict in state.get("tool_results", {}).items():
        if result_dict:
            tool_results_models[tool_name] = ToolResponse(**result_dict)

    synthesizer = ResponseSynthesizer(gemini_model=state.get("gemini_model"))
    parallel = len(tool_results_models) > 1

    synthesized = synthesizer.synthesize(
        tool_results=tool_results_models,
        total_time_ms=0,  # patched by run_orchestrator with the real measured wall-clock time
        parallel=parallel
    )

    synthesized["turns"] = state.get("turn", 0)
    synthesized["finish_reason"] = state.get("finish_reason")

    if state.get("errors"):
        synthesized["system_errors"] = state["errors"]

    return {"synthesized_response": synthesized}


# Build Graph Workflow
workflow = StateGraph(AgentState)

workflow.add_node("agent", agent_node)
workflow.add_node("calculator", calculator_node)
workflow.add_node("rag", rag_node)
workflow.add_node("web_search", web_search_node)
workflow.add_node("synthesizer", synthesizer_node)

workflow.add_edge(START, "agent")

# Conditional edges from the agent node - registry-driven (router.py), not a
# hardcoded tool list.
workflow.add_conditional_edges(
    "agent",
    router_edge,
    {
        "calculator": "calculator",
        "rag": "rag",
        "web_search": "web_search",
        "synthesizer": "synthesizer"
    }
)

# Tool nodes return to the agent, not straight to the synthesizer - this loop
# edge is what makes this ReAct instead of a one-shot parallel fan-out (B2 fix).
# Termination is guarded three ways: ReactAgent.MAX_TURNS caps total rounds,
# agent_node dedupes (tool, args) pairs, and executor.py enforces each agent's
# own timeout_seconds - so the loop cannot hang or spin forever.
workflow.add_edge("calculator", "agent")
workflow.add_edge("rag", "agent")
workflow.add_edge("web_search", "agent")

workflow.add_edge("synthesizer", END)

# Compile Graph
compiled_graph = workflow.compile()


# Reducer keys mirrored from state.py's Annotated fields, used to reconstruct the
# fully-merged final state from run_orchestrator_streaming's per-node updates.
_LIST_MERGE_KEYS = {"called_tools", "errors", "observations_this_turn"}
_DICT_MERGE_KEYS = {"tool_results"}


def _apply_update(current_state: Dict[str, Any], partial: Dict[str, Any]) -> None:
    for key, value in partial.items():
        if key in _LIST_MERGE_KEYS:
            current_state[key] = (current_state.get(key) or []) + (value or [])
        elif key in _DICT_MERGE_KEYS:
            merged = dict(current_state.get(key) or {})
            merged.update(value or {})
            current_state[key] = merged
        else:
            current_state[key] = value


def run_orchestrator_streaming(
    query: str, request_id: Optional[str] = None, gemini_model: Any = None
) -> "tuple[Dict[str, Any], list]":
    """
    Same execution as run_orchestrator, but also returns the ordered per-node
    execution trace: [(node_name, partial_state_update), ...]. /investigations
    uses this to render each real agent turn and tool call as its own timeline
    event (B1 fix - the endpoint used to fabricate a fixed sequence of events
    regardless of what the orchestrator actually did).
    """
    req_id = request_id or f"req_{uuid.uuid4().hex[:8]}"
    initial_state: AgentState = {
        "request_id": req_id,
        "user_query": query,
        "gemini_model": gemini_model,
        "turn": 0,
        "chat_history": [],
        "observations_this_turn": [],
        "observations_consumed": 0,
        "pending_calls": [],
        "called_tools": [],
        "finish_reason": None,
        "parsed_input": None,
        "intent": None,
        "tool_results": {},
        "synthesized_response": None,
        "errors": []
    }

    logger.info(f"Running Orchestrator for request {req_id}: '{query}'")
    start_time = time.time()
    current_state: Dict[str, Any] = dict(initial_state)
    trace: list = []
    # Recursion budget covers MAX_TURNS agent<->tool round trips plus the
    # synthesizer step, with headroom.
    for step in compiled_graph.stream(initial_state, {"recursion_limit": 25}):
        for node_name, partial in step.items():
            trace.append((node_name, partial))
            _apply_update(current_state, partial)
    elapsed_ms = int((time.time() - start_time) * 1000)

    result = current_state.get("synthesized_response") or {}
    if "execution" in result:
        result["execution"]["execution_time_ms"] = elapsed_ms
    return result, trace


def run_orchestrator(query: str, request_id: Optional[str] = None, gemini_model: Any = None) -> Dict[str, Any]:
    """
    Main entry point to execute the ReAct Orchestrator. Callers should pass the
    shared gemini_model explicitly (main.py does, from app_state.rag_service.model)
    rather than agents reaching back into main's global state (E5 fix).
    """
    result, _trace = run_orchestrator_streaming(query, request_id=request_id, gemini_model=gemini_model)
    return result
