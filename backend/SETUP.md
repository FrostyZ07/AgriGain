# Agricultural Waste Backend - Setup Guide

This guide walks you through setting up all the required credentials and environment variables for the Agricultural Waste Backend.

## 🚀 Quick Setup

1. **Copy the environment template:**
   ```bash
   cp .env.template .env
   ```

2. **Fill in your credentials** (see detailed steps below)

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Initialize the database:**
   ```bash
   python ingest.py
   ```

5. **Start the server:**
   ```bash
   uvicorn main:app --reload
   ```

## 📝 Required Credentials

### 1. Google Gemini API Key

**Get your API key:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key

**Add to .env:**
```env
GEMINI_API_KEY=AIzaSyC-your-actual-api-key-here
```

### 2. Firebase Service Account

**Create a Firebase project:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Enable Firestore Database

**Get service account key:**
1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Save it securely (e.g., `firebase-key.json`)

**Add to .env:**
```env
GOOGLE_APPLICATION_CREDENTIALS=./firebase-key.json
GOOGLE_CLOUD_PROJECT=your-firebase-project-id
```

### 3. Google Cloud Project (for deployment)

**Create/Select GCP Project:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Note the Project ID

**Add to .env:**
```env
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
```

## 🔧 Environment Configuration

### Development Setup

For local development, update these values in `.env`:

```env
APP_ENV=development
PORT=8000
DEBUG=true
LOG_LEVEL=INFO

# Frontend URLs (update if different)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Production Setup

For production deployment:

```env
APP_ENV=production
DEBUG=false
LOG_LEVEL=WARNING

# Your production frontend URL
CORS_ORIGINS=https://your-domain.com
```

## 📁 File Structure After Setup

```
backend/
├── .env                          # Your credentials (DO NOT COMMIT)
├── .env.template                 # Template file (safe to commit)
├── firebase-key.json            # Firebase credentials (DO NOT COMMIT)
├── chroma_db/                    # Vector database (created after ingestion)
└── ... (other project files)
```

## 🧪 Testing Your Setup

### 1. Test Environment Loading
```bash
python -c "
import os
from dotenv import load_dotenv
load_dotenv()
print('✅ Gemini API Key loaded:', bool(os.getenv('GEMINI_API_KEY')))
print('✅ Firebase configured:', bool(os.getenv('GOOGLE_APPLICATION_CREDENTIALS')))
"
```

### 2. Test Firebase Connection
```bash
python -c "
import os
from dotenv import load_dotenv
load_dotenv()
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    
    cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
    app = firebase_admin.initialize_app(cred)
    db = firestore.client()
    print('✅ Firebase connection successful')
except Exception as e:
    print('❌ Firebase error:', e)
"
```

### 3. Test ChromaDB Setup
```bash
python ingest.py
# Should output: "✅ Successfully ingested X documents"
```

### 4. Test API Server
```bash
uvicorn main:app --reload
# Visit: http://localhost:8000/docs
```

## 🔒 Security Best Practices

### Never Commit Secrets
The `.gitignore` file is configured to exclude:
- `.env` files
- Firebase keys (`*service-account*.json`)
- API keys (`*api-key*`)
- ChromaDB data

### Secure File Permissions
```bash
# Make credential files readable only by you
chmod 600 .env
chmod 600 firebase-key.json
```

### Environment-Specific Files
Create separate environment files if needed:
- `.env.development` - Development settings
- `.env.staging` - Staging environment
- `.env.production` - Production settings

## 🚨 Troubleshooting

### Common Issues

**"No module named 'dotenv'"**
```bash
pip install python-dotenv
```

**"Firebase Admin SDK could not be initialized"**
- Check that `GOOGLE_APPLICATION_CREDENTIALS` points to a valid JSON file
- Verify the file has proper permissions
- Ensure the service account has Firestore permissions

**"ChromaDB collection not found"**
```bash
# Reinitialize the database
rm -rf chroma_db/
python ingest.py
```

**"Gemini API quota exceeded"**
- Check your API usage in [Google AI Studio](https://makersuite.google.com/)
- Consider upgrading your quota or implementing rate limiting

### Debug Mode

Enable verbose logging:
```env
LOG_LEVEL=DEBUG
DEBUG=true
```

### Health Check

Test all services:
```bash
curl http://localhost:8000/health
```

Should return:
```json
{
  "status": "healthy",
  "services": {
    "firestore": "connected",
    "chromadb": "connected (53 docs)",
    "embedding_model": "loaded",
    "rag_service": "initialized"
  }
}
```

## 🌐 Frontend Integration

Update your frontend configuration to use the backend:

**React/Next.js:**
```javascript
// config/api.js
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
```

**Environment file for frontend:**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all credentials are correctly configured
3. Review the logs for specific error messages
4. Test individual components using the testing commands

The system should work seamlessly once all credentials are properly configured!