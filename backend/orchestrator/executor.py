import uuid
import logging
from typing import Dict, Any
from backend.registry.tool_registry import global_registry
from backend.models.tool_models import ToolRequest, ToolResponse, ToolError
from backend.orchestrator.state import AgentState

logger = logging.getLogger(__name__)

def _to_dict(model_obj: Any) -> Dict[str, Any]:
    """Helper to convert Pydantic models to JSON dicts safely."""
    if hasattr(model_obj, "model_dump"):
        return model_obj.model_dump()
    elif hasattr(model_obj, "dict"):
        return model_obj.dict()
    return model_obj

def calculator_node(state: AgentState) -> Dict[str, Any]:
    """
    LangGraph node to execute CalculatorAgent.
    """
    logger.info("Executing Calculator Node...")
    request_id = state.get("request_id", "unknown")
    parsed_input = state.get("parsed_input") or {}
    
    agent = global_registry.get_agent("calculator")
    if not agent:
        err = ToolResponse(
            request_id=request_id,
            tool_name="calculator",
            status="failed",
            execution_time_ms=0,
            error=ToolError(code="AGENT_NOT_FOUND", message="Calculator Agent is not registered in ToolRegistry.")
        )
        return {
            "tool_results": {"calculator": _to_dict(err)},
            "errors": ["Calculator Agent not registered"]
        }

    # Construct request
    req = ToolRequest(
        request_id=request_id,
        tool_name="calculator",
        execution_id=f"exec_calc_{uuid.uuid4()}",
        input=parsed_input
    )

    try:
        response = agent.execute(req)
        return {"tool_results": {"calculator": _to_dict(response)}}
    except Exception as e:
        logger.error(f"Error executing Calculator Node: {e}")
        err = ToolResponse(
            request_id=request_id,
            tool_name="calculator",
            status="failed",
            execution_time_ms=0,
            error=ToolError(code="NODE_EXECUTION_FAILURE", message=str(e))
        )
        return {
            "tool_results": {"calculator": _to_dict(err)},
            "errors": [f"Calculator failure: {str(e)}"]
        }

def rag_node(state: AgentState) -> Dict[str, Any]:
    """
    LangGraph node to execute RAGAgent.
    """
    logger.info("Executing RAG Node...")
    request_id = state.get("request_id", "unknown")
    parsed_input = state.get("parsed_input") or {}
    user_query = state.get("user_query", "")

    agent = global_registry.get_agent("rag")
    if not agent:
        err = ToolResponse(
            request_id=request_id,
            tool_name="rag",
            status="failed",
            execution_time_ms=0,
            error=ToolError(code="AGENT_NOT_FOUND", message="RAG Agent is not registered in ToolRegistry.")
        )
        return {
            "tool_results": {"rag": _to_dict(err)},
            "errors": ["RAG Agent not registered"]
        }

    # Construct RAG request input. Support both structured fields and user query fallback
    rag_input = {
        "query": user_query,
        "waste_type": parsed_input.get("waste_type"),
        "total_kg": parsed_input.get("quantity") or parsed_input.get("estimated_waste"),
        "region": parsed_input.get("region") or "all"
    }

    req = ToolRequest(
        request_id=request_id,
        tool_name="rag",
        execution_id=f"exec_rag_{uuid.uuid4()}",
        input=rag_input
    )

    try:
        response = agent.execute(req)
        return {"tool_results": {"rag": _to_dict(response)}}
    except Exception as e:
        logger.error(f"Error executing RAG Node: {e}")
        err = ToolResponse(
            request_id=request_id,
            tool_name="rag",
            status="failed",
            execution_time_ms=0,
            error=ToolError(code="NODE_EXECUTION_FAILURE", message=str(e))
        )
        return {
            "tool_results": {"rag": _to_dict(err)},
            "errors": [f"RAG failure: {str(e)}"]
        }

def web_search_node(state: AgentState) -> Dict[str, Any]:
    """
    LangGraph node to execute WebSearchAgent.
    """
    logger.info("Executing Web Search Node...")
    request_id = state.get("request_id", "unknown")
    parsed_input = state.get("parsed_input") or {}
    user_query = state.get("user_query", "")

    agent = global_registry.get_agent("web_search")
    if not agent:
        err = ToolResponse(
            request_id=request_id,
            tool_name="web_search",
            status="failed",
            execution_time_ms=0,
            error=ToolError(code="AGENT_NOT_FOUND", message="Web Search Agent is not registered in ToolRegistry.")
        )
        return {
            "tool_results": {"web_search": _to_dict(err)},
            "errors": ["Web Search Agent not registered"]
        }

    # Construct search request input
    search_input = {
        "query": user_query,
        "waste_type": parsed_input.get("waste_type"),
        "region": parsed_input.get("region") or "all"
    }

    req = ToolRequest(
        request_id=request_id,
        tool_name="web_search",
        execution_id=f"exec_search_{uuid.uuid4()}",
        input=search_input
    )

    try:
        response = agent.execute(req)
        return {"tool_results": {"web_search": _to_dict(response)}}
    except Exception as e:
        logger.error(f"Error executing Web Search Node: {e}")
        err = ToolResponse(
            request_id=request_id,
            tool_name="web_search",
            status="failed",
            execution_time_ms=0,
            error=ToolError(code="NODE_EXECUTION_FAILURE", message=str(e))
        )
        return {
            "tool_results": {"web_search": _to_dict(err)},
            "errors": [f"Web search failure: {str(e)}"]
        }
