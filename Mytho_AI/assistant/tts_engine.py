"""
tts_engine.py
--------------
Text-to-speech pipeline.

Loads the model once at module init. Falls back to edge-tts / Google TTS
if the model fails to load.
"""

import io
import logging
import threading
from typing import Optional

logger = logging.getLogger("mqe.tts")

_VOICE_PRESETS = {
    "en-IN": {
        "default": "Mary speaks in a calm, clear, and professional tone with a moderate speed. The recording is of very high quality with no background noise.",
        "warm":    "Mary speaks in a warm and empathetic tone, slightly slow-paced for clarity. The recording is of very high quality with no background noise.",
        "formal":  "Thoma speaks in a formal, neutral tone with precise diction and moderate speed. The recording is of very high quality with no background noise.",
    },
}

_LANG_MAP = {
    "en": "en-IN",
}

_model = None
_tokenizer = None
_desc_tokenizer = None
_device = None
_infer_lock = threading.Lock()
_model_ready = False


def _load_model():
    global _model, _tokenizer, _desc_tokenizer, _device, _model_ready

    try:
        import torch
        import numpy as np
        import soundfile as sf

        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer

        _device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info("Loading ai4bharat/indic-parler-tts on %s ...", _device)

        _model = ParlerTTSForConditionalGeneration.from_pretrained(
            "ai4bharat/indic-parler-tts", token=True
        ).to(_device)
        _model.eval()

        _tokenizer = AutoTokenizer.from_pretrained("ai4bharat/indic-parler-tts")
        _desc_tokenizer = AutoTokenizer.from_pretrained(
            _model.config.text_encoder._name_or_path
        )
        _model_ready = True
        logger.info("Indic Parler-TTS model loaded")
    except Exception as exc:
        logger.warning("Indic Parler-TTS not available: %s", exc)
        _model_ready = False


def _normalise(text: str) -> str:
    import re
    text = re.sub(r"\*+", "", text)
    text = re.sub(r"[\U0001F300-\U0001FAFF\U0001F600-\U0001F64F]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > 500:
        text = text[:500]
    return text


def is_ready() -> bool:
    return _model_ready


async def synthesize(text: str, lang: str = "en") -> Optional[bytes]:
    normalised = _normalise(text)
    if not normalised:
        return None

    if _model_ready:
        try:
            result = _synthesize_indic(normalised, lang)
            if result:
                return result
        except Exception as exc:
            logger.warning("Indic Parler-TTS failed: %s", exc)

    result = await _try_edge_tts(normalised, lang)
    if result:
        return result

    result = await _try_google_tts(normalised, lang)
    if result:
        return result

    return None


def _get_voice_description(lang_code: str, style: str = "default") -> str:
    presets = _VOICE_PRESETS.get(lang_code, _VOICE_PRESETS["en-IN"])
    return presets.get(style, presets["default"])


def _synthesize_indic(text: str, lang: str) -> Optional[bytes]:
    import numpy as np
    import soundfile as sf
    import torch

    lang_code = _LANG_MAP.get(lang, "en-IN")
    description = _get_voice_description(lang_code)

    desc_inputs = _desc_tokenizer(description, return_tensors="pt").to(_device)
    prompt_inputs = _tokenizer(text, return_tensors="pt").to(_device)

    with _infer_lock:
        with torch.no_grad():
            generation = _model.generate(
                input_ids=desc_inputs.input_ids,
                attention_mask=desc_inputs.attention_mask,
                prompt_input_ids=prompt_inputs.input_ids,
                prompt_attention_mask=prompt_inputs.attention_mask,
            )

    audio_arr = generation.cpu().numpy().squeeze().astype(np.float32)

    peak = np.abs(audio_arr).max()
    if peak > 1.0:
        audio_arr = audio_arr / peak

    native_rate = _model.config.sampling_rate
    buf = io.BytesIO()
    sf.write(buf, audio_arr, native_rate, format="WAV", subtype="PCM_16")
    buf.seek(0)
    logger.info("Indic Parler-TTS synthesis OK (%d Hz, %d bytes)", native_rate, buf.getbuffer().nbytes)
    return buf.read()


async def _try_edge_tts(text: str, lang: str) -> Optional[bytes]:
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, "en-IN-NeerjaNeural")
        buf = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        buf.seek(0)
        logger.info("edge-tts synthesis OK")
        return buf.read()
    except ImportError:
        logger.debug("edge-tts not installed")
        return None
    except Exception as exc:
        logger.warning("edge-tts failed: %s", exc)
        return None


async def _try_google_tts(text: str, lang: str) -> Optional[bytes]:
    import httpx
    from urllib.parse import quote

    url = (
        f"https://translate.google.com/translate_tts"
        f"?ie=UTF-8&client=tw-ob&tl=en&q={quote(text)}"
    )

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            })
            resp.raise_for_status()
            logger.info("Google TTS synthesis OK")
            return resp.content
    except ImportError:
        logger.warning("httpx not installed. pip install httpx")
        return None
    except Exception as exc:
        logger.warning("Google TTS failed: %s", exc)
        return None


_load_model()
