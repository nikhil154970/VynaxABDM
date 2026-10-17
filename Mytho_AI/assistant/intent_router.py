"""
intent_router.py
----------------
Classifies user messages into intents based on module and role.
Supports pharmacy and patient modules with role-based access control.

Uses keyword scoring with word-boundary matching, negation detection,
and multi-level parameter extraction. No LLM calls.
"""

import re
from typing import Optional

from .intents.shared_intents import SHARED_INTENTS, ROLE_PERMISSIONS, get_module_intents, filter_by_role
from .intents.pharmacy_intents import PHARMACY_INTENTS, PHARMACY_RULES
from .intents.patient_intents import PATIENT_INTENTS, PATIENT_RULES


# ── Parameter extraction helpers ──────────────────────────────────

_NEGATION_WORDS = {"no", "not", "nahi", "bina", "without", "except", "siva"}


def _has_negation(text: str, keyword: str) -> bool:
    """Check if keyword is negated (e.g. 'no pending' → pending is negated)."""
    idx = text.find(keyword)
    if idx < 0:
        return False
    before = text[max(0, idx - 20):idx].strip()
    for word in _NEGATION_WORDS:
        if before.endswith(word) or before.endswith(word + " "):
            return True
        if re.search(rf'\b{re.escape(word)}\s*$', before):
            return True
    return False


def _extract_numbers(text: str) -> dict:
    """Extract integers from common patterns."""
    result = {}
    m = re.search(r'top\s+(\d+)', text)
    if m:
        result["topN"] = int(m.group(1))
    # "within 15 days", "15 din", "in 15 days"
    m = re.search(r'(?:within|in|ke within|mein)\s+(\d+)\s+day', text, re.I)
    if m:
        result["withinDays"] = int(m.group(1))
    m = re.search(r'(\d+)\s+din', text)
    if m:
        result["withinDays"] = int(m.group(1))
    # "1 month", "2 months", "ek mahina"
    m = re.search(r'(\d+)\s+month', text, re.I)
    if m:
        result["withinDays"] = int(m.group(1)) * 30
    m = re.search(r'(?:ek|1)\s+mahin[ae]', text)
    if m:
        result["withinDays"] = 30
    return result


def _extract_period(text: str) -> Optional[str]:
    """Detect relative time periods from text."""
    if re.search(r'\b(last month|pichle mahine|pichla mahina|previous month)\b', text):
        return "last_month"
    if re.search(r'\b(this month|is mahine|iss mahine|is mahina|current month)\b', text):
        return "this_month"
    if re.search(r'\b(last week|pichle hafte|pichla hafta)\b', text):
        return "last_week"
    if re.search(r'\b(this week|is hafte|iss hafte|current week)\b', text):
        return "this_week"
    if re.search(r'\b(january|jan|february|feb|march|mar|april|apr|may|june|jul|july|august|aug|september|sep|october|oct|november|nov|december|dec)\b', text):
        return "this_month"
    return None


MONTH_NAMES = {
    "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
    "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6,
    "july": 7, "jul": 7, "august": 8, "aug": 8, "september": 9, "sep": 9,
    "october": 10, "oct": 10, "november": 11, "nov": 11, "december": 12, "dec": 12,
}

ORDINAL_SUFFIXES = {"st": "", "nd": "", "rd": "", "th": ""}


def _parse_date_tokens(day_str: str, month_str: str, year_str: str = "") -> Optional[str]:
    """Convert day/month/year strings to YYYY-MM-DD."""
    from datetime import datetime
    try:
        day = int(re.sub(r'(st|nd|rd|th)', '', day_str.lower()))
        month_num = MONTH_NAMES.get(month_str.lower().rstrip("."))
        if not month_num:
            return None
        year = int(year_str) if year_str else datetime.now().year
        return f"{year}-{month_num:02d}-{day:02d}"
    except (ValueError, TypeError):
        return None


def _extract_date(text: str) -> Optional[str]:
    """Detect date references including '21st June', '20 June', 'June 21', '20/06', etc."""
    if re.search(r'\b(kal|kl|yesterday)\b', text):
        return "yesterday"
    if re.search(r'\b(aaj|today|aaj ka|aaj ki)\b', text):
        return "today"
    if re.search(r'\b(parson|day after)\b', text):
        return "tomorrow"

    # "21st June 2026" or "21st June" or "21 June"
    m = re.search(r'(\d{1,2})(?:st|nd|rd|th)?\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec)\.?\s*(\d{4})?', text, re.I)
    if m:
        result = _parse_date_tokens(m.group(1), m.group(2), m.group(3))
        if result:
            return result

    # "June 21st" or "June 21, 2026" or "June 21"
    m = re.search(r'(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?', text, re.I)
    if m:
        result = _parse_date_tokens(m.group(2), m.group(1), m.group(3))
        if result:
            return result

    # "20/06/2026" or "20/06"
    m = re.search(r'(\d{1,2})/(\d{1,2})(?:/(\d{4}))?', text)
    if m:
        from datetime import datetime
        try:
            day = int(m.group(1))
            month = int(m.group(2))
            year = int(m.group(3)) if m.group(3) else datetime.now().year
            if 1 <= day <= 31 and 1 <= month <= 12:
                return f"{year}-{month:02d}-{day:02d}"
        except ValueError:
            pass

    # ISO format: "2026-06-21" or "2026/06/21"
    m = re.search(r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})', text)
    if m:
        return m.group(1)

    return None


def _extract_patient_identifier(text: str) -> Optional[str]:
    """Extract UHID or patient name from common patterns."""
    m = re.search(r'\b(UHID|uhid|patient id)\s*[:#]?\s*(?:is\s+)?(\d+)', text, re.I)
    if m:
        return m.group(2)
    m = re.search(r'\b(\d{5,})\b', text)
    if m:
        return m.group(1)
    patterns = [
        (r'(\w+(?:\s+\w+)?)\s+ka\s+(?:purchase |bill )?history', 1),
        (r'(\w+(?:\s+\w+)?)\s+ki\s+history', 1),
        (r'patient\s+(\w+(?:\s+\w+)?)\s+ka', 1),
        (r'(\w+(?:\s+\w+)?)\s+(?:purchase|bill|medicine|patient)\s+history', 1),
        (r'(?:purchase|bill|medicine|patient)\s+history\s+(?:of|for)\s+(\w+(?:\s+\w+)?)', 1),
        (r'history\s+(?:of|for)\s+(\w+(?:\s+\w+)?)', 1),
        (r'UHID\s+(\d+)', 1),
        (r'(\d{5,})\s+ka\s+(?:purchase |bill )?history', 1),
        (r'(\d{5,})\s+ki\s+history', 1),
    ]
    exclude = {"ka", "ki", "ke", "ko", "se", "mein", "me", "aur", "aaj", "kal", "kya", "nahi", "hai", "the", "is", "and", "patient", "purchase", "history", "bill", "medicine", "show", "display", "get", "see", "all", "of", "for", "this", "that", "my", "his", "her"}
    for pat, group_idx in patterns:
        m = re.search(pat, text, re.I)
        if m and m.lastindex >= group_idx:
            val = m.group(group_idx)
            words = val.lower().split()
            if val and not any(w in exclude for w in words):
                return val.strip()
    return None


# ======================================================================
#  MAIN CLASSIFICATION
# ======================================================================

def classify(user_message: str, module: str = "pharmacy", role: str = "pharmacist") -> dict:
    """
    Classify user_message into an intent dict using keyword scoring.
    
    Args:
        user_message: The user's input text
        module: The module context ("pharmacy" or "patient")
        role: The user's role for access control
    
    Returns:
        {
            "intent":     str,
            "confidence": str,   # "high" | "medium" | "low"
            "params":     dict,
            "source":     str,
        }
    """
    text = user_message.strip()
    lower = text.lower()

    # Get allowed intents based on module and role
    allowed_intents = get_module_intents(module)
    allowed_intents = filter_by_role(allowed_intents, role)
    
    # Get the appropriate rules based on module
    if module == "pharmacy":
        rules = PHARMACY_RULES
    elif module == "patient":
        rules = PATIENT_RULES
    else:
        rules = []

    # ── Step 1: score every rule with word-boundary matching ──
    best_intent = "UNKNOWN"
    best_score = 0
    best_params = {}
    matched_rule_keywords = None

    for keywords, intent, weight, default_params, _ in rules:
        # Skip if intent is not allowed
        if intent not in allowed_intents:
            continue
            
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', lower):
                # Negation check — skip if negated
                if _has_negation(lower, kw):
                    continue
                if weight > best_score:
                    best_score = weight
                    best_intent = intent
                    best_params = dict(default_params)
                    matched_rule_keywords = kw
                elif weight == best_score and intent == best_intent:
                    best_params.update(default_params)
                break

    # ── Step 2: regex-based pattern boost ────────────────────────
    # Boost score for quantified patterns like "top 10", "30 din"
    if re.search(r'\btop\s+\d+', lower) and best_intent == "TOP_MEDICINES_SALES":
        best_score = max(best_score, 18)
    if re.search(r'\b\d+\s+din\b', lower) and best_intent == "EXPIRY_RISK_REPORT":
        best_score = max(best_score, 18)
    # Boost reorder when combined with time period
    if re.search(r'\breorder\b', lower) and best_intent == "REORDER_RECOMMENDATIONS":
        best_score = max(best_score, 30)
    # Boost top when combined with medicines/products
    if re.search(r'\btop\b', lower) and re.search(r'\b(medicines|products|drugs|dawai|selling)\b', lower):
        if best_intent == "TOP_MEDICINES_SALES":
            best_score = max(best_score, 30)
        elif best_intent != "TOP_MEDICINES_SALES" and best_score < 30:
            if "TOP_MEDICINES_SALES" in allowed_intents:
                best_intent = "TOP_MEDICINES_SALES"
                best_score = 30
                best_params = {"topN": 5}

    # ── Step 3: extract numbers from text ──────────────────────
    numbers = _extract_numbers(lower)
    if "topN" in numbers:
        best_params["topN"] = numbers["topN"]
    if "withinDays" in numbers:
        best_params["withinDays"] = numbers["withinDays"]

    # ── Step 4: extract date ──────────────────────────────────
    if "date" not in best_params or best_params.get("date") == "today":
        date = _extract_date(lower)
        if date:
            best_params["date"] = date

    # ── Step 5: extract period for monthly revenue ────────────
    if best_intent == "MONTHLY_REVENUE":
        period = _extract_period(lower)
        if period:
            best_params["period"] = period

    # ── Step 6: extract patient identifier ────────────────────
    if best_intent == "PATIENT_PURCHASE_HISTORY":
        pid = _extract_patient_identifier(text)
        if pid:
            best_params["patientIdentifier"] = pid

    # ── Step 6b: bare UHID fallback for patient module ────────
    # If intent is UNKNOWN but we have a UHID-like number, default to MY_PRESCRIPTIONS
    if module == "patient" and best_intent == "UNKNOWN":
        uhid_match = re.search(r'\b(10\d{3})\b', text)
        if uhid_match:
            best_intent = "MY_PRESCRIPTIONS"
            best_params["uhid"] = uhid_match.group(1)
            best_score = 10

    # ── Step 7: determine confidence ──────────────────────────
    if best_intent == "UNKNOWN":
        confidence = "low"
    elif best_score >= 20:
        confidence = "high"
    elif best_score >= 10:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "intent": best_intent,
        "confidence": confidence,
        "params": best_params,
        "source": "keyword_fallback",
    }
