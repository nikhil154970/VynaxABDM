"""
pharmacy_intents.py
-------------------
Pharmacy-specific intents for the assistant.
Extracted from the original intent_router.py
"""

# All pharmacy-specific intents
PHARMACY_INTENTS = {
    "TOP_MEDICINES_SALES",
    "OUT_OF_STOCK_ALERT",
    "LOW_STOCK_ALERT",
    "EXPIRY_RISK_REPORT",
    "DAILY_REVENUE",
    "MONTHLY_REVENUE",
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
}

# Pharmacy-specific keyword rules
# (keywords, intent_id, weight, default_params, extractors)
PHARMACY_RULES = []


def _rule(keywords, intent, weight=10, params=None, extractors=None):
    PHARMACY_RULES.append((keywords, intent, weight, params or {}, extractors or []))


# ── DAILY_REVENUE ────────────────────────────────────────────────
_rule(["kal ka revenue", "kal ki kamai", "kal ka business", "kal ka total", "yesterday ka revenue",
        "kl ka revenue", "kl ki kamai", "kl ka business"],
      "DAILY_REVENUE", 40, {"date": "yesterday"})
_rule(["aaj ka revenue", "aaj ki kamai", "aaj ka business", "aaj ka total", "today ka revenue"],
      "DAILY_REVENUE", 35, {"date": "today"})
_rule(["aaj kitna paisa", "aaj kitna aaya", "aaj kitna hua", "today kitna aaya"],
      "DAILY_REVENUE", 30, {"date": "today"})
_rule(["aaj ki total kamai", "aaj ka total income", "aaj ki income"],
      "DAILY_REVENUE", 30, {"date": "today"})
_rule(["aaj ka sale", "aaj ki bikri", "today ka business", "today ka income"],
      "DAILY_REVENUE", 25, {"date": "today"})
_rule(["kal ka sale", "kal ki bikri", "yesterday ka business", "kl ka sale", "kl ki bikri"],
      "DAILY_REVENUE", 25, {"date": "yesterday"})
_rule(["aaj ka collection", "aaj kitna collect", "today collection"],
      "DAILY_REVENUE", 25, {"date": "today"})
_rule(["total revenue", "total kamai", "total income", "total sale"],
      "DAILY_REVENUE", 15, {"date": "today"})
_rule(["yesterday ka", "yesterday ki", "kal ka", "kal ki", "kl ka", "kl ki"],
      "DAILY_REVENUE", 12, {"date": "yesterday"})
_rule(["aaj ka", "aaj ki", "today ka", "today ki"],
      "DAILY_REVENUE", 10, {"date": "today"})
_rule(["revenue", "kamai", "kamaai", "income", "amdani", "billing", "bikri", "business", "paise", "paisa", "collection"],
      "DAILY_REVENUE", 5, {"date": "today"})

# ── MONTHLY_REVENUE ──────────────────────────────────────────────
_rule(["this month revenue", "this month total revenue", "total revenue this month",
        "total revenue for this month", "this month ka revenue", "this month ki revenue"],
      "MONTHLY_REVENUE", 35, {"period": "this_month"})
_rule(["last month revenue", "last month total revenue", "total revenue last month",
        "total revenue for last month", "last month ka revenue"],
      "MONTHLY_REVENUE", 35, {"period": "last_month"})
_rule(["this month", "iss month", "is month"],
      "MONTHLY_REVENUE", 20, {"period": "this_month"})
_rule(["last month", "pichle month", "previous month"],
      "MONTHLY_REVENUE", 20, {"period": "last_month"})
_rule(["this week", "iss week", "is week", "is hafte"],
      "MONTHLY_REVENUE", 20, {"period": "this_week"})
_rule(["last week", "pichle week", "pichla week", "pichle hafte"],
      "MONTHLY_REVENUE", 20, {"period": "last_week"})
_rule(["week ka bill", "week ka revenue", "week ki revenue", "week ki kamai",
        "hafte ka bill", "hafte ka revenue", "hafte ki kamai", "hafte ki revenue",
        "total bill for week", "total bill this week", "total bill for this week",
        "this week bill", "this week total bill", "this week total revenue"],
      "MONTHLY_REVENUE", 25, {"period": "this_week"})
_rule(["last week bill", "last week total bill", "last week revenue",
        "last week total revenue", "pichle hafte ka bill", "pichle hafte ka revenue"],
      "MONTHLY_REVENUE", 25, {"period": "last_week"})
_rule(["is mahine ka revenue", "is mahine ki kamai", "iss mahine ki sale", "this month ka revenue",
        "is mahine ki total sale", "is mahine ki total kamai", "is mahine ka total income"],
      "MONTHLY_REVENUE", 30, {"period": "this_month"})
_rule(["is mahine ka total", "is mahine ka business", "this month ka business", "is mahine ka sale"],
      "MONTHLY_REVENUE", 25, {"period": "this_month"})
_rule(["pichle mahine ka revenue", "pichle mahine ki kamai", "last month ka revenue", "last month revenue",
        "previous month revenue", "pichle mahine revenue", "pichla mahina revenue",
        "pichle mahine ka business", "pichle mahine ki total", "last month ka business"],
      "MONTHLY_REVENUE", 25, {"period": "last_month"})
_rule(["pichle mahine", "pichla mahina", "pichle maheena", "pichla maheena"],
      "MONTHLY_REVENUE", 15, {"period": "last_month"})
_rule(["pichla mahina kitna", "pichle mahine kitna", "pichle maheene kitna",
        "pichle mahine ka total", "pichla mahina total"],
      "MONTHLY_REVENUE", 20, {"period": "last_month"})
_rule(["is mahina kitna aaya", "is mahine kitna aaya", "is maheene kitna aaya",
        "this month kitna aaya", "iss mahine kitna"],
      "MONTHLY_REVENUE", 20, {"period": "this_month"})
_rule(["monthly revenue", "monthly sale", "monthly income", "monthly bikri", "monthly kamai"],
      "MONTHLY_REVENUE", 15, {"period": "this_month"})
_rule(["mahine ka revenue", "mahina ka revenue", "month ka revenue", "month ka income",
        "mahine ki kamai", "mahine ka business"],
      "MONTHLY_REVENUE", 10, {"period": "this_month"})
_rule(["pichle hafte ka", "pichla hafta revenue", "last week revenue", "last week ka revenue"],
      "MONTHLY_REVENUE", 15, {"period": "last_week"})
_rule(["is hafte ka revenue", "is hafte ki kamai", "this week revenue"],
      "MONTHLY_REVENUE", 15, {"period": "this_week"})

# ── OUT_OF_STOCK_ALERT ──────────────────────────────────────────
_rule(["out of stock medicines", "out of stock items", "out of stock products",
        "medicines out of stock", "items out of stock", "zero stock", "no stock",
        "stock khatam hai", "stock nahi hai", "bilkul khatam", "completely out"],
      "OUT_OF_STOCK_ALERT", 35)
_rule(["out of stock", "oos", "stock out", "no inventory"],
      "OUT_OF_STOCK_ALERT", 30)

# ── LOW_STOCK_ALERT ──────────────────────────────────────────────
_rule(["low stock medicines", "low stock items", "low stock medicine", "low stock products"],
      "LOW_STOCK_ALERT", 30)
_rule(["medicines running low", "medicines low in stock", "which medicines are low",
        "medicines almost out", "items running low", "products running low"],
      "LOW_STOCK_ALERT", 28)
_rule(["check medicines running low", "check low stock", "show low stock", "show medicines low"],
      "LOW_STOCK_ALERT", 25)
_rule(["kya khatam ho raha", "khatam hone wali", "khatam ho rahi", "khatam ho gaya"],
      "LOW_STOCK_ALERT", 25)
_rule(["stock kam hai", "kam stock"],
      "LOW_STOCK_ALERT", 20)
_rule(["low stock", "stock low", "stock kam", "running low", "short stock"],
      "LOW_STOCK_ALERT", 10)

# ── EXPIRY_RISK_REPORT ───────────────────────────────────────────
_rule(["expire ho rahi", "expire hone wali", "expiry wali medicine", "expiring medicines"],
      "EXPIRY_RISK_REPORT", 25, {"withinDays": 30})
_rule(["kharab hone wali", "kharab ho rahi", "kharab stock", "expiry stock"],
      "EXPIRY_RISK_REPORT", 20, {"withinDays": 30})
_rule(["expire", "expiry", "kharab", "expiring", "expired"],
      "EXPIRY_RISK_REPORT", 5, {"withinDays": 30})
_rule(["expiry alerts", "expiry alert", "expiry report", "expire alert", "expire report"],
      "EXPIRY_RISK_REPORT", 30, {"withinDays": 90})
_rule(["full expiry list", "full list expiry", "all expiry", "all expiring", "complete expiry list",
        "saari expiry", "poori expiry", "sari expiry"],
      "EXPIRY_RISK_REPORT", 30, {"withinDays": 90})

# ── QUEUE_STATUS ─────────────────────────────────────────────────
_rule(["queue mein kitne", "queue me kitne", "kitne log queue", "waiting queue"],
      "QUEUE_STATUS", 25)
_rule(["kitne patients", "kitne log wait", "wait kar rahe", "waiting patients", "patients waiting"],
      "QUEUE_STATUS", 20)
_rule(["queue", "line", "waiting", "line mein", "line me", "wait"],
      "QUEUE_STATUS", 5)

# ── TOP_MEDICINES_SALES ──────────────────────────────────────────
_rule(["sabse zyada bikne wali", "sabse zyada bikri", "sabse popular medicine", "sabse zyada bechne wali"],
      "TOP_MEDICINES_SALES", 25, {"topN": 5})
_rule(["top selling", "best selling", "most sold", "most popular medicine", "popular dawai"],
      "TOP_MEDICINES_SALES", 20, {"topN": 5})
_rule(["top medicines", "top products", "top drugs", "top dawai", "best medicines",
        "top 5 medicines", "top 10 medicines", "top 5 products", "top 10 products",
        "top 5 drugs", "top 10 drugs"],
      "TOP_MEDICINES_SALES", 25, {"topN": 5})
_rule(["top", "best", "popular", "bikri", "sabse zyada", "sabse"],
      "TOP_MEDICINES_SALES", 3, {"topN": 5})

# ── PENDING_BILLS ────────────────────────────────────────────────
_rule(["pending bills", "pending bill", "unpaid bills", "unpaid bill", "baki bill", "baaki bill"],
      "PENDING_BILLS", 20)
_rule(["kitne pending hai", "kitne pending", "pending dikhao", "kaun sa bill pending"],
      "PENDING_BILLS", 15)
_rule(["pending", "unpaid", "baaki", "outstanding", "udhar", "baki", "due payment"],
      "PENDING_BILLS", 5)

# ── PATIENT_PURCHASE_HISTORY ─────────────────────────────────────
_rule(["ka purchase history", "ka bill history", "ka record", "ke purchase", "ki history", "ka history",
        "uhid history", "UHID history", "patient id history", "ka purchase record", "ka treatment record",
        "ka medical record"],
      "PATIENT_PURCHASE_HISTORY", 20)
_rule(["patient history", "purchase history", "bill history", "medicine history", "patient record",
        "purchase record", "medical history", "treatment history"],
      "PATIENT_PURCHASE_HISTORY", 12)
_rule(["history for", "history of"],
      "PATIENT_PURCHASE_HISTORY", 10)
_rule(["uhid", "patient id", "UHID"],
      "PATIENT_PURCHASE_HISTORY", 8)
_rule(["patient history", "purchase history", "bill history", "medicine history", "patient record"],
      "PATIENT_PURCHASE_HISTORY", 10)

# ── DISPENSE_PENDING ────────────────────────────────────────────
_rule(["dispense nahi hua", "dispense nahi", "pending dispense", "diya nahi", "nahi diya gaya"],
      "DISPENSE_PENDING", 20)
_rule(["pay ho gaya par diya nahi", "paid but not given", "paid hai par mila nahi"],
      "DISPENSE_PENDING", 25)
_rule(["dispense pending", "bills pending dispense", "bills not dispensed",
        "not yet dispensed", "undispensed", "not dispensed",
        "show bills not yet dispensed", "bills not yet dispensed",
        "dispense nahi hua bills", "pending dispense bills"],
      "DISPENSE_PENDING", 25)
_rule(["dispense", "dispensed"],
      "DISPENSE_PENDING", 5)

# ── REORDER_RECOMMENDATIONS ──────────────────────────────────────
_rule(["kya mangwana padega", "kya order karna", "kya mangwana", "kya order karein"],
      "REORDER_RECOMMENDATIONS", 20)
_rule(["reorder karna", "reorder recommendations", "restock karna", "order karne chahiye"],
      "REORDER_RECOMMENDATIONS", 15)
_rule(["should we reorder", "what should we reorder", "reorder this week", "reorder list",
        "reorder this month", "kya reorder karein"],
      "REORDER_RECOMMENDATIONS", 25)
_rule(["reorder", "restock", "mangwana", "mangwao", "order karna"],
      "REORDER_RECOMMENDATIONS", 5)

# ── SUPPLIER_PERFORMANCE ─────────────────────────────────────────
_rule(["sabse achha supplier", "best supplier", "reliable supplier", "achha supplier"],
      "SUPPLIER_PERFORMANCE", 20)
_rule(["supplier performance", "vendor performance", "dealers performance"],
      "SUPPLIER_PERFORMANCE", 15)
_rule(["supplier", "vendor", "dealers", "distributor"],
      "SUPPLIER_PERFORMANCE", 3)

# ── RETURN_SUMMARY ───────────────────────────────────────────────
_rule(["return summary", "medicine returns", "returns kitne", "return count"],
      "RETURN_SUMMARY", 15)
_rule(["return", "wapas", "returned", "return kiya"],
      "RETURN_SUMMARY", 5)

# ── GRN_SUMMARY ──────────────────────────────────────────────────
_rule(["recent grn", "goods received", "maal aaya", "grn dikhao", "grn entry"],
      "GRN_SUMMARY", 15)
_rule(["grn"],
      "GRN_SUMMARY", 3)

# ── PURCHASE_ORDER_STATUS ─────────────────────────────────────────
_rule(["purchase order pending", "po pending", "purchase orders", "open purchase order"],
      "PURCHASE_ORDER_STATUS", 15)
_rule(["purchase order", "po status", "order status"],
      "PURCHASE_ORDER_STATUS", 5)

# ── CATEGORY_BREAKDOWN ───────────────────────────────────────────
_rule(["category wise revenue", "category wise sale", "category wise bikri", "category breakdown"],
      "CATEGORY_BREAKDOWN", 20)
_rule(["sabse zyada bikti category", "kaun si category zyada bikti", "category ka revenue",
        "kis category ka revenue", "kis category ki bikri", "category me revenue"],
      "CATEGORY_BREAKDOWN", 20)
_rule(["category wise", "type wise", "category breakdown", "categories"],
      "CATEGORY_BREAKDOWN", 10)
_rule(["category", "type ka revenue", "type ki bikri"],
      "CATEGORY_BREAKDOWN", 6)

# ── CONTROLLED_DRUG_AUDIT ────────────────────────────────────────
_rule(["schedule h drugs ka", "schedule h drug log", "schedule h drugs record",
        "schedule h log", "narcotic log", "controlled drug record",
        "schedule h record", "schedule h ka record", "narcotic drug log"],
      "CONTROLLED_DRUG_AUDIT", 28)
_rule(["schedule h", "controlled drug", "narcotic", "h1 record", "narcotic drug"],
      "CONTROLLED_DRUG_AUDIT", 12)

# ── WALK_IN_VS_PATIENT ───────────────────────────────────────────
_rule(["walk-in aur hospital", "walkin vs hospital", "walkin aur hospital patient"],
      "WALK_IN_VS_PATIENT", 20)
_rule(["walk-in", "walkin", "bahar ke patient", "walk in patient"],
      "WALK_IN_VS_PATIENT", 8)
