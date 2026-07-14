import os
import time
import logging
from typing import Dict, Any, List, Optional
from tavily import TavilyClient

logger = logging.getLogger(__name__)

class TavilyService:
    def __init__(self, api_key: Optional[str] = None) -> None:
        """
        Initialize the Tavily Service.
        """
        self.api_key = api_key or os.getenv("TAVILY_API_KEY")
        self.client = None
        if self.api_key:
            try:
                self.client = TavilyClient(api_key=self.api_key)
                logger.info("Tavily client initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize Tavily Client: {e}")
        else:
            logger.warning("TAVILY_API_KEY not found in environment. Web Search Agent will run in mock/disabled mode.")

    def search(self, query: str, max_results: int = 5, retries: int = 2) -> Dict[str, Any]:
        """
        Execute search query via Tavily Search API with transient failure retry logic.
        """
        if not self.client:
            raise ValueError("Tavily client not initialized. Check TAVILY_API_KEY environment variable.")

        delay = 1.0
        for attempt in range(1, retries + 1):
            try:
                logger.info(f"Executing search: '{query}' (attempt {attempt}/{retries})")
                # Execute query using the official SDK
                response = self.client.search(query=query, max_results=max_results)
                # Ensure we have a structured output
                return {
                    "status": "success",
                    "results": response.get("results", []),
                    "query": query
                }
            except Exception as e:
                logger.error(f"Tavily search attempt {attempt} failed: {e}")
                if attempt == retries:
                    return {
                        "status": "failed",
                        "error": str(e),
                        "query": query
                    }
                time.sleep(delay)
                delay *= 2.0

        return {
            "status": "failed",
            "error": "Unknown error in search execution",
            "query": query
        }
