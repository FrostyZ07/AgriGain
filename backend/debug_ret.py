import chromadb
from sentence_transformers import SentenceTransformer
from rag_service import RAGService
from dotenv import load_dotenv

load_dotenv()

# Initialize ChromaDB
client = chromadb.PersistentClient(path="chroma_db")
collection = client.get_collection("agri_waste_knowledge")

# Load embedding model
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# Initialize RAG service
rag = RAGService(
    chroma_collection=collection,
    embedding_model=embedding_model
)

# Change these to test different cases
waste_type = "rice_husks"
quantity = 500
region = "punjab"

# Generate search queries
queries = rag.generate_search_queries(
    waste_type=waste_type,
    total_kg=quantity,
    region=region
)

print("=" * 80)
print("SEARCH QUERIES")
print("=" * 80)
for q in queries:
    print("-", q)

# Retrieve documents
docs = rag.query_vector_database(
    queries=queries,
    waste_type=waste_type,
    n_results_per_query=2
)

print(f"\nRetrieved {len(docs)} documents")

for i, doc in enumerate(docs, 1):
    print("\n" + "=" * 80)
    print(f"Document {i}")
    print("=" * 80)
    print("Matched Query :", doc["query"])
    print("Distance      :", doc["distance"])
    print("Source Type   :", doc["metadata"].get("source_type"))
    print("Waste Type    :", doc["metadata"].get("waste_type"))
    print("Region        :", doc["metadata"].get("region"))
    print("\nCONTENT:\n")
    print(doc["document"])

context = rag.build_context_string(
    docs,
    waste_type=waste_type
)

print("\n" + "=" * 80)
print("CONTEXT SENT TO GEMINI")
print("=" * 80)
print(context)