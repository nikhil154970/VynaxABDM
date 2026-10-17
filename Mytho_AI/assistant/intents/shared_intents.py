"""
shared_intents.py
-----------------
Common intents shared across all modules (pharmacy, patient, etc.)
These are module-agnostic intents like help, status, etc.
"""

# Shared intents that work across all modules
SHARED_INTENTS = {
    "HELP",
    "STATUS",
    "GREETING",
    "GOODBYE",
    "UNKNOWN",
}

# Role-based access control
ROLE_PERMISSIONS = {
    "pharmacist": [
        # Pharmacy intents
        "LOW_STOCK_ALERT",
        "OUT_OF_STOCK_ALERT",
        "DAILY_REVENUE",
        "MONTHLY_REVENUE",
        "TOP_MEDICINES_SALES",
        "EXPIRY_RISK_REPORT",
        "PENDING_BILLS",
        "PATIENT_PURCHASE_HISTORY",
        "REORDER_RECOMMENDATIONS",
        "SUPPLIER_PERFORMANCE",
        "RETURN_SUMMARY",
        "QUEUE_STATUS",
        "DISPENSE_PENDING",
        "GRN_SUMMARY",
        "PURCHASE_ORDER_STATUS",
        "CATEGORY_BREAKDOWN",
        "CONTROLLED_DRUG_AUDIT",
        "WALK_IN_VS_PATIENT",
        # Shared intents
        "HELP",
        "STATUS",
        "GREETING",
        "GOODBYE",
    ],
    "patient": [
        # Patient intents
        "MY_PRESCRIPTIONS",
        "MY_BILLS",
        "MY_APPOINTMENTS",
        "MY_MEDICINE_HISTORY",
        "MY_LAB_REPORTS",
        "MY_PAYMENT_HISTORY",
        "BOOK_APPOINTMENT",
        "CONTACT_DOCTOR",
        # Shared intents
        "HELP",
        "STATUS",
        "GREETING",
        "GOODBYE",
    ],
    "doctor": [
        # Doctor intents
        "PATIENT_HISTORY",
        "PRESCRIPTION_LIST",
        "MY_SCHEDULE",
        # Shared intents
        "HELP",
        "STATUS",
        "GREETING",
        "GOODBYE",
    ],
    "admin": [
        # Admin can access everything
        "ALL",
    ],
}


def get_module_intents(module: str) -> set:
    """Get all intents available for a specific module."""
    if module == "pharmacy":
        from .pharmacy_intents import PHARMACY_INTENTS
        return PHARMACY_INTENTS | SHARED_INTENTS
    elif module == "patient":
        from .patient_intents import PATIENT_INTENTS
        return PATIENT_INTENTS | SHARED_INTENTS
    else:
        return SHARED_INTENTS


def filter_by_role(intents: set, role: str) -> set:
    """Filter intents based on user role permissions."""
    if not role:
        return intents
    
    role_lower = role.lower()
    
    # Admin has access to everything
    if role_lower == "admin" or "ALL" in ROLE_PERMISSIONS.get(role_lower, []):
        return intents
    
    allowed = ROLE_PERMISSIONS.get(role_lower, [])
    if not allowed:
        return intents & SHARED_INTENTS  # Only shared intents for unknown roles
    
    allowed_set = set(allowed)
    return intents & allowed_set
