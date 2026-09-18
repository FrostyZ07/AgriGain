from typing import Any, Dict, List, Optional, Tuple
from backend.agents.base_agent import BaseAgent
from backend.models.tool_models import AgentMetadata

# JSON-schema-style type name -> Gemini Schema.Type enum value.
_TYPE_MAP = {
    "string": "STRING",
    "number": "NUMBER",
    "integer": "INTEGER",
    "boolean": "BOOLEAN",
}


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

    def to_function_declarations(self) -> List[Any]:
        """
        Build Gemini native function-calling declarations from every registered
        agent's metadata. This makes the registry the single source of truth for
        what the LLM can call - replacing the old hand-written JSON schema in
        orchestrator/prompts.py that had drifted from what agents actually accept
        (e.g. 'region' was never declared there, the calculator's area/crop path
        wasn't declared at all).
        """
        import google.generativeai as genai

        declarations = []
        for name, (_agent, metadata) in self._registry.items():
            properties = {}
            for param_name, param in metadata.parameters.items():
                schema_type = _TYPE_MAP.get(param.type, "STRING")
                properties[param_name] = genai.protos.Schema(
                    type=getattr(genai.protos.Type, schema_type),
                    description=param.description,
                )

            declarations.append(
                genai.protos.FunctionDeclaration(
                    name=name,
                    description=metadata.description,
                    parameters=genai.protos.Schema(
                        type=genai.protos.Type.OBJECT,
                        properties=properties,
                        required=metadata.required,
                    ),
                )
            )
        return declarations


# Global registry instance
global_registry = ToolRegistry()
