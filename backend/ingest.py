#!/usr/bin/env python3
"""
Agricultural Waste Knowledge Base Ingestion Pipeline

This script reads JSON knowledge base files, chunks text content from guides and safety sheets,
generates embeddings using sentence-transformers, and stores everything in a persistent ChromaDB.

Usage:
    python ingest.py

Requirements:
    - chromadb
    - sentence-transformers
    - json
    - os
    - typing
"""

import json
import os
import logging
from typing import List, Dict, Any
import chromadb
from chromadb.config import Settings
from embedding import get_embedding_function

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AgriWasteKnowledgeIngester:
    def __init__(self, data_dir: str = "data", db_path: str = "chroma_db"):
        """
        Initialize the ingester with data directory and ChromaDB path.
        
        Args:
            data_dir: Directory containing JSON knowledge base files
            db_path: Path to store persistent ChromaDB
        """
        self.data_dir = data_dir
        self.db_path = db_path
        self.embedding_model = None
        self.chroma_client = None
        self.collection = None
        
    def setup_embedding_model(self):
        """Load the shared embedding function (same one used at query time)."""
        logger.info("Loading shared embedding function: all-MiniLM-L6-v2")
        self.embedding_model = get_embedding_function()
        logger.info("Embedding function loaded successfully")

    def setup_chromadb(self):
        """Initialize ChromaDB client and collection, bound to the shared embedding function."""
        logger.info(f"Setting up ChromaDB at {self.db_path}")

        # Create the database directory if it doesn't exist
        os.makedirs(self.db_path, exist_ok=True)

        # Initialize ChromaDB client with persistent storage
        self.chroma_client = chromadb.PersistentClient(path=self.db_path)

        # Create or get collection - embedding_function must match the one used at query time (A1 fix)
        try:
            self.collection = self.chroma_client.get_collection(
                "agri_waste_knowledge", embedding_function=self.embedding_model
            )
            logger.info("Found existing collection")
        except Exception:
            self.collection = self.chroma_client.create_collection(
                name="agri_waste_knowledge",
                metadata={"description": "Agricultural waste processing knowledge base"},
                embedding_function=self.embedding_model
            )
            logger.info("Created new collection")
    
    def load_json_file(self, filename: str) -> List[Dict[Any, Any]]:
        """Load and parse a JSON file from the data directory."""
        filepath = os.path.join(self.data_dir, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            logger.info(f"Loaded {len(data)} records from {filename}")
            return data
        except FileNotFoundError:
            logger.error(f"File not found: {filepath}")
            return []
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in {filename}: {e}")
            return []
    
    def chunk_text(self, text: str, chunk_size: int = 300, overlap: int = 50) -> List[str]:
        """
        Split text into overlapping chunks for better retrieval.
        
        Args:
            text: Text to chunk
            chunk_size: Maximum number of words per chunk
            overlap: Number of words to overlap between chunks
            
        Returns:
            List of text chunks
        """
        words = text.split()
        if len(words) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(words):
            end = min(start + chunk_size, len(words))
            chunk = ' '.join(words[start:end])
            chunks.append(chunk)
            
            if end == len(words):
                break
                
            start = end - overlap
        
        return chunks
    
    def process_how_to_guides(self):
        """Process how-to guides and add to vector database."""
        logger.info("Processing how-to guides...")
        guides = self.load_json_file("how_to_guides.json")
        
        documents = []
        metadatas = []
        ids = []
        
        for guide in guides:
            # Combine all textual content
            full_text = f"Title: {guide['title']}\n"
            full_text += f"Description: {guide['description']}\n"
            full_text += f"Steps: {' '.join(guide['steps'])}\n"
            full_text += f"Materials: {' '.join(guide['materials_needed'])}"
            
            # Create chunks from the full text
            chunks = self.chunk_text(full_text)
            
            for i, chunk in enumerate(chunks):
                documents.append(chunk)
                metadatas.append({
                    "source_type": "how_to_guide",
                    "guide_id": guide["guide_id"],
                    "waste_type": guide["waste_type"],
                    "title": guide["title"],
                    "difficulty": guide["difficulty"],
                    "region": guide["region"],
                    "chunk_index": i,
                    "total_chunks": len(chunks)
                })
                ids.append(f"{guide['guide_id']}_chunk_{i}")
        
        # Generate embeddings and add to collection
        if documents:
            logger.info(f"Generating embeddings for {len(documents)} guide chunks...")
            # Let the collection's bound embedding_function embed these documents,
            # instead of encoding manually - guarantees the same embedder is used
            # here and at query time (see embedding.py).
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            logger.info(f"Added {len(documents)} guide chunks to database")
    
    def process_safety_sheets(self):
        """Process safety sheets and add to vector database."""
        logger.info("Processing safety sheets...")
        safety_data = self.load_json_file("safety_sheets.json")
        
        documents = []
        metadatas = []
        ids = []
        
        for sheet in safety_data:
            # Create chunks from safety content
            chunks = self.chunk_text(sheet['content'])
            
            for i, chunk in enumerate(chunks):
                documents.append(chunk)
                metadatas.append({
                    "source_type": "safety_sheet",
                    "sheet_id": sheet["sheet_id"],
                    "waste_type": sheet["waste_type"],
                    "source": sheet["source"],
                    "chunk_index": i,
                    "total_chunks": len(chunks)
                })
                ids.append(f"{sheet['sheet_id']}_chunk_{i}")
        
        # Generate embeddings and add to collection
        if documents:
            logger.info(f"Generating embeddings for {len(documents)} safety chunks...")
            # Let the collection's bound embedding_function embed these documents,
            # instead of encoding manually - guarantees the same embedder is used
            # here and at query time (see embedding.py).
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            logger.info(f"Added {len(documents)} safety chunks to database")
    
    def process_market_data(self):
        """Process market data and add to vector database (for market context)."""
        logger.info("Processing market data...")
        market_data = self.load_json_file("market_data.json")
        
        documents = []
        metadatas = []
        ids = []
        
        for data in market_data:
            # Create searchable text from market data
            text = f"Market data for {data['waste_type']} as {data['product_type']} "
            text += f"in {data['region']} region. Average price: ₹{data['avg_price_per_kg']:.2f} per kg. "
            text += f"Source: {data['source']}. Last updated: {data['last_updated']}"
            
            documents.append(text)
            metadatas.append({
                "source_type": "market_data",
                "data_id": data["data_id"],
                "waste_type": data["waste_type"],
                "product_type": data["product_type"],
                "region": data["region"],
                "avg_price_per_kg": data["avg_price_per_kg"],
                "source": data["source"],
                "last_updated": data["last_updated"]
            })
            ids.append(data["data_id"])
        
        # Generate embeddings and add to collection
        if documents:
            logger.info(f"Generating embeddings for {len(documents)} market data entries...")
            # Let the collection's bound embedding_function embed these documents,
            # instead of encoding manually - guarantees the same embedder is used
            # here and at query time (see embedding.py).
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            logger.info(f"Added {len(documents)} market data entries to database")
    
    def process_buyer_directory(self):
        """Process buyer directory and add to vector database."""
        logger.info("Processing buyer directory...")
        buyers = self.load_json_file("buyer_directory.json")
        
        documents = []
        metadatas = []
        ids = []
        
        for buyer in buyers:
            # Create searchable text from buyer information
            text = f"Buyer: {buyer['buyer_name']} in {buyer['region']} region. "
            text += f"Accepts waste types: {', '.join(buyer['waste_types_accepted'])}. "
            text += f"Contact: {buyer['contact_info']}"
            
            documents.append(text)
            metadatas.append({
                "source_type": "buyer_directory",
                "buyer_id": buyer["buyer_id"],
                "buyer_name": buyer["buyer_name"],
                "region": buyer["region"],
                "waste_types_accepted": ", ".join(buyer["waste_types_accepted"]),
                "contact_info": buyer["contact_info"]
            })
            ids.append(buyer["buyer_id"])
        
        # Generate embeddings and add to collection
        if documents:
            logger.info(f"Generating embeddings for {len(documents)} buyer entries...")
            # Let the collection's bound embedding_function embed these documents,
            # instead of encoding manually - guarantees the same embedder is used
            # here and at query time (see embedding.py).
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            logger.info(f"Added {len(documents)} buyer entries to database")
    
    def ingest_all(self):
        """Run the complete ingestion pipeline."""
        logger.info("Starting agricultural waste knowledge base ingestion...")
        
        # Setup components
        self.setup_embedding_model()
        self.setup_chromadb()
        
        # Clear existing collection (optional - remove if you want to append)
        try:
            self.chroma_client.delete_collection("agri_waste_knowledge")
            self.collection = self.chroma_client.create_collection(
                name="agri_waste_knowledge",
                metadata={"description": "Agricultural waste processing knowledge base"},
                embedding_function=self.embedding_model
            )
            logger.info("Cleared existing collection and created new one")
        except:
            pass  # Collection might not exist
        
        # Process all data sources
        self.process_how_to_guides()
        self.process_safety_sheets()
        self.process_market_data()
        self.process_buyer_directory()
        
        # Get collection stats
        collection_info = self.collection.count()
        logger.info(f"Ingestion complete! Total documents in collection: {collection_info}")
        
        return True
    
    def query_test(self, query: str, n_results: int = 5):
        """Test query to verify the ingestion worked correctly."""
        if not self.collection:
            logger.error("Collection not initialized")
            return None
            
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        
        logger.info(f"Test query: '{query}'")
        for i, (doc, metadata) in enumerate(zip(results['documents'][0], results['metadatas'][0])):
            logger.info(f"Result {i+1}: {metadata['source_type']} - {doc[:100]}...")
        
        return results


def main():
    """Main function to run the ingestion pipeline."""
    ingester = AgriWasteKnowledgeIngester()
    
    try:
        success = ingester.ingest_all()
        if success:
            logger.info("Knowledge base ingestion completed successfully!")
            
            # Run a test query
            ingester.query_test("rice husk briquette production")
            
        else:
            logger.error("Ingestion failed")
            
    except Exception as e:
        logger.error(f"Error during ingestion: {e}")
        raise


if __name__ == "__main__":
    main()