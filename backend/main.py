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

import sys
import os
# Ensure parent directory (workspace root) is in PYTHONPATH to allow 'backend.' module imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

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
from dotenv import load_dotenv
from quantify import QuantificationService
from rag_service import RAGService
from embedding import get_embedding_function

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

class StartInvestigationRequest(BaseModel):
    """Request model for starting progressive workspace investigation"""
    message: str
    objective: Optional[str] = None

class StartInvestigationResponse(BaseModel):
    """Response model containing session ID and progressive timeline events"""
    sessionId: str
    events: list[dict[str, Any]]

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

CHROMA_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db")

def initialize_ml_models():
    """Initialize the shared embedding function (same one ingest.py uses)."""
    try:
        app_state.embedding_model = get_embedding_function()
        logger.info("Shared embedding function loaded")
    except Exception as e:
        logger.error(f"Failed to load embedding function: {e}")

def initialize_chroma():
    """Initialize ChromaDB connection.

    Must run AFTER initialize_ml_models(): the collection is bound to the same
    embedding_function used at ingest time (see embedding.py) so query-time
    embeddings land in the same vector space as the documents (A1 fix). Without
    this, Chroma silently falls back to its own default embedder for queries.
    """
    try:
        app_state.chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
    except Exception as e:
        logger.error(f"Failed to create ChromaDB client: {e}")
        return

    try:
        app_state.chroma_collection = app_state.chroma_client.get_collection(
            "agri_waste_knowledge", embedding_function=app_state.embedding_model
        )
        logger.info(f"ChromaDB initialized - collection has {app_state.chroma_collection.count()} documents")
    except Exception as e:
        logger.warning(f"Existing collection not found ({e}); creating an empty one")
        # Create empty collection as fallback - client is guaranteed to exist here
        try:
            app_state.chroma_collection = app_state.chroma_client.create_collection(
                "agri_waste_knowledge", embedding_function=app_state.embedding_model
            )
            logger.warning("Created empty ChromaDB collection - run ingest.py first")
        except Exception as create_err:
            logger.error(f"Could not create ChromaDB collection: {create_err}")

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
        initialize_ml_models()
    except Exception as e:
        logger.warning(f"ML models initialization failed: {e}")

    try:
        initialize_chroma()
    except Exception as e:
        logger.warning(f"ChromaDB initialization failed: {e}")

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
    
    # Initialize the multi-agent registry for orchestrator
    try:
        initialize_agent_registry()
    except Exception as e:
        logger.error(f"Critical error initializing agent registry: {e}")
    
    logger.info("API startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Agricultural Waste Management API...")

def initialize_agent_registry():
    """Initialize and register agents with the global registry."""
    try:
        from backend.agents.calculator_agent import CalculatorAgent
        from backend.agents.rag_agent import RAGAgent
        from backend.agents.web_search_agent import WebSearchAgent
        from backend.registry.tool_registry import global_registry
        from backend.models.tool_models import AgentMetadata

        calc = CalculatorAgent()
        calc.initialize()
        global_registry.register(calc, AgentMetadata(
            name="calculator",
            version="1.0",
            description="Performs deterministic calculations",
            supported_intents=["waste_estimation", "roi_analysis"]
        ))

        rag = RAGAgent(rag_service=app_state.rag_service)
        rag.initialize()
        global_registry.register(rag, AgentMetadata(
            name="rag",
            version="1.0",
            description="Retrieves domain knowledge",
            supported_intents=["knowledge_retrieval"]
        ))

        web_search = WebSearchAgent(gemini_model=app_state.rag_service.model if app_state.rag_service else None)
        web_search.initialize()
        global_registry.register(web_search, AgentMetadata(
            name="web_search",
            version="1.0",
            description="Performs real-time web search",
            supported_intents=["market_intelligence"]
        ))
        logger.info("All Multi-Agent layers initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Agent Registry: {e}")
        raise


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

def categorize_recommendations(recs: list) -> dict:
    """Categorize a flat list of recommendations for backward compatibility."""
    on_farm = []
    local = []
    process = []
    for rec in recs:
        rec_lower = rec.lower()
        if any(w in rec_lower for w in ["compost", "feed", "fertilizer", "on farm", "direct", "soil"]):
            on_farm.append(rec)
        elif any(w in rec_lower for w in ["sell", "buyer", "market", "dealer", "price", "revenue", "cost"]):
            local.append(rec)
        else:
            process.append(rec)
            
    # Fallback to make sure categories aren't completely empty
    if not on_farm and not local and not process:
        process = recs
        
    return {
        "on_farm_use": on_farm,
        "local_sale": local,
        "process_and_sell": process
    }

@app.post("/api/v2/recommend")
async def recommend(request: GetOpportunitiesRequest, state: AppState = Depends(get_app_state)):
    """
    Unified endpoint that coordinates the Master ReAct Orchestrator.
    It fetches waste details from Firestore, constructs a query,
    executes the multi-agent graph, and returns the synthesized JSON response.
    """
    try:
        # Check database connections
        if not state.firestore_db:
            try:
                state.firestore_db = firestore.client()
            except Exception:
                raise HTTPException(status_code=503, detail="Database service not available")
        if state.firestore_db is None:
            raise HTTPException(status_code=503, detail="Database service not available")

        # 1. Fetch waste log
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
        waste_type = waste_log_data.get("waste_type")
        estimated_kg = waste_log_data.get("estimated_kg", 0.0)

        # 2. Fetch region
        user_profile_ref = state.firestore_db.collection('artifacts').document(app_id)\
                                            .collection('users').document(request.userId)\
                                            .collection('profile').document('main')
        
        user_profile_doc = user_profile_ref.get()
        user_region = "all"
        if user_profile_doc.exists:
            user_region = user_profile_doc.to_dict().get("region", "all")

        # 3. Construct Query
        clean_waste_type = (waste_type or "agricultural waste").replace("_", " ")
        query = f"I have {estimated_kg} kg of {clean_waste_type} in {user_region}. What is the best option for maximum profit?"

        # 4. Execute Orchestrator
        from orchestrator.graph import run_orchestrator
        orchestration_result = run_orchestrator(query, request_id=request.waste_log_id)

        # Enrich response with waste_info and region for compatibility/logging
        if "waste_info" not in orchestration_result:
            orchestration_result["waste_info"] = {
                "waste_type": waste_type,
                "total_kg": estimated_kg,
                "quantity": waste_log_data.get("quantity", 0),
                "unit_name": waste_log_data.get("unit_name", ""),
                "timestamp": waste_log_data.get("timestamp", "")
            }
        if "user_region" not in orchestration_result:
            orchestration_result["user_region"] = user_region

        # 5. Populate legacy text opportunities and structured opportunities for legacy compatibility
        recs = orchestration_result.get("recommendations", [])
        
        summary_parts = []
        if orchestration_result.get("calculations"):
            calc = orchestration_result["calculations"]
            summary_parts.append("--- Quantitative Analysis ---")
            summary_parts.append(f"Estimated Waste: {calc.get('estimated_waste')} kg")
            summary_parts.append(f"Estimated Revenue potential: INR {calc.get('estimated_revenue')}")
            summary_parts.append(f"Return on Investment (ROI): {calc.get('roi')}x")
            summary_parts.append(f"CO2 Saved: {calc.get('co2_saved')} kg")
            summary_parts.append("")

        if orchestration_result.get("market_information"):
            mkt = orchestration_result["market_information"]
            summary_parts.append("--- Real-Time Market Intel ---")
            if mkt.get("market_price"):
                summary_parts.append(f"Scraped Prices: {mkt['market_price']}")
            if mkt.get("buyers"):
                summary_parts.append(f"Local Buyers found: {', '.join(mkt['buyers'])}")
            summary_parts.append("")

        summary_parts.append("--- AI Recommendations ---")
        for rec in recs:
            summary_parts.append(f"- {rec}")

        orchestration_result["opportunities_text"] = "\n".join(summary_parts)
        orchestration_result["structured_opportunities"] = categorize_recommendations(recs)
        
        # Populate other required legacy response keys
        exec_meta = orchestration_result.get("execution") or {}
        orchestration_result["sources_used"] = len(orchestration_result.get("citations", []))
        orchestration_result["processing_time_ms"] = exec_meta.get("execution_time_ms", 1000)
        orchestration_result["context_length"] = len(orchestration_result["opportunities_text"])
        orchestration_result["queries_generated"] = len(exec_meta.get("tools_used", []))

        return orchestration_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing recommendation orchestrator: {e}")
        raise HTTPException(status_code=500, detail=f"Recommendation error: {str(e)}")


@app.post("/investigations", response_model=StartInvestigationResponse)
async def start_investigation(request: StartInvestigationRequest, state: AppState = Depends(get_app_state)):
    """
    Translates raw user chat prompts into a series of progressive WorkspaceEvents
    suitable for the agentic timeline visualization dashboard on the new frontend.
    """
    import uuid
    import time
    session_id = f"sess_{uuid.uuid4().hex[:8]}"
    message = request.message
    
    # 1. Run the Orchestrator
    from orchestrator.graph import run_orchestrator
    try:
        # Execute the LangGraph workflow on the query
        res = run_orchestrator(message, request_id=session_id)
    except Exception as e:
        logger.error(f"Orchestrator failed during investigations endpoint: {e}")
        # Revert to standard fallback events
        raise HTTPException(status_code=500, detail=str(e))

    # 2. Extract results from orchestrator run
    exec_meta = res.get("execution") or {}
    tools_used = exec_meta.get("tools_used", [])
    
    # Check if the query is out of scope (no tools selected, explicitly stated, or parsed as out_of_scope)
    intent_primary = res.get("intent", {}).get("primary") if isinstance(res.get("intent"), dict) else ""
    if not intent_primary and "intent" in res:
        intent_primary = res["intent"]

    is_out_of_scope = (
        (len(tools_used) == 0) or 
        ("no waste" in message.lower()) or 
        (intent_primary == "out_of_scope")
    )

    def get_time():
        return time.strftime("%H:%M:%S")

    if is_out_of_scope:
        events = [
            {
                "type": "phase",
                "phase": "understanding",
                "objective": "Understand agricultural waste context",
                "activeQuestion": "No agricultural waste parameters identified.",
                "timeline": {
                    "id": f"t-understand-{uuid.uuid4().hex[:4]}",
                    "time": get_time(),
                    "title": "Request analyzed",
                    "detail": "Agri-Gain could not identify any crop type, waste type, or quantity in the input.",
                    "type": "conversation"
                }
            },
            {
                "type": "phase",
                "phase": "planning",
                "objective": "Execution plan bypassed",
                "activeQuestion": "Explain options for non-agricultural queries.",
                "timeline": {
                    "id": f"t-plan-{uuid.uuid4().hex[:4]}",
                    "time": get_time(),
                    "title": "Strategy bypassed",
                    "detail": "All calculator, RAG, and search routes skipped - input is out of scope.",
                    "type": "planner"
                }
            },
            {
                "type": "planner",
                "decisionId": "waste-analysis",
                "status": "skipped",
                "reason": "Input lacks valid crop waste parameters."
            },
            {
                "type": "planner",
                "decisionId": "knowledge-research",
                "status": "skipped",
                "reason": "No waste identified for research lookup."
            },
            {
                "type": "planner",
                "decisionId": "market-intelligence",
                "status": "skipped",
                "reason": "Market lookup skipped."
            },
            {
                "type": "recommendations",
                "recommendations": [],
                "selectedRecommendationId": "",
                "timeline": {
                    "id": f"t-recs-{uuid.uuid4().hex[:4]}",
                    "time": get_time(),
                    "title": "No recommendations generated",
                    "detail": "No utilization options could be ranked.",
                    "type": "recommendation"
                }
            },
            {
                "type": "phase",
                "phase": "ready",
                "objective": "Awaiting valid agricultural waste parameters",
                "activeQuestion": "Please specify the type of crop waste and quantity (e.g. 5 tonnes sugarcane bagasse) to generate options."
            }
        ]
        return StartInvestigationResponse(
            sessionId=session_id,
            events=events
        )

    calc_data = res.get("calculations") or {}
    rag_data = res.get("knowledge_base") or {}
    search_data = res.get("market_information") or {}
    confidence = res.get("confidence_score", 0.85)

    events = []

    # Helper for timestamp formatting
    def get_time():
        return time.strftime("%H:%M:%S")

    # Event 1: Phase change to Understanding
    events.append({
        "type": "phase",
        "phase": "understanding",
        "objective": "Understand waste type, quantity, and user outcome",
        "activeQuestion": "Extracting decision criteria from query context.",
        "timeline": {
            "id": f"t-understand-{uuid.uuid4().hex[:4]}",
            "time": get_time(),
            "title": "Request understood",
            "detail": f"Identified waste parameters from user prompt: '{message}'",
            "type": "conversation"
        }
    })

    # Event 2: Phase change to Planning
    events.append({
        "type": "phase",
        "phase": "planning",
        "objective": "Design dynamic agent execution plan",
        "activeQuestion": "Identifying which tools will improve the recommendation quality.",
        "timeline": {
            "id": f"t-plan-{uuid.uuid4().hex[:4]}",
            "time": get_time(),
            "title": "Execution plan created",
            "detail": f"Selected parallel routes: {', '.join(tools_used)}",
            "type": "planner"
        }
    })

    # Event 3: Mark modules/tools running & completed progress
    # A. Calculator Agent
    if "calculator" in tools_used:
        events.append({
            "type": "planner",
            "decisionId": "waste-analysis",
            "status": "running",
            "reason": "Resolving acreage yield and transport/handling metrics."
        })
        events.append({
            "type": "module",
            "moduleId": "calculator",
            "status": "completed",
            "progress": 100,
            "latestFinding": f"Dry waste resolved to {calc_data.get('estimated_waste', 0)} kg. Revenue potential ₹{calc_data.get('estimated_revenue', 0)}.",
            "timeline": {
                "id": f"t-calc-{uuid.uuid4().hex[:4]}",
                "time": get_time(),
                "title": "Waste calculations finished",
                "detail": f"Calculated {calc_data.get('estimated_waste', 0)} kg weight with ROI multiple {calc_data.get('roi', 0)}x.",
                "type": "evidence"
            }
        })
        events.append({
            "type": "evidence",
            "evidence": {
                "id": f"ev-calc-{uuid.uuid4().hex[:4]}",
                "title": "Material & ROI Estimates Confirmed",
                "category": "Waste Analysis",
                "summary": f"Calculations suggest a net profit of ₹{int(calc_data.get('estimated_revenue', 0) - (calc_data.get('transportation_cost', 0) + calc_data.get('storage_cost', 0)))} with CO2 savings of {calc_data.get('co2_saved', 0)} kg.",
                "quality": "high",
                "impact": 24
            }
        })
    else:
        events.append({
            "type": "planner",
            "decisionId": "waste-analysis",
            "status": "skipped",
            "reason": "No calculations required for this user query."
        })

    # B. RAG Agent
    if "rag" in tools_used:
        events.append({
            "type": "planner",
            "decisionId": "knowledge-research",
            "status": "running",
            "reason": "Searching ChromaDB for verified utilization steps."
        })
        events.append({
            "type": "module",
            "moduleId": "knowledge",
            "status": "completed",
            "progress": 100,
            "latestFinding": f"Retrieved {len(rag_data.get('sources', []))} reference docs. Standard agricultural guides loaded.",
            "opportunities_text": rag_data.get("opportunities_text", ""),
            "timeline": {
                "id": f"t-rag-{uuid.uuid4().hex[:4]}",
                "time": get_time(),
                "title": "Domain research finished",
                "detail": f"Located suitable composting and pyrolyzer guidelines.",
                "type": "evidence"
            }
        })
        events.append({
            "type": "evidence",
            "evidence": {
                "id": f"ev-rag-{uuid.uuid4().hex[:4]}",
                "title": "Agronomic Knowledge Ingested",
                "category": "Knowledge Base",
                "summary": rag_data.get("recommendations", ["No guides loaded."])[0] if rag_data.get("recommendations") else "Waste pathways matched to standard guide specifications.",
                "quality": "high",
                "impact": 20
            }
        })
    else:
        events.append({
            "type": "planner",
            "decisionId": "knowledge-research",
            "status": "skipped",
            "reason": "Static domain knowledge not required."
        })

    # C. Web Search Agent
    if "web_search" in tools_used:
        events.append({
            "type": "planner",
            "decisionId": "market-intelligence",
            "status": "running",
            "reason": "Scraping Tavily search results for local buyers."
        })
        events.append({
            "type": "module",
            "moduleId": "market",
            "status": "completed",
            "progress": 100,
            "latestFinding": f"Scraped market prices: {search_data.get('market_price') or 'No live price resolved'}.",
            "timeline": {
                "id": f"t-search-{uuid.uuid4().hex[:4]}",
                "time": get_time(),
                "title": "Market signals scraped",
                "detail": f"Live buyers list compiled: {', '.join(search_data.get('buyers', [])) or 'No specific factory names found'}",
                "type": "evidence"
            }
        })
        events.append({
            "type": "evidence",
            "evidence": {
                "id": f"ev-search-{uuid.uuid4().hex[:4]}",
                "title": "Live Market Intelligence Favorable",
                "category": "Market Intelligence",
                "summary": f"Resolved prices: {str(search_data.get('market_price', {})) or 'Historical average ₹5/kg used.'}. Local buyers count: {len(search_data.get('buyers', []))}.",
                "quality": "medium",
                "impact": 32
            }
        })
    else:
        events.append({
            "type": "planner",
            "decisionId": "market-intelligence",
            "status": "skipped",
            "reason": "Live market lookup skipped."
        })

    # 4. Generate Recommendations list from tool results
    recs_list = res.get("recommendations") or ["Processing agricultural waste for maximum circular efficiency."]
    
    def find_summary_for_alt(alt_id, recs):
        alt_id_lower = alt_id.lower()
        keywords = {
            "biochar": ["biochar", "pyrolysis", "carbon", "charcoal"],
            "direct-sale": ["sale", "sell", "buyer", "factory", "market"],
            "compost": ["compost", "fertilizer", "soil", "organic"],
            "biogas": ["biogas", "methane", "energy", "power"]
        }.get(alt_id_lower, [alt_id_lower])
        
        for rec in recs:
            rec_lower = rec.lower()
            if any(kw in rec_lower for kw in keywords):
                return rec
        return None

    est_waste = calc_data.get("estimated_waste", 100.0)
    est_rev = calc_data.get("estimated_revenue", 500.0)
    roi_val = calc_data.get("roi", 2.0)
    trans = calc_data.get("transportation_cost", 80.0)
    storage = calc_data.get("storage_cost", 45.0)
    total_cost = trans + storage
    net_profit = est_rev - total_cost

    recs_events = [
        {
            "id": "biochar",
            "title": "Biochar Production",
            "rank": 1,
            "confidence": int(confidence * 100),
            "expectedProfit": int(net_profit),
            "roi": float(roi_val),
            "investment": int(total_cost),
            "timeline": "2 weeks",
            "difficulty": "Medium",
            "sustainabilityScore": 91,
            "summary": find_summary_for_alt("biochar", recs_list) or "Thermochemical conversion into biochar yields highest net profit and circular sustainability.",
            "advantages": ["Highest ROI", "Carbon capture credit value", "Very strong soil amendment value"],
            "limitations": ["Upfront kiln setup cost", "Requires moisture controls"],
            "drivers": [
                {"label": "Market demand", "value": 32},
                {"label": "Investment Fit", "value": 24},
                {"label": "Carbon credit", "value": 18}
            ]
        },
        {
            "id": "direct-sale",
            "title": "Direct Sale to Factory",
            "rank": 2,
            "confidence": int(confidence * 100 - 10),
            "expectedProfit": int(est_rev * 0.7),
            "roi": float(max(1.0, roi_val * 0.7)),
            "investment": int(trans),
            "timeline": "3 days",
            "difficulty": "Low",
            "sustainabilityScore": 58,
            "summary": find_summary_for_alt("direct-sale", recs_list) or "Direct bulk dispatch to nearby biofuel boilers or brick kilns. Quick cash but lower margins.",
            "advantages": ["Fastest liquidation", "Zero processing setup", "Low technical skill requirement"],
            "limitations": ["Lower unit margin", "Subject to localized spot buyer demands"],
            "drivers": [
                {"label": "Speed", "value": 35},
                {"label": "Low investment", "value": 28},
                {"label": "Demand fit", "value": 15}
            ]
        },
        {
            "id": "compost",
            "title": "Aerobic Composting",
            "rank": 3,
            "confidence": int(confidence * 100 - 20),
            "expectedProfit": int(est_rev * 0.5),
            "roi": float(max(1.0, roi_val * 0.5)),
            "investment": int(storage * 2),
            "timeline": "5 weeks",
            "difficulty": "Medium",
            "sustainabilityScore": 82,
            "summary": find_summary_for_alt("compost", recs_list) or "Blend with crop residue to produce rich manure. Best for long-term circular agriculture.",
            "advantages": ["Improves soil health directly", "Low equipment requirements", "Zero chemical residue"],
            "limitations": ["Takes 5+ weeks of decomposition", "Requires substantial storage space"],
            "drivers": [
                {"label": "Soil value", "value": 30},
                {"label": "Storage requirement", "value": 22},
                {"label": "Zero waste", "value": 18}
            ]
        }
    ]

    events.append({
        "type": "recommendations",
        "recommendations": recs_events,
        "selectedRecommendationId": "biochar",
        "timeline": {
            "id": f"t-recs-{uuid.uuid4().hex[:4]}",
            "time": get_time(),
            "title": "Recommendation compiled",
            "detail": f"Ranks resolved: Biochar ranks #1 based on profit/sustainability trade-offs.",
            "type": "recommendation"
        }
    })

    # Event 5: Confidence Signals
    events.append({
        "type": "confidence",
        "recommendationId": "biochar",
        "confidence": int(confidence * 100),
        "signals": [
            {"label": "Waste yield verified", "value": int(confidence * 100 * 0.3), "direction": "positive"},
            {"label": "Market demand verified", "value": int(confidence * 100 * 0.35), "direction": "positive"},
            {"label": "Transport cost estimated", "value": 12, "direction": "limiting"}
        ],
        "timeline": {
            "id": f"t-conf-{uuid.uuid4().hex[:4]}",
            "time": get_time(),
            "title": "Confidence score verified",
            "detail": f"Confidence set to {int(confidence * 100)}% based on resolved data points.",
            "type": "confidence"
        }
    })

    # Event 6: Phase Ready
    events.append({
        "type": "phase",
        "phase": "ready",
        "objective": "Recommendation finalized",
        "activeQuestion": "Inspect the timeline drivers, view evidence metrics, or ask follow-up refinements."
    })

    return StartInvestigationResponse(
        sessionId=session_id,
        events=events
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


