# Agri-Gain Backend

An AI-powered RAG (Retrieval-Augmented Generation) backend system to help farmers quantify bio-waste and discover opportunities for value creation.

## Features

- **Waste Quantification**: Convert various units (bundles, bags, acres) to kilograms
- **AI-Powered Opportunities**: Generate actionable recommendations using RAG
- **Knowledge Base**: Comprehensive database of how-to guides, market data, and safety information
- **Firebase Integration**: User data management and persistence
- **Vector Search**: ChromaDB for efficient knowledge retrieval

## Quick Start

### Prerequisites

- Python 3.10+
- Firebase project with Firestore enabled
- Google API key for Gemini AI (optional for development)

### Installation

1. Clone the repository and install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Initialize the knowledge base:
```bash
python ingest.py --clear
```

4. Run the development server:
```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

### Testing

Run the test suite:
```bash
python test_api.py
```

## API Endpoints

### POST /log_waste
Log waste data and get quantity estimation.

**Request:**
```json
{
  "userId": "user123",
  "waste_type": "rice_straw",
  "unit_name": "bundle",
  "quantity": 10
}
```

**Response:**
```json
{
  "success": true,
  "waste_log_id": "log_id_123",
  "estimated_kg": 25.0
}
```

### GET /get_how_to_guide/{guide_id}
Retrieve detailed how-to guides.

### POST /get_opportunities
Generate AI-powered opportunities for waste utilization.

**Request:**
```json
{
  "userId": "user123",
  "waste_log_id": "log_id_123"
}
```

## Knowledge Base Structure

The system uses structured JSON files for the knowledge base:

- `how_to_guides.json`: Step-by-step guides for waste utilization
- `market_data.json`: Current market prices and trends
- `buyer_directory.json`: Contact information for waste buyers
- `quantification_models.json`: Conversion factors for different units
- `safety_sheets.json`: Safety guidelines for handling different waste types

## Deployment

### Google Cloud Run

1. Build and deploy:
```bash
gcloud run deploy agri-gain-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

2. Set environment variables in Cloud Run console

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env

# Initialize knowledge base
python ingest.py

# Run server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile App    │───▶│   FastAPI        │───▶│   Firebase      │
│                 │    │   Backend        │    │   Firestore     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   RAG Service    │───▶│   Google        │
                       │                  │    │   Gemini AI     │
                       └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   ChromaDB       │
                       │   Vector Store   │
                       └──────────────────┘
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details
