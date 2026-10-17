import time
import uuid
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from typing import Any, Callable, Dict

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


def _observation_payload(response: ToolResponse) -> Dict[str, Any]:
    """What gets handed back to the model as this tool's observation - errors
    included, so the model can see a failure and adjust (retry with different
    args, or move on) instead of the loop just dying."""
    if response.status == "success":
        return response.result or {}
    return {"error": response.error.message if response.error else "unknown error"}


def make_tool_node(tool_name: str) -> Callable[[AgentState], Dict[str, Any]]:
    """
    Build a LangGraph node function for one registered agent. Replaces the three
    hand-written, near-identical calculator_node/rag_node/web_search_node functions
    that each hardcoded their own input-building logic - now driven entirely by
    `pending_calls`, the arguments the ReAct agent's function call actually asked
    for, and by the agent's own AgentMetadata.timeout_seconds (declared before but
    never enforced).
    """

    def node(state: AgentState) -> Dict[str, Any]:
        request_id = state.get("request_id", "unknown")
        calls = [c for c in (state.get("pending_calls") or []) if c.get("tool") == tool_name]
        if not calls:
            return {}

        call = calls[0]
        if len(calls) > 1:
            # Observed model behavior is one call per tool per turn; if the model
            # ever asks for the same tool twice in one turn with different args,
            # run the first and let the second be considered on a later turn
            # rather than silently overwriting one response with the other.
            logger.warning(
                f"{tool_name}: {len(calls) - 1} extra call(s) this turn ignored "
                f"(one call per tool per turn is supported)"
            )

        agent = global_registry.get_agent(tool_name)
        metadata = global_registry.get_metadata(tool_name)
        timeout = metadata.timeout_seconds if metadata else 5

        if not agent:
            response = ToolResponse(
                request_id=request_id,
                tool_name=tool_name,
                status="failed",
                execution_time_ms=0,
                error=ToolError(code="AGENT_NOT_FOUND", message=f"{tool_name} agent is not registered"),
            )
        else:
            req = ToolRequest(
                request_id=request_id,
                tool_name=tool_name,
                execution_id=f"exec_{tool_name}_{uuid.uuid4()}",
                input=call["args"],
            )
            start_time = time.time()
            try:
                # AgentMetadata.timeout_seconds enforced here - previously declared
                # and never read anywhere.
                with ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(agent.execute, req)
                    response = future.result(timeout=timeout)
            except FutureTimeoutError:
                execution_time = int((time.time() - start_time) * 1000)
                logger.error(f"{tool_name} exceeded its {timeout}s timeout")
                response = ToolResponse(
                    request_id=request_id,
                    tool_name=tool_name,
                    status="timeout",
                    execution_time_ms=execution_time,
                    error=ToolError(code="TIMEOUT", message=f"{tool_name} exceeded {timeout}s timeout"),
                )
            except Exception as e:
                execution_time = int((time.time() - start_time) * 1000)
                logger.error(f"Error executing {tool_name} node: {e}")
                response = ToolResponse(
                    request_id=request_id,
                    tool_name=tool_name,
                    status="failed",
                    execution_time_ms=execution_time,
                    error=ToolError(code="NODE_EXECUTION_FAILURE", message=str(e)),
                )

        update: Dict[str, Any] = {
            "tool_results": {tool_name: _to_dict(response)},
            "observations_this_turn": [
                {"tool": tool_name, "args": call["args"], "payload": _observation_payload(response)}
            ],
        }
        if response.status != "success":
            err_msg = response.error.message if response.error else "unknown error"
            update["errors"] = [f"{tool_name} failure: {err_msg}"]
        return update

    return node


calculator_node = make_tool_node("calculator")
rag_node = make_tool_node("rag")
web_search_node = make_tool_node("web_search")
