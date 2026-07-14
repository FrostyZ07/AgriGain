from typing import TypedDict, Dict, Any, List, Optional, Annotated

def merge_tool_results(left: Dict[str, Any], right: Dict[str, Any]) -> Dict[str, Any]:
    new_dict = left.copy() if left else {}
    new_dict.update(right)
    return new_dict

def merge_errors(left: List[str], right: List[str]) -> List[str]:
    return (left or []) + (right or [])

class AgentState(TypedDict):
    request_id: str
    user_query: str
    parsed_input: Optional[Dict[str, Any]]
    intent: Optional[Dict[str, Any]]
    execution_plan: Optional[Dict[str, Any]]
    tool_results: Annotated[Dict[str, Any], merge_tool_results]
    synthesized_response: Optional[Dict[str, Any]]
    errors: Annotated[List[str], merge_errors]

