#!/usr/bin/env python3
"""
Test script for Agri-Gain API endpoints
"""

import requests
import json
import time
from typing import Dict, Any

# API base URL
BASE_URL = "http://localhost:8000"

def test_health_check():
    """Test the health check endpoint"""
    print("Testing health check...")
    response = requests.get(f"{BASE_URL}/")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    print()

def test_log_waste():
    """Test waste logging endpoint"""
    print("Testing waste logging...")
    
    test_data = {
        "userId": "test_user_123",
        "waste_type": "rice_straw",
        "unit_name": "bundle",
        "quantity": 10
    }
    
    response = requests.post(f"{BASE_URL}/log_waste", json=test_data)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Success: {result['success']}")
        print(f"Waste Log ID: {result['waste_log_id']}")
        print(f"Estimated KG: {result['estimated_kg']}")
        return result['waste_log_id']
    else:
        print(f"Error: {response.text}")
        return None
    print()

def test_get_guide():
    """Test getting a how-to guide"""
    print("Testing how-to guide retrieval...")
    
    guide_id = "rice_straw_mushroom"
    response = requests.get(f"{BASE_URL}/get_how_to_guide/{guide_id}")
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        guide = response.json()
        print(f"Guide Title: {guide['title']}")
        print(f"Waste Type: {guide['waste_type']}")
        print(f"Difficulty: {guide['difficulty']}")
        print(f"Steps: {len(guide['steps'])}")
    else:
        print(f"Error: {response.text}")
    print()

def test_get_opportunities(waste_log_id: str):
    """Test getting opportunities"""
    if not waste_log_id:
        print("Skipping opportunities test - no waste log ID")
        return
    
    print("Testing opportunities generation...")
    
    test_data = {
        "userId": "test_user_123",
        "waste_log_id": waste_log_id
    }
    
    response = requests.post(f"{BASE_URL}/get_opportunities", json=test_data)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print("Opportunities generated:")
        print(result['opportunities_text'])
    else:
        print(f"Error: {response.text}")
    print()

def test_quantification_edge_cases():
    """Test quantification with various edge cases"""
    print("Testing quantification edge cases...")
    
    test_cases = [
        {
            "name": "Unknown waste type",
            "data": {
                "userId": "test_user_123",
                "waste_type": "unknown_waste",
                "unit_name": "bundle",
                "quantity": 5
            }
        },
        {
            "name": "Unknown unit",
            "data": {
                "userId": "test_user_123",
                "waste_type": "rice_straw",
                "unit_name": "unknown_unit",
                "quantity": 5
            }
        },
        {
            "name": "Zero quantity",
            "data": {
                "userId": "test_user_123",
                "waste_type": "rice_straw",
                "unit_name": "bundle",
                "quantity": 0
            }
        }
    ]
    
    for test_case in test_cases:
        print(f"Testing: {test_case['name']}")
        response = requests.post(f"{BASE_URL}/log_waste", json=test_case['data'])
        print(f"Status: {response.status_code}")
        if response.status_code != 200:
            print(f"Expected error: {response.json()}")
        print()

def main():
    """Run all API tests"""
    print("Starting Agri-Gain API Tests")
    print("=" * 50)
    
    # Wait for server to be ready
    print("Waiting for server to be ready...")
    for i in range(10):
        try:
            response = requests.get(f"{BASE_URL}/", timeout=5)
            if response.status_code == 200:
                print("Server is ready!")
                break
        except requests.exceptions.RequestException:
            pass
        time.sleep(2)
    else:
        print("Server not responding. Make sure it's running on localhost:8000")
        return
    
    print()
    
    # Run tests
    test_health_check()
    waste_log_id = test_log_waste()
    test_get_guide()
    test_get_opportunities(waste_log_id)
    test_quantification_edge_cases()
    
    print("API tests completed!")

if __name__ == "__main__":
    main()
