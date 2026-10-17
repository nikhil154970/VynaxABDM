"""
Mytho_AI HTTP Server
-------------------
Exposes the Mytho_AI assistant as a RESTful HTTP API.
This server bridges the Node.js backend with the Python Mytho_AI module.

Usage:
    python server.py
    
Environment Variables:
    PORT: Server port (default 5001)
    LOG_LEVEL: Logging level (default INFO)
"""

import os
import sys
import json
import logging
from typing import Dict, Any
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from flask import Flask, request, jsonify
from flask_cors import CORS
import asyncio

from assistant.chat import process_message
from assistant.response_formatter import VALID_LANGS

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="[%(levelname)s] %(name)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(str(Path(__file__).parent / "logs" / "server.log"), encoding="utf-8"),
    ]
)
logger = logging.getLogger("mytho_ai.server")
logger.setLevel(logging.DEBUG)

app = Flask(__name__)
CORS(app)

PORT = int(os.getenv("PORT", 5001))
DEBUG = os.getenv("DEBUG", "false").lower() == "true"


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "mytho_ai"}), 200


@app.route("/api/query", methods=["POST"])
def query():
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "error": "No JSON body provided",
                "reply": "Invalid request format"
            }), 400

        message = data.get("message", "").strip()
        language = "english"
        module = data.get("module", "pharmacy")
        userId = data.get("userId")
        uhid = data.get("uhid")
        role = data.get("role") or ("patient" if module == "patient" else "pharmacist")

        if not message:
            return jsonify({
                "error": "Message is required and cannot be empty",
                "reply": "Please provide a message"
            }), 400

        logger.info(f"Processing query: message='{message[:50]}...' module='{module}' userId={userId} role='{role}'")

        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(process_message(message, language, module, userId, role, uhid))
        finally:
            try:
                loop.run_until_complete(loop.shutdown_asyncgens())
            except Exception:
                pass
            loop.close()

        import time
        result["server_stamp"] = int(time.time())
        logger.info(f"Query processed: intent='{result.get('intent')}' module='{module}' error={result.get('error') is not None} stamp={result['server_stamp']}")
        logger.debug(f"Assistant result: {result}")

        # Generate PDF for lab reports
        if result.get("intent") == "MY_LAB_REPORTS" and result.get("rawData"):
            try:
                from assistant.lab_report_pdf import generate_lab_report_pdf
                pdf_b64 = generate_lab_report_pdf(result["rawData"])
                if pdf_b64:
                    result["pdfData"] = pdf_b64
            except Exception as pdf_err:
                logger.warning("PDF generation failed: %s", pdf_err)
            finally:
                result.pop("rawData", None)
        try:
            print(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
        except Exception:
            pass

        try:
            dump_dir = Path(__file__).parent / "logs"
            dump_dir.mkdir(exist_ok=True)
            (dump_dir / "last_result.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        except Exception:
            pass

        return jsonify(result), 200

    except asyncio.TimeoutError:
        logger.error("Query processing timed out")
        return jsonify({
            "reply": "Processing took too long. Please try again.",
            "intent": "ERROR",
            "language": "english",
            "error": "timeout"
        }), 504

    except Exception as e:
        logger.error(f"Error processing query: {str(e)}", exc_info=True)
        return jsonify({
            "reply": "An error occurred while processing your request.",
            "intent": "ERROR",
            "language": "english",
            "error": str(e)
        }), 500


@app.route("/api/status", methods=["GET"])
def status():
    return jsonify({
        "status": "ready",
        "service": "mytho_ai",
        "supported_languages": list(VALID_LANGS),
        "version": "1.0.0",
        "supported_modules": ["pharmacy", "patient"],
        "supported_roles": ["pharmacist", "patient", "doctor", "admin"]
    }), 200


@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "error": "Endpoint not found",
        "available_endpoints": [
            "/health",
            "/api/query",
            "/api/status"
        ]
    }), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed"}), 405


if __name__ == "__main__":
    logger.info(f"Starting Mytho_AI server on port {PORT}")
    logger.info(f"Debug mode: {DEBUG}")
    app.run(
        host="0.0.0.0",
        port=PORT,
        debug=DEBUG,
        threaded=True
    )
