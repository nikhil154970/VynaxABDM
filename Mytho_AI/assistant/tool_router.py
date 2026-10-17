"""
tool_router.py

Tool router for LLM-based function calling.
LLM decides which tool/endpoint to call based on user query.
Zero external API costs - uses local Qwen2.5 only.
"""

import json
import logging
import requests
from typing import Optional
from assistant.tools import TOOLS, get_tools_schema, get_tool
from assistant import llm_router

logger = logging.getLogger("mqe.tool_router")

BACKEND_URL = "http://localhost:5000"
BACKEND_TIMEOUT = 10  # seconds

TOOL_ROUTER_PROMPT = """You are a tool router for a hospital pharmacy assistant.

Given a user query, decide which tool to call and what parameters to use.

Available tools:
{tools_schema}

Instructions:
1. Analyze the user query
2. Choose the BEST matching tool
3. Extract parameters from the query
4. Return JSON with: tool_id, parameters, reasoning

Rules:
- If user asks about bills: use 'search_bills'
- If user asks about medicines/inventory: use 'check_inventory'
- If user asks about a patient: use 'search_patient_history'
- If user asks about revenue/sales: use 'get_daily_revenue'
- If user asks about alerts/warnings: use 'get_inventory_alerts'

Output ONLY valid JSON. Example:
{{
  "tool_id": "search_bills",
  "parameters": {{"billNumber": "PH-BILL-0005"}},
  "reasoning": "User asked to find a specific bill",
  "confidence": 0.95
}}
"""


def route_to_tool(user_query: str) -> Optional[dict]:
    """
    Route user query to the appropriate tool.
    
    Returns:
        {
            "tool_id": "search_bills",
            "parameters": {...},
            "reasoning": "...",
            "confidence": 0.95
        }
    """
    prompt = TOOL_ROUTER_PROMPT.format(tools_schema=get_tools_schema())
    
    try:
        # Use local LLM only (no API costs)
        raw = llm_router._local_inference(
            f"{prompt}\n\nUser query: {user_query}",
            model_name=llm_router._get_model_name()
        )
        
        if not raw:
            logger.warning("Tool router LLM unavailable")
            return None
        
        # Parse JSON response
        import re
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if not json_match:
            logger.warning(f"No JSON in tool router response: {raw}")
            return None
        
        result = json.loads(json_match.group(0))
        
        logger.info(f"Route result: {result}")
        
        # Validate tool exists
        tool = get_tool(result.get("tool_id"))
        if not tool:
            logger.warning(f"Invalid tool ID: {result.get('tool_id')}")
            return None
        
        logger.info(f"Tool found: {tool['id']}")
        return result
        
    except Exception as e:
        logger.error(f"Tool routing error: {e}")
        return None


async def execute_tool(tool_routing: dict) -> Optional[dict]:
    """
    Execute the selected tool by calling the backend endpoint.
    
    Args:
        tool_routing: Result from route_to_tool()
        
    Returns:
        API response from backend
    """
    tool_id = tool_routing.get("tool_id")
    parameters = tool_routing.get("parameters", {})
    
    tool = get_tool(tool_id)
    if not tool:
        logger.error(f"Tool not found: {tool_id}")
        return None
    
    try:
        endpoint = tool["endpoint"]
        method = tool.get("method", "GET")
        
        url = f"{BACKEND_URL}{endpoint}"
        
        logger.info(f"Calling tool: {tool_id} with params: {parameters}")
        
        if method == "GET":
            response = requests.get(
                url,
                params=parameters,
                timeout=BACKEND_TIMEOUT
            )
        elif method == "POST":
            response = requests.post(
                url,
                json=parameters,
                timeout=BACKEND_TIMEOUT
            )
        else:
            logger.error(f"Unsupported method: {method}")
            return None
        
        response.raise_for_status()
        
        data = response.json()
        logger.info(f"Tool {tool_id} returned data: {data}")
        
        result = {
            "tool_id": tool_id,
            "data": data,
            "status": "success"
        }
        logger.info(f"Execute tool result: {result}")
        return result
        
    except requests.Timeout:
        logger.error(f"Backend timeout calling {tool_id}")
        return {
            "tool_id": tool_id,
            "status": "error",
            "error": f"Request timeout - backend took too long to respond"
        }
    except requests.ConnectionError as e:
        logger.error(f"Cannot connect to backend for {tool_id}: {e}")
        return {
            "tool_id": tool_id,
            "status": "error",
            "error": f"Cannot connect to backend at {BACKEND_URL}. Is the backend running?"
        }
    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code if hasattr(e, 'response') else 'unknown'
        logger.error(f"HTTP error {status_code} calling {tool_id}: {e}")
        return {
            "tool_id": tool_id,
            "status": "error",
            "error": f"Backend returned error {status_code}. Please try again."
        }
    except Exception as e:
        logger.error(f"Tool execution error: {e}")
        return {
            "tool_id": tool_id,
            "status": "error",
            "error": f"Error executing tool: {str(e)[:100]}"
        }


def get_tool_context_for_response(tool_result: dict) -> str:
    """
    Format tool result into context for LLM response generation.
    """
    if tool_result["status"] == "error":
        return f"Tool {tool_result['tool_id']} failed: {tool_result.get('error')}"
    
    data = tool_result.get("data", {})
    
    # Convert data to readable format for LLM
    if isinstance(data, dict):
        return json.dumps(data, ensure_ascii=False, indent=2)
    elif isinstance(data, list):
        return json.dumps(data[:5], ensure_ascii=False, indent=2)  # First 5 items
    else:
        return str(data)
