# How to Start the AI Insight Backend Server

To use the AI Insight chatbot feature, you need to start the backend server. Here's how:

## Prerequisites
1. Make sure you have Python 3.8+ installed
2. Install required packages (if not already done):
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

## Starting the Backend Server

### Option 1: Using Python directly
```bash
cd backend
python main.py
```

### Option 2: Using Uvicorn
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## What You Should See
When the server starts successfully, you'll see output like:
```
INFO: ChromaDB initialized - collection has 53 documents
INFO: Sentence transformer model loaded
INFO: Loaded 20 quantification models  
INFO: RAG service initialized successfully
INFO: Application startup complete.
```

The server will be running at: **http://localhost:8000**

## Testing the Server
Once running, you can:
1. Visit `http://localhost:8000/docs` to see the API documentation
2. Test the health endpoint: `http://localhost:8000/health`
3. The AI Insight chatbot in the frontend will automatically detect the running server

## Troubleshooting

### Common Issues:
1. **Port 8000 already in use**: Stop other services or change the port
2. **Missing packages**: Run `pip install -r requirements.txt`
3. **ChromaDB issues**: Make sure the `chroma_db` folder exists with data
4. **Gemini API**: Set your `GEMINI_API_KEY` in the `.env` file for AI responses

### AI Insight Features:
- **Knowledge Base First**: Uses your agricultural waste knowledge base
- **Gemini AI Fallback**: Uses Google's Gemini AI for questions not in knowledge base  
- **Multilingual Support**: Supports 10 languages including Hindi, Tamil, etc.
- **Waste-Type Specific**: Can provide targeted advice for specific waste types

## Environment Variables
Create a `.env` file in the backend directory with:
```
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_APPLICATION_CREDENTIALS=path_to_your_firebase_credentials.json
```

## Once Running:
1. Go to the **Guides** page in the frontend
2. Look for the **AI Waste Expert** section
3. Click "Start Chat" to begin asking questions
4. The interface will show "Knowledge base + AI powered" when connected

The chatbot will intelligently use your knowledge base first, then fall back to Gemini AI for comprehensive answers!