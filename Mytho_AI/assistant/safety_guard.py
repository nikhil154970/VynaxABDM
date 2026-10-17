"""
safety_guard.py
---------------
Blocks any message that tries to WRITE, MODIFY, or DELETE data.
This is a HARD block — runs before the LLM, zero latency.

CHANGE FROM PREVIOUS VERSION
  - Added Hindi and Hinglish write-intent keywords
  - Added get_block_message() that replies in Hinglish
  - Kept original English keywords unchanged
"""

# ── Write-intent keywords ─────────────────────────────────────────
# English
_ENGLISH_WRITE = [
    "delete", "remove", "update", "change", "edit",
    "insert", "create", "add", "drop", "truncate",
    "approve", "refund", "cancel", "modify", "alter",
    "reset", "clear", "wipe", "overwrite",
]

# Hindi / Hinglish — what a pharmacy staff member might say
_HINDI_WRITE = [
    # delete / remove
    "hatao", "hata do", "delete karo", "remove karo",
    "mitao", "mita do",
    # update / change
    "badlo", "badal do", "update karo", "change karo",
    "theek karo",
    # add / create
    "add karo", "naya banao", "create karo", "daalo",
    # cancel
    "cancel karo", "band karo", "rok do",
    # refund / return process (write action)
    "wapas karo", "refund karo", "return karo",
]

ALL_WRITE_KEYWORDS = _ENGLISH_WRITE + _HINDI_WRITE


def is_allowed(text: str) -> bool:
    """
    Returns True  → message is safe, proceed with pipeline.
    Returns False → message wants to write data, block it.
    """
    lower = text.lower()
    return not any(kw in lower for kw in ALL_WRITE_KEYWORDS)


def get_block_message() -> str:
    """English refusal message shown to user when blocked."""
    return (
        "I can only answer read-only queries. "
        "Changing, deleting, or updating data is not part of my role. "
        "Please ask another question."
    )