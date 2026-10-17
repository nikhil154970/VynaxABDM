"""
llm_router.py
-------------
LLM-powered query router using Qwen2.5 (local or API).
Extracts structured intent for the NL2SQL engine.
"""

import json
import os
import re
import logging
import requests
from typing import Optional
from assistant.intent_router import classify as intent_classify

logger = logging.getLogger("mqe.llm_router")

SYSTEM_PROMPT = """You are a hospital database assistant. Understand English queries from hospital staff.

Given a user question, extract structured information in JSON format.

Rules:
- intent: "revenue" for income/money, "patient_count", "appointment_count", "bill_count", "list" for showing items, "stock_check" for inventory, "expiry_check" for expiring medicines, "unknown"
- time: "today" | "yesterday" | "this_month" | "last_month" | "this_week" | "last_week" | null
- entity: "pharmacy" | "patient" | "appointment" | "admission" | "lab" | "doctor" | null
- metric: "sum" | "count" | "list" | null
- limit: number or null for top/best queries
- language: "english"

Examples:
Q: "aaj ka revenue kitna hua bhaiyya?"
A: {"intent": "revenue", "time": "today", "entity": null, "metric": "sum", "limit": null, "language": "english"}

Q: "pichle mahine kitne naye mareez aaye the?"
A: {"intent": "patient_count", "time": "last_month", "entity": "patient", "metric": "count", "limit": null, "language": "english"}

Q: "kaun si dawaiyaan khatam hone wali hain?"
A: {"intent": "stock_check", "time": null, "entity": "pharmacy", "metric": "list", "limit": null, "language": "english"}

Q: "Show me top 5 selling medicines this month"
A: {"intent": "revenue", "time": "this_month", "entity": "pharmacy", "metric": "sum", "limit": 5, "language": "english"}

Q: "aaj ka total kitna hua aur kal ka bhi batao"
A: {"intent": "revenue", "time": "today", "entity": null, "metric": "sum", "limit": null, "language": "english"}

Output ONLY valid JSON. No extra text."""


def _get_api_key() -> Optional[str]:
    """Check for API key in environment or backend .env"""
    key = os.getenv("LLM_API_KEY")
    if key:
        return key
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", "backend", ".env")
    try:
        for line in open(env_path, encoding="utf-8"):
            if line.startswith("LLM_API_KEY="):
                return line.strip().split("=", 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return None


def _get_api_base() -> str:
    return os.getenv("LLM_API_BASE", "https://api.groq.com/openai/v1")



def _get_model_name() -> str:
    return os.getenv("LLM_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")


def _get_intent_model_name() -> str:
    """Model to use for intent extraction/classification. Defaults to Qwen2.5."""
    return os.getenv("LLM_INTENT_MODEL", _get_model_name())


def _get_response_model_name() -> str:
    """Model to use for natural language response generation. Can be set to an Indic-focused model via env var `LLM_RESPONSE_MODEL`.
    Falls back to the intent model if not set.
    """
    return os.getenv("LLM_RESPONSE_MODEL", _get_model_name())


# ── Local transformers inference ──────────────────────────

_model = None
_tokenizer = None


def _is_model_cached(model_name: str) -> bool:
    """Check if model is already in HuggingFace cache (local filesystem only)."""
    import os
    # Common HF cache locations
    cache_home = os.getenv("HF_HOME", os.path.join(os.path.expanduser("~"), ".cache", "huggingface"))
    cache_dirs = [
        os.path.join(cache_home, "hub"),
        os.path.join(os.path.expanduser("~"), ".cache", "huggingface", "hub"),
    ]
    model_slug = model_name.replace("/", "--")
    for base in cache_dirs:
        snapshots = os.path.join(base, "models--" + model_slug, "snapshots")
        if os.path.isdir(snapshots) and os.listdir(snapshots):
            return True
    return False


def _load_local_model():
    global _model, _tokenizer
    if _model is not None:
        return True
    try:
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer  # type: ignore
        except ImportError:
            logger.warning("transformers not installed — skipping local LLM")
            return False
        model_name = _get_model_name()

        # Don't attempt download — only use cached model
        if not _is_model_cached(model_name):
            logger.warning(f"{model_name} not in cache — skipping local LLM")
            return False

        logger.info(f"Loading {model_name} on CPU (cached)...")
        _tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        _model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype="auto",
            device_map="cpu",
            trust_remote_code=True,
            low_cpu_mem_usage=True,
        )
        logger.info("Model loaded successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to load local model: {e}")
        return False


def _local_inference(prompt: str, model_name: Optional[str] = None) -> Optional[str]:
    """Run local inference. If `model_name` is provided, attempt to load that model (cache-only).
    Returns None on failure.
    """
    # Respect cached model policy — only load if available in cache
    if model_name and not _is_model_cached(model_name):
        logger.warning(f"Requested local model {model_name} not cached; skipping local inference")
        return None

    if not _load_local_model():
        return None
    try:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]
        text = _tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = _tokenizer(text, return_tensors="pt")
        outputs = _model.generate(
            **inputs,
            max_new_tokens=256,
            temperature=0.1,
            do_sample=False,
        )
        response = _tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        return response.strip()
    except Exception as e:
        logger.error(f"Local inference error: {e}")
        return None


# ── API inference ─────────────────────────────────────────

def _api_inference(prompt: str, model_name: Optional[str] = None) -> Optional[str]:
    api_key = _get_api_key()
    if not api_key:
        return None
    try:
        base = _get_api_base()
        model = model_name or _get_model_name()
        # Map local HF name to API name if needed
        api_model = os.getenv("LLM_API_MODEL", model.split("/")[-1] if "/" in model else model)

        resp = requests.post(
            f"{base}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": api_model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.1,
                "max_tokens": 256,
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.error(f"API inference error: {e}")
        return None


# ── Main router ───────────────────────────────────────────

def classify(text: str) -> dict:
    """Classify user query using local Qwen2.5 only (zero external API cost)."""
    prompt = text.strip()
    if not prompt:
        return _fallback(text)

    # Use LOCAL inference only (no API calls)
    intent_model = _get_intent_model_name()
    raw = _local_inference(prompt, model_name=intent_model)

    if not raw:
        logger.warning("Local LLM unavailable, falling back to keyword router")
        return _fallback(text)

    return _parse_llm_output(raw, text)


def _parse_llm_output(raw: str, original: str) -> dict:
    """Extract JSON from LLM output with cleanup."""
    # Find JSON block in the response
    json_match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not json_match:
        logger.warning(f"No JSON found in LLM output: {raw}")
        return _fallback(original)

    try:
        data = json.loads(json_match.group(0))
    except json.JSONDecodeError:
        logger.warning(f"Invalid JSON from LLM: {raw}")
        return _fallback(original)

    # Build the structured result
    result = {
        "intent": _map_intent(data.get("intent", "unknown")),
        "params": {
            "time": data.get("time"),
            "entity": data.get("entity"),
            "metric": data.get("metric", "count"),
            "limit": data.get("limit"),
            "language": "english",
        },
        "confidence": "high",
        "source": "llm",
    }
    return result


def _map_intent(intent: str) -> str:
    """Map LLM intent names to our internal intent names."""
    mapping = {
        "revenue": "DAILY_REVENUE",
        "patient_count": "PATIENT_COUNT",
        "appointment_count": "APPOINTMENT_COUNT",
        "bill_count": "BILL_COUNT",
        "stock_check": "LOW_STOCK_ALERT",
        "expiry_check": "EXPIRY_RISK_REPORT",
        "list": "LIST_ITEMS",
    }
    return mapping.get(intent, "UNKNOWN")


def _fallback(text: str) -> dict:
    """Fallback to keyword-based NL2SQL parsing."""
    # Use the intent_router keyword classifier for reliable intent detection
    # when the LLM is unavailable.
    parsed = intent_classify(text)
    # intent_router returns internal intent names (e.g. LOW_STOCK_ALERT)
    return {
        "intent": parsed.get("intent", "UNKNOWN"),
        "params": parsed.get("params", {}),
        "confidence": parsed.get("confidence", "low"),
        "source": "keyword_fallback",
    }


def format_response(data: dict, text: str, lang: str = "english") -> str:
    """Use local Qwen2.5 to format response (zero API cost).
    
    Uses local inference only for cost-free operation.
    """
    prompt = (
        f"User asked: \"{text}\"\n"
        f"Data from database: {json.dumps(data, ensure_ascii=False)}\n\n"
        f"Respond in English. "
        f"Be friendly and natural, like a hospital assistant talking to staff. "
        f"Keep it under 2 sentences."
    )

    resp_model = _get_response_model_name()
    raw = _local_inference(prompt, model_name=resp_model)
    
    if raw:
        return raw.strip()

    # Ultimate fallback
    return f"Data mil gaya: {data}"
