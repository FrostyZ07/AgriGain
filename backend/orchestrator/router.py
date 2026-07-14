from typing import List
from backend.orchestrator.state import AgentState

def router_edge(state: AgentState) -> List[str]:
    """
    Evaluates the execution plan in the state and returns the list of target
    tool node names to execute in parallel.
    If no tools are planned, goes directly to the synthesizer.
    """
    plan = state.get("execution_plan")
    if not plan or not plan.get("tools"):
        return ["synthesizer"]

    active_nodes = []
    for tool in plan.get("tools", []):
        name = tool.get("name")
        # Validate that the planned tool maps to one of our nodes
        if name in ["calculator", "rag", "web_search"]:
            active_nodes.append(name)

    if not active_nodes:
        return ["synthesizer"]
    
    return active_nodes
