#!/usr/bin/env python3
"""
Debug script for AI Insight endpoint - test the backend logic directly
"""

import os
import asyncio
import logging
from datetime import datetime

# Set up logging to see what's happening
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

async def test_ai_insight():
    """Test the AI insight logic directly"""
    
    # Import necessary modules  
    from main import app_state, initialize_chroma, initialize_ml_models, initialize_rag_service, load_quantification_models
    from dotenv import load_dotenv
    
    load_dotenv()
    
    print("=== AI Insight Debug Test ===\n")
    
    # Initialize all services
    print("1. Initializing services...")
    initialize_chroma()
    initialize_ml_models()
    load_quantification_models()
    initialize_rag_service()
    
    if not app_state.rag_service:
        print("❌ RAG service not initialized")
        return
        
    if not app_state.chroma_collection:
        print("❌ ChromaDB collection not available")
        return
    
    print("✅ All services initialized\n")
    
    # Test the AI insight logic directly
    print("2. Testing AI Insight logic...")
    
    question = "How do I start composting vegetable waste?"
    language = "english"
    waste_type = "vegetable_trimmings"
    
    print(f"Question: {question}")
    print(f"Language: {language}")
    print(f"Waste type: {waste_type}")
    
    # Test vector database query
    print("\n3. Testing vector database query...")
    search_queries = [
        question,
        f"{waste_type} {question}",
        f"how to {question.lower()}",
        f"{question.lower()} agricultural waste"
    ]
    
    all_results = []
    for query in search_queries[:3]:
        try:
            print(f"   Querying: '{query}'")
            results = app_state.chroma_collection.query(
                query_texts=[query],
                n_results=3
            )
            
            if results['documents'] and results['documents'][0]:
                for i, doc in enumerate(results['documents'][0]):
                    doc_id = results['ids'][0][i]
                    metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                    distance = results['distances'][0][i] if results['distances'] else 1.0
                    
                    all_results.append({
                        'id': doc_id,
                        'document': doc,
                        'metadata': metadata,
                        'distance': distance
                    })
                    
                print(f"   Found {len(results['documents'][0])} documents")
        except Exception as e:
            print(f"   Error querying '{query}': {e}")
    
    # Remove duplicates
    unique_results = {}
    for result in all_results:
        if result['id'] not in unique_results:
            unique_results[result['id']] = result
    
    sorted_results = sorted(unique_results.values(), key=lambda x: x['distance'])[:5]
    print(f"\n4. Found {len(sorted_results)} unique relevant documents")
    
    if sorted_results:
        print("   Top results:")
        for i, result in enumerate(sorted_results[:3]):
            print(f"   {i+1}. ID: {result['id']}")
            print(f"      Type: {result['metadata'].get('source_type', 'unknown')}")
            print(f"      Distance: {result['distance']:.4f}")
            print(f"      Content: {result['document'][:100]}...")
            print()
    
    # Test context building
    print("5. Building context...")
    context_parts = []
    for result in sorted_results:
        doc_text = result['document'][:500]
        context_parts.append(doc_text)
    
    context = "\n\n".join(context_parts)
    print(f"   Context length: {len(context)} characters")
    print(f"   Context preview: {context[:200]}...")
    
    # Test Gemini API directly
    print("\n6. Testing Gemini API...")
    if app_state.rag_service.model:
        try:
            test_prompt = f"""You are an expert agricultural consultant. Answer the user's question using the provided context.

User's Question: {question}
Waste Type: {waste_type}

Context:
{context}

Provide a clear, practical answer."""
            
            print("   Sending request to Gemini...")
            response = app_state.rag_service.model.generate_content(
                test_prompt,
                generation_config=app_state.rag_service.genai.types.GenerationConfig(
                    temperature=0.4,
                    max_output_tokens=1000
                )
            )
            
            if response.text:
                print(f"   ✅ Gemini response received: {len(response.text)} characters")
                print(f"   Preview: {response.text[:200]}...")
            else:
                print("   ❌ Gemini returned empty response")
                
        except Exception as e:
            print(f"   ❌ Gemini API error: {e}")
    else:
        print("   ❌ Gemini model not available")

if __name__ == "__main__":
    asyncio.run(test_ai_insight())