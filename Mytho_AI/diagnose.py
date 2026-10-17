#!/usr/bin/env python3
"""
Diagnostic script to identify backend issues
"""

import sys
import requests
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

def check_backend():
    """Check if backend is running and accessible"""
    print("\n🔍 Checking Backend Connectivity...")
    print("-" * 50)
    
    try:
        # Check health
        response = requests.get('http://localhost:5000/api/health', timeout=5)
        print(f"✓ Backend health: {response.status_code}")
        print(f"  Response: {response.json()}")
    except Exception as e:
        print(f"✗ Backend health check failed: {e}")
        return False
    
    try:
        # Check database
        response = requests.get('http://localhost:5000/api/health/db', timeout=5)
        print(f"✓ Database check: {response.status_code}")
        print(f"  Response: {response.json()}")
    except Exception as e:
        print(f"✗ Database check failed: {e}")
        return False
    
    return True

def check_assistant_endpoint():
    """Check if assistant data endpoint works"""
    print("\n🔍 Checking Assistant Endpoint...")
    print("-" * 50)
    
    try:
        response = requests.get('http://localhost:5000/api/pharmacy/assistant-data', timeout=10)
        print(f"✓ Assistant data endpoint: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  KPIs: {data.get('kpis')}")
            print(f"  Low stock items: {len(data.get('lowStock', []))}")
            print(f"  Recent bills: {len(data.get('recentBills', []))}")
        else:
            print(f"  Error response: {response.text[:200]}")
    except Exception as e:
        print(f"✗ Assistant endpoint failed: {e}")
        return False
    
    return response.status_code == 200

def check_tool_router():
    """Check if tool router works"""
    print("\n🔍 Checking Tool Router...")
    print("-" * 50)
    
    try:
        from assistant.tool_router import route_to_tool
        routing = route_to_tool("What is today's revenue?")
        if routing:
            print(f"✓ Tool routing works")
            print(f"  Tool: {routing.get('tool_id')}")
            print(f"  Confidence: {routing.get('confidence')}")
        else:
            print(f"✗ Tool routing returned None (LLM might not be available)")
    except Exception as e:
        print(f"✗ Tool routing failed: {e}")
        return False
    
    return routing is not None

def check_mytho_ai():
    """Check if Mytho_AI server is running"""
    print("\n🔍 Checking Mytho_AI Server...")
    print("-" * 50)
    
    try:
        response = requests.get('http://localhost:5001/health', timeout=5)
        print(f"✓ Mytho_AI health: {response.status_code}")
        print(f"  Response: {response.json()}")
        return True
    except Exception as e:
        print(f"✗ Mytho_AI server not responding: {e}")
        return False

def main():
    print("\n" + "="*50)
    print("  🔧 Pharmacy AI Diagnostic Tool")
    print("="*50)
    
    results = {}
    
    results['backend'] = check_backend()
    results['assistant_endpoint'] = check_assistant_endpoint() if results['backend'] else False
    results['tool_router'] = check_tool_router()
    results['mytho_ai'] = check_mytho_ai()
    
    print("\n" + "="*50)
    print("  📊 Summary")
    print("="*50)
    
    for check, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status} - {check.replace('_', ' ').title()}")
    
    print("\n" + "="*50)
    
    if all(results.values()):
        print("✅ All checks passed! System is working.")
    else:
        print("\n❌ Some checks failed. Common fixes:")
        
        if not results['backend']:
            print("\n1. Backend is not running or not responding")
            print("   Fix: cd backend && npm run dev")
        
        if not results['assistant_endpoint']:
            print("\n2. Assistant data endpoint is returning errors")
            print("   Fix: Check backend logs for database errors")
        
        if not results['tool_router']:
            print("\n3. Tool router is not working")
            print("   Fix: Check if Qwen model is cached (this is OK for first run)")
        
        if not results['mytho_ai']:
            print("\n4. Mytho_AI server is not running")
            print("   Fix: cd Mytho_AI && python server.py")
    
    print()

if __name__ == "__main__":
    main()
