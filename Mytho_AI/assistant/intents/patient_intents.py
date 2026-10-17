"""
patient_intents.py
------------------
Patient-specific intents for the assistant.
These intents are filtered by userId to ensure patients only see their own data.
"""

# All patient-specific intents
PATIENT_INTENTS = {
    "GREETING",
    "MY_PRESCRIPTIONS",
    "MY_BILLS",
    "MY_APPOINTMENTS",
    "MY_MEDICINE_HISTORY",
    "MY_LAB_REPORTS",
    "MY_PAYMENT_HISTORY",
    "BOOK_APPOINTMENT",
    "CONTACT_DOCTOR",
}

# Patient-specific keyword rules
# (keywords, intent_id, weight, default_params, extractors)
PATIENT_RULES = []


def _rule(keywords, intent, weight=10, params=None, extractors=None):
    PATIENT_RULES.append((keywords, intent, weight, params or {}, extractors or []))


# ── GREETING ─────────────────────────────────────────────────────
_rule(["hi", "hello", "hey", "namaste", "good morning", "good afternoon", "good evening"],
      "GREETING", 30)
_rule(["help", "kya kar sakte ho", "what can you do", "options", "menu"],
      "GREETING", 20)

# ── MY_PRESCRIPTIONS ─────────────────────────────────────────────
_rule(["my prescription", "mera prescription", "meri prescription", "prescription dikhao",
        "my prescriptions", "meri prescriptions", "prescriptions dikhao"],
      "MY_PRESCRIPTIONS", 30)
_rule(["prescription", "prescriptions", "dawa ka prescription", "davai ka prescription"],
      "MY_PRESCRIPTIONS", 20)
_rule(["medicine list", "dawa list", "davai list", "medicines prescribed"],
      "MY_PRESCRIPTIONS", 15)

# ── MY_BILLS ─────────────────────────────────────────────────────
_rule(["my bill", "mera bill", "meri bill", "bill dikhao", "my bills", "meri bills"],
      "MY_BILLS", 30)
_rule(["bill", "bills", "pharmacy bill", "pharmacy bills"],
      "MY_BILLS", 20)
_rule(["my payment", "mera payment", "payment dikhao", "my payments"],
      "MY_BILLS", 15)

# ── MY_APPOINTMENTS ──────────────────────────────────────────────
_rule(["my appointment", "mera appointment", "appointment dikhao", "my appointments"],
      "MY_APPOINTMENTS", 30)
_rule(["appointment", "appointments", "upcoming appointment", "next appointment"],
      "MY_APPOINTMENTS", 20)
_rule(["book appointment", "appointment book", "appointment schedule", "schedule appointment"],
      "MY_APPOINTMENTS", 25)

# ── MY_MEDICINE_HISTORY ──────────────────────────────────────────
_rule(["my medicine history", "meri medicine history", "medicine history dikhao",
        "my medicine purchase", "meri medicine purchase"],
      "MY_MEDICINE_HISTORY", 30)
_rule(["medicine history", "dawa history", "davai history", "purchased medicines"],
      "MY_MEDICINE_HISTORY", 20)
_rule(["what medicines i bought", "kya kharida maine", "meri kharidari"],
      "MY_MEDICINE_HISTORY", 15)

# ── MY_LAB_REPORTS ───────────────────────────────────────────────
_rule(["my lab report", "mera lab report", "lab report dikhao", "my lab reports"],
      "MY_LAB_REPORTS", 30)
_rule(["lab report", "lab reports", "test report", "test reports", "investigation report"],
      "MY_LAB_REPORTS", 20)
_rule(["blood test", "urine test", "pathology", "diagnostic"],
      "MY_LAB_REPORTS", 15)

# ── MY_PAYMENT_HISTORY ───────────────────────────────────────────
_rule(["my payment history", "mera payment history", "payment history dikhao"],
      "MY_PAYMENT_HISTORY", 30)
_rule(["payment history", "transaction history", "payment record"],
      "MY_PAYMENT_HISTORY", 20)
_rule(["how much i paid", "kitna pay kiya", "mera payment summary"],
      "MY_PAYMENT_HISTORY", 15)

# ── BOOK_APPOINTMENT ─────────────────────────────────────────────
_rule(["book appointment", "appointment book", "schedule appointment", "appointment schedule"],
      "BOOK_APPOINTMENT", 30)
_rule(["i want to book", "main appointment lena chahta", "appointment chahiye"],
      "BOOK_APPOINTMENT", 25)
_rule(["consult doctor", "doctor se milna", "doctor consultation"],
      "BOOK_APPOINTMENT", 20)

# ── CONTACT_DOCTOR �───────────────────────────────────────────────
_rule(["contact doctor", "doctor ka number", "doctor ka contact", "doctor se baat"],
      "CONTACT_DOCTOR", 30)
_rule(["how to contact doctor", "doctor kaise milega", "doctor ka phone"],
      "CONTACT_DOCTOR", 25)
_rule(["doctor", "physician", "specialist"],
      "CONTACT_DOCTOR", 10)
