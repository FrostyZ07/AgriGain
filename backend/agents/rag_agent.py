import logging
import time
from typing import Any, Dict, List, Optional
from backend.agents.base_agent import BaseAgent
from backend.models.tool_models import ToolRequest, ToolResponse, ToolError
from rag_service import RAGService

logger = logging.getLogger(__name__)

class RAGAgent(BaseAgent):
    def __init__(self, rag_service: Optional[RAGService] = None) -> None:
        super().__init__()
        self.rag_service = rag_service

    def initialize(self) -> None:
        """
        Verify that RAG service is initialized. If not, try to import from main.
        """
        if not self.rag_service:
            try:
                from main import app_state
                if app_state.rag_service:
                    self.rag_service = app_state.rag_service
                    logger.info("RAGAgent successfully bound to global rag_service.")
            except Exception as e:
                logger.warning(f"RAGAgent: Could not load global rag_service on init: {e}")

    def validate(self, request: ToolRequest) -> bool:
        inp = request.input
        if not inp:
            raise ValueError("Input data is missing.")
        
        # Valid inputs must contain either 'query' or 'waste_type'
        if "query" not in inp and "waste_type" not in inp:
            raise ValueError("Parameter 'query' or 'waste_type' is required.")
        
        return True

    def execute(self, request: ToolRequest) -> ToolResponse:
        start_time = time.time()
        self.initialize()
        
        if not self.rag_service:
            return self.format_response(
                None, "failed", request, 0, 
                error=ValueError("RAG Service is not initialized or configured.")
            )

        try:
            self.validate(request)
            inp = request.input

            # Option A: waste_type, total_kg, region structured lookup
            if "waste_type" in inp:
                waste_type = inp.get("waste_type")
                total_kg = float(inp.get("total_kg") or inp.get("quantity") or 100.0)
                region = inp.get("region") or inp.get("user_region") or "all"
                
                logger.info(f"RAGAgent executing waste lookup for {waste_type} ({total_kg}kg, {region})")
                rag_result = self.rag_service.get_grounded_opportunities(
                    waste_type=waste_type,
                    total_kg=total_kg,
                    region=region
                )
            else:
                # Option B: raw query fallback
                query = inp.get("query")
                logger.info(f"RAGAgent executing raw query: '{query}'")
                
                # Guess a waste type from the query text for vector search prioritization
                guessed_waste = "rice_straw"
                query_lower = query.lower()
                for wt in ["rice_straw", "rice_husks", "sugarcane_bagasse", "vegetable_trimmings", "fruit_seeds", "mixed_waste"]:
                    if wt.replace("_", " ") in query_lower or wt in query_lower:
                        guessed_waste = wt
                        break
                
                queries = [query]
                retrieved_docs = self.rag_service.query_vector_database(queries, guessed_waste)
                context = self.rag_service.build_context_string(retrieved_docs, guessed_waste)
                opp_text = self.rag_service.generate_opportunities_with_gemini(
                    context=context,
                    waste_type=guessed_waste,
                    total_kg=100.0,
                    region="all"
                )
                
                rag_result = {
                    "opportunities_text": opp_text,
                    "retrieved_documents": [
                        {
                            "id": doc["id"],
                            "source_type": doc["metadata"].get("source_type", "unknown")
                        }
                        for doc in retrieved_docs
                    ]
                }

            if "error" in rag_result and rag_result["error"]:
                raise Exception(rag_result["error"])

            # 1. Recommendations extraction
            # Split recommendations text by newlines/bullets to create a nice list
            opp_text = rag_result.get("opportunities_text", "")
            recommendations = []
            for line in opp_text.split("\n"):
                clean_line = line.strip()
                if clean_line and (clean_line.startswith("-") or clean_line.startswith("*") or clean_line[0].isdigit()):
                    # Strip bullet prefix
                    bullet_stripped = clean_line.lstrip("-*•0123456789. ")
                    if bullet_stripped:
                        recommendations.append(bullet_stripped)
            
            if not recommendations:
                # Fallback to splitting by paragraphs
                recommendations = [para.strip() for para in opp_text.split("\n\n") if para.strip()]

            # 2. Extract sources
            sources = []
            retrieved_docs = rag_result.get("retrieved_documents", [])
            for doc in retrieved_docs:
                source_id = doc.get("id", "unknown")
                source_type = doc.get("source_type", "unknown")
                sources.append(f"{source_type}:{source_id}")

            # 3. Calculate confidence score
            # Simple heuristic score based on Gemini model settings or retrieved doc count
            base_confidence = 0.85
            if len(sources) > 0:
                base_confidence = min(0.95, 0.85 + (len(sources) * 0.02))
            
            result = {
                "opportunities_text": opp_text,
                "recommendations": recommendations,
                "sources": sources,
                "confidence": round(base_confidence, 2)
            }

            execution_time = int((time.time() - start_time) * 1000)
            return self.format_response(result, "success", request, execution_time)

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"RAGAgent execution failed: {e}")
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
            err_obj = ToolError(code="RAG_AGENT_ERROR", message=str(error))
        
        return ToolResponse(
            request_id=request.request_id,
            tool_name=request.tool_name,
            status=status,
            execution_time_ms=execution_time_ms,
            result=result,
            error=err_obj
        )
