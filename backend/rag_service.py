#!/usr/bin/env python3
"""
RAG (Retrieval Augmented Generation) Service for Agricultural Waste Opportunities

This module implements the core RAG functionality to generate actionable opportunities
from agricultural waste data using vector database retrieval and Google Gemini LLM.
"""

import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

logger = logging.getLogger(__name__)

class RAGService:
    """Service for generating grounded agricultural waste opportunities using RAG"""
    
    def __init__(self, chroma_collection, embedding_model, gemini_api_key: Optional[str] = None):
        """Initialize the RAG service."""
        self.chroma_collection = chroma_collection
        self.embedding_model = embedding_model
        
        # Initialize Gemini
        api_key = gemini_api_key or os.getenv('GEMINI_API_KEY')
        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model_name = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')
                self.model = genai.GenerativeModel(model_name)
                self.genai = genai
                logger.info(f"Gemini API initialized successfully (model: {model_name})")
            except ImportError:
                self.model = None
                self.genai = None
                logger.warning("google-generativeai not installed - LLM generation disabled")
        else:
            self.model = None
            self.genai = None
            logger.warning("Gemini API key not found - LLM generation disabled")
    
    def generate_search_queries(self, waste_type: str, total_kg: float, region: str) -> List[str]:
        """Generate highly specific search queries focused on the exact waste type (optimized for speed)."""
        # Primary waste-type specific queries (highest priority) - reduced count
        exact_type_queries = [
            f"{waste_type} processing methods",
            f"{waste_type} business opportunities",
            f"{waste_type} value addition techniques",
            f"how to monetize {waste_type}"
        ]
        
        # Specific product/application queries for this waste type - reduced
        application_queries = [
            f"{waste_type} products manufacturing",
            f"{waste_type} direct uses"
        ]
        
        # Market and buyer queries specific to waste type
        if region and region != "all":
            market_queries = [
                f"{waste_type} buyers {region}",
                f"{waste_type} market price {region}"
            ]
        else:
            market_queries = [
                f"{waste_type} buyers",
                f"{waste_type} market price"
            ]
        
        # Quantity-specific opportunities - only if significant
        scale_queries = []
        if total_kg > 500:
            scale_queries = [
                f"large scale {waste_type} business",
                f"commercial {waste_type} processing"
            ]
        elif total_kg > 100:
            scale_queries = [
                f"medium scale {waste_type} ventures"
            ]
        else:
            scale_queries = [
                f"small scale {waste_type} opportunities"
            ]
        
        # Combine queries - limit total to speed up processing
        all_queries = exact_type_queries + application_queries + scale_queries + market_queries
        # Limit to top 10 queries for faster processing
        return all_queries[:10]
    
    def query_vector_database(self, queries: List[str], waste_type: str, n_results_per_query: int = 2, max_total_results: int = 12) -> List[Dict[str, Any]]:
        """Query the ChromaDB vector database with multiple queries, prioritizing waste-type specific results."""
        if not self.chroma_collection:
            logger.error("ChromaDB collection not available")
            return []
        
        all_results = []
        waste_type_results = []  # Priority results matching exact waste type
        other_results = []       # Other relevant results
        seen_ids = set()
        
        try:
            for query in queries:
                if len(all_results) >= max_total_results:
                    break
                    
                results = self.chroma_collection.query(
                    query_texts=[query],
                    n_results=n_results_per_query
                )
                
                if results['documents'] and results['documents'][0]:
                    for i, doc in enumerate(results['documents'][0]):
                        doc_id = results['ids'][0][i]
                        
                        if doc_id in seen_ids:
                            continue
                        
                        seen_ids.add(doc_id)
                        metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                        
                        result_item = {
                            'id': doc_id,
                            'document': doc,
                            'metadata': metadata,
                            'distance': results['distances'][0][i] if results['distances'] else None,
                            'query': query
                        }
                        
                        # Prioritize results that specifically mention the waste type
                        doc_waste_type = metadata.get('waste_type', '')
                        if (doc_waste_type == waste_type or 
                            waste_type.replace('_', ' ') in doc.lower() or
                            waste_type in doc.lower()):
                            waste_type_results.append(result_item)
                        else:
                            other_results.append(result_item)
                        
                        if len(waste_type_results) + len(other_results) >= max_total_results:
                            break
            
            # Combine results with waste-type specific ones first
            all_results = waste_type_results + other_results[:max_total_results - len(waste_type_results)]
            
            logger.info(f"Retrieved {len(all_results)} documents ({len(waste_type_results)} waste-type specific, {len(other_results)} general)")
            return all_results
            
        except Exception as e:
            logger.error(f"Error querying vector database: {e}")
            return []
    
    def build_context_string(self, retrieved_docs: List[Dict[str, Any]], waste_type: str, max_context_length: int = 4000) -> str:
        """Build a waste-type focused context string from retrieved documents."""
        if not retrieved_docs:
            return f"No relevant information found in the knowledge base for {waste_type.replace('_', ' ')}."
        
        context_parts = []
        current_length = 0
        
        # Separate waste-type specific docs from general docs
        specific_docs = []
        general_docs = []
        
        for doc in retrieved_docs:
            metadata = doc.get('metadata', {})
            doc_text = doc.get('document', '')
            doc_waste_type = metadata.get('waste_type', '')
            
            # Check if document is specifically about this waste type
            is_specific = (
                doc_waste_type == waste_type or
                waste_type.replace('_', ' ') in doc_text.lower() or
                waste_type in doc_text.lower()
            )
            
            if is_specific:
                specific_docs.append(doc)
            else:
                general_docs.append(doc)
        
        # Group specific documents by source type
        specific_groups = {
            'how_to_guide': [],
            'market_data': [],
            'buyer_directory': [],
            'safety_sheet': []
        }
        
        for doc in specific_docs:
            source_type = doc['metadata'].get('source_type', 'unknown')
            if source_type in specific_groups:
                specific_groups[source_type].append(doc)
        
        # Prioritize specific information first
        sections = [
            (f'{waste_type.replace("_", " ").title()} Processing Methods', specific_groups['how_to_guide']),
            (f'{waste_type.replace("_", " ").title()} Market Information', specific_groups['market_data']),
            (f'{waste_type.replace("_", " ").title()} Buyers & Contacts', specific_groups['buyer_directory']),
            (f'{waste_type.replace("_", " ").title()} Safety Guidelines', specific_groups['safety_sheet'])
        ]
        
        for section_name, docs in sections:
            if not docs or current_length >= max_context_length * 0.8:  # Reserve space for summary
                continue
            
            section_text = f"\n\n--- {section_name} ---\n"
            
            for i, doc in enumerate(docs[:3]):  # Limit to 3 docs per section
                doc_text = doc['document']
                
                remaining_space = int(max_context_length * 0.8) - current_length - len(section_text)
                if remaining_space <= 100:
                    break
                
                if len(doc_text) > remaining_space:
                    doc_text = doc_text[:remaining_space-10] + "..."
                
                section_text += f"{i+1}. {doc_text}\n"
            
            if len(section_text) > 50:  # Only add section if it has content
                context_parts.append(section_text)
                current_length += len(section_text)
        
        # Add a summary note about the focus
        if context_parts:
            focus_note = f"\n\n--- Important Note ---\nThe above information is specifically for {waste_type.replace('_', ' ')} processing and monetization. Ignore any general agricultural waste advice that doesn't specifically apply to {waste_type.replace('_', ' ')}.\n"
            context_parts.insert(0, focus_note)
        
        context = "".join(context_parts)
        
        if len(context) > max_context_length:
            context = context[:max_context_length-100] + "... [truncated for length]"
        
        logger.debug(f"Built waste-type focused context string of {len(context)} characters for {waste_type}")
        return context
    
    def generate_opportunities_with_gemini(self, context: str, waste_type: str, total_kg: float, region: str, timeout_seconds: int = 45) -> str:
        """Generate opportunities using Google Gemini with the provided context and timeout."""
        if not self.model:
            return "AI generation unavailable - Gemini API not configured"
        
        # Truncate context if too long to avoid timeouts
        max_context_length = 3500  # Reduced from 4000 for faster processing
        if len(context) > max_context_length:
            context = context[:max_context_length] + "... [context truncated for performance]"
            logger.warning(f"Context truncated to {max_context_length} characters")
        
        system_prompt = f"""You are Agri-Gain, an expert AI assistant specializing in {waste_type.replace('_', ' ')} waste monetization. Provide concise, actionable advice ONLY for {waste_type.replace('_', ' ')}.

CRITICAL: Use ONLY the provided context. Focus EXCLUSIVELY on {waste_type.replace('_', ' ')}.

Structure into three categories:
1. On-Farm Use: Direct applications on farm
2. Local Sale: Selling to nearby buyers
3. Process & Sell: Value-added processing

For each opportunity, provide: steps, difficulty, revenue estimates (if in context), safety notes, equipment needed."""
        
        user_prompt = f"""I have {total_kg} kg of {waste_type.replace('_', ' ')} in {region}.

Context:
{context}

Provide specific opportunities in the three categories above."""
        
        try:
            # Use ThreadPoolExecutor to add timeout to synchronous Gemini call
            def call_gemini():
                response = self.model.generate_content(
                    f"{system_prompt}\n\n{user_prompt}",
                    generation_config=self.genai.types.GenerationConfig(
                        temperature=0.3,
                        max_output_tokens=1200,  # Reduced from 1500 for faster generation
                        top_p=0.9
                    )
                )
                return response.text if response.text else None
            
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(call_gemini)
                try:
                    result = future.result(timeout=timeout_seconds)
                    if result:
                        logger.info(f"Generated {len(result)} characters of opportunities text")
                        return result
                    else:
                        logger.warning("Gemini returned empty response")
                        return "Unable to generate opportunities - please try again"
                except FutureTimeoutError:
                    logger.error(f"Gemini API call timed out after {timeout_seconds} seconds")
                    future.cancel()
                    return f"AI generation timed out. The system is processing a large request. Please try again or contact support."
                
        except Exception as e:
            logger.error(f"Error generating opportunities with Gemini: {e}")
            return f"Error generating opportunities: {str(e)}"
    
    def get_grounded_opportunities(self, waste_type: str, total_kg: float, region: str) -> Dict[str, Any]:
        """Main method to get grounded opportunities using the complete RAG pipeline."""
        logger.info(f"Generating opportunities for {total_kg}kg of {waste_type} in {region}")
        
        start_time = datetime.now()
        
        try:
            # Step 1: Generate search queries
            queries = self.generate_search_queries(waste_type, total_kg, region)
            
            # Step 2: Query vector database
            retrieved_docs = self.query_vector_database(queries, waste_type)
            
            if not retrieved_docs:
                return {
                    "opportunities_text": "No relevant information found in our knowledge base for this type of waste. Please check the waste type or contact support for assistance.",
                    "sources_used": 0,
                    "processing_time_ms": int((datetime.now() - start_time).total_seconds() * 1000),
                    "error": "No relevant documents retrieved"
                }
            
            # Step 3: Build context
            context = self.build_context_string(retrieved_docs, waste_type)
            
            # Step 4: Generate opportunities
            opportunities_text = self.generate_opportunities_with_gemini(
                context, waste_type, total_kg, region
            )
            
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            return {
                "opportunities_text": opportunities_text,
                "sources_used": len(retrieved_docs),
                "processing_time_ms": processing_time,
                "context_length": len(context),
                "queries_generated": len(queries),
                "retrieved_documents": [
                    {
                        "id": doc["id"],
                        "source_type": doc["metadata"].get("source_type", "unknown"),
                        "relevance_query": doc["query"]
                    }
                    for doc in retrieved_docs
                ]
            }
            
        except Exception as e:
            logger.error(f"Error in RAG pipeline: {e}")
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            return {
                "opportunities_text": f"An error occurred while generating opportunities: {str(e)}",
                "sources_used": 0,
                "processing_time_ms": processing_time,
                "error": str(e)
            }


def create_rag_service(chroma_collection, embedding_model, gemini_api_key: Optional[str] = None) -> RAGService:
    """Factory function to create a RAG service instance."""
    return RAGService(chroma_collection, embedding_model, gemini_api_key)


if __name__ == "__main__":
    print("RAG Service for Agricultural Waste Opportunities")
    print("=" * 50)
    print("Note: This module requires ChromaDB collection and embedding model to run")