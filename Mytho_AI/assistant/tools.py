"""
tools.py

Tool definitions for LLM function calling.
LLM uses this to decide which backend API to call.

This is extensible - add new tools here without changing LLM code.
"""

import json

TOOLS = [
    {
        "id": "search_bills",
        "name": "search_bills",
        "description": "Find pharmacy bills with filters (patient name, bill number, date range, amount)",
        "category": "query",
        "endpoint": "/api/pharmacy/assistant/bills",
        "method": "GET",
        "parameters": {
            "type": "object",
            "properties": {
                "billNumber": {
                    "type": "string",
                    "description": "Specific bill number to search (e.g., PH-BILL-0005)"
                },
                "patientName": {
                    "type": "string",
                    "description": "Patient name to filter by"
                },
                "dateRange": {
                    "type": "string",
                    "enum": ["today", "yesterday", "this_week", "this_month", "last_month"],
                    "description": "Time period to search"
                },
                "minAmount": {
                    "type": "number",
                    "description": "Minimum bill amount in rupees"
                },
                "maxAmount": {
                    "type": "number",
                    "description": "Maximum bill amount in rupees"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results to return (default 10)"
                }
            },
            "required": []
        },
        "examples": [
            "Show me bill PH-BILL-0005",
            "Find bills for patient John from this month",
            "Bills between ₹1000 and ₹5000 this week"
        ]
    },

    {
        "id": "check_inventory",
        "name": "check_inventory",
        "description": "Check medicine inventory levels and low stock items",
        "category": "query",
        "endpoint": "/api/pharmacy/assistant/medicines",
        "method": "GET",
        "parameters": {
            "type": "object",
            "properties": {
                "medicineName": {
                    "type": "string",
                    "description": "Specific medicine name to check"
                },
                "showLowStock": {
                    "type": "boolean",
                    "description": "Show only items below minimum stock level"
                },
                "category": {
                    "type": "string",
                    "description": "Medicine category (e.g., Antibiotic, Pain Relief)"
                },
                "limit": {
                    "type": "integer",
                    "description": "Number of results"
                }
            },
            "required": []
        },
        "examples": [
            "Check stock for Aspirin",
            "Show me low stock items",
            "What medicines do we have for pain relief?"
        ]
    },

    {
        "id": "search_patient_history",
        "name": "search_patient_history",
        "description": "Search patient visit history, prescriptions, and medical records",
        "category": "query",
        "endpoint": "/api/pharmacy/assistant/patient-history",
        "method": "GET",
        "parameters": {
            "type": "object",
            "properties": {
                "patientName": {
                    "type": "string",
                    "description": "Patient name to search for"
                },
                "recordType": {
                    "type": "string",
                    "enum": ["bills", "prescriptions", "visits", "all"],
                    "description": "Type of records to retrieve"
                },
                "dateRange": {
                    "type": "string",
                    "enum": ["this_week", "this_month", "last_month", "this_year"],
                    "description": "Time period"
                },
                "limit": {
                    "type": "integer",
                    "description": "Max records to return"
                }
            },
            "required": ["patientName"]
        },
        "examples": [
            "Show me all records for patient John",
            "What prescriptions does John have this month?",
            "Patient John visit history"
        ]
    },

    {
        "id": "get_daily_revenue",
        "name": "get_daily_revenue",
        "description": "Get daily pharmacy revenue statistics",
        "category": "kpi",
        "endpoint": "/api/pharmacy/assistant/daily-revenue",
        "method": "GET",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "examples": [
            "What is today's revenue?",
            "How much did we collect today?",
            "Today sales summary"
        ]
    },

    {
        "id": "get_inventory_alerts",
        "name": "get_inventory_alerts",
        "description": "Get inventory alerts (low stock, expiring medicines)",
        "category": "kpi",
        "endpoint": "/api/pharmacy/assistant/inventory-alerts",
        "method": "GET",
        "parameters": {
            "type": "object",
            "properties": {
                "alertType": {
                    "type": "string",
                    "enum": ["low_stock", "expiring", "expired", "all"],
                    "description": "Type of alerts"
                }
            },
            "required": []
        },
        "examples": [
            "Which medicines are running low?",
            "Show expiring medicines",
            "Inventory alerts"
        ]
    }
]


def get_tool(tool_id: str) -> dict:
    """Get tool by ID"""
    for tool in TOOLS:
        if tool["id"] == tool_id:
            return tool
    return None


def get_tools_for_llm() -> list:
    """Get all tools for LLM context"""
    return [
        {
            "name": tool["name"],
            "description": tool["description"],
            "parameters": tool["parameters"]
        }
        for tool in TOOLS
    ]


def get_tools_schema() -> str:
    """Format tools as JSON schema for LLM"""
    return json.dumps([
        {
            "id": tool["id"],
            "name": tool["name"],
            "description": tool["description"],
            "parameters": tool["parameters"],
            "examples": tool["examples"]
        }
        for tool in TOOLS
    ], indent=2)

