from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class AgentMetadata(BaseModel):
    name: str
    version: str
    description: str
    supported_intents: List[str] = Field(default_factory=list)
    parallel_execution: bool = True
    timeout_seconds: int = 5

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

