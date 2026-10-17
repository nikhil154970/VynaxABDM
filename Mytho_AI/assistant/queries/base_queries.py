"""
base_queries.py
---------------
Shared database connection logic and utilities for all query modules.
"""

import os
import re
import sqlite3
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import requests

logger = logging.getLogger("mqe.base_queries")

try:
    import psycopg  # type: ignore
    from psycopg.rows import dict_row  # type: ignore
except ImportError:  # pragma: no cover - keeps SQLite/mock fallback usable without psycopg.
    psycopg = None
    dict_row = None

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_ENV_PATH = ROOT_DIR / "backend" / ".env"
DB_PATH = os.getenv("MQE_SQLITE_DB", str(ROOT_DIR / "mqe_assistant" / "test_pharmacy.db"))

POSTGRES_IDENTIFIERS = [
    "PharmacyBillItem",
    "PharmacyBill",
    "PharmacyMedicine",
    "PharmacyPayment",
    "PharmacyInventoryBatch",
    "PharmacyMedicineFeatures",
    "PharmacyQueue",
    "PharmacyReturn",
    "PharmacySupplier",
    "PharmacyGrn",
    "PharmacyPurchaseOrder",
    "medicineName",
    "billId",
    "medicineId",
    "availableQty",
    "batchNumber",
    "expiryDate",
    "createdAt",
    "grandTotal",
    "paidAmount",
    "pendingAmount",
    "paymentMode",
    "sentAt",
    "tokenNumber",
    "billNumber",
    "customerName",
    "customerMobile",
    "patientName",
    "patientUhid",
    "dispenseStatus",
    "returnNumber",
    "returnType",
    "patientName",
    "supplierName",
    "totalAmount",
    "receivedDate",
    "purchaseOrderId",
    "poNumber",
    "grnNumber",
    "receiptStatus",
    "billingType",
    "subTotal",
    "gstAmount",
    "invoiceNumber",
    "invoiceDate",
    "purchasePrice",
    "sellingPrice",
    "gstPercentage",
    "avgDailyDemand30d",
    "reorderPoint",
    "safetyStock",
    "suggestedOrderQty",
    "billDate",
    "strength",
    "dosageForm",
    "category",
    "status",
    "mrp",
    "grandTotal",
    "createdAt",
]


def _load_backend_env():
    if not BACKEND_ENV_PATH.exists():
        return
    for line in BACKEND_ENV_PATH.read_text(encoding="utf-8").splitlines():
        clean = line.strip()
        if not clean or clean.startswith("#") or "=" not in clean:
            continue
        key, value = clean.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)
    db_url_env = None
    for line in BACKEND_ENV_PATH.read_text(encoding="utf-8").splitlines():
        clean = line.strip()
        if clean.startswith("DATABASE_URL="):
            db_url_env = clean.split("=", 1)[1].strip().strip('"').strip("'")
            break
    if db_url_env:
        os.environ["DATABASE_URL"] = db_url_env


def _sanitize_database_url(database_url: str) -> str:
    """Strip query params psycopg may not understand while preserving sslmode."""
    parts = urlsplit(database_url)
    allowed_params = []
    for key, value in parse_qsl(parts.query, keep_blank_values=True):
      if key.lower() == "sslmode":
            allowed_params.append((key, value))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(allowed_params), parts.fragment))


def _postgres_sql(sql: str) -> str:
    pg_sql = sql.replace("?", "%s")
    for ident in sorted(POSTGRES_IDENTIFIERS, key=len, reverse=True):
        pg_sql = re.sub(rf'(?<!")\b{re.escape(ident)}\b(?!")', f'"{ident}"', pg_sql)
    # Ensure common DATE()/TIME() usages have quoted identifiers for Postgres
    for ident in POSTGRES_IDENTIFIERS:
        # unqualified DATE(createdAt) -> DATE("createdAt")
        pg_sql = re.sub(rf'DATE\(\s*{re.escape(ident)}\s*\)', f'DATE("{ident}")', pg_sql)
        # unqualified TIME(createdAt) -> TIME("createdAt") (handled later)
        pg_sql = re.sub(rf'TIME\(\s*{re.escape(ident)}\s*\)', f'TIME("{ident}")', pg_sql)
    pg_sql = pg_sql.replace(
        'CAST(julianday("expiryDate") - julianday(\'now\') AS INTEGER) AS days_left',
        'CAST(DATE_PART(\'day\', "expiryDate" - NOW()) AS INTEGER) AS days_left',
    )
    pg_sql = pg_sql.replace(
        'julianday(g."receivedDate") - julianday(po."createdAt")',
        'EXTRACT(DAY FROM (g."receivedDate" - po."createdAt"))',
    )
    pg_sql = pg_sql.replace('TIME("createdAt")', 'CAST("createdAt" AS TIME)')
    return pg_sql


class DbConnection:
    def __init__(self, conn, kind: str):
        self.conn = conn
        self.kind = kind

    def execute(self, sql: str, params=()):
        if self.kind == "postgres":
            return self.conn.execute(_postgres_sql(sql), params)
        # SQLite: convert PostgreSQL-specific functions
        sql = sql.replace("STRING_AGG(", "GROUP_CONCAT(")
        return self.conn.execute(sql, params)

    def close(self):
        self.conn.close()


# Mock data for fallback
MOCK_DATA = {
    "TOP_MEDICINES_SALES": [
        {"medicineName": "Aspirin 500mg", "total_qty": 250, "total_revenue": 2500.00},
        {"medicineName": "Ibuprofen 400mg", "total_qty": 198, "total_revenue": 2772.00},
        {"medicineName": "Paracetamol 500mg", "total_qty": 180, "total_revenue": 1800.00},
    ],
    "LOW_STOCK_ALERT": [
        {"medicineName": "Omeprazole 20mg", "total_available": 25, "batch_count": 2},
        {"medicineName": "Atorvastatin 10mg", "total_available": 40, "batch_count": 1},
    ],
    "DAILY_REVENUE": [
        {"bill_count": 45, "total_revenue": 8950.50, "collected": 7200.00, "pending": 1750.50},
    ],
    "MONTHLY_REVENUE": [
        {"bill_count": 987, "total_revenue": 186543.75, "collected": 156320.25, "pending": 30223.50},
    ],
    "QUEUE_STATUS": [
        {"status": "WAITING", "count": 12},
        {"status": "DISPENSED", "count": 34},
        {"status": "COMPLETED", "count": 28},
    ],
}


def get_conn():
    """Return the live backend Postgres connection, with SQLite fallback for local tests."""
    _load_backend_env()
    database_url = os.getenv("DATABASE_URL")
    postgres_error = None

    if database_url and psycopg:
        try:
            cleaned_database_url = _sanitize_database_url(database_url)
            conn = psycopg.connect(cleaned_database_url, row_factory=dict_row, connect_timeout=3)
            conn.autocommit = True
            return DbConnection(conn, "postgres")
        except Exception as exc:
            postgres_error = exc

    if database_url and not psycopg:
        postgres_error = RuntimeError("psycopg is not installed; install requirements.txt to use Postgres")
        print(f"[query_engine] {postgres_error}")

    try:
        if not os.path.exists(DB_PATH):
            sqlite_error = RuntimeError(f"SQLite fallback missing at {DB_PATH}")
            if postgres_error:
                # If both Postgres is configured but psycopg is missing and the local
                # SQLite fallback is not present, don't raise immediately — higher
                # layers will attempt to call the backend HTTP API as a last resort.
                raise RuntimeError(f"{postgres_error}; {sqlite_error}") from sqlite_error
            raise sqlite_error
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return DbConnection(conn, "sqlite")
    except Exception as sqlite_exc:
        if postgres_error:
            raise RuntimeError(f"{postgres_error}; SQLite fallback failed: {sqlite_exc}") from sqlite_exc
        raise RuntimeError(f"DATABASE_URL not configured and SQLite fallback failed: {sqlite_exc}") from sqlite_exc


def _today_range():
    today = datetime.now().date()
    return str(today), str(today)


def _month_range():
    today = datetime.now().date()
    start = today.replace(day=1)
    return str(start), str(today)


def _to_number(value, default=0):
    try:
        if value is None:
            return default
        if isinstance(value, (int, float)):
            return value
        return float(value)
    except Exception:
        return default


def _row_list(raw: dict) -> list[dict]:
    rows = raw.get("rows", [])
    return rows if isinstance(rows, list) else []


def _first_row(raw: dict) -> dict:
    rows = _row_list(raw)
    return rows[0] if rows else {}


def _get_backend_base() -> str:
    """Return the base URL for the Node backend API (tries env, backend .env, or localhost defaults)."""
    # Preferred env override
    base = os.getenv("BACKEND_API_BASE")
    if base:
        return base.rstrip('/')

    # Try reading backend .env for PORT
    try:
        for line in BACKEND_ENV_PATH.read_text(encoding="utf-8").splitlines():
            if line.startswith("PORT="):
                port = line.split("=", 1)[1].strip().strip('"').strip("'")
                return f"http://localhost:{port}"
    except Exception:
        pass

    # Default
    return "http://localhost:5000"


def _fetch_from_backend_api(intent: str, params: dict) -> dict | None:
    """Map a small set of intents to backend HTTP endpoints and return a result
    in the same shape as the DB-backed handlers ({"rows": [...], "meta": {...}}).
    Returns None when the intent can't be served via HTTP.
    """
    base = _get_backend_base()
    try:
        if intent in ("DAILY_REVENUE", "MONTHLY_REVENUE", "QUEUE_STATUS", "PENDING_BILLS", "LOW_STOCK_ALERT"):
            # Use the assistant-data endpoint which doesn't require authentication
            url = f"{base}/api/pharmacy/assistant-data"
            headers = {"Content-Type": "application/json"}

            resp = requests.get(url, timeout=5, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            if intent == "DAILY_REVENUE":
                kpis = data.get("kpis", {})
                rows = [{
                    "bill_count": 1,
                    "total_revenue": kpis.get("todaySales", 0),
                    "collected": kpis.get("todaySales", 0),
                    "pending": 0,
                }]
                return {"rows": rows, "meta": {"source": "backend_api"}}

            if intent == "MONTHLY_REVENUE":
                # backend dashboard doesn't return monthly aggregate — approximate
                kpis = data.get("kpis", {})
                rows = [{
                    "bill_count": 0,
                    "total_revenue": kpis.get("todaySales", 0) * 30,
                    "collected": 0,
                    "pending": 0,
                }]
                return {"rows": rows, "meta": {"source": "backend_api"}}

            if intent == "LOW_STOCK_ALERT":
                low = data.get("lowStock", [])
                rows = [{"medicineName": r.get("medicineName") or r.get("name"), "total_available": r.get("availableStock") or r.get("availableQty") or r.get("stockLabel") } for r in low]
                return {"rows": rows, "meta": {"source": "backend_api"}}

            if intent == "QUEUE_STATUS":
                k = data.get("kpis", {})
                pending = data.get("pendingPrescriptions", 0)
                rows = [{"status": "WAITING", "count": pending}]
                return {"rows": rows, "meta": {"source": "backend_api"}}

            if intent == "PENDING_BILLS":
                pending = data.get("recentBills", [])
                rows = [{"pending": round(sum(float(p.get("grandTotal", 0)) for p in pending), 2)}]
                return {"rows": rows, "meta": {"source": "backend_api"}}

        # For unhandled intents, return None to let caller fallback to mock
        return None
    except Exception as e:
        print(f"[query_engine] backend API fetch failed: {e}")
        return None
