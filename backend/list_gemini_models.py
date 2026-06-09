#!/usr/bin/env python3
"""
List available Gemini models to find the correct model name
"""

import os
from dotenv import load_dotenv

load_dotenv()

try:
    import google.generativeai as genai
    
    # Configure with API key
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("❌ GEMINI_API_KEY not found in .env file")
        exit(1)
    
    genai.configure(api_key=api_key)
    
    print("=== Available Gemini Models ===\n")
    
    models = genai.list_models()
    
    for model in models:
        if 'generateContent' in model.supported_generation_methods:
            print(f"✅ {model.name}")
            print(f"   Display name: {model.display_name}")
            print(f"   Description: {model.description}")
            print(f"   Methods: {model.supported_generation_methods}")
            print()
    
    print("=== Testing Models ===\n")
    
    # Test common model names
    test_models = [
        'gemini-pro',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.0-pro',
        'models/gemini-pro',
        'models/gemini-1.5-pro',
        'models/gemini-1.0-pro'
    ]
    
    for model_name in test_models:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content("Hello, this is a test.")
            if response.text:
                print(f"✅ {model_name} - Works!")
                print(f"   Response: {response.text[:100]}...")
                break
            else:
                print(f"❌ {model_name} - Empty response")
        except Exception as e:
            print(f"❌ {model_name} - Error: {e}")

except ImportError:
    print("❌ google-generativeai package not installed")
    print("Install with: pip install google-generativeai")
except Exception as e:
    print(f"❌ Error: {e}")