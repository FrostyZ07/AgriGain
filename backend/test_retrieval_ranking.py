#!/usr/bin/env python3
"""
Self-check for RAGService's retrieval ranking and relevance filtering (A3/A4
fixes) - no live Gemini/ChromaDB dependency, just the ranking/filtering logic
itself with synthetic distances.

Run directly: python test_retrieval_ranking.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rag_service import RAGService


class FakeCollection:
    """Returns a fixed set of (id, doc, metadata, distance) per query, ignoring
    the actual query text - just enough to drive query_vector_database()."""

    def __init__(self, rows):
        self.rows = rows

    def query(self, query_texts, n_results):
        ids = [r[0] for r in self.rows[:n_results]]
        docs = [r[1] for r in self.rows[:n_results]]
        metadatas = [r[2] for r in self.rows[:n_results]]
        distances = [r[3] for r in self.rows[:n_results]]
        return {"ids": [ids], "documents": [docs], "metadatas": [metadatas], "distances": [distances]}


def demo():
    # A4: a non-matching doc at a much better distance must outrank a matching
    # doc at a much worse distance - the old hard partition got this backwards.
    rows = [
        ("far_match", "rice husks are great", {"waste_type": "rice_husks"}, 0.85),
        ("near_other", "sugarcane bagasse notes", {"waste_type": "sugarcane_bagasse"}, 0.10),
    ]
    rs = RAGService(chroma_collection=FakeCollection(rows), embedding_model=None, gemini_api_key=None)
    results = rs.query_vector_database(["q"], waste_type="rice_husks", n_results_per_query=2)
    assert results[0]["id"] == "near_other", "a much closer non-matching doc must rank first"
    assert results[1]["id"] == "far_match"

    # A4: at a SIMILAR distance, the waste-type match should win (the boost).
    rows2 = [
        ("other", "sugarcane notes", {"waste_type": "sugarcane_bagasse"}, 0.30),
        ("match", "rice husks notes", {"waste_type": "rice_husks"}, 0.35),
    ]
    rs2 = RAGService(chroma_collection=FakeCollection(rows2), embedding_model=None, gemini_api_key=None)
    results2 = rs2.query_vector_database(["q"], waste_type="rice_husks", n_results_per_query=2)
    assert results2[0]["id"] == "match", "a matching doc at a similar distance should rank first"

    # A3: anything past MAX_RELEVANT_DISTANCE must be dropped entirely.
    rows3 = [
        ("close", "rice husks", {"waste_type": "rice_husks"}, 0.2),
        ("irrelevant", "unrelated", {"waste_type": "unrelated"}, 1.5),
    ]
    rs3 = RAGService(chroma_collection=FakeCollection(rows3), embedding_model=None, gemini_api_key=None)
    results3 = rs3.query_vector_database(["q"], waste_type="rice_husks", n_results_per_query=2)
    assert len(results3) == 1 and results3[0]["id"] == "close", "far-distance doc must be filtered out"

    # A3: an entirely out-of-domain query can legitimately come back with ZERO docs.
    rows4 = [("nothing_close", "totally unrelated content", {"waste_type": "x"}, 1.9)]
    rs4 = RAGService(chroma_collection=FakeCollection(rows4), embedding_model=None, gemini_api_key=None)
    results4 = rs4.query_vector_database(["q"], waste_type="rice_husks", n_results_per_query=1)
    assert results4 == [], "an out-of-domain query should be able to return zero results"

    print("All retrieval ranking checks passed.")


if __name__ == "__main__":
    demo()
