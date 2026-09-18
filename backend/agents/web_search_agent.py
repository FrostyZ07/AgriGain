import logging
import time
import json
from typing import Any, Dict, List, Optional
from backend.agents.base_agent import BaseAgent
from backend.models.tool_models import ToolRequest, ToolResponse, ToolError
from backend.services.tavily_service import TavilyService

logger = logging.getLogger(__name__)

class WebSearchAgent(BaseAgent):
    def __init__(
        self, 
        tavily_service: Optional[TavilyService] = None,
        gemini_model: Any = None
    ) -> None:
        super().__init__()
        self.tavily_service = tavily_service
        self.gemini_model = gemini_model

    def initialize(self) -> None:
        """
        Lazy-initialize TavilyService. gemini_model is injected at construction
        time by main.py's initialize_agent_registry() (E5: this used to re-import
        `from main import app_state` as a fallback, which never actually triggered
        since main.py always passes gemini_model in).
        """
        if not self.tavily_service:
            self.tavily_service = TavilyService()

        if not self.gemini_model:
            logger.warning("WebSearchAgent initialized without a gemini_model - result structuring will be skipped.")

    def validate(self, request: ToolRequest) -> bool:
        inp = request.input
        if not inp:
            raise ValueError("Input data is missing.")

        # Accept either 'query' or 'waste_type' for search query creation
        if "query" not in inp and "waste_type" not in inp:
            raise ValueError("Parameter 'query' or 'waste_type' is required.")

        return True

    def execute(self, request: ToolRequest) -> ToolResponse:
        start_time = time.time()
        self.initialize()

        try:
            self.validate(request)
            inp = request.input

            # 1. Prepare search query
            if "query" in inp:
                query = inp.get("query")
            else:
                waste_type = inp.get("waste_type", "").replace("_", " ")
                region = inp.get("region") or inp.get("user_region") or "India"
                query = f"current market price and buyers of {waste_type} in {region}"

            logger.info(f"WebSearchAgent searching for query: '{query}'")

            # 2. Run Tavily search
            search_response = self.tavily_service.search(query=query, max_results=5)
            if search_response.get("status") == "failed":
                raise Exception(search_response.get("error"))

            results = search_response.get("results", [])
            sources = [res.get("url") for res in results if res.get("url")]

            # 3. Structure snippets using LLM if available
            market_price = {}
            buyers = []
            
            if self.gemini_model and results:
                try:
                    # Construct prompt for structuring search results
                    snippets_text = ""
                    for i, res in enumerate(results):
                        snippets_text += f"[{i+1}] Title: {res.get('title')}\nURL: {res.get('url')}\nContent: {res.get('content')}\n\n"

                    prompt = f"""You are an agricultural data extractor. Given the following web search results about agricultural waste prices and buyers, parse the information and output ONLY a valid JSON object.
                    
                    Search Query: {query}
                    
                    Search Results:
                    {snippets_text}
                    
                    Output format MUST be exactly:
                    {{
                        "market_price": {{
                            "item_name": "estimated price string, e.g. ₹9.4/kg or ₹2500/ton"
                        }},
                        "buyers": ["buyer/factory name 1", "buyer/factory name 2"]
                    }}
                    
                    Return ONLY the raw JSON object, no markdown blocks, no explanations:"""

                    response = self.gemini_model.generate_content(prompt)
                    response_text = response.text.strip()
                    
                    # Clean markdown code blocks if any
                    if response_text.startswith("```json"):
                        response_text = response_text[7:]
                    if response_text.endswith("```"):
                        response_text = response_text[:-3]
                    response_text = response_text.strip()

                    parsed = json.loads(response_text)
                    market_price = parsed.get("market_price", {})
                    buyers = parsed.get("buyers", [])
                except Exception as ex:
                    logger.warning(f"Failed to parse search results using Gemini: {ex}")
                    # Keep empty and fallback to returning sources only

            # 4. Fallback/Standard response format
            result = {
                "market_price": market_price,
                "buyers": buyers,
                "sources": sources
            }

            execution_time = int((time.time() - start_time) * 1000)
            return self.format_response(result, "success", request, execution_time)

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"WebSearchAgent execution failed: {e}")
            return self.format_response(None, "failed", request, execution_time, error=e)

    def format_response(
        self, 
        result: Any, 
        status: str, 
        request: ToolRequest, 
        execution_time_ms: int,
        error: Any = None
    ) -> ToolResponse:
        err_obj = None
        if error:
            err_obj = ToolError(code="WEB_SEARCH_ERROR", message=str(error))
        
        return ToolResponse(
            request_id=request.request_id,
            tool_name=request.tool_name,
            status=status,
            execution_time_ms=execution_time_ms,
            result=result,
            error=err_obj
        )
