#!/usr/bin/env python3
"""
Self-check for evaluate_rag.py's groundedness metric (F1) - no live
Gemini/ChromaDB dependency.

Run directly: python test_groundedness.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evaluate_rag import RAGEvaluator


def demo():
    evaluator = RAGEvaluator(rag_service=None)

    context = "Buyer: ABC Biofuels in Punjab region. Average price ₹9.4/kg. Contact: 9876543210."

    # Fully grounded response - everything it claims is in the context.
    grounded_text = "Potential Buyers: ABC Biofuels\nEstimated Revenue: ₹9.4/kg\nContact: 9876543210"
    result = evaluator.check_groundedness(grounded_text, context)
    assert result["groundedness_score"] == 1.0, result
    assert result["ungrounded_claims"] == []

    # Hallucinated buyer + price not present anywhere in the context.
    hallucinated_text = "Potential Buyers: XYZ Traders Pvt Ltd\nEstimated Revenue: ₹2500/ton"
    result2 = evaluator.check_groundedness(hallucinated_text, context)
    assert result2["groundedness_score"] == 0.0, result2
    assert "XYZ Traders Pvt Ltd" in result2["ungrounded_claims"]
    assert any("2500" in c for c in result2["ungrounded_claims"])

    # A response that correctly declines (no buyer/price claims at all) must be
    # vacuously grounded - it invented nothing, so it must not be penalized.
    declined_text = (
        "Opportunity: No suitable opportunity found in the provided knowledge base.\n"
        "Buyer information not available in the provided knowledge base."
    )
    result3 = evaluator.check_groundedness(declined_text, context)
    assert result3["groundedness_score"] == 1.0, result3
    assert result3["total_claims"] == 0

    # Mixed: one grounded claim, one hallucinated -> exactly 0.5.
    mixed_text = "Potential Buyers: ABC Biofuels, Fake Buyer Co"
    result4 = evaluator.check_groundedness(mixed_text, context)
    assert result4["total_claims"] == 2
    assert result4["grounded_claims"] == 1
    assert result4["groundedness_score"] == 0.5

    print("All groundedness checks passed.")


if __name__ == "__main__":
    demo()
