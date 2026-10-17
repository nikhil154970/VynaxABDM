"""
chat.py
-------
Tool-based assistant using Qwen2.5 for function calling.
LLM decides which tool (API) to call based on user query.
Zero external API costs.
Supports direct database connection as fallback when backend unavailable.
Supports module-based routing (pharmacy/patient) with role-based access control.
"""

import asyncio
import logging
import re
import os

from assistant.safety_guard import is_allowed, get_block_message
from assistant import intent_router, llm_router, tool_router, query_engine
from assistant.formatters import format_pharmacy_response, format_patient_response

logger = logging.getLogger("mqe.chat")

VALID_LANGS = {"english"}

_UNKNOWN = "I didn't understand that. Try asking about pharmacy revenue, medicine inventory, bills, or queue status."


async def process_message(user_message: str, language: str = "english", 
                         module: str = "pharmacy", userId: str = None, 
                         role: str = "pharmacist", uhid: str = None) -> dict:
    """
    Process user message with tool-based routing.
    
    Flow:
    1. Validate message with safety guard
    2. Route to appropriate tool using LLM
    3. Execute tool (call backend API)
    4. Format response with LLM
    
    Returns:
        {
            "reply": "formatted response",
            "intent": "tool_used",
            "tool_called": bool,
            "confidence": 0.95,
            "error": null or error message
        }
    """
    lang = "english"

    if not is_allowed(user_message):
        return {"reply": get_block_message(), "intent": "BLOCKED", "language": lang, "error": None}

    try:
        normalized = normalize_text(user_message)
        
        # Step 1: Use deterministic NL2SQL pipeline (tool router LLM is not available)
        return nl2sql(normalized, lang, module, userId, role, uhid)

    except Exception as exc:
        logger.error("process_message failed: %s", exc, exc_info=True)
        return {
            "reply": "There was a problem processing your request. Please try again.",
            "intent": "ERROR",
            "tool_called": False,
            "language": lang,
            "error": str(exc),
        }


def run_repl():
    print("\n" + "=" * 55)
    print("  MQE Hospital Assistant (LLM-based)")
    print("=" * 55 + "\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nBye!")
            break

        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit", "bye"):
            print("Assistant: Goodbye!")
            break

        result = asyncio.run(process_message(user_input, "english"))
        print(f"\nAssistant: {result['reply']}\n")


if __name__ == "__main__":
    run_repl()


def normalize_text(text: str) -> str:
    if not text:
        return ""
    s = text.strip()
    s = re.sub(r"\s+", " ", s)
    return s


def nl2sql(text: str, lang: str = "english", module: str = "pharmacy", 
           userId: str = None, role: str = "pharmacist", uhid: str = None) -> dict:
    """Fallback NL2SQL pipeline using keyword router + query engine + templates."""
    parsed = intent_router.classify(text, module, role)
    intent = parsed.get("intent", "UNKNOWN")
    params = parsed.get("params", {})

    if intent == "UNKNOWN":
        if module == "patient":
            reply = format_patient_response("UNKNOWN", {}, params, lang)
        else:
            reply = format_pharmacy_response("UNKNOWN", {}, params, lang)
        return {"reply": reply, "intent": "UNKNOWN", "tool_called": False, "language": lang, "error": None}

    try:
        rows = query_engine.run_query(intent, params, module, userId, uhid)
        
        result = {"reply": None, "intent": intent, "tool_called": False, "language": lang, "error": None}

        # Use module-specific formatter
        if module == "patient":
            reply = format_patient_response(intent, rows, params, lang)
        else:
            reply = format_pharmacy_response(intent, rows, params, lang)
            
        result["reply"] = reply

        # Pass raw data for lab reports (PDF generation)
        if intent == "MY_LAB_REPORTS" and isinstance(rows, list):
            result["rawData"] = rows

        return result
    except Exception as e:
        logger.error("nl2sql failed for intent=%s: %s", intent, e)
        if module == "patient":
            reply = format_patient_response("UNKNOWN", {}, params, lang)
        else:
            reply = format_pharmacy_response("UNKNOWN", {}, params, lang)
        return {"reply": reply, "intent": intent, "tool_called": False, "language": lang, "error": str(e)}


def _format_tool_response(tool_id: str, data: dict, query: str, lang: str = "english") -> str:
    """Format tool response using pre-written templates to avoid LLM confusion."""
    try:
        if tool_id == "get_daily_revenue":
            total = float(data.get("total", 0)) if data.get("total") else 0
            count = int(data.get("count", 0)) if data.get("count") else 0
            paid = float(data.get("paid", 0)) if data.get("paid") else 0
            pending = float(data.get("pending", 0)) if data.get("pending") else 0
            if count == 0:
                return f"Today's total revenue is ₹{total:,.0f} — No bills generated yet."
            return (
                f"Today's total revenue is ₹{total:,.0f} with {count} bills. "
                f"Collected: ₹{paid:,.0f}, Pending: ₹{pending:,.0f}."
            )
        
        elif tool_id == "get_inventory_alerts":
            alerts = data.get("alerts", [])
            threshold = data.get("lowStockThreshold", 20)
            if not alerts:
                return "Great news! All medicines are well-stocked. No low stock or out-of-stock items right now."
            
            out_of_stock = [a for a in alerts if a.get("status") == "OUT_OF_STOCK"]
            low_stock = [a for a in alerts if a.get("status") == "LOW_STOCK"]
            
            lines = []
            lines.append(f"**Inventory Alert Report** ({len(alerts)} items need attention)")
            lines.append(f"Low stock threshold: {threshold} units\n")
            
            if out_of_stock:
                lines.append(f"**OUT OF STOCK ({len(out_of_stock)} items):**")
                for i, a in enumerate(out_of_stock, 1):
                    name = a.get("medicineName", "Unknown")
                    strength = a.get("strength", "")
                    unit = a.get("unit", "units")
                    label = f"{name} {strength}".strip() if strength else name
                    lines.append(f"  {i}. **{label}** — 0 {unit} remaining")
                lines.append("")
            
            if low_stock:
                lines.append(f"**LOW STOCK ({len(low_stock)} items):**")
                for i, a in enumerate(low_stock, 1):
                    name = a.get("medicineName", "Unknown")
                    strength = a.get("strength", "")
                    unit = a.get("unit", "units")
                    qty = a.get("availableStock", 0)
                    label = f"{name} {strength}".strip() if strength else name
                    lines.append(f"  {i}. **{label}** — {qty} {unit} remaining")
                lines.append("")
            
            lines.append("**Recommended actions:**")
            if out_of_stock:
                names = [a.get("medicineName", "Unknown") for a in out_of_stock[:3]]
                lines.append(f"- Immediately reorder: {', '.join(names)}")
            if low_stock:
                lines.append("- Place purchase orders for low stock items before they run out")
            
            return "\n".join(lines)
        
        elif tool_id == "check_inventory":
            medicines = data.get("medicines", [])
            if not medicines:
                return "No medicines found matching your query."
            
            lines = []
            lines.append(f"**Medicine Inventory** ({len(medicines)} items found)\n")
            
            for i, med in enumerate(medicines, 1):
                name = med.get("medicineName", "Unknown")
                strength = med.get("strength", "")
                unit = med.get("unit", "units")
                stock = med.get("availableStock", 0)
                label = f"{name} {strength}".strip() if strength else name
                lines.append(f"{i}. **{label}** — {stock} {unit}")
            
            return "\n".join(lines)
        
        elif tool_id == "search_bills":
            bills = data.get("bills", [])
            if not bills:
                return "No bills found matching your criteria."
            
            lines = []
            lines.append(f"**Pharmacy Bills** ({len(bills)} found)\n")
            
            for i, bill in enumerate(bills, 1):
                amount = float(bill.get("amount", 0)) if bill.get("amount") else 0
                bill_no = bill.get("billNumber", "Unknown")
                patient = bill.get("patientName", "Walk-in")
                status = bill.get("status", "Unknown")
                lines.append(f"{i}. **{bill_no}** — ₹{amount:,.0f} ({status})")
                lines.append(f"   Patient: {patient}")
            
            return "\n".join(lines)
        
        elif tool_id == "search_patient_history":
            records_found = data.get("recordsFound", 0)
            if records_found == 0:
                return f"No records found for the patient."
            msg = f"Found {records_found} records for this patient."
            bills = data.get("bills", [])
            if bills:
                msg += f"\n- Bills: {len(bills)} bills found"
            return msg
        
        else:
            # Fallback for unknown tools
            return f"Tool {tool_id} executed successfully. Data: {str(data)[:100]}"
    
    except Exception as e:
        logger.warning(f"Error formatting response for {tool_id}: {e}")
        return f"I received data but had trouble formatting it. Here's what I got: {str(data)[:100]}"
