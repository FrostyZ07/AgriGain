from typing import List
from backend.orchestrator.state import AgentState
from backend.registry.tool_registry import global_registry


def router_edge(state: AgentState) -> List[str]:
    """
    Routes from the agent node to whichever registered tool nodes this turn's
    pending_calls target, or to the synthesizer once the agent has stopped
    requesting tools.

    B6 fix: previously this validated tool names against a hardcoded literal
    ["calculator", "rag", "web_search"], so adding a fourth agent meant editing
    this file, graph.py, and the planner prompt. Now it checks against whatever
    is actually registered, making the registry load-bearing.
    """
    calls = state.get("pending_calls") or []
    if not calls:
        return ["synthesizer"]

    registered = set(global_registry.list_agents())
    active_nodes = sorted({call["tool"] for call in calls if call.get("tool") in registered})

    if not active_nodes:
        return ["synthesizer"]

    return active_nodes
