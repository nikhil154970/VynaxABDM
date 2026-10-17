"""
query_engine.py
───────────────
Maps each intent to a SQL query and runs it against the pharmacy database.
Supports module-based routing (pharmacy/patient) with role-based access control.
"""

from .queries.pharmacy_queries import run_pharmacy_query
from .queries.patient_queries import run_patient_query
from .queries.base_queries import MOCK_DATA, _to_number, _row_list, _first_row


def run_query(intent: str, params: dict, module: str = "pharmacy", userId: str = None, uhid: str = None) -> dict:
    """
    Run the appropriate query for the given intent and module.
    
    Args:
        intent: The classified intent
        params: Parameters extracted from the user message
        module: The module context ("pharmacy" or "patient")
        userId: The user's ID for patient-specific queries
        uhid: The patient's UHID for patient-specific queries
    
    Returns:
        {"rows": [...], "meta": {...}}
    """
    # Add userId and uhid to params for patient queries
    if module == "patient":
        if userId:
            params["userId"] = userId
        if uhid:
            params["uhid"] = uhid
    
    # Route to appropriate query handler based on module
    if module == "patient":
        result = run_patient_query(intent, params)
        # intents that need meta data (not just rows)
        if intent in ("BOOK_APPOINTMENT", "CONTACT_DOCTOR"):
            if isinstance(result, dict):
                return result.get("meta", {})
            return result
        if isinstance(result, dict):
            return result.get("rows", [])
        return result
    else:
        # Default to pharmacy queries
        raw = run_pharmacy_query(intent, params)
        return _transform_for_formatter(intent, raw)


def run_query_old(intent: str, params: dict) -> dict:
    """
    Backward-compatible wrapper for the current chat pipeline.
    This maintains compatibility with the existing nl2sql() function.
    """
    raw = run_query(intent, params)
    return _transform_for_formatter(intent, raw)


def _transform_for_formatter(intent: str, raw: dict):
    """Transform raw query results for the response formatter."""
    rows = _row_list(raw)
    meta = raw.get("meta", {}) if isinstance(raw, dict) else {}

    if intent == "DAILY_REVENUE":
        row = _first_row(raw)
        return {
            "total": _to_number(row.get("total_revenue")),
            "count": int(_to_number(row.get("bill_count"))),
            "paid": _to_number(row.get("collected")),
            "pending": _to_number(row.get("pending")),
            "payment_modes": meta.get("payment_modes", []),
        }

    if intent == "MONTHLY_REVENUE":
        row = _first_row(raw)
        return {
            "total": _to_number(row.get("total_revenue")),
            "count": int(_to_number(row.get("bill_count"))),
            "paid": _to_number(row.get("collected")),
            "pending": _to_number(row.get("pending")),
            "start": meta.get("start", ""),
            "end": meta.get("end", ""),
        }

    if intent == "OUT_OF_STOCK_ALERT":
        return [
            {
                "name": row.get("medicineName") or row.get("name") or "Unknown",
                "strength": row.get("strength", ""),
                "dosageForm": row.get("dosageForm", ""),
                "category": row.get("category", ""),
                "qty": 0,
                "batch_count": row.get("batch_count"),
            }
            for row in rows
        ]

    if intent == "LOW_STOCK_ALERT":
        return [
            {
                "name": row.get("medicineName") or row.get("name") or "Unknown",
                "strength": row.get("strength", ""),
                "dosageForm": row.get("dosageForm", ""),
                "category": row.get("category", ""),
                "qty": int(_to_number(row.get("total_available") or row.get("qty"))),
                "batch_count": row.get("batch_count"),
            }
            for row in rows
        ]

    if intent == "EXPIRY_RISK_REPORT":
        return [
            {
                "name": row.get("medicineName") or row.get("name") or "Unknown",
                "expiry": row.get("expiry_date") or row.get("expiry") or "",
                "batchNumber": row.get("batchNumber", "N/A"),
                "qty": int(_to_number(row.get("availableQty") or row.get("qty"))),
                "stock_value": _to_number(row.get("stock_value")),
                "days_left": int(_to_number(row.get("days_left"), 999)),
            }
            for row in rows
        ]

    if intent == "PENDING_BILLS":
        total = sum(_to_number(row.get("pending")) for row in rows)
        return {
            "count": len(rows),
            "total": total,
            "rows": rows,
        }

    if intent == "TOP_MEDICINES_SALES":
        return [
            {
                "name": row.get("medicineName") or row.get("name") or "Unknown",
                "qty": int(_to_number(row.get("total_qty") or row.get("qty"))),
                "amount": _to_number(row.get("total_revenue") or row.get("amount")),
            }
            for row in rows
        ]

    if intent == "QUEUE_STATUS":
        status_map = {row.get("status"): int(_to_number(row.get("count"))) for row in rows}
        oldest = meta.get("oldest_waiting") or {}
        oldest_wait = oldest.get("tokenNumber") if oldest else None
        return {
            "waiting": status_map.get("WAITING", 0),
            "in_progress": status_map.get("IN_PROGRESS", 0),
            "oldest_wait": oldest_wait,
        }

    if intent == "DISPENSE_PENDING":
        return [
            {
                "billNumber": row.get("billNumber") or row.get("bill_number") or "?",
                "patientName": row.get("patient") or row.get("patientName") or row.get("customerName") or "Walk-in",
                "billingType": row.get("billingType") or "WALK_IN",
                "total": _to_number(row.get("total")),
                "item_count": int(_to_number(row.get("item_count"))),
                "bill_date": row.get("bill_date") or "",
                "billed_at": row.get("billed_at") or "",
            }
            for row in rows
        ]

    if intent == "REORDER_RECOMMENDATIONS":
        return [
            {
                "name": row.get("medicineName") or row.get("name") or "Unknown",
                "suggestedQty": int(_to_number(row.get("suggestedOrderQty") or row.get("suggestedQty"))),
                "availableQty": int(_to_number(row.get("availableQty"))),
                "urgency": row.get("urgency") or "WATCH",
            }
            for row in rows
        ]

    if intent == "SUPPLIER_PERFORMANCE":
        return [
            {
                "name": row.get("supplierName") or row.get("name") or "Unknown",
                "score": row.get("avg_lead_days") if row.get("avg_lead_days") is not None else row.get("total_purchased") or 0,
            }
            for row in rows
        ]

    if intent == "RETURN_SUMMARY":
        total = sum(_to_number(row.get("amount") or row.get("totalAmount")) for row in rows)
        return {"count": len(rows), "total": total, "rows": rows}

    if intent == "GRN_SUMMARY":
        return rows

    if intent == "PURCHASE_ORDER_STATUS":
        return rows

    if intent == "CATEGORY_BREAKDOWN":
        return [
            {
                "category": row.get("category") or "Unknown",
                "amount": _to_number(row.get("total_revenue") or row.get("amount")),
                "total_qty": int(_to_number(row.get("total_qty"))),
            }
            for row in rows
        ]

    if intent == "CONTROLLED_DRUG_AUDIT":
        return {"count": len(rows), "rows": rows}

    if intent == "WALK_IN_VS_PATIENT":
        totals = {row.get("billingType"): row for row in rows}
        walk_in = totals.get("WALK_IN") or totals.get("WALKIN") or {}
        hospital = totals.get("HOSPITAL") or totals.get("PATIENT") or {}
        return {
            "walkin": _to_number(walk_in.get("total_revenue")),
            "hospital": _to_number(hospital.get("total_revenue")),
        }

    if intent == "PATIENT_PURCHASE_HISTORY":
        return [
            {
                "billNumber": row.get("billNumber", "?"),
                "patientName": row.get("patientName") or row.get("customerName") or "Walk-in",
                "billingType": row.get("billingType", ""),
                "total": _to_number(row.get("grandTotal")),
                "paid": _to_number(row.get("paidAmount")),
                "pending": _to_number(row.get("pendingAmount")),
                "paymentMode": row.get("paymentMode", ""),
                "dispenseStatus": row.get("dispenseStatus", ""),
                "item_count": int(_to_number(row.get("item_count"))),
                "date": row.get("createdAt", ""),
            }
            for row in rows
        ]

    # Patient-specific intents - extract rows list from dict
    if intent in ("MY_PRESCRIPTIONS", "MY_BILLS", "MY_APPOINTMENTS", 
                   "MY_MEDICINE_HISTORY", "MY_LAB_REPORTS", "MY_PAYMENT_HISTORY"):
        if isinstance(rows, dict):
            return rows.get("rows", [])
        return rows

    return raw
