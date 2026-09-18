from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class ToolParameter(BaseModel):
    """One argument an agent's function-calling schema exposes to the LLM."""
    type: str = "string"  # "string" | "number" | "integer" | "boolean"
    description: str = ""


class AgentMetadata(BaseModel):
    name: str
    version: str
    description: str
    supported_intents: List[str] = Field(default_factory=list)
    parallel_execution: bool = True
    timeout_seconds: int = 5
    # Drives ToolRegistry.to_function_declarations() - this IS the agent's public
    # contract for the LLM. Previously the planner prompt hand-declared a JSON
    # schema that drifted from what agents actually read (region was never in the
    # schema; the calculator's area/crop path wasn't declared at all).
    parameters: Dict[str, ToolParameter] = Field(default_factory=dict)
    required: List[str] = Field(default_factory=list)

class ToolError(BaseModel):
    code: str
    message: str

class ToolRequest(BaseModel):
    schema_version: str = "1.0"
    request_id: str
    tool_name: str
    execution_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    input: Dict[str, Any] = Field(default_factory=dict)

class ToolResponse(BaseModel):
    schema_version: str = "1.0"
    request_id: str
    tool_name: str
    status: str  # "success", "failed", "timeout"
    execution_time_ms: int
    result: Optional[Dict[str, Any]] = None
    error: Optional[ToolError] = None

