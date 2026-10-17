#!/usr/bin/env python
"""Quick debug script to test tool routing and execution"""

import asyncio
import json
import sys
sys.path.insert(0, ".")
from assistant import tool_router, llm_router
from assistant.chat import _format_tool_response

async def test():
    query = "What is today revenue?"
    print(f"\n=== Testing: {query} ===\n")
    
    # Step 1: Route to tool
    print("[1] Calling route_to_tool...")
    routing = tool_router.route_to_tool(query)
    print(f"Routing result: {json.dumps(routing, indent=2)}")
    
    if not routing:
        print("ERROR: route_to_tool returned None")
        return
    
    # Step 2: Execute tool
    print(f"\n[2] Calling execute_tool...")
    tool_result = await tool_router.execute_tool(routing)
    print(f"Tool result: {json.dumps(tool_result, indent=2)}")
    
    if not tool_result:
        print("ERROR: execute_tool returned None")
        return
    
    # Step 3: Format response
    print(f"\n[3] Formatting response...")
    tool_data = tool_result.get("data", {})
    tool_id = tool_result.get("tool_id")
    print(f"Tool data: {json.dumps(tool_data, indent=2)}")
    
    reply = _format_tool_response(tool_id, tool_data, query, "english")
    print(f"Formatted reply: {reply[:100]} ...")

if __name__ == "__main__":
    asyncio.run(test())
