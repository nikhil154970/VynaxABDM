#!/usr/bin/env python3
"""
quick_test.py
--------------
Quick test of the tool-based assistant.
Run this to verify everything is wired up correctly.

Usage:
    python quick_test.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from assistant.tool_router import route_to_tool, execute_tool
from assistant.chat import process_message


async def main():
    print("\n" + "="*60)
    print("  ⚡ Quick Tool Integration Test")
    print("="*60 + "\n")

    test_queries = [
        "What is today's revenue?",
        "Show me bill PH-BILL-0005",
        "Check stock for Aspirin",
        "Which medicines are low stock?",
    ]

    for i, query in enumerate(test_queries, 1):
        print(f"\n📝 Test {i}: {query}")
        print("-" * 60)

        # Step 1: Route to tool
        try:
            routing = route_to_tool(query)
            if not routing:
                print("  ❌ Tool routing failed")
                continue

            tool_id = routing.get("tool_id")
            params = routing.get("parameters", {})
            confidence = routing.get("confidence", 0)

            print(f"  ✓ Routed to: {tool_id}")
            print(f"    Confidence: {confidence:.2f}")
            if params:
                print(f"    Parameters: {params}")

        except Exception as e:
            print(f"  ❌ Tool routing error: {e}")
            continue

        # Step 2: Execute tool
        try:
            result = await execute_tool(routing)
            if not result:
                print("  ❌ Tool execution failed")
                continue

            status = result.get("status")
            if status == "error":
                print(f"  ❌ Tool error: {result.get('error')}")
                continue

            data = result.get("data", {})
            data_size = len(str(data))
            print(f"  ✓ Tool executed successfully ({data_size} bytes)")

        except Exception as e:
            print(f"  ❌ Tool execution error: {e}")
            continue

        # Step 3: Process with chat
        try:
            response = await process_message(query, "english")
            reply = response.get("reply", "")
            error = response.get("error")

            if error:
                print(f"  ⚠ Chat error: {error}")
            else:
                print(f"  ✓ Chat response: {reply[:80]}...")

        except Exception as e:
            print(f"  ❌ Chat processing error: {e}")
            continue

        print()

    print("="*60)
    print("  ✅ Quick test complete!\n")


if __name__ == "__main__":
    asyncio.run(main())
