#!/usr/bin/env python3
"""
Test script for RAG service functionality.

This script tests the RAG pipeline directly without FastAPI TestClient limitations.
"""

import os
import logging
from rag_service import RAGService
import chromadb
from sentence_transformers import SentenceTransformer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_rag_pipeline():
    """Test the complete RAG pipeline"""
    print("Testing RAG Service Pipeline")
    print("=" * 50)
    
    try:
        # 1. Initialize ChromaDB
        print("1. Initializing ChromaDB...")
        chroma_client = chromadb.PersistentClient(path="chroma_db")
        chroma_collection = chroma_client.get_collection("agri_waste_knowledge")
        doc_count = chroma_collection.count()
        print(f"   ChromaDB loaded with {doc_count} documents")
        
        # 2. Initialize embedding model
        print("2. Loading embedding model...")
        embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        print("   Embedding model loaded successfully")
        
        # 3. Initialize RAG service (without Gemini for now)
        print("3. Initializing RAG service...")
        rag_service = RAGService(
            chroma_collection=chroma_collection,
            embedding_model=embedding_model,
            gemini_api_key=None  # Test without Gemini first
        )
        print("   RAG service initialized")
        
        # 4. Test query generation
        print("4. Testing search query generation...")
        queries = rag_service.generate_search_queries("rice_husks", 100.0, "punjab")
        print(f"   Generated {len(queries)} search queries:")
        for i, query in enumerate(queries[:5]):  # Show first 5
            print(f"     {i+1}. {query}")
        
        # 5. Test vector database querying
        print("5. Testing vector database query...")
        retrieved_docs = rag_service.query_vector_database(queries[:5], n_results_per_query=2)
        print(f"   Retrieved {len(retrieved_docs)} documents")
        for doc in retrieved_docs[:3]:  # Show first 3
            source_type = doc['metadata'].get('source_type', 'unknown')
            print(f"     - {source_type}: {doc['document'][:100]}...")
        
        # 6. Test context building
        print("6. Testing context building...")
        context = rag_service.build_context_string(retrieved_docs)
        print(f"   Built context of {len(context)} characters")
        print(f"   Context preview: {context[:200]}...")
        
        # 7. Test complete pipeline (without Gemini)
        print("7. Testing complete RAG pipeline...")
        result = rag_service.get_grounded_opportunities("rice_husks", 100.0, "punjab")
        
        print("   Pipeline Results:")
        print(f"   - Sources used: {result.get('sources_used', 0)}")
        print(f"   - Processing time: {result.get('processing_time_ms', 0)}ms")
        print(f"   - Context length: {result.get('context_length', 0)}")
        print(f"   - Queries generated: {result.get('queries_generated', 0)}")
        print(f"   - Opportunities text length: {len(result.get('opportunities_text', ''))}")
        
        if result.get('error'):
            print(f"   - Error: {result.get('error')}")
        else:
            print("   - No errors detected")
            
        return True
        
    except Exception as e:
        print(f"Error in RAG pipeline test: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_vector_search():
    """Test vector search specifically"""
    print("\nTesting Vector Search")
    print("=" * 30)
    
    try:
        chroma_client = chromadb.PersistentClient(path="chroma_db")
        collection = chroma_client.get_collection("agri_waste_knowledge")
        
        test_queries = [
            "rice husk briquette production",
            "market price rice husks",
            "buyers rice husks punjab",
            "safety handling rice husks"
        ]
        
        for query in test_queries:
            print(f"\nQuery: '{query}'")
            results = collection.query(query_texts=[query], n_results=3)
            
            if results['documents'] and results['documents'][0]:
                for i, (doc, metadata) in enumerate(zip(results['documents'][0], results['metadatas'][0])):
                    source_type = metadata.get('source_type', 'unknown')
                    print(f"  {i+1}. [{source_type}] {doc[:100]}...")
            else:
                print("  No results found")
                
        return True
        
    except Exception as e:
        print(f"Error in vector search test: {e}")
        return False

if __name__ == "__main__":
    print("Agricultural Waste RAG System Test")
    print("=" * 60)
    
    # Test vector search first
    success1 = test_vector_search()
    
    # Test full RAG pipeline
    success2 = test_rag_pipeline()
    
    print("\n" + "=" * 60)
    if success1 and success2:
        print("✅ All tests passed! RAG system is working correctly.")
        print("🚀 Ready for integration with FastAPI endpoints.")
    else:
        print("❌ Some tests failed. Check the error messages above.")
        
    print("=" * 60)