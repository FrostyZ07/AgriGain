from typing import TypedDict, Dict, Any, List, Optional, Annotated

def merge_tool_results(left: Dict[str, Any], right: Dict[str, Any]) -> Dict[str, Any]:
    new_dict = left.copy() if left else {}
    new_dict.update(right)
    return new_dict

def merge_lists(left: List[Any], right: List[Any]) -> List[Any]:
    return (left or []) + (right or [])

class AgentState(TypedDict):
    request_id: str
    user_query: str
    gemini_model: Optional[Any]  # injected once by run_orchestrator - no agent re-imports main.app_state (E5 fix)

    # --- ReAct loop state (B2 fix: this is what makes the graph an actual loop) ---
    turn: int
    # Gemini `Content` turns (dicts with role/parts), owned solely by the agent node.
    # Not parallel-write-safe by design: tool nodes never touch this directly (see
    # observations_this_turn below) so concurrent tool nodes in one round can never
    # conflict over it.
    chat_history: List[Dict[str, Any]]
    # Tool nodes append their result here (parallel-safe, list-append reducer). The
    # agent node folds unconsumed entries into one bundled function-response turn
    # in chat_history each round, then advances observations_consumed.
    observations_this_turn: Annotated[List[Dict[str, Any]], merge_lists]
    observations_consumed: int
    # This turn's function calls the agent node decided on: [{"tool": str, "args": dict}]
    pending_calls: List[Dict[str, Any]]
    # Dedupe keys of "tool:hash(args)" already executed, so the loop can't repeat
    # an identical call forever.
    called_tools: Annotated[List[str], merge_lists]
    # Why the loop stopped calling tools: "model_done" | "turn_cap" | "out_of_scope" |
    # "no_new_calls" | "no_model" | "model_error: ..."
    finish_reason: Optional[str]

    # --- legacy fields, kept for the synthesizer / API response shape ---
    parsed_input: Optional[Dict[str, Any]]
    intent: Optional[Dict[str, Any]]
    tool_results: Annotated[Dict[str, Any], merge_tool_results]
    synthesized_response: Optional[Dict[str, Any]]
    errors: Annotated[List[str], merge_lists]
