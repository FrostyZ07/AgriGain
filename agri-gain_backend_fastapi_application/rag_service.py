import os
import logging
from typing import List, Dict, Any
import google.generativeai as genai
import chromadb
from sentence_transformers import SentenceTransformer
import json

logger = logging.getLogger(__name__)

class RAGService:
    """Service for Retrieval-Augmented Generation using ChromaDB and Gemini"""
    
    def __init__(self):
        self.chroma_client = None
        self.collection = None
        self.embedding_model = None
        self.genai_model = None
        self.initialized = False
    
    async def initialize(self):
        """Initialize the RAG service components"""
        try:
            # Initialize ChromaDB
            self.chroma_client = chromadb.PersistentClient(path="./chroma_db")
            
            # Get or create collection
            try:
                self.collection = self.chroma_client.get_collection("agri_knowledge")
                logger.info("Loaded existing ChromaDB collection")
            except:
                # Collection doesn't exist, create it
                self.collection = self.chroma_client.create_collection("agri_knowledge")
                logger.info("Created new ChromaDB collection")
                # Load initial data if available
                await self._load_initial_data()
            
            # Initialize embedding model
            self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("Loaded sentence transformer model")
            
            # Initialize Gemini
            api_key = os.getenv("GOOGLE_API_KEY")
            if not api_key:
                logger.warning("GOOGLE_API_KEY not found, using mock responses")
                self.genai_model = None
            else:
                genai.configure(api_key=api_key)
                self.genai_model = genai.GenerativeModel('gemini-2.0-flash-exp')
                logger.info("Initialized Gemini model")
            
            self.initialized = True
            
        except Exception as e:
            logger.error(f"Failed to initialize RAG service: {e}")
            raise
    
    async def _load_initial_data(self):
        """Load initial knowledge base data into ChromaDB"""
        try:
            # Load and chunk how-to guides
            await self._load_how_to_guides()
            
            # Load safety sheets
            await self._load_safety_sheets()
            
            # Load market data as searchable content
            await self._load_market_data()
            
            logger.info("Loaded initial knowledge base data")
            
        except Exception as e:
            logger.warning(f"Could not load initial data: {e}")
            # Create some sample data for development
            await self._create_sample_data()
    
    async def _load_how_to_guides(self):
        """Load how-to guides into vector database"""
        try:
            with open("data/how_to_guides.json", "r") as f:
                guides = json.load(f)
            
            documents = []
            metadatas = []
            ids = []
            
            for guide in guides:
                # Create searchable content from guide
                content = f"Title: {guide['title']}\n"
                content += f"Description: {guide['description']}\n"
                content += f"Steps: {' '.join(guide['steps'])}\n"
                content += f"Materials: {', '.join(guide['materials_needed'])}"
                
                documents.append(content)
                metadatas.append({
                    "source_type": "how_to_guide",
                    "guide_id": guide["guide_id"],
                    "waste_type": guide["waste_type"],
                    "region": guide["region"],
                    "difficulty": guide["difficulty"]
                })
                ids.append(f"guide_{guide['guide_id']}")
            
            if documents:
                self.collection.add(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
                logger.info(f"Added {len(documents)} how-to guides to vector DB")
                
        except FileNotFoundError:
            logger.warning("How-to guides file not found")
    
    async def _load_safety_sheets(self):
        """Load safety sheets into vector database"""
        try:
            with open("data/safety_sheets.json", "r") as f:
                sheets = json.load(f)
            
            documents = []
            metadatas = []
            ids = []
            
            for sheet in sheets:
                documents.append(sheet["content"])
                metadatas.append({
                    "source_type": "safety_sheet",
                    "sheet_id": sheet["sheet_id"],
                    "waste_type": sheet["waste_type"],
                    "source": sheet["source"]
                })
                ids.append(f"safety_{sheet['sheet_id']}")
            
            if documents:
                self.collection.add(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
                logger.info(f"Added {len(documents)} safety sheets to vector DB")
                
        except FileNotFoundError:
            logger.warning("Safety sheets file not found")
    
    async def _load_market_data(self):
        """Load market data as searchable content"""
        try:
            with open("data/market_data.json", "r") as f:
                market_data = json.load(f)
            
            documents = []
            metadatas = []
            ids = []
            
            for data in market_data:
                content = f"Market price for {data['waste_type']} as {data['product_type']} "
                content += f"in {data['region']}: ${data['avg_price_per_kg']:.2f} per kg. "
                content += f"Source: {data['source']}"
                
                documents.append(content)
                metadatas.append({
                    "source_type": "market_data",
                    "data_id": data["data_id"],
                    "waste_type": data["waste_type"],
                    "product_type": data["product_type"],
                    "region": data["region"],
                    "price_per_kg": data["avg_price_per_kg"]
                })
                ids.append(f"market_{data['data_id']}")
            
            if documents:
                self.collection.add(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
                logger.info(f"Added {len(documents)} market data entries to vector DB")
                
        except FileNotFoundError:
            logger.warning("Market data file not found")
    
    async def _create_sample_data(self):
        """Create sample data for development"""
        sample_documents = [
            "Rice straw can be used for mushroom cultivation. Bundle the straw and sterilize before use.",
            "Corn husks are excellent for composting. Mix with green materials for best results.",
            "Rice straw sells for $0.15 per kg in Punjab region for paper manufacturing.",
            "Safety: Always wear gloves when handling rice straw to avoid cuts from sharp edges."
        ]
        
        sample_metadatas = [
            {"source_type": "how_to_guide", "waste_type": "rice_straw", "region": "general"},
            {"source_type": "how_to_guide", "waste_type": "corn_husks", "region": "general"},
            {"source_type": "market_data", "waste_type": "rice_straw", "region": "punjab"},
            {"source_type": "safety_sheet", "waste_type": "rice_straw", "region": "general"}
        ]
        
        sample_ids = ["sample_1", "sample_2", "sample_3", "sample_4"]
        
        self.collection.add(
            documents=sample_documents,
            metadatas=sample_metadatas,
            ids=sample_ids
        )
        
        logger.info("Created sample knowledge base data")
    
    async def get_grounded_opportunities(self, waste_type: str, total_kg: float, region: str) -> str:
        """
        Generate grounded opportunities using RAG
        
        Args:
            waste_type: Type of waste
            total_kg: Total amount in kg
            region: User's region
            
        Returns:
            AI-generated opportunities text
        """
        if not self.initialized:
            raise ValueError("RAG service not initialized")
        
        try:
            # Generate search queries
            search_queries = [
                f"how to use {waste_type}",
                f"market price {waste_type} in {region}",
                f"local buyers {waste_type} in {region}",
                f"safety handling {waste_type}",
                f"processing {waste_type}",
                f"composting {waste_type}"
            ]
            
            # Retrieve relevant documents
            context_chunks = []
            for query in search_queries:
                try:
                    results = self.collection.query(
                        query_texts=[query],
                        n_results=3,
                        where={"waste_type": waste_type} if waste_type else None
                    )
                    
                    if results['documents'] and results['documents'][0]:
                        context_chunks.extend(results['documents'][0])
                        
                except Exception as e:
                    logger.warning(f"Query failed for '{query}': {e}")
                    continue
            
            # Remove duplicates and combine context
            unique_chunks = list(set(context_chunks))
            context = "\n\n".join(unique_chunks[:10])  # Limit context size
            
            # Generate response using Gemini
            if self.genai_model:
                response = await self._generate_with_gemini(waste_type, total_kg, region, context)
            else:
                response = self._generate_mock_response(waste_type, total_kg, region)
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating opportunities: {e}")
            return self._generate_fallback_response(waste_type, total_kg)
    
    async def _generate_with_gemini(self, waste_type: str, total_kg: float, region: str, context: str) -> str:
        """Generate response using Gemini API"""
        system_prompt = """You are Agri-Gain, an expert AI assistant for farmers. You provide clear, simple, and actionable advice. 
        You MUST use ONLY the context provided to answer. Do not invent information. 
        Structure your answer into 'On-Farm Use', 'Local Sale', and 'Process & Sell' categories."""
        
        user_prompt = f"""Based on the following context, provide opportunities for a farmer who has {total_kg} kg of {waste_type} in the {region} region.

Context:
{context}

Please provide specific, actionable advice organized into:
1. On-Farm Use - ways to use the waste on the farm
2. Local Sale - opportunities to sell the waste locally
3. Process & Sell - ways to process the waste into value-added products

Farmer's situation: {total_kg} kg of {waste_type} in {region} region."""
        
        try:
            response = self.genai_model.generate_content(f"{system_prompt}\n\n{user_prompt}")
            return response.text
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return self._generate_fallback_response(waste_type, total_kg)
    
    def _generate_mock_response(self, waste_type: str, total_kg: float, region: str) -> str:
        """Generate mock response for development"""
        return f"""**Opportunities for {total_kg} kg of {waste_type} in {region}**

**On-Farm Use:**
- Use as mulch around crops to retain soil moisture
- Compost with kitchen waste to create organic fertilizer
- Use as bedding material for livestock

**Local Sale:**
- Contact local paper mills - they often buy agricultural waste
- Sell to mushroom farmers who need substrate material
- Check with local biomass energy plants

**Process & Sell:**
- Create compressed bales for easier transport and higher value
- Process into biochar for soil amendment
- Make handicrafts or packaging materials

*Note: This is a development response. Connect your Google API key for AI-powered recommendations.*"""
    
    def _generate_fallback_response(self, waste_type: str, total_kg: float) -> str:
        """Generate fallback response when AI fails"""
        return f"""**Basic Opportunities for {total_kg} kg of {waste_type}**

**On-Farm Use:**
- Composting for organic fertilizer
- Mulching for soil protection
- Animal bedding material

**Local Sale:**
- Contact local farmers or cooperatives
- Check with waste management companies
- Explore biomass energy buyers

**Process & Sell:**
- Bundle for easier handling
- Dry for better preservation
- Mix with other materials for value addition

*Note: For detailed, AI-powered recommendations, please ensure proper API configuration.*"""
