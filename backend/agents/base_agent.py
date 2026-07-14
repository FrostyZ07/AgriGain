from abc import ABC, abstractmethod
from typing import Any
from backend.models.tool_models import ToolRequest, ToolResponse

class BaseAgent(ABC):
    def initialize(self) -> None:
        """
        Initialize the agent, loading config or instantiating clients.
        Override in subclasses if initialization is needed.
        """
        pass

    @abstractmethod
    def validate(self, request: ToolRequest) -> bool:
        """
        Validate the incoming ToolRequest.
        Return True if valid, False or raise ValueError/ValidationError if invalid.
        """
        pass

    @abstractmethod
    def execute(self, request: ToolRequest) -> ToolResponse:
        """
        Execute the agent's specific logic.
        """
        pass

    @abstractmethod
    def format_response(
        self, 
        result: Any, 
        status: str, 
        request: ToolRequest, 
        execution_time_ms: int,
        error: Any = None
    ) -> ToolResponse:
        """
        Format output into a standardized ToolResponse.
        """
        pass
