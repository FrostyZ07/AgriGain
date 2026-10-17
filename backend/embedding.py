#!/usr/bin/env python3
"""
Shared embedding function for ChromaDB.

Both ingestion (ingest.py) and query time (main.py, rag_service.py) MUST use the
exact same embedding function bound to the collection. Previously ingest.py encoded
documents with a manually-loaded SentenceTransformer while every query path called
`collection.query(query_texts=...)` against a collection with no embedding_function
set — so Chroma silently embedded queries with its own default ONNX model instead.
Same model family, different runtime: degraded retrieval with no error, and a
outright break the day either side changes. Binding this one function to the
collection on both the add and query side closes that gap by construction.
"""
import logging
from chromadb.utils import embedding_functions

logger = logging.getLogger(__name__)

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

_embedding_function = None


def get_embedding_function():
    """Return the process-wide shared SentenceTransformer embedding function."""
    global _embedding_function
    if _embedding_function is None:
        logger.info(f"Loading shared embedding function: {EMBEDDING_MODEL_NAME}")
        _embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=EMBEDDING_MODEL_NAME
        )
    return _embedding_function
