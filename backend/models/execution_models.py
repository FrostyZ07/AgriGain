from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class ParsedInput(BaseModel):
    crop: Optional[str] = None
    waste_type: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None

class IntentInfo(BaseModel):
    primary: str
    confidence: float
    requires_tools: List[str] = Field(default_factory=list)

class PlannedTool(BaseModel):
    name: str
    priority: int = 1

class ExecutionPlan(BaseModel):
    parallel: bool = True
    tools: List[PlannedTool] = Field(default_factory=list)

class ExecutionContext(BaseModel):
    request_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user_query: str
    parsed_input: Optional[ParsedInput] = None
    intent: Optional[IntentInfo] = None
    execution_plan: Optional[ExecutionPlan] = None
    tool_results: Dict[str, Any] = Field(default_factory=dict)
