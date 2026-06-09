# Agri-Gain

AI-powered platform that helps farmers turn agricultural waste into revenue. Log waste in everyday units (sacks, wheelbarrows, crates), get weight estimates, and receive personalized monetization opportunities grounded in a local knowledge base.

## Features

- **Waste logging** — Multi-step wizard with visual selectors; converts farm units to kilograms using quantification models
- **AI opportunities** — RAG pipeline (ChromaDB + Gemini) suggests on-farm use, local sale, and value-added processing options
- **AI expert chat** — Multilingual Q&A on the Guides page (English, Hindi, and more)
- **How-to guides & help** — Educational content and FAQs for waste monetization
- **Dashboard** — Impact tracking UI (demo metrics)
- **i18n** — English and Hindi UI

## Architecture

```
agri-gain/          Next.js 14 frontend (port 3000)
backend/            FastAPI + RAG backend (port 8000)
  ├── data/         JSON knowledge base (guides, buyers, market, safety, quant models)
  ├── chroma_db/    Vector store (created by ingest.py, not committed)
  └── main.py       API entry point
```

**Data flow:** Frontend → `POST /log_waste` → Firestore → `POST /get_opportunities` → Chroma retrieval → Gemini → structured opportunity cards.

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **Google Gemini API key** — [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Firebase project** (optional for local dev) — Firestore for persisting waste logs; download a service account JSON key

## Quick start

### 1. Backend

```bash
cd backend
cp .env.template .env
# Edit .env: set GEMINI_API_KEY, GOOGLE_APPLICATION_CREDENTIALS, GEMINI_MODEL=gemini-2.5-flash

pip install -r requirements.txt
python ingest.py          # Builds chroma_db/ (53 embedded documents)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Verify: [http://localhost:8000/health](http://localhost:8000/health) and [http://localhost:8000/docs](http://localhost:8000/docs).

### 2. Frontend

```bash
cd agri-gain
npm install
# Optional: create .env.local with NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Log Waste** → submit → redirected to personalized opportunities.

## Environment variables

| Variable | Where | Description |
|----------|--------|-------------|
| `GEMINI_API_KEY` | `backend/.env` | Google Gemini API key |
| `GEMINI_MODEL` | `backend/.env` | Model name (default: `gemini-2.5-flash`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | `backend/.env` | Path to Firebase service account JSON |
| `NEXT_PUBLIC_API_URL` | `agri-gain/.env.local` | Backend URL (default: `http://localhost:8000`) |

Never commit `.env`, `service.json`, or Firebase key files. Use `.env.template` as reference.

## API highlights

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Service health check |
| `/log_waste` | POST | Log waste, return `waste_log_id` + `estimated_kg` |
| `/get_opportunities` | POST | RAG-generated opportunities for a waste log |
| `/ai_insight` | POST | Multilingual waste Q&A |
| `/guides` | GET | List how-to guides |
| `/quantification/info` | GET | Waste types, units, conversion factors |

## Project structure

```
AgriGain/
├── agri-gain/           Next.js app (pages, components, lib/api.ts)
├── backend/
│   ├── main.py          FastAPI routes & lifespan
│   ├── rag_service.py   RAG + Gemini generation
│   ├── ingest.py        ChromaDB ingestion pipeline
│   ├── quantify.py      Unit → kg conversion
│   └── data/            Static knowledge base JSON
├── INTEGRATION.md       Frontend–backend integration notes
├── START_BACKEND.md     Backend startup guide
├── STATUS.md            Feature & status overview
└── devplan.md           Original development plan
```

## Testing

```bash
# Backend integration (requires running API on :8000)
node test-integration.js

# Backend unit tests
cd backend && pytest
```

## Deployment

See `backend/DEPLOYMENT.md` and `backend/Dockerfile` for Google Cloud Run. Run `startup.py` on boot to ensure ChromaDB is populated if the vector store is empty.

## License

Hackathon / educational project. Add a license file if you intend to open-source formally.
