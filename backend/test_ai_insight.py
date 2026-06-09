#!/usr/bin/env python3
"""
Test script for AI Insight endpoint
"""
import requests
import json

def test_ai_insight():
    """Test the AI insight endpoint"""
    url = "http://localhost:8000/ai_insight"
    
    # Test data
    test_request = {
        "question": "How do I start composting vegetable waste?",
        "language": "english",
        "waste_type": "vegetable_trimmings",
        "context": "I am a beginner farmer with about 10kg of vegetable trimmings daily"
    }
    
    try:
        print("Testing AI Insight endpoint...")
        print(f"URL: {url}")
        print(f"Request: {json.dumps(test_request, indent=2)}")
        
        response = requests.post(url, json=test_request, timeout=30)
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nSuccess! Response:")
            print(f"Question: {result.get('question')}")
            print(f"Answer: {result.get('answer')}")
            print(f"Sources Used: {result.get('sources_used')}")
            print(f"Confidence: {result.get('confidence_score')}")
            print(f"Language: {result.get('language')}")
            print(f"Processing Time: {result.get('processing_time_ms')}ms")
            print(f"Fallback Used: {result.get('fallback_used')}")
            if result.get('related_guides'):
                print(f"Related Guides: {result.get('related_guides')}")
        else:
            print(f"\nError Response:")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to backend server at localhost:8000")
        print("Make sure the backend server is running with: python main.py")
    except requests.exceptions.Timeout:
        print("ERROR: Request timed out after 30 seconds")
    except Exception as e:
        print(f"ERROR: {e}")

def test_health():
    """Test the health endpoint first"""
    try:
        response = requests.get("http://localhost:8000/health", timeout=10)
        print(f"Health Status: {response.status_code}")
        if response.status_code == 200:
            health = response.json()
            print("Services status:")
            for service, status in health.get('services', {}).items():
                print(f"  {service}: {status}")
            return True
    except:
        print("Health check failed - server not running")
        return False

if __name__ == "__main__":
    print("=== AI Insight Endpoint Test ===\n")
    
    if test_health():
        print("\n" + "="*50 + "\n")
        test_ai_insight()
    else:
        print("Please start the backend server first: python main.py")