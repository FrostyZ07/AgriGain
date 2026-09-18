import re
import logging
from typing import Any, Dict, List, Optional
from backend.models.tool_models import ToolResponse

logger = logging.getLogger(__name__)

class ResponseSynthesizer:
    def __init__(self, gemini_model: Any = None) -> None:
        self.gemini_model = gemini_model

    # Unit -> multiplier to convert a price expressed "per <unit>" into a price per kg.
    _UNIT_TO_PER_KG = {
        "kg": 1.0, "kilo": 1.0, "kilos": 1.0, "kilogram": 1.0, "kilograms": 1.0,
        "ton": 1.0 / 1000.0, "tons": 1.0 / 1000.0, "tonne": 1.0 / 1000.0, "tonnes": 1.0 / 1000.0,
        "quintal": 1.0 / 100.0, "quintals": 1.0 / 100.0, "q": 1.0 / 100.0,
    }

    def _extract_price_value(self, price_str: str) -> Optional[float]:
        """
        Parse a price-per-kg float from LLM-extracted strings like '₹9.4/kg',
        '₹2500/ton', '12 per quintal'.

        C1 fix: the previous version grabbed the first number in the string with no
        unit awareness, so '₹2500/ton' (₹2.50/kg) was read as ₹2500/kg - a 1000x
        revenue error. A price with no recognizable per-unit is now rejected rather
        than assumed to be per-kg.
        """
        try:
            match = re.search(
                r"(\d+(?:\.\d+)?)\s*(?:/|per)\s*(kg|kilo|kilos|kilogram|kilograms|"
                r"ton|tons|tonne|tonnes|quintal|quintals|q)\b",
                price_str,
                re.IGNORECASE,
            )
            if not match:
                logger.warning(f"Could not determine a per-unit price from '{price_str}' - ignoring it")
                return None

            value = float(match.group(1))
            unit = match.group(2).lower()
            return value * self._UNIT_TO_PER_KG[unit]
        except Exception:
            pass
        return None

    def synthesize(
        self, 
        tool_results: Dict[str, ToolResponse], 
        total_time_ms: int,
        parallel: bool = True
    ) -> Dict[str, Any]:
        """
        Aggregates outputs from Calculator, RAG, and Web Search agents.
        Applies conflict resolution and formatting.
        """
        tools_used = list(tool_results.keys())
        
        # Extract individual tool results
        calc_res = tool_results.get("calculator")
        rag_res = tool_results.get("rag")
        search_res = tool_results.get("web_search")

        calculations = {}
        market_information = {}
        knowledge_base = {}
        recommendations = []
        citations = []
        confidence_scores = []

        # 1. Process Calculator Results
        if calc_res and calc_res.status == "success" and calc_res.result:
            calculations = calc_res.result.copy()
            confidence_scores.append(1.0)

        # 2. Process Web Search Results
        if search_res and search_res.status == "success" and search_res.result:
            market_information = search_res.result
            if "sources" in market_information:
                citations.extend(market_information["sources"])
            confidence_scores.append(0.95)

        # 3. Process RAG Results
        if rag_res and rag_res.status == "success" and rag_res.result:
            knowledge_base = rag_res.result
            if "recommendations" in knowledge_base:
                recommendations.extend(knowledge_base["recommendations"])
            if "sources" in knowledge_base:
                citations.extend(knowledge_base["sources"])
            confidence_scores.append(knowledge_base.get("confidence", 0.85))

        # 4. Conflict Resolution (Web Search Price takes precedence over static Calculator price)
        if market_information.get("market_price") and calculations.get("estimated_waste"):
            # Check if we got a real-time price string
            prices = market_information["market_price"]
            real_price = None
            for key, val in prices.items():
                parsed_val = self._extract_price_value(str(val))
                if parsed_val is not None:
                    real_price = parsed_val
                    break
            
            # C4: bound the scraped price against the curated model's implied price -
            # an ungrounded LLM extraction should not be able to override the
            # curated market_data.json numbers by an arbitrary factor.
            if real_price is not None and calculations.get("estimated_revenue") and calculations["estimated_waste"] > 0:
                curated_price_per_kg = calculations["estimated_revenue"] / calculations["estimated_waste"]
                if curated_price_per_kg > 0 and not (0.2 <= real_price / curated_price_per_kg <= 5.0):
                    logger.warning(
                        f"Rejecting scraped price ₹{real_price}/kg - more than 5x off the curated "
                        f"model price of ₹{curated_price_per_kg:.2f}/kg"
                    )
                    real_price = None

            if real_price is not None:
                logger.info(f"Conflict Resolution: Replacing static price with web search price ₹{real_price}/kg")
                # Recalculate revenue and ROI
                waste = calculations["estimated_waste"]
                new_revenue = waste * real_price
                trans_cost = calculations.get("transportation_cost", waste * 0.8)
                stor_cost = calculations.get("storage_cost", waste * 0.45)
                total_cost = trans_cost + stor_cost
                
                new_roi = 0.0
                if total_cost > 0:
                    new_roi = (new_revenue - total_cost) / total_cost

                calculations["estimated_revenue"] = round(new_revenue, 2)
                calculations["roi"] = round(new_roi, 2)
                calculations["price_resolved_from_search"] = True
                calculations["resolved_price_per_kg"] = real_price

        # 5. Synthesize Recommendations & Bullet Point deduplication
        # Add basic recommendations if list is empty
        if not recommendations:
            if calculations.get("estimated_waste"):
                recommendations.append(
                    f"You have an estimated waste quantity of {calculations['estimated_waste']} kg."
                )
            if market_information.get("buyers"):
                recommendations.append(
                    f"Potential buyers in your region include: {', '.join(market_information['buyers'])}"
                )
        else:
            # Deduplicate and clean recommendations list
            seen_recs = set()
            cleaned_recs = []
            for rec in recommendations:
                norm_rec = rec.lower().strip()
                if norm_rec not in seen_recs:
                    seen_recs.add(norm_rec)
                    cleaned_recs.append(rec)
            recommendations = cleaned_recs

        # 6. Overall Confidence Score Calculation
        overall_confidence = 0.85
        if confidence_scores:
            overall_confidence = sum(confidence_scores) / len(confidence_scores)

        # Deduplicate citations
        citations = sorted(list(set(citations)))

        # 7. Final Response JSON
        final_response = {
            "status": "success",
            "execution": {
                "tools_used": tools_used,
                "parallel": parallel,
                "execution_time_ms": total_time_ms
            },
            "recommendations": recommendations,
            "calculations": calculations,
            "market_information": market_information,
            "knowledge_base": knowledge_base,
            "citations": citations,
            "confidence_score": round(overall_confidence, 2)
        }

        return final_response
