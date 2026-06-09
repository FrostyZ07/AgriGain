# Agricultural Waste Backend - Google Cloud Run Deployment

This guide covers deploying the Agricultural Waste Management Backend to Google Cloud Run as specified in Phase 4.3 and 4.4 of the development plan.

## Prerequisites

1. **Google Cloud Project**: Active GCP project with billing enabled
2. **gcloud CLI**: Installed and authenticated
3. **Docker**: For local testing (optional)
4. **API Keys**: Gemini API key and Firebase service account

## Quick Deployment

```bash
# Clone and navigate to the backend directory
cd backend

# Run the automated deployment script
chmod +x deploy.sh
./deploy.sh YOUR_PROJECT_ID us-central1
```

## Manual Deployment Steps

### 1. Setup Google Cloud Project

```bash
# Set your project ID
PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 2. Create Secrets

**Gemini API Key:**
```bash
# Store your Gemini API key securely
echo -n "your-actual-gemini-api-key" | gcloud secrets create gemini-api-key --data-file=-
```

**Firebase Service Account:**
```bash
# Store your Firebase service account JSON
gcloud secrets create firebase-service-account-key --data-file=path/to/your-service-account.json
```

### 3. Build and Deploy

```bash
# Build the container image
IMAGE_NAME="gcr.io/${PROJECT_ID}/agri-gain-backend"
gcloud builds submit --tag $IMAGE_NAME .

# Deploy to Cloud Run
gcloud run deploy agri-gain-backend \
    --image $IMAGE_NAME \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --memory 4Gi \
    --cpu 2 \
    --concurrency 80 \
    --timeout 300 \
    --max-instances 10 \
    --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" \
    --set-secrets "GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-key.json=firebase-service-account-key:latest" \
    --execution-environment gen2
```

### 4. Configure Firebase

**Deploy Firestore Security Rules:**
```bash
firebase deploy --only firestore:rules --project $PROJECT_ID
```

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  Cloud Run      │────▶│   Firestore     │
│   (React)       │     │  Backend API    │     │   Database      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │   ChromaDB      │
                        │ (Vector Store)  │
                        └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │   Gemini AI     │
                        │    (Google)     │
                        └─────────────────┘
```

## Environment Configuration

The following environment variables are configured automatically:

- `PORT`: 8080 (Cloud Run port)
- `GEMINI_API_KEY`: From Google Secret Manager
- `GOOGLE_APPLICATION_CREDENTIALS`: Firebase service account path

## Resource Configuration

**CPU & Memory:**
- Memory: 4 GiB
- CPU: 2 vCPUs
- Concurrency: 80 requests per instance
- Timeout: 300 seconds

**Scaling:**
- Min instances: 0 (scale to zero)
- Max instances: 10
- Startup CPU boost: Enabled

## Health Checks

The service includes comprehensive health checks:

- **Startup Probe**: `/health` endpoint with 60s initial delay
- **Liveness Probe**: `/health` every 30 seconds
- **Readiness Probe**: `/health` every 10 seconds

## API Endpoints

Once deployed, your API will be available at:
- **Base URL**: `https://agri-gain-backend-[hash]-uc.a.run.app`
- **Documentation**: `/docs` (Swagger UI)
- **Health Check**: `/health`

### Key Endpoints:
- `POST /log_waste` - Log agricultural waste
- `GET /get_how_to_guide/{guide_id}` - Get processing guides
- `POST /get_opportunities` - Get AI-powered opportunities
- `GET /quantification/info` - Get available waste types and units

## Data Storage

**ChromaDB (Vector Database):**
- Path: `/app/chroma_db`
- Contains: 53 embedded documents from knowledge base
- Model: `all-MiniLM-L6-v2` embeddings

**Firestore Collections:**
```
artifacts/
  agri_gain_v1/
    users/
      {userId}/
        waste_logs/
          {wasteLogId} - Individual waste entries
        opportunities/
          {opportunityId} - Generated opportunities
```

## Monitoring & Troubleshooting

**View Logs:**
```bash
gcloud logs tail agri-gain-backend --region us-central1
```

**Monitor Performance:**
```bash
# View service details
gcloud run services describe agri-gain-backend --region us-central1

# View metrics in console
https://console.cloud.google.com/run/detail/us-central1/agri-gain-backend/metrics
```

**Common Issues:**

1. **Startup Timeout**: Increase `initialDelaySeconds` in startup probe
2. **Memory Issues**: Increase memory allocation or reduce model size
3. **API Key Errors**: Verify secrets are correctly configured
4. **ChromaDB Issues**: Check data initialization in startup logs

## Security Considerations

1. **Firestore Rules**: Implemented user-based access control
2. **Secrets Management**: API keys stored in Google Secret Manager
3. **Authentication**: Endpoints protected by Firebase Auth (where required)
4. **Network Security**: Cloud Run handles HTTPS automatically

## Cost Optimization

1. **Scale to Zero**: Configured to scale down when not in use
2. **Resource Limits**: Right-sized CPU and memory allocation
3. **Request Batching**: High concurrency settings for efficiency
4. **Startup Optimization**: CPU boost for faster cold starts

## Testing Deployment

**Health Check:**
```bash
curl https://your-service-url/health
```

**API Test:**
```bash
# Test quantification endpoint
curl https://your-service-url/quantification/info

# Test guide retrieval
curl https://your-service-url/get_how_to_guide/guide_001
```

## Updating the Service

**Code Changes:**
```bash
# Rebuild and redeploy
gcloud builds submit --tag gcr.io/$PROJECT_ID/agri-gain-backend .
gcloud run deploy agri-gain-backend --image gcr.io/$PROJECT_ID/agri-gain-backend
```

**Update Secrets:**
```bash
# Update Gemini API key
gcloud secrets versions add gemini-api-key --data-file=new-key-file

# Update Firebase credentials  
gcloud secrets versions add firebase-service-account-key --data-file=new-service-account.json
```

## Integration with Frontend

The backend is designed to work with the existing React frontend. Update the frontend's API base URL to point to your Cloud Run service:

```javascript
// In your React app configuration
const API_BASE_URL = 'https://your-cloud-run-url';
```

## Support & Maintenance

- **Logs**: Available through Google Cloud Console or gcloud CLI
- **Monitoring**: Built-in Cloud Run metrics and custom health checks
- **Updates**: Zero-downtime deployments with Cloud Run
- **Backup**: Firestore automatic backups and ChromaDB data persistence

For issues or questions, refer to the logs and monitoring dashboard in Google Cloud Console.