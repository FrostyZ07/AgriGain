from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore
import json
from datetime import datetime
from typing import Dict, Any
import logging

from models import WasteLogRequest, WasteLogResponse, OpportunitiesRequest
from quantify import QuantificationService
from rag_service import RAGService

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global services
quantification_service = None
rag_service = None
db = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup"""
    global quantification_service, rag_service, db
    
    try:
        # Initialize Firebase
        if not firebase_admin._apps:
            # In production, use service account key from environment
            if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
                cred = credentials.ApplicationDefault()
            else:
                # For local development, use a service account key file
                cred = credentials.Certificate("firebase-service-account.json")
            
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        logger.info("Firebase initialized successfully")
        
        # Initialize quantification service
        quantification_service = QuantificationService()
        await quantification_service.load_models()
        logger.info("Quantification service initialized")
        
        # Initialize RAG service
        rag_service = RAGService()
        await rag_service.initialize()
        logger.info("RAG service initialized")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise
    finally:
        # Cleanup if needed
        pass

app = FastAPI(
    title="Agri-Gain Backend",
    description="AI-powered RAG backend to help farmers quantify and find opportunities for bio-waste",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    """Dependency to get Firestore client"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return db

def get_quantification_service():
    """Dependency to get quantification service"""
    if quantification_service is None:
        raise HTTPException(status_code=500, detail="Quantification service not initialized")
    return quantification_service

def get_rag_service():
    """Dependency to get RAG service"""
    if rag_service is None:
        raise HTTPException(status_code=500, detail="RAG service not initialized")
    return rag_service

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Agri-Gain Backend is running", "status": "healthy"}

@app.post("/log_waste", response_model=WasteLogResponse)
async def log_waste(
    request: WasteLogRequest,
    db_client: firestore.Client = Depends(get_db),
    quant_service: QuantificationService = Depends(get_quantification_service)
):
    """Log waste data and calculate estimated kg"""
    try:
        # Calculate total kg using quantification service
        total_kg = quant_service.calculate_kg(
            waste_type=request.waste_type,
            unit_name=request.unit_name,
            quantity=request.quantity
        )
        
        # Prepare waste log document
        waste_log_data = {
            "userId": request.userId,
            "waste_type": request.waste_type,
            "unit_name": request.unit_name,
            "quantity": request.quantity,
            "total_kg": total_kg,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Save to Firestore
        app_id = os.getenv("FIREBASE_APP_ID", "agri-gain")
        doc_ref = db_client.collection("artifacts").document(app_id)\
                          .collection("users").document(request.userId)\
                          .collection("waste_logs").document()
        
        doc_ref.set(waste_log_data)
        
        logger.info(f"Waste log created for user {request.userId}: {doc_ref.id}")
        
        return WasteLogResponse(
            success=True,
            waste_log_id=doc_ref.id,
            estimated_kg=total_kg
        )
        
    except ValueError as e:
        logger.error(f"Quantification error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error logging waste: {e}")
        raise HTTPException(status_code=500, detail="Failed to log waste data")

@app.get("/get_how_to_guide/{guide_id}")
async def get_how_to_guide(guide_id: str):
    """Retrieve a specific how-to guide by ID"""
    try:
        # Load guides from JSON file (in production, this could be cached)
        with open("data/how_to_guides.json", "r") as f:
            guides = json.load(f)
        
        # Find the guide by ID
        guide = next((g for g in guides if g["guide_id"] == guide_id), None)
        
        if not guide:
            raise HTTPException(status_code=404, detail="Guide not found")
        
        return guide
        
    except FileNotFoundError:
        logger.error("How-to guides file not found")
        raise HTTPException(status_code=500, detail="Guides data not available")
    except Exception as e:
        logger.error(f"Error retrieving guide: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve guide")

@app.post("/get_opportunities")
async def get_opportunities(
    request: OpportunitiesRequest,
    db_client: firestore.Client = Depends(get_db),
    rag_service: RAGService = Depends(get_rag_service)
):
    """Get AI-powered opportunities for waste utilization"""
    try:
        # Fetch waste log from Firestore
        app_id = os.getenv("FIREBASE_APP_ID", "agri-gain")
        waste_log_ref = db_client.collection("artifacts").document(app_id)\
                               .collection("users").document(request.userId)\
                               .collection("waste_logs").document(request.waste_log_id)
        
        waste_log = waste_log_ref.get()
        if not waste_log.exists:
            raise HTTPException(status_code=404, detail="Waste log not found")
        
        waste_data = waste_log.to_dict()
        
        # Fetch user profile for region
        profile_ref = db_client.collection("artifacts").document(app_id)\
                             .collection("users").document(request.userId)\
                             .collection("profile").document("main")
        
        profile = profile_ref.get()
        user_region = "general"  # Default region
        if profile.exists:
            profile_data = profile.to_dict()
            user_region = profile_data.get("region", "general")
        
        # Get opportunities using RAG service
        opportunities = await rag_service.get_grounded_opportunities(
            waste_type=waste_data["waste_type"],
            total_kg=waste_data["total_kg"],
            region=user_region
        )
        
        return {"opportunities_text": opportunities}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting opportunities: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate opportunities")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
