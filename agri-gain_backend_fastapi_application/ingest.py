#!/usr/bin/env python3
"""
Vector Database Ingestion Pipeline for Agri-Gain Knowledge Base

This script reads JSON files containing agricultural knowledge and ingests them
into a ChromaDB vector database for use in the RAG system.
"""

import json
import os
import logging
from typing import List, Dict, Any
import chromadb
from sentence_transformers import SentenceTransformer
import argparse

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class KnowledgeBaseIngester:
    """Handles ingestion of knowledge base data into ChromaDB"""
    
    def __init__(self, db_path: str = "./chroma_db"):
        self.db_path = db_path
        self.client = None
        self.collection = None
        self.embedding_model = None
        
    def initialize(self):
        """Initialize ChromaDB and embedding model"""
        try:
            # Initialize ChromaDB client
            self.client = chromadb.PersistentClient(path=self.db_path)
            
            # Create or get collection
            try:
                self.collection = self.client.get_collection("agri_knowledge")
                logger.info("Found existing collection, will update it")
            except:
                self.collection = self.client.create_collection("agri_knowledge")
                logger.info("Created new collection")
            
            # Initialize embedding model
            logger.info("Loading sentence transformer model...")
            self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("Embedding model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize ingester: {e}")
            raise
    
    def chunk_text(self, text: str, max_chunk_size: int = 500) -> List[str]:
        """Split text into chunks for better retrieval"""
        sentences = text.split('. ')
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) < max_chunk_size:
                current_chunk += sentence + ". "
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence + ". "
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks if chunks else [text]
    
    def ingest_how_to_guides(self, file_path: str):
        """Ingest how-to guides from JSON file"""
        try:
            with open(file_path, 'r') as f:
                guides = json.load(f)
            
            documents = []
            metadatas = []
            ids = []
            
            for guide in guides:
                # Create comprehensive content for each guide
                content_parts = [
                    f"Title: {guide['title']}",
                    f"Description: {guide['description']}",
                    f"Waste Type: {guide['waste_type']}",
                    f"Difficulty: {guide['difficulty']}",
                    f"Region: {guide['region']}",
                    "Steps: " + " ".join([f"Step {i+1}: {step}" for i, step in enumerate(guide['steps'])]),
                    "Materials needed: " + ", ".join(guide['materials_needed'])
                ]
                
                full_content = "\n".join(content_parts)
                
                # Chunk the content
                chunks = self.chunk_text(full_content)
                
                for i, chunk in enumerate(chunks):
                    documents.append(chunk)
                    metadatas.append({
                        "source_type": "how_to_guide",
                        "guide_id": guide["guide_id"],
                        "waste_type": guide["waste_type"],
                        "region": guide["region"],
                        "difficulty": guide["difficulty"],
                        "title": guide["title"],
                        "chunk_index": i
                    })
                    ids.append(f"guide_{guide['guide_id']}_chunk_{i}")
            
            if documents:
                self.collection.add(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
                logger.info(f"Ingested {len(documents)} chunks from {len(guides)} how-to guides")
            
        except FileNotFoundError:
            logger.warning(f"How-to guides file not found: {file_path}")
        except Exception as e:
            logger.error(f"Error ingesting how-to guides: {e}")
    
    def ingest_safety_sheets(self, file_path: str):
        """Ingest safety sheets from JSON file"""
        try:
            with open(file_path, 'r') as f:
                sheets = json.load(f)
            
            documents = []
            metadatas = []
            ids = []
            
            for sheet in sheets:
                # Chunk the safety content
                chunks = self.chunk_text(sheet["content"])
                
                for i, chunk in enumerate(chunks):
                    documents.append(chunk)
                    metadatas.append({
                        "source_type": "safety_sheet",
                        "sheet_id": sheet["sheet_id"],
                        "waste_type": sheet["waste_type"],
                        "source": sheet["source"],
                        "chunk_index": i
                    })
                    ids.append(f"safety_{sheet['sheet_id']}_chunk_{i}")
            
            if documents:
                self.collection.add(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
                logger.info(f"Ingested {len(documents)} chunks from {len(sheets)} safety sheets")
            
        except FileNotFoundError:
            logger.warning(f"Safety sheets file not found: {file_path}")
        except Exception as e:
            logger.error(f"Error ingesting safety sheets: {e}")
    
    def ingest_market_data(self, file_path: str):
        """Ingest market data from JSON file"""
        try:
            with open(file_path, 'r') as f:
                market_data = json.load(f)
            
            documents = []
            metadatas = []
            ids = []
            
            for data in market_data:
                # Create searchable content for market data
                content = f"Market information for {data['waste_type']} in {data['region']} region. "
                content += f"Product type: {data['product_type']}. "
                content += f"Average price: ${data['avg_price_per_kg']:.2f} per kilogram. "
                content += f"Data source: {data['source']}. "
                content += f"Last updated: {data['last_updated']}."
                
                documents.append(content)
                metadatas.append({
                    "source_type": "market_data",
                    "data_id": data["data_id"],
                    "waste_type": data["waste_type"],
                    "product_type": data["product_type"],
                    "region": data["region"],
                    "price_per_kg": data["avg_price_per_kg"],
                    "source": data["source"],
                    "last_updated": data["last_updated"]
                })
                ids.append(f"market_{data['data_id']}")
            
            if documents:
                self.collection.add(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
                logger.info(f"Ingested {len(documents)} market data entries")
            
        except FileNotFoundError:
            logger.warning(f"Market data file not found: {file_path}")
        except Exception as e:
            logger.error(f"Error ingesting market data: {e}")
    
    def ingest_buyer_directory(self, file_path: str):
        """Ingest buyer directory from JSON file"""
        try:
            with open(file_path, 'r') as f:
                buyers = json.load(f)
            
            documents = []
            metadatas = []
            ids = []
            
            for buyer in buyers:
                # Create searchable content for buyers
                content = f"Buyer: {buyer['buyer_name']} in {buyer['region']} region. "
                content += f"Accepts waste types: {', '.join(buyer['waste_types_accepted'])}. "
                content += f"Contact information: {buyer['contact_info']}."
                
                documents.append(content)
                metadatas.append({
                    "source_type": "buyer_directory",
                    "buyer_id": buyer["buyer_id"],
                    "buyer_name": buyer["buyer_name"],
                    "region": buyer["region"],
                    "waste_types_accepted": buyer["waste_types_accepted"],
                    "contact_info": buyer["contact_info"]
                })
                ids.append(f"buyer_{buyer['buyer_id']}")
            
            if documents:
                self.collection.add(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
                logger.info(f"Ingested {len(documents)} buyer directory entries")
            
        except FileNotFoundError:
            logger.warning(f"Buyer directory file not found: {file_path}")
        except Exception as e:
            logger.error(f"Error ingesting buyer directory: {e}")
    
    def ingest_all(self, data_dir: str = "data"):
        """Ingest all knowledge base files"""
        logger.info("Starting knowledge base ingestion...")
        
        # Define file paths
        files_to_ingest = [
            ("how_to_guides.json", self.ingest_how_to_guides),
            ("safety_sheets.json", self.ingest_safety_sheets),
            ("market_data.json", self.ingest_market_data),
            ("buyer_directory.json", self.ingest_buyer_directory)
        ]
        
        for filename, ingest_method in files_to_ingest:
            file_path = os.path.join(data_dir, filename)
            logger.info(f"Processing {filename}...")
            ingest_method(file_path)
        
        # Get collection stats
        try:
            count = self.collection.count()
            logger.info(f"Ingestion complete. Total documents in collection: {count}")
        except Exception as e:
            logger.warning(f"Could not get collection count: {e}")
    
    def clear_collection(self):
        """Clear all data from the collection"""
        try:
            # Delete the collection and recreate it
            self.client.delete_collection("agri_knowledge")
            self.collection = self.client.create_collection("agri_knowledge")
            logger.info("Collection cleared successfully")
        except Exception as e:
            logger.error(f"Error clearing collection: {e}")

def main():
    """Main function to run the ingestion pipeline"""
    parser = argparse.ArgumentParser(description="Ingest knowledge base data into ChromaDB")
    parser.add_argument("--data-dir", default="data", help="Directory containing JSON data files")
    parser.add_argument("--db-path", default="./chroma_db", help="Path to ChromaDB database")
    parser.add_argument("--clear", action="store_true", help="Clear existing data before ingesting")
    
    args = parser.parse_args()
    
    try:
        # Initialize ingester
        ingester = KnowledgeBaseIngester(db_path=args.db_path)
        ingester.initialize()
        
        # Clear collection if requested
        if args.clear:
            logger.info("Clearing existing collection...")
            ingester.clear_collection()
        
        # Ingest all data
        ingester.ingest_all(data_dir=args.data_dir)
        
        logger.info("Ingestion pipeline completed successfully!")
        
    except Exception as e:
        logger.error(f"Ingestion pipeline failed: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
