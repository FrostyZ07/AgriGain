{
  "projectName": "Agri-Gain Backend",
  "description": "An AI-powered RAG backend to help farmers quantify and find opportunities for bio-waste. The system will use a vector database for grounding and expose a FastAPI for a future mobile app.",
  "coreTechStack": {
    "language": "Python 3.10+",
    "apiFramework": "FastAPI",
    "vectorDatabase": "ChromaDB (persistent, file-based)",
    "llm": "Google Gemini (gemini-2.5-flash-preview-09-2025)",
    "database": "Firebase Firestore",
    "deployment": "Google Cloud Run (from source)"
  },
  "phases": [
    {
      "phaseId": 1,
      "title": "Knowledge Base (KB) & Ingestion",
      "objective": "Create the structured data for the RAG system and a Python script to ingest it into the vector DB.",
      "tasks": [
        {
          "taskId": "1.1",
          "description": "Define data schemas (as models for data curation).",
          "details": "The knowledge base will consist of several JSON files with clear schemas.",
          "outputs": [
            {
              "fileName": "how_to_guides.json",
              "schema": "{ guide_id: str, waste_type: str, title: str, description: str, steps: list[str], materials_needed: list[str], difficulty: str, region: str }"
            },
            {
              "fileName": "market_data.json",
              "schema": "{ data_id: str, waste_type: str, product_type: str, region: str, avg_price_per_kg: float, source: str, last_updated: str }"
            },
            {
              "fileName": "buyer_directory.json",
              "schema": "{ buyer_id: str, buyer_name: str, region: str, waste_types_accepted: list[str], contact_info: str }"
            },
            {
              "fileName": "quantification_models.json",
              "schema": "{ model_id: str, waste_type: str, unit_name: str, avg_kg_per_unit: float }"
            },
            {
              "fileName": "safety_sheets.json",
              "schema": "{ sheet_id: str, waste_type: str, content: str, source: str }"
            }
          ]
        },
        {
          "taskId": "1.2",
          "description": "Build Vector DB Ingestion Pipeline (ingest.py)",
          "details": "Create a Python script (ingest.py) that: 1. Reads all source JSON files (from Task 1.1). 2. Chunks text content from 'how_to_guides' and 'safety_sheets'. 3. Uses 'all-MiniLM-L6-v2' (via sentence-transformers) to generate embeddings for each chunk. 4. Stores chunks, vectors, and metadata (e.g., guide_id, waste_type, region, source_type) in a persistent ChromaDB collection saved to disk. This script is intended to be run locally or in a CI/CD pipeline to pre-build the vector database."
        }
      ]
    },
    {
      "phaseId": 2,
      "title": "Core API & Business Logic",
      "objective": "Build the FastAPI server and core business logic for quantification and user data management.",
      "tasks": [
        {
          "taskId": "2.1",
          "description": "Setup FastAPI Project & Firebase Admin",
          "details": "Initialize a standard FastAPI project structure. Integrate the Firebase Admin SDK for server-side Firestore operations."
        },
        {
          "taskId": "2.2",
          "description": "Build Quantification Module (quantify.py)",
          "details": "Create a Python module that loads quantification_models.json into memory (e.g., as a dictionary) on startup. Define a function: calculate_kg(waste_type: str, unit_name: str, quantity: int) -> float."
        },
        {
          "taskId": "2.3",
          "description": "Define Core API Endpoints (using Pydantic models)",
          "endpoints": [
            {
              "path": "/log_waste",
              "method": "POST",
              "input": "{ userId: str, waste_type: str, unit_name: str, quantity: int }",
              "logic": "1. Call calculate_kg() from quantify.py to get total_kg. 2. Save a new document in Firestore: artifacts/{appId}/users/{userId}/waste_logs/ containing all input data plus total_kg and a timestamp.",
              "output": "{ 'success': true, 'waste_log_id': '...', 'estimated_kg': ... }"
            },
            {
              "path": "/get_how_to_guide/{guide_id}",
              "method": "GET",
              "input": "guide_id (string from URL path)",
              "logic": "Fetch the non-vectorized, full guide object from its original source (e.g., how_to_guides.json or a separate 'static_content' collection in Firestore).",
              "output": "The full JSON object for the requested guide."
            }
          ]
        }
      ]
    },
    {
      "phaseId": 3,
      "title": "RAG Opportunity Engine",
      "objective": "Build the main RAG-powered API endpoint that generates actionable opportunities.",
      "tasks": [
        {
          "taskId": "3.1",
          "description": "Build RAG Query Service (rag_service.py)",
          "details": "Create a module with a function get_grounded_opportunities(waste_type: str, total_kg: float, region: str). This function must: 1. Generate a list of search queries for the vector DB (e.g., 'how to use {waste_type}', 'market price {waste_type} in {region}', 'local buyers {waste_type} in {region}', 'safety handling {waste_type}'). 2. Query the ChromaDB (loaded from disk) with these queries to retrieve the top relevant document chunks. 3. Concatenate all retrieved chunks into a single 'context' string. 4. Define a system prompt: 'You are Agri-Gain, an expert AI assistant for farmers. You provide clear, simple, and actionable advice. You MUST use ONLY the context provided to answer. Do not invent information. Structure your answer into 'On-Farm Use', 'Local Sale', and 'Process & Sell' categories.' 5. Create a user prompt augmenting the farmer's query with the 'context' string. 6. Call the gemini-2.5-flash-preview-09-2025 model with Google Search grounding disabled to force it to use only the provided context. 7. Return the raw text response from the LLM."
        },
        {
          "taskId": "3.2",
          "description": "Implement Main RAG API Endpoint",
          "endpoints": [
            {
              "path": "/get_opportunities",
              "method": "POST",
              "input": "{ userId: str, waste_log_id: str }",
              "logic": "1. Fetch the waste_log document from Firestore using waste_log_id. 2. Fetch the user's profile from Firestore (path: artifacts/{appId}/users/{userId}/profile/) to get their region. 3. Call rag_service.get_grounded_opportunities() with the log's waste_type, total_kg, and user's region. 4. Return the raw text response.",
              "output": "{ 'opportunities_text': '...' }"
            }
          ]
        },
        {
          "taskId": "3.3",
          "description": "(Advanced) JSON Structuring for RAG Response",
          "details": "Modify Task 3.2. After receiving the raw text from rag_service.py, make a second call to the Gemini API using JSON mode. Prompt it to structure the raw text according to the following schema.",
          "outputSchema": {
            "type": "OBJECT",
            "properties": {
              "on_farm_use": {
                "type": "ARRAY",
                "items": {
                  "type": "STRING",
                  "description": "A one-sentence summary of the on-farm use."
                }
              },
              "local_sale": {
                "type": "ARRAY",
                "items": {
                  "type": "STRING",
                  "description": "A one-sentence summary of the local sale opportunity."
                }
              },
              "process_and_sell": {
                "type": "ARRAY",
                "items": {
                  "type": "STRING",
                  "description": "A one-sentence summary of the processing opportunity."
                }
              }
            }
          },
          "modifiedOutput": "{ 'structured_opportunities': { ... } }"
        }
      ]
    },
    {
      "phaseId": 4,
      "title": "Testing & Deployment",
      "objective": "Ensure code quality and deploy the backend service.",
      "tasks": [
        {
          "taskId": "4.1",
          "description": "Unit & Integration Tests (Pytest)",
          "details": "Write Pytest tests for: quantify.py with known values. API endpoints (mocking Firebase and Gemini calls). rag_service.py (mocking vector DB and Gemini calls)."
        },
        {
          "taskId": "4.2",
          "description": "RAG 'Golden Set' Evaluation (Manual)",
          "details": "Create a test_queries.csv with 20+ sample farmer scenarios. Create a script to run these scenarios through the /get_opportunities endpoint. Manually review outputs for accuracy, groundedness (no hallucinations), and clarity. If results are poor, iterate on the Knowledge Base data (Phase 1), not the LLM prompt logic."
        },
        {
          "taskId": "4.3",
          "description": "Prepare for Deployment (No Docker)",
          "details": "1. Create requirements.txt (pip freeze > requirements.txt). 2. Ensure main FastAPI file (main.py) creates the app instance. 3. Add logic to the FastAPI startup event to download the pre-built ChromaDB database files (from Task 1.3, now hosted on Google Cloud Storage) to the server's local filesystem on boot. 4. (Optional) Add a Procfile for Gunicorn: web: gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app."
        },
        {
          "taskId": "4.4",
          "description": "Deploy to Google Cloud Run",
          "details": "1. Deploy to Cloud Run from a source code repository (e.g., GitHub). 2. Configure the startup command (e.g., gunicorn ...). 3. Configure Firebase Security Rules to allow authenticated users to read/write their own data. 4. Secure the API endpoint (e.g., require authentication or set up an API Key)."
        }
      ]
    }
  ]
}