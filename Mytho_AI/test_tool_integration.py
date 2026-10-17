"""
test_tool_integration.py
------------------------
Comprehensive test suite for the tool-based assistant architecture.

Tests:
1. Tool router identification (LLM correctly routes queries)
2. Tool execution (backend API calls)
3. Chat integration (tool routing + LLM response formatting)
4. Full end-to-end flow

Usage:
    python test_tool_integration.py

or run individual tests:
    python -m pytest test_tool_integration.py -v
"""

import asyncio
import json
import logging
import requests
import sys
from pathlib import Path
from typing import Optional, Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from assistant import tool_router, chat
from assistant.tools import get_tools_schema, TOOLS

logging.basicConfig(
    level=logging.DEBUG,
    format="[%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger("test_tool_integration")

# Test configuration
BACKEND_URL = "http://localhost:5000"
ASSISTANT_URL = "http://localhost:5001"

# ─────────────────────────────────────────────────────────────────

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(title: str):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.CYAN}{title.center(60)}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.ENDC}\n")

def print_test(name: str, status: str, details: str = ""):
    status_symbol = f"{Colors.GREEN}✓{Colors.ENDC}" if status == "PASS" else f"{Colors.RED}✗{Colors.ENDC}"
    print(f"{status_symbol} {Colors.BOLD}{name}{Colors.ENDC}")
    if details:
        print(f"  {Colors.YELLOW}{details}{Colors.ENDC}")

def print_section(name: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}→ {name}{Colors.ENDC}")

# ─────────────────────────────────────────────────────────────────

def test_backend_connectivity() -> bool:
    """Check if backend is running and accessible."""
    print_section("Testing Backend Connectivity")
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/pharmacy/assistant-data", timeout=5)
        if response.status_code == 200:
            print_test("Backend connection", "PASS", "Connected to backend API")
            return True
        else:
            print_test("Backend connection", "FAIL", f"Status code: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print_test("Backend connection", "FAIL", f"Could not connect to {BACKEND_URL}")
        return False
    except Exception as e:
        print_test("Backend connection", "FAIL", str(e))
        return False

# ─────────────────────────────────────────────────────────────────

def test_tools_schema() -> bool:
    """Verify tool definitions are properly formatted."""
    print_section("Testing Tool Schema")
    
    try:
        schema = get_tools_schema()
        if not schema:
            print_test("Tool schema generation", "FAIL", "Schema is empty")
            return False
        
        print_test("Tool schema generation", "PASS", f"Generated schema for {len(TOOLS)} tools")
        
        # Display available tools
        for tool in TOOLS:
            print(f"    • {tool['id']}: {tool['description'][:50]}...")
        
        return True
    except Exception as e:
        print_test("Tool schema generation", "FAIL", str(e))
        return False

# ─────────────────────────────────────────────────────────────────

def test_tool_routing() -> bool:
    """Test that tool router correctly identifies tools from queries."""
    print_section("Testing Tool Router")
    
    test_queries = [
        ("Show me bill PH-BILL-0005", "search_bills"),
        ("Check Aspirin stock", "check_inventory"),
        ("What is today's revenue?", "get_daily_revenue"),
        ("List low stock medicines", "get_inventory_alerts"),
        ("Patient John's history", "search_patient_history"),
    ]
    
    success_count = 0
    
    for query, expected_tool in test_queries:
        try:
            routing = tool_router.route_to_tool(query)
            
            if routing is None:
                print_test(
                    f"Route: {query[:40]}...",
                    "FAIL",
                    "Tool router returned None"
                )
                continue
            
            detected_tool = routing.get("tool_id")
            confidence = routing.get("confidence", 0)
            
            if detected_tool == expected_tool:
                print_test(
                    f"Route: {query[:40]}...",
                    "PASS",
                    f"Tool: {detected_tool} (confidence: {confidence:.2f})"
                )
                success_count += 1
            else:
                print_test(
                    f"Route: {query[:40]}...",
                    "FAIL",
                    f"Expected {expected_tool}, got {detected_tool}"
                )
        
        except Exception as e:
            print_test(
                f"Route: {query[:40]}...",
                "FAIL",
                str(e)
            )
    
    result = success_count > 0
    print(f"\n  {Colors.YELLOW}Tool routing: {success_count}/{len(test_queries)} queries routed correctly{Colors.ENDC}")
    return result

# ─────────────────────────────────────────────────────────────────

async def test_tool_execution() -> bool:
    """Test that tools can execute backend API calls."""
    print_section("Testing Tool Execution")
    
    test_cases = [
        {
            "query": "What is today's revenue?",
            "expected_tool": "get_daily_revenue",
        },
        {
            "query": "Show me bills",
            "expected_tool": "search_bills",
        },
        {
            "query": "Check medicine inventory",
            "expected_tool": "check_inventory",
        },
    ]
    
    success_count = 0
    
    for test_case in test_cases:
        query = test_case["query"]
        
        try:
            # Route the query
            routing = tool_router.route_to_tool(query)
            if routing is None:
                print_test(
                    f"Execute: {query[:40]}...",
                    "FAIL",
                    "Tool routing failed"
                )
                continue
            
            # Execute the tool
            result = await tool_router.execute_tool(routing)
            
            if result is None:
                print_test(
                    f"Execute: {query[:40]}...",
                    "FAIL",
                    "Tool execution returned None"
                )
                continue
            
            status = result.get("status")
            data = result.get("data", {})
            
            if status == "success":
                print_test(
                    f"Execute: {query[:40]}...",
                    "PASS",
                    f"Tool: {result.get('tool_id')}, Data size: {len(str(data))} chars"
                )
                success_count += 1
            else:
                error = result.get("error", "Unknown error")
                print_test(
                    f"Execute: {query[:40]}...",
                    "FAIL",
                    f"Status: {status}, Error: {error}"
                )
        
        except Exception as e:
            print_test(
                f"Execute: {query[:40]}...",
                "FAIL",
                str(e)
            )
    
    result = success_count > 0
    print(f"\n  {Colors.YELLOW}Tool execution: {success_count}/{len(test_cases)} tools executed successfully{Colors.ENDC}")
    return result

# ─────────────────────────────────────────────────────────────────

async def test_chat_integration() -> bool:
    """Test the full chat.py integration with tools."""
    print_section("Testing Chat Integration")
    
    test_queries = [
        "What is today's pharmacy revenue?",
        "Show me the latest bills",
        "Which medicines have low stock?",
    ]
    
    success_count = 0
    
    for query in test_queries:
        try:
            result = await chat.process_message(query, "english")
            
            reply = result.get("reply", "")
            intent = result.get("intent", "")
            error = result.get("error")
            
            if reply and not error:
                print_test(
                    f"Chat: {query[:40]}...",
                    "PASS",
                    f"Intent: {intent}, Reply: {reply[:50]}..."
                )
                success_count += 1
            else:
                print_test(
                    f"Chat: {query[:40]}...",
                    "FAIL",
                    f"Error: {error or 'No reply'}"
                )
        
        except Exception as e:
            print_test(
                f"Chat: {query[:40]}...",
                "FAIL",
                str(e)
            )
    
    result = success_count > 0
    print(f"\n  {Colors.YELLOW}Chat integration: {success_count}/{len(test_queries)} queries processed{Colors.ENDC}")
    return result

# ─────────────────────────────────────────────────────────────────

def test_assistant_api() -> bool:
    """Test the Flask API endpoint."""
    print_section("Testing Assistant API")
    
    try:
        response = requests.get(f"{ASSISTANT_URL}/health", timeout=5)
        if response.status_code == 200:
            print_test("API health check", "PASS", "Assistant service is healthy")
        else:
            print_test("API health check", "FAIL", f"Status: {response.status_code}")
            return False
        
        # Test query endpoint
        payload = {
            "message": "What is today's revenue?",
            "language": "english"
        }
        
        response = requests.post(
            f"{ASSISTANT_URL}/api/query",
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            reply = data.get("reply", "")
            intent = data.get("intent", "")
            print_test(
                "API query endpoint",
                "PASS",
                f"Intent: {intent}, Reply length: {len(reply)} chars"
            )
            return True
        else:
            print_test("API query endpoint", "FAIL", f"Status: {response.status_code}")
            return False
    
    except requests.exceptions.ConnectionError:
        print_test(
            "API health check",
            "FAIL",
            f"Could not connect to {ASSISTANT_URL}"
        )
        return False
    except Exception as e:
        print_test("API query endpoint", "FAIL", str(e))
        return False

# ─────────────────────────────────────────────────────────────────

async def run_all_tests():
    """Run all tests in sequence."""
    print_header("🧪 Tool Integration Test Suite")
    
    results = {}
    
    # Test backend connectivity first (required for other tests)
    results["backend_connectivity"] = test_backend_connectivity()
    
    if not results["backend_connectivity"]:
        print(f"\n{Colors.RED}{Colors.BOLD}⚠ Backend is not accessible. Some tests will be skipped.{Colors.ENDC}\n")
    
    # Test schema
    results["tools_schema"] = test_tools_schema()
    
    # Test tool routing (doesn't require backend)
    results["tool_routing"] = test_tool_routing()
    
    # Test tool execution (requires backend)
    if results["backend_connectivity"]:
        results["tool_execution"] = await test_tool_execution()
    else:
        print_section("Testing Tool Execution")
        print(f"{Colors.YELLOW}Skipped (backend not available){Colors.ENDC}")
        results["tool_execution"] = None
    
    # Test chat integration (requires backend and LLM)
    if results["backend_connectivity"]:
        results["chat_integration"] = await test_chat_integration()
    else:
        print_section("Testing Chat Integration")
        print(f"{Colors.YELLOW}Skipped (backend not available){Colors.ENDC}")
        results["chat_integration"] = None
    
    # Test API (requires assistant service)
    results["api_endpoint"] = test_assistant_api()
    
    # Print summary
    print_header("📊 Test Summary")
    
    total_tests = 0
    passed_tests = 0
    
    for test_name, result in results.items():
        if result is not None:
            total_tests += 1
            if result:
                passed_tests += 1
                status = f"{Colors.GREEN}✓ PASS{Colors.ENDC}"
            else:
                status = f"{Colors.RED}✗ FAIL{Colors.ENDC}"
            
            test_display = test_name.replace("_", " ").title()
            print(f"{status}  {test_display}")
    
    # Overall result
    print()
    if passed_tests == total_tests and total_tests > 0:
        print(f"{Colors.GREEN}{Colors.BOLD}✓ All tests passed!{Colors.ENDC}")
        print(f"{Colors.YELLOW}You're ready to use the tool-based assistant.{Colors.ENDC}")
    else:
        print(f"{Colors.YELLOW}⚠ {total_tests - passed_tests}/{total_tests} tests failed.{Colors.ENDC}")
        print(f"{Colors.YELLOW}Check the errors above and ensure backend is running.{Colors.ENDC}")
    
    print()

# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    asyncio.run(run_all_tests())
