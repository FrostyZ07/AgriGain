import time
import uuid
import logging
from typing import Dict, Any, Optional, List
from langgraph.graph import StateGraph, START, END

from backend.orchestrator.state import AgentState
from backend.orchestrator.planner import Planner
from backend.orchestrator.router import router_edge
from backend.orchestrator.executor import calculator_node, rag_node, web_search_node
from backend.agents.response_synthesizer import ResponseSynthesizer
from backend.models.tool_models import ToolResponse

logger = logging.getLogger(__name__)

# Define Node functions
def planner_node(state: AgentState) -> Dict[str, Any]:
    """
    Executes the planning model to identify intent and select tools.
    """
    logger.info("Executing Planner Node...")
    start_time = time.time()
    
    planner = Planner()
    plan_result = planner.plan(state["user_query"])
    
    # Enrich parsed input with start timestamp for synthesizer latency tracking
    parsed_input = plan_result.get("parsed_input") or {}
    parsed_input["start_time_float"] = start_time
    
    return {
        "intent": plan_result.get("intent"),
        "execution_plan": plan_result.get("execution_plan"),
        "parsed_input": parsed_input
    }

def synthesizer_node(state: AgentState) -> Dict[str, Any]:
    """
    Executes the Response Synthesizer to combine all tool outputs.
    """
    logger.info("Executing Synthesizer Node...")
    
    # Parse dict results back to ToolResponse Pydantic models for the synthesizer class
    tool_results_models = {}
    for tool_name, result_dict in state.get("tool_results", {}).items():
        if result_dict:
            tool_results_models[tool_name] = ToolResponse(**result_dict)
            
    # Retrieve start time
    parsed_inp = state.get("parsed_input") or {}
    start_time = parsed_inp.get("start_time_float") or time.time()
    total_time_ms = int((time.time() - start_time) * 1000)

    # Call response synthesizer
    synthesizer = ResponseSynthesizer()
    parallel = state.get("execution_plan", {}).get("parallel", True)
    
    synthesized = synthesizer.synthesize(
        tool_results=tool_results_models,
        total_time_ms=total_time_ms,
        parallel=parallel
    )
    
    # Append any accumulated system errors to the final response
    if state.get("errors"):
        synthesized["system_errors"] = state["errors"]

    return {"synthesized_response": synthesized}

# Build Graph Workflow
workflow = StateGraph(AgentState)

# Register nodes
workflow.add_node("planner", planner_node)
workflow.add_node("calculator", calculator_node)
workflow.add_node("rag", rag_node)
workflow.add_node("web_search", web_search_node)
workflow.add_node("synthesizer", synthesizer_node)

# Define edges
workflow.add_edge(START, "planner")

# Conditional edges from planner
workflow.add_conditional_edges(
    "planner",
    router_edge,
    {
        "calculator": "calculator",
        "rag": "rag",
        "web_search": "web_search",
        "synthesizer": "synthesizer"
    }
)

# Connect tools back to synthesizer
workflow.add_edge("calculator", "synthesizer")
workflow.add_edge("rag", "synthesizer")
workflow.add_edge("web_search", "synthesizer")

# Synthesizer completes execution
workflow.add_edge("synthesizer", END)

# Compile Graph
compiled_graph = workflow.compile()

def run_orchestrator(query: str, request_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Main entry point to execute the Master ReAct Orchestrator.
    """
    req_id = request_id or f"req_{uuid.uuid4().hex[:8]}"
    initial_state: AgentState = {
        "request_id": req_id,
        "user_query": query,
        "parsed_input": None,
        "intent": None,
        "execution_plan": None,
        "tool_results": {},
        "synthesized_response": None,
        "errors": []
    }
    
    logger.info(f"Running Orchestrator for request {req_id}: '{query}'")
    final_state = compiled_graph.invoke(initial_state)
    return final_state.get("synthesized_response") or {}
