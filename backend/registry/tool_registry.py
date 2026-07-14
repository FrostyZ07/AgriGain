from typing import Dict, List, Optional, Tuple
from backend.agents.base_agent import BaseAgent
from backend.models.tool_models import AgentMetadata

class ToolRegistry:
    def __init__(self) -> None:
        self._registry: Dict[str, Tuple[BaseAgent, AgentMetadata]] = {}

    def register(self, agent: BaseAgent, metadata: AgentMetadata) -> None:
        """
        Register an agent instance with its capability metadata.
        """
        name = metadata.name
        self._registry[name] = (agent, metadata)

    def get_agent(self, name: str) -> Optional[BaseAgent]:
        """
        Retrieve an agent instance by name.
        """
        if name in self._registry:
            return self._registry[name][0]
        return None

    def get_metadata(self, name: str) -> Optional[AgentMetadata]:
        """
        Retrieve agent metadata by name.
        """
        if name in self._registry:
            return self._registry[name][1]
        return None

    def list_agents(self) -> List[str]:
        """
        List all registered agent names.
        """
        return list(self._registry.keys())

    def list_capabilities(self) -> List[AgentMetadata]:
        """
        Get capabilities metadata for all registered agents.
        """
        return [item[1] for item in self._registry.values()]

# Global registry instance
global_registry = ToolRegistry()
