#!/bin/bash

# Google Cloud Run Deployment Script for Agricultural Waste Backend
# Usage: ./deploy.sh PROJECT_ID REGION

set -e

# Configuration
PROJECT_ID=${1:-"your-project-id"}
REGION=${2:-"us-central1"}
SERVICE_NAME="agri-gain-backend"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying Agricultural Waste Backend to Google Cloud Run"
echo "Project ID: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo "=================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Set the project
echo "📋 Setting Google Cloud project..."
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo "🔧 Enabling required Google Cloud APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com

# Build the Docker image
echo "🐳 Building Docker image..."
gcloud builds submit --tag ${IMAGE_NAME} .

echo "✅ Docker image built successfully: ${IMAGE_NAME}"

# Create secrets if they don't exist
echo "🔐 Setting up secrets..."

# Check if Gemini API key secret exists
if ! gcloud secrets describe gemini-api-key --quiet 2>/dev/null; then
    echo "Creating Gemini API key secret (you'll need to add the actual key)..."
    echo -n "placeholder-gemini-key" | gcloud secrets create gemini-api-key --data-file=-
    echo "⚠️  Remember to update the gemini-api-key secret with your actual API key:"
    echo "   gcloud secrets versions add gemini-api-key --data-file=<path-to-key-file>"
else
    echo "✅ Gemini API key secret already exists"
fi

# Check if Firebase service account key secret exists
if ! gcloud secrets describe firebase-service-account-key --quiet 2>/dev/null; then
    echo "Creating Firebase service account key secret (you'll need to add the actual key)..."
    echo -n '{"type": "service_account"}' | gcloud secrets create firebase-service-account-key --data-file=-
    echo "⚠️  Remember to update the firebase-service-account-key secret with your actual service account JSON:"
    echo "   gcloud secrets versions add firebase-service-account-key --data-file=<path-to-service-account.json>"
else
    echo "✅ Firebase service account key secret already exists"
fi

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --memory 4Gi \
    --cpu 2 \
    --concurrency 80 \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --set-env-vars "PORT=8080" \
    --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" \
    --set-secrets "GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-key.json=firebase-service-account-key:latest" \
    --execution-environment gen2

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')

echo ""
echo "🎉 Deployment completed successfully!"
echo "=================================="
echo "Service URL: ${SERVICE_URL}"
echo "Health Check: ${SERVICE_URL}/health"
echo "API Documentation: ${SERVICE_URL}/docs"
echo ""
echo "Next steps:"
echo "1. Update the Gemini API key secret:"
echo "   gcloud secrets versions add gemini-api-key --data-file=<your-gemini-key-file>"
echo ""
echo "2. Update the Firebase service account key:"
echo "   gcloud secrets versions add firebase-service-account-key --data-file=<your-service-account.json>"
echo ""
echo "3. Test the API endpoints:"
echo "   curl ${SERVICE_URL}/health"
echo ""
echo "4. Configure Firebase security rules for production use"
echo ""

# Test the health endpoint
echo "🔍 Testing health endpoint..."
if curl -f "${SERVICE_URL}/health" > /dev/null 2>&1; then
    echo "✅ Health check passed!"
else
    echo "⚠️  Health check failed - check logs with:"
    echo "   gcloud logs tail ${SERVICE_NAME} --region ${REGION}"
fi

echo ""
echo "📊 To view logs:"
echo "gcloud logs tail ${SERVICE_NAME} --region ${REGION}"
echo ""
echo "📈 To view metrics and monitoring:"
echo "https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/metrics?project=${PROJECT_ID}"