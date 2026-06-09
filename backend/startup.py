#!/usr/bin/env python3
"""
Cloud Run Startup Script for Agricultural Waste Backend

This script handles initialization tasks for Google Cloud Run deployment:
- Downloads knowledge base data from Google Cloud Storage (if needed)
- Initializes ChromaDB with embeddings
- Sets up required directories and files

Run this before starting the main application in Cloud Run environment.
"""

import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def ensure_data_directory():
    """Ensure data directory exists with required files"""
    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)
    
    # Check if all required data files exist
    required_files = [
        "how_to_guides.json",
        "market_data.json", 
        "buyer_directory.json",
        "quantification_models.json",
        "safety_sheets.json"
    ]
    
    missing_files = []
    for filename in required_files:
        filepath = data_dir / filename
        if not filepath.exists():
            missing_files.append(filename)
    
    if missing_files:
        logger.warning(f"Missing data files: {missing_files}")
        logger.info("Data files should be included in the Docker image or downloaded from Cloud Storage")
        return False
    
    logger.info("All required data files found")
    return True


def ensure_chroma_directory():
    """Ensure ChromaDB directory exists"""
    chroma_dir = Path("chroma_db")
    chroma_dir.mkdir(exist_ok=True)
    logger.info("ChromaDB directory ready")
    return True


def initialize_chroma_if_empty():
    """Initialize ChromaDB if it's empty"""
    try:
        import chromadb
        from sentence_transformers import SentenceTransformer
        
        chroma_client = chromadb.PersistentClient(path="chroma_db")
        
        # Try to get existing collection
        try:
            collection = chroma_client.get_collection("agri_waste_knowledge")
            doc_count = collection.count()
            
            if doc_count > 0:
                logger.info(f"ChromaDB already initialized with {doc_count} documents")
                return True
            else:
                logger.info("ChromaDB collection exists but is empty - reinitializing")
                
        except Exception:
            logger.info("ChromaDB collection doesn't exist - creating new one")
        
        # If we reach here, we need to initialize ChromaDB
        logger.info("Initializing ChromaDB with knowledge base data...")
        
        # Import and run the ingestion script
        from ingest import main as ingest_main
        success = ingest_main()
        
        if success:
            logger.info("✅ ChromaDB initialized successfully")
            return True
        else:
            logger.error("❌ Failed to initialize ChromaDB")
            return False
            
    except Exception as e:
        logger.error(f"Error initializing ChromaDB: {e}")
        return False


def download_from_gcs_if_needed():
    """Download data from Google Cloud Storage if running in Cloud Run"""
    # Check if we're running in Cloud Run
    if not os.getenv('K_SERVICE'):
        logger.info("Not running in Cloud Run - skipping GCS download")
        return True
    
    # Check if data already exists
    if ensure_data_directory():
        logger.info("Data files already exist - skipping download")
        return True
    
    # This would download data from GCS if needed
    # For now, we assume data is baked into the Docker image
    logger.info("GCS download logic would go here if data files are stored remotely")
    return True


def main():
    """Main startup initialization"""
    logger.info("🚀 Starting Agricultural Waste Backend initialization...")
    
    # Step 1: Ensure directories exist
    logger.info("📁 Setting up directories...")
    ensure_data_directory()
    ensure_chroma_directory()
    
    # Step 2: Download data if needed (for Cloud Run)
    logger.info("📥 Checking for data download needs...")
    if not download_from_gcs_if_needed():
        logger.error("Failed to download required data")
        return False
    
    # Step 3: Initialize ChromaDB if empty
    logger.info("🗄️ Initializing vector database...")
    if not initialize_chroma_if_empty():
        logger.error("Failed to initialize ChromaDB")
        return False
    
    logger.info("✅ Initialization completed successfully!")
    return True


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)