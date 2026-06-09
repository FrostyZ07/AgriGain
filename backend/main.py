#!/usr/bin/env python3
"""
Agricultural Waste Management Backend API

Main FastAPI application with Firebase Admin integration and vector database support.
This is the entry point for the Agri-Gain backend system.

Usage:
    uvicorn main:app --reload

Environment Variables:
    GOOGLE_APPLICATION_CREDENTIALS: Path to Firebase service account key
    GEMINI_API_KEY: Google Gemini API key for AI processing
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import json
import chromadb
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from quantify import QuantificationService
from rag_service import RAGService

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables for shared resources
embedding_model = None
chroma_client = None
chroma_collection = None
firestore_db = None

class AppState:
    """Global application state container"""
    def __init__(self):
        self.embedding_model = None
        self.chroma_client = None
        self.chroma_collection = None
        self.firestore_db = None
        self.quantification_models = {}
        self.rag_service = None

app_state = AppState()

# Pydantic models for API requests and responses
class LogWasteRequest(BaseModel):
    """Request model for logging agricultural waste"""
    userId: str = Field(..., description="Unique identifier for the user")
    waste_type: str = Field(..., description="Type of waste (e.g., rice_husks, sugarcane_bagasse)")
    unit_name: str = Field(..., description="Unit of measurement (e.g., sacks, wheelbarrows)")
    quantity: int = Field(..., ge=1, description="Number of units (must be positive)")
    notes: str = Field("", description="Optional additional notes about the waste")

class LogWasteResponse(BaseModel):
    """Response model for waste logging"""
    success: bool
    waste_log_id: str
    estimated_kg: float
    message: str = ""

class HowToGuideResponse(BaseModel):
    """Response model for how-to guide retrieval"""
    guide_id: str
    waste_type: str
    title: str
    description: str
    steps: list[str]
    materials_needed: list[str]
    difficulty: str
    region: str

class GetOpportunitiesRequest(BaseModel):
    """Request model for getting waste monetization opportunities"""
    userId: str = Field(..., description="Unique identifier for the user")
    waste_log_id: str = Field(..., description="ID of the waste log to generate opportunities for")

class OpportunityCategory(BaseModel):
    """Model for a single opportunity category"""
    opportunities: list[str] = Field(default_factory=list, description="List of opportunity descriptions")

class StructuredOpportunities(BaseModel):
    """Structured opportunities organized by category"""
    on_farm_use: list[str] = Field(default_factory=list, description="Direct on-farm applications")
    local_sale: list[str] = Field(default_factory=list, description="Local selling opportunities")
    process_and_sell: list[str] = Field(default_factory=list, description="Value-added processing opportunities")

class GetOpportunitiesResponse(BaseModel):
    """Response model for opportunities generation"""
    opportunities_text: str = Field(..., description="Raw opportunities text from AI")
    structured_opportunities: Optional[StructuredOpportunities] = Field(None, description="Structured opportunities (if available)")
    sources_used: int = Field(0, description="Number of knowledge base sources used")
    processing_time_ms: int = Field(0, description="Processing time in milliseconds")
    context_length: int = Field(0, description="Length of context provided to AI")
    queries_generated: int = Field(0, description="Number of search queries generated")
    waste_info: Dict[str, Any] = Field(default_factory=dict, description="Information about the waste log")
    user_region: Optional[str] = Field(None, description="User's region")
    error: Optional[str] = Field(None, description="Error message if any")

def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        # Check if Firebase app is already initialized
        firebase_admin.get_app()
        logger.info("Firebase app already initialized")
    except ValueError:
        # Initialize Firebase app
        cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized with service account")
        else:
            # For development/testing, initialize with default credentials
            firebase_admin.initialize_app()
            logger.info("Firebase initialized with default credentials")
    
    app_state.firestore_db = firestore.client()
    logger.info("Firestore client initialized")

def initialize_chroma():
    """Initialize ChromaDB connection"""
    try:
        app_state.chroma_client = chromadb.PersistentClient(path="chroma_db")
        app_state.chroma_collection = app_state.chroma_client.get_collection("agri_waste_knowledge")
        logger.info(f"ChromaDB initialized - collection has {app_state.chroma_collection.count()} documents")
    except Exception as e:
        logger.error(f"Failed to initialize ChromaDB: {e}")
        # Create empty collection as fallback
        try:
            app_state.chroma_collection = app_state.chroma_client.create_collection("agri_waste_knowledge")
            logger.warning("Created empty ChromaDB collection - run ingest.py first")
        except:
            logger.error("Could not create ChromaDB collection")

def initialize_ml_models():
    """Initialize ML models for embeddings"""
    try:
        app_state.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("Sentence transformer model loaded")
    except Exception as e:
        logger.error(f"Failed to load sentence transformer: {e}")

def load_quantification_models():
    """Load quantification models from JSON file"""
    import json
    try:
        with open("data/quantification_models.json", "r") as f:
            models_list = json.load(f)
        
        # Convert to dictionary for faster lookup
        app_state.quantification_models = {}
        for model in models_list:
            key = f"{model['waste_type']}_{model['unit_name']}"
            app_state.quantification_models[key] = model['avg_kg_per_unit']
        
        logger.info(f"Loaded {len(app_state.quantification_models)} quantification models")
        return True
    except Exception as e:
        logger.error(f"Failed to load quantification models: {e}")
        return False

def initialize_rag_service():
    """Initialize the RAG service with ChromaDB and embedding model"""
    try:
        if app_state.chroma_collection and app_state.embedding_model:
            gemini_api_key = os.getenv('GEMINI_API_KEY')
            app_state.rag_service = RAGService(
                chroma_collection=app_state.chroma_collection,
                embedding_model=app_state.embedding_model,
                gemini_api_key=gemini_api_key
            )
            logger.info("RAG service initialized successfully")
            return True
        else:
            logger.warning("Cannot initialize RAG service - ChromaDB or embedding model not available")
            return False
    except Exception as e:
        logger.error(f"Failed to initialize RAG service: {e}")
        return False

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - startup and shutdown"""
    # Startup
    logger.info("Starting Agricultural Waste Management API...")
    
    # Initialize all services
    try:
        initialize_firebase()
    except Exception as e:
        logger.warning(f"Firebase initialization failed: {e}")
    
    try:
        initialize_chroma()
    except Exception as e:
        logger.warning(f"ChromaDB initialization failed: {e}")
    
    try:
        initialize_ml_models()
    except Exception as e:
        logger.warning(f"ML models initialization failed: {e}")
    
    try:
        success = load_quantification_models()
        if not success:
            logger.warning("Quantification models loading failed")
    except Exception as e:
        logger.error(f"Critical error loading quantification models: {e}")
    
    try:
        success = initialize_rag_service()
        if not success:
            logger.warning("RAG service initialization failed")
    except Exception as e:
        logger.error(f"Critical error initializing RAG service: {e}")
    
    logger.info("API startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Agricultural Waste Management API...")

# Create FastAPI application
app = FastAPI(
    title="Agricultural Waste Management API",
    description="AI-powered RAG backend for agricultural waste monetization opportunities",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get database connections
async def get_app_state() -> AppState:
    """Dependency to inject app state into endpoints"""
    return app_state

# Basic health check endpoint
@app.get("/")
async def root():
    """Root endpoint for basic API information"""
    return {
        "message": "Agricultural Waste Management API",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "log_waste": "/log_waste",
            "get_how_to_guide": "/get_how_to_guide/{guide_id}",
            "get_opportunities": "/get_opportunities"
        }
    }

@app.get("/debug/firestore")
async def debug_firestore(state: AppState = Depends(get_app_state)):
    """Debug endpoint to check Firestore state"""
    return {
        "firestore_db_is_none": state.firestore_db is None,
        "firestore_db_type": str(type(state.firestore_db)),
        "firestore_db_str": str(state.firestore_db)[:100] if state.firestore_db else "None"
    }

@app.get("/health")
async def health_check(state: AppState = Depends(get_app_state)):
    """Comprehensive health check for all services"""
    health_status = {
        "status": "healthy",
        "services": {},
        "timestamp": None
    }
    
    # Check Firestore
    try:
        if state.firestore_db:
            # Try to access Firestore
            test_ref = state.firestore_db.collection('_health_check').document('test')
            health_status["services"]["firestore"] = "connected"
        else:
            health_status["services"]["firestore"] = "not_initialized"
    except Exception as e:
        health_status["services"]["firestore"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check ChromaDB
    try:
        if state.chroma_collection:
            doc_count = state.chroma_collection.count()
            health_status["services"]["chromadb"] = f"connected ({doc_count} docs)"
        else:
            health_status["services"]["chromadb"] = "not_initialized"
    except Exception as e:
        health_status["services"]["chromadb"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check ML Models
    try:
        if state.embedding_model:
            health_status["services"]["embedding_model"] = "loaded"
        else:
            health_status["services"]["embedding_model"] = "not_loaded"
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["services"]["embedding_model"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check quantification models
    health_status["services"]["quantification_models"] = f"{len(state.quantification_models)} loaded"
    
    # Check RAG service
    try:
        if state.rag_service:
            health_status["services"]["rag_service"] = "initialized"
        else:
            health_status["services"]["rag_service"] = "not_initialized"
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["services"]["rag_service"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    health_status["timestamp"] = datetime.now(timezone.utc).isoformat()
    
    return health_status

@app.post("/log_waste", response_model=LogWasteResponse)
async def log_waste(request: LogWasteRequest, state: AppState = Depends(get_app_state)):
    """
    Log agricultural waste and calculate estimated weight in kilograms.
    
    This endpoint:
    1. Validates the waste type and unit combination
    2. Calculates total weight using quantification models
    3. Stores the waste log in Firestore
    4. Returns the log ID and estimated weight
    """
    try:
        # Validate inputs using quantification service
        if not state.quantification_models:
            raise HTTPException(status_code=503, detail="Quantification models not loaded")
        
        # Create quantification service instance and validate combination
        key = f"{request.waste_type}_{request.unit_name}"
        if key not in state.quantification_models:
            # Get available combinations for better error message
            available = list(state.quantification_models.keys())
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid waste type/unit combination: {request.waste_type}/{request.unit_name}. Available: {available[:5]}..."
            )
        
        # Calculate weight using the loaded models
        conversion_factor = state.quantification_models[key]
        estimated_kg = round(request.quantity * conversion_factor, 2)
        
        # Generate unique waste log ID
        import uuid
        waste_log_id = str(uuid.uuid4())
        
        # Prepare document for Firestore
        waste_log = {
            "waste_log_id": waste_log_id,
            "user_id": request.userId,
            "waste_type": request.waste_type,
            "unit_name": request.unit_name,
            "quantity": request.quantity,
            "estimated_kg": estimated_kg,
            "notes": request.notes,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc)
        }
        
        # Store in Firestore
        if state.firestore_db:
            # Use the path structure from devplan: artifacts/{appId}/users/{userId}/waste_logs/
            app_id = "agri_gain_v1"  # This could be configurable
            doc_ref = state.firestore_db.collection('artifacts').document(app_id)\
                                      .collection('users').document(request.userId)\
                                      .collection('waste_logs').document(waste_log_id)
            doc_ref.set(waste_log)
            
            logger.info(f"Waste log {waste_log_id} saved for user {request.userId}")
        else:
            logger.warning("Firestore not initialized - waste log not saved")
        
        return LogWasteResponse(
            success=True,
            waste_log_id=waste_log_id,
            estimated_kg=estimated_kg,
            message=f"Successfully logged {request.quantity} {request.unit_name} of {request.waste_type} ({estimated_kg} kg)"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error logging waste: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/get_how_to_guide/{guide_id}", response_model=HowToGuideResponse)
async def get_how_to_guide(guide_id: str, state: AppState = Depends(get_app_state)):
    """
    Retrieve a specific how-to guide by ID.
    
    This endpoint fetches the complete guide information from the JSON knowledge base
    rather than from the vector database (which contains chunked versions).
    """
    try:
        # Load guides from JSON file
        guides_path = "data/how_to_guides.json"
        try:
            with open(guides_path, 'r', encoding='utf-8') as f:
                guides = json.load(f)
        except FileNotFoundError:
            raise HTTPException(status_code=503, detail="How-to guides data not available")
        except json.JSONDecodeError:
            raise HTTPException(status_code=503, detail="Invalid guides data format")
        
        # Find the requested guide
        guide = None
        for g in guides:
            if g['guide_id'] == guide_id:
                guide = g
                break
        
        if not guide:
            raise HTTPException(
                status_code=404, 
                detail=f"Guide with ID '{guide_id}' not found. Available guides: {[g['guide_id'] for g in guides]}"
            )
        
        # Return the complete guide
        return HowToGuideResponse(
            guide_id=guide['guide_id'],
            waste_type=guide['waste_type'],
            title=guide['title'],
            description=guide['description'],
            steps=guide['steps'],
            materials_needed=guide['materials_needed'],
            difficulty=guide['difficulty'],
            region=guide['region']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving guide {guide_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/guides")
async def list_guides():
    """
    List all available how-to guides with basic information.
    Useful for frontend to show available guides.
    """
    try:
        guides_path = "data/how_to_guides.json"
        with open(guides_path, 'r', encoding='utf-8') as f:
            guides = json.load(f)
        
        # Return summary information for each guide
        guide_summaries = []
        for guide in guides:
            guide_summaries.append({
                "guide_id": guide['guide_id'],
                "title": guide['title'],
                "waste_type": guide['waste_type'],
                "difficulty": guide['difficulty'],
                "region": guide['region'],
                "description": guide['description'][:200] + "..." if len(guide['description']) > 200 else guide['description']
            })
        
        return {
            "total_guides": len(guide_summaries),
            "guides": guide_summaries
        }
        
    except Exception as e:
        logger.error(f"Error listing guides: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/quantification/info")
async def get_quantification_info(state: AppState = Depends(get_app_state)):
    """
    Get information about available waste types and units for quantification.
    Useful for frontend form validation and dropdowns.
    """
    try:
        quant_service = QuantificationService()
        stats = quant_service.get_statistics()
        
        return {
            "available_waste_types": stats['waste_types'],
            "available_units": stats['units'],
            "total_models": stats['total_models'],
            "conversion_factors": stats['conversion_factors']
        }
        
    except Exception as e:
        logger.error(f"Error getting quantification info: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

def structure_opportunities_text(opportunities_text: str, rag_service: RAGService) -> Optional[StructuredOpportunities]:
    """
    Structure the raw opportunities text into JSON categories using Gemini.
    
    This implements Phase 3.3 - JSON Structuring for RAG Response.
    """
    if not rag_service or not rag_service.model:
        return None
    
    try:
        # Truncate opportunities text if too long for faster processing
        max_text_length = 2000
        truncated_text = opportunities_text[:max_text_length] if len(opportunities_text) > max_text_length else opportunities_text
        
        structuring_prompt = f"""Please analyze the following agricultural waste opportunities text and extract specific opportunities into three categories. Return ONLY a valid JSON object with no additional text.

The JSON should follow this exact structure:
{{
  "on_farm_use": ["opportunity 1", "opportunity 2"],
  "local_sale": ["opportunity 1", "opportunity 2"], 
  "process_and_sell": ["opportunity 1", "opportunity 2"]
}}

Extract concrete, actionable opportunities from this text:

{truncated_text}

Return only the JSON object:"""
        
        # Use ThreadPoolExecutor to add timeout to synchronous Gemini call
        def call_gemini():
            response = rag_service.model.generate_content(
                structuring_prompt,
                generation_config=rag_service.genai.types.GenerationConfig(
                    temperature=0.1,  # Very low temperature for consistent JSON
                    max_output_tokens=800
                )
            )
            return response.text if response.text else None
        
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(call_gemini)
            try:
                response_text = future.result(timeout=20)  # 20 second timeout for structuring
                
                if response_text:
                    # Clean the response to extract JSON
                    json_text = response_text.strip()
                    if json_text.startswith('```json'):
                        json_text = json_text[7:]
                    if json_text.endswith('```'):
                        json_text = json_text[:-3]
                    json_text = json_text.strip()
                    
                    # Parse JSON
                    import json
                    structured_data = json.loads(json_text)
                    
                    return StructuredOpportunities(
                        on_farm_use=structured_data.get('on_farm_use', []),
                        local_sale=structured_data.get('local_sale', []),
                        process_and_sell=structured_data.get('process_and_sell', [])
                    )
            except FutureTimeoutError:
                logger.warning("Structuring opportunities timed out after 20 seconds")
                future.cancel()
                return None
            
    except Exception as e:
        logger.warning(f"Failed to structure opportunities: {e}")
        return None

@app.post("/get_opportunities", response_model=GetOpportunitiesResponse)
async def get_opportunities(request: GetOpportunitiesRequest, state: AppState = Depends(get_app_state)):
    """
    Get AI-powered waste monetization opportunities using RAG.
    
    This endpoint implements the main RAG functionality:
    1. Fetches the waste log from Firestore using waste_log_id
    2. Fetches the user's profile to get their region  
    3. Calls RAG service to generate grounded opportunities
    4. Optionally structures the response into JSON categories
    
    As specified in devplan Phase 3.2 and 3.3.
    """
    try:
        # Check if RAG service is available
        if not state.rag_service:
            raise HTTPException(status_code=503, detail="RAG service not available")
        
        # Check if Firestore is available (don't execute query, just check connection)
        try:
            if not state.firestore_db:
                # Try to get firestore client directly
                state.firestore_db = firestore.client()
            # Just verify the client exists, don't execute a query
            if state.firestore_db is None:
                raise HTTPException(status_code=503, detail="Database service not available")
        except Exception as e:
            logger.error(f"Firestore not available: {e}")
            raise HTTPException(status_code=503, detail="Database service not available")
        
        # Fetch the waste log document from Firestore
        app_id = "agri_gain_v1"
        waste_log_ref = state.firestore_db.collection('artifacts').document(app_id)\
                                         .collection('users').document(request.userId)\
                                         .collection('waste_logs').document(request.waste_log_id)
        
        waste_log_doc = waste_log_ref.get()
        
        if not waste_log_doc.exists:
            raise HTTPException(
                status_code=404, 
                detail=f"Waste log {request.waste_log_id} not found for user {request.userId}"
            )
        
        waste_log_data = waste_log_doc.to_dict()
        
        # Fetch user profile to get region
        user_profile_ref = state.firestore_db.collection('artifacts').document(app_id)\
                                            .collection('users').document(request.userId)\
                                            .collection('profile').document('main')
        
        user_profile_doc = user_profile_ref.get()
        user_region = "all"  # Default region
        
        if user_profile_doc.exists:
            profile_data = user_profile_doc.to_dict()
            user_region = profile_data.get('region', 'all')
        else:
            logger.warning(f"User profile not found for {request.userId}, using default region")
        
        # Extract waste information
        waste_type = waste_log_data.get('waste_type')
        total_kg = waste_log_data.get('estimated_kg', 0)
        
        if not waste_type or total_kg <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid waste log data: waste_type={waste_type}, total_kg={total_kg}"
            )
        
        # Call RAG service to generate opportunities
        rag_result = state.rag_service.get_grounded_opportunities(
            waste_type=waste_type,
            total_kg=total_kg,
            region=user_region
        )
        
        # Structure the opportunities into JSON (Phase 3.3)
        structured_opportunities = None
        try:
            structured_opportunities = structure_opportunities_text(
                rag_result.get('opportunities_text', ''), 
                state.rag_service
            )
        except Exception as e:
            logger.warning(f"Failed to structure opportunities: {e}")
        
        # Prepare response
        return GetOpportunitiesResponse(
            opportunities_text=rag_result.get('opportunities_text', ''),
            structured_opportunities=structured_opportunities,
            sources_used=rag_result.get('sources_used', 0),
            processing_time_ms=rag_result.get('processing_time_ms', 0),
            context_length=rag_result.get('context_length', 0),
            queries_generated=rag_result.get('queries_generated', 0),
            waste_info={
                "waste_type": waste_type,
                "total_kg": total_kg,
                "quantity": waste_log_data.get('quantity', 0),
                "unit_name": waste_log_data.get('unit_name', ''),
                "timestamp": waste_log_data.get('timestamp', '')
            },
            user_region=user_region,
            error=rag_result.get('error')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating opportunities: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

class AIInsightRequest(BaseModel):
    """Request model for AI insights about agricultural waste"""
    question: str = Field(..., min_length=5, max_length=500, description="User's question about agricultural waste")
    waste_type: Optional[str] = Field(None, description="Specific waste type context (optional)")
    language: str = Field("english", description="Response language (english, hindi, kannada, tamil, telugu, bengali, gujarati, marathi, punjabi, malayalam)")
    context: Optional[str] = Field(None, description="Additional context about user's situation")

class AIInsightResponse(BaseModel):
    """Response model for AI insights"""
    question: str
    answer: str
    sources_used: int = Field(0, description="Number of knowledge base sources used")
    language: str
    processing_time_ms: int = Field(0, description="Processing time in milliseconds")
    confidence_score: float = Field(0.0, description="Confidence in the answer (0.0-1.0)")
    related_guides: list[str] = Field(default_factory=list, description="Related guide IDs")
    fallback_used: bool = Field(False, description="Whether Gemini fallback was used")
    error: Optional[str] = Field(None, description="Error message if any")

class TestOpportunitiesRequest(BaseModel):
    """Simplified request model for testing opportunities without Firestore"""
    waste_type: str = Field(..., description="Type of waste (e.g., rice_husks, sugarcane_bagasse)")
    total_kg: float = Field(..., ge=0.1, description="Total weight in kilograms")
    region: str = Field("all", description="Geographic region")

@app.post("/test_opportunities", response_model=GetOpportunitiesResponse)
async def test_opportunities(request: TestOpportunitiesRequest, state: AppState = Depends(get_app_state)):
    """
    Test endpoint for RAG opportunities without Firestore dependency.
    Useful for testing the RAG pipeline directly.
    """
    try:
        # Check if RAG service is available
        if not state.rag_service:
            raise HTTPException(status_code=503, detail="RAG service not available")
        
        # Call RAG service directly
        rag_result = state.rag_service.get_grounded_opportunities(
            waste_type=request.waste_type,
            total_kg=request.total_kg,
            region=request.region
        )
        
        # Structure the opportunities into JSON
        structured_opportunities = None
        try:
            structured_opportunities = structure_opportunities_text(
                rag_result.get('opportunities_text', ''), 
                state.rag_service
            )
        except Exception as e:
            logger.warning(f"Failed to structure opportunities: {e}")
        
        # Prepare response
        return GetOpportunitiesResponse(
            opportunities_text=rag_result.get('opportunities_text', ''),
            structured_opportunities=structured_opportunities,
            sources_used=rag_result.get('sources_used', 0),
            processing_time_ms=rag_result.get('processing_time_ms', 0),
            context_length=rag_result.get('context_length', 0),
            queries_generated=rag_result.get('queries_generated', 0),
            waste_info={
                "waste_type": request.waste_type,
                "total_kg": request.total_kg,
                "quantity": 0,
                "unit_name": "test",
        "timestamp": datetime.now(timezone.utc).isoformat()
            },
            user_region=request.region,
            error=rag_result.get('error')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating test opportunities: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/ai_insight", response_model=AIInsightResponse)
async def get_ai_insight(request: AIInsightRequest, state: AppState = Depends(get_app_state)):
    """
    Get AI-powered insights about agricultural waste questions.
    
    This endpoint provides multilingual support and uses the knowledge base first,
    with Gemini API as fallback for questions not covered in the knowledge base.
    """
    start_time = datetime.now()
    
    try:
        # Validate language
        supported_languages = {
            "english": "English",
            "hindi": "Hindi (हिंदी)",
            "kannada": "Kannada (ಕನ್ನಡ)",
            "tamil": "Tamil (தமிழ்)",
            "telugu": "Telugu (తెలుగు)",
            "bengali": "Bengali (বাংলা)",
            "gujarati": "Gujarati (ગુજરાતી)",
            "marathi": "Marathi (मराठी)",
            "punjabi": "Punjabi (ਪੰਜਾਬੀ)",
            "malayalam": "Malayalam (മലയാളം)"
        }
        
        if request.language.lower() not in supported_languages:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported language: {request.language}. Supported: {list(supported_languages.keys())}"
            )
        
        language_name = supported_languages[request.language.lower()]
        fallback_used = False
        sources_used = 0
        related_guides = []
        confidence_score = 0.0
        
        # Step 1: Query knowledge base using RAG approach
        knowledge_base_answer = None
        if state.rag_service and state.chroma_collection:
            try:
                # Generate search queries based on the question
                search_queries = [
                    request.question,
                    f"{request.waste_type} {request.question}" if request.waste_type else request.question,
                    f"how to {request.question.lower()}",
                    f"{request.question.lower()} agricultural waste"
                ]
                
                # Query the vector database
                all_results = []
                for query in search_queries[:3]:  # Limit to 3 queries
                    try:
                        results = state.chroma_collection.query(
                            query_texts=[query],
                            n_results=3
                        )
                        
                        if results['documents'] and results['documents'][0]:
                            for i, doc in enumerate(results['documents'][0]):
                                doc_id = results['ids'][0][i]
                                metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                                
                                all_results.append({
                                    'id': doc_id,
                                    'document': doc,
                                    'metadata': metadata,
                                    'distance': results['distances'][0][i] if results['distances'] else 1.0
                                })
                    except Exception as e:
                        logger.warning(f"Query failed for '{query}': {e}")
                        continue
                
                # Remove duplicates and sort by relevance
                unique_results = {}
                for result in all_results:
                    if result['id'] not in unique_results:
                        unique_results[result['id']] = result
                
                sorted_results = sorted(unique_results.values(), key=lambda x: x['distance'])[:5]
                sources_used = len(sorted_results)
                
                # Extract related guides
                for result in sorted_results:
                    metadata = result.get('metadata', {})
                    if metadata.get('source_type') == 'how_to_guide':
                        guide_id = metadata.get('guide_id')
                        if guide_id and guide_id not in related_guides:
                            related_guides.append(guide_id)
                
                # Build context for knowledge base answer
                if sorted_results:
                    context_parts = []
                    for result in sorted_results:
                        doc_text = result['document'][:500]  # Limit context length
                        context_parts.append(doc_text)
                    
                    context = "\n\n".join(context_parts)
                    confidence_score = min(1.0, sources_used * 0.2)  # Basic confidence scoring
                    
                    # Generate knowledge-based answer using Gemini if available
                    if state.rag_service.model:
                        knowledge_prompt = f"""You are an expert agricultural waste consultant. Answer the user's question using ONLY the provided knowledge base context. 

IMPORTANT: Respond in {language_name} language.

User's Question: {request.question}
Waste Type Context: {request.waste_type or 'Not specified'}
User Context: {request.context or 'Not provided'}

Knowledge Base Context:
{context}

Provide a clear, practical answer in {language_name}. If the context doesn't contain enough information to answer the question, state that clearly and suggest what type of information would be needed."""
                        
                        try:
                            response = state.rag_service.model.generate_content(
                                knowledge_prompt,
                                generation_config=state.rag_service.genai.types.GenerationConfig(
                                    temperature=0.4,
                                    max_output_tokens=1000
                                )
                            )
                            
                            if response.text:
                                knowledge_base_answer = response.text.strip()
                                
                        except Exception as e:
                            logger.warning(f"Failed to generate knowledge-based answer: {e}")
                
            except Exception as e:
                logger.warning(f"Knowledge base query failed: {e}")
        
        # Step 2: Use Gemini fallback if knowledge base didn't provide a good answer
        final_answer = knowledge_base_answer
        
        if not knowledge_base_answer or len(knowledge_base_answer.strip()) < 50:
            fallback_used = True
            
            if state.rag_service and state.rag_service.model:
                fallback_prompt = f"""You are an expert agricultural waste management consultant. Answer the user's question with practical, actionable advice.

IMPORTANT: Respond in {language_name} language.

User's Question: {request.question}
Waste Type Context: {request.waste_type or 'General agricultural waste'}
User Context: {request.context or 'Not provided'}

Provide specific, practical advice for farmers. Include:
1. Direct answer to the question
2. Step-by-step guidance if applicable
3. Safety considerations if relevant
4. Potential benefits or revenue opportunities
5. Common mistakes to avoid

Keep the answer concise but comprehensive, suitable for farmers with varying education levels."""
                
                try:
                    response = state.rag_service.model.generate_content(
                        fallback_prompt,
                        generation_config=state.rag_service.genai.types.GenerationConfig(
                            temperature=0.5,
                            max_output_tokens=1200
                        )
                    )
                    
                    if response.text:
                        final_answer = response.text.strip()
                        confidence_score = 0.7  # Lower confidence for fallback answers
                        
                except Exception as e:
                    logger.error(f"Gemini fallback failed: {e}")
                    final_answer = f"I apologize, but I'm unable to process your question at the moment due to a technical issue. Please try again later or contact support for assistance."
                    if request.language.lower() != "english":
                        final_answer += f"\n\nकृपया बाद में पुनः प्रयास करें या सहायता के लिए संपर्क करें।"  # Hindi fallback
                    confidence_score = 0.0
            else:
                final_answer = f"I'm sorry, but the AI service is currently unavailable. Please check our guides section for detailed information about agricultural waste management."
                confidence_score = 0.0
        
        # Calculate processing time
        processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
        
        return AIInsightResponse(
            question=request.question,
            answer=final_answer or "Unable to generate an answer at this time.",
            sources_used=sources_used,
            language=request.language,
            processing_time_ms=processing_time,
            confidence_score=confidence_score,
            related_guides=related_guides[:5],  # Limit to 5 related guides
            fallback_used=fallback_used
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating AI insight: {e}")
        processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
        
        return AIInsightResponse(
            question=request.question,
            answer=f"An error occurred while processing your question: {str(e)}",
            sources_used=0,
            language=request.language,
            processing_time_ms=processing_time,
            confidence_score=0.0,
            related_guides=[],
            fallback_used=True,
            error=str(e)
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
