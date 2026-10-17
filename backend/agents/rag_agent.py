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
        No-op: rag_service is injected at construction time by main.py's
        initialize_agent_registry(). (E5: this used to re-import `from main import
        app_state` as a fallback, which never actually triggered since main.py
        always passes rag_service in - it just added a needless circular-import
        risk between the FastAPI app module and the agent layer.)
        """
        if not self.rag_service:
            logger.warning("RAGAgent initialized without a rag_service - RAG calls will fail.")

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
                # Normalize "rice straw" -> "rice_straw": the LLM caller writes
                # waste_type in natural language, but the knowledge base's
                # waste_type metadata (and CalculatorAgent's own lookup) use
                # underscores. Without this, retrieval silently finds zero
                # waste-type-specific matches for anything the model didn't
                # happen to phrase with underscores.
                waste_type = (inp.get("waste_type") or "").strip().lower().replace(" ", "_")
                # C2 fix: total_kg used to silently default to 100.0 when unknown,
                # asserting a fabricated quantity into the prompt as if it were
                # given. None now flows through to rag_service, which describes
                # it as "not specified" instead of a made-up number.
                raw_qty = inp.get("total_kg") or inp.get("quantity")
                total_kg = float(raw_qty) if raw_qty else None
                region = inp.get("region") or inp.get("user_region") or "all"

                qty_log = f"{total_kg}kg" if total_kg is not None else "unspecified quantity"
                logger.info(f"RAGAgent executing waste lookup for {waste_type} ({qty_log}, {region})")
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
                            "source_type": doc["metadata"].get("source_type", "unknown"),
                            "distance": doc.get("distance"),
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

            # 3. Calculate confidence score from the BEST (closest) match distance,
            # not the count of retrieved docs (A3 fix: the old version rewarded
            # more results with higher confidence even when every extra result
            # was irrelevant padding - and rag_service.py's own distance filtering
            # now means a genuinely unanswerable query CAN come back with zero
            # sources, so that case must be low confidence, not the old flat 0.85
            # default).
            distances = [
                doc.get("distance") for doc in retrieved_docs
                if doc.get("distance") is not None
            ]
            if not distances:
                base_confidence = 0.3
            else:
                best_distance = min(distances)
                # RAGService.MAX_RELEVANT_DISTANCE is the retrieval cutoff (A3) -
                # a match right at that cutoff is barely relevant; a near-zero
                # distance is a strong match.
                max_relevant = getattr(self.rag_service, "MAX_RELEVANT_DISTANCE", 0.9)
                base_confidence = 0.95 - (min(best_distance, max_relevant) / max_relevant) * 0.45
                base_confidence = max(0.5, min(0.95, base_confidence))
            
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
