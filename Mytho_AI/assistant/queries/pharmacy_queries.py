"""
pharmacy_queries.py
-------------------
Pharmacy-specific query handlers.
These queries are unrestricted - pharmacists can see all pharmacy data.
"""

from datetime import datetime, timedelta
from .base_queries import get_conn, _today_range, _month_range, _to_number, MOCK_DATA


def run_pharmacy_query(intent: str, params: dict) -> dict:
    """Run pharmacy-specific queries."""
    try:
        conn = get_conn()
    except Exception as conn_err:
        # If we couldn't get a DB connection, try calling the running backend
        # REST API as a fallback (local dev mode).
        from .base_queries import _fetch_from_backend_api
        try:
            backend_result = _fetch_from_backend_api(intent, params)
            if backend_result is not None:
                return backend_result
        except Exception:
            pass
        # If backend API is unavailable, fall back to in-memory mock data
        if intent in MOCK_DATA:
            return {"rows": MOCK_DATA[intent], "meta": {"source": "mock"}}
        raise

    try:
        if intent == "TOP_MEDICINES_SALES":
            result = _top_medicines_sales(conn, params)
        elif intent == "OUT_OF_STOCK_ALERT":
            result = _out_of_stock_alert(conn, params)
        elif intent == "LOW_STOCK_ALERT":
            result = _low_stock_alert(conn, params)
        elif intent == "EXPIRY_RISK_REPORT":
            result = _expiry_risk(conn, params)
        elif intent == "DAILY_REVENUE":
            result = _daily_revenue(conn, params)
        elif intent == "MONTHLY_REVENUE":
            result = _monthly_revenue(conn, params)
        elif intent == "PENDING_BILLS":
            result = _pending_bills(conn, params)
        elif intent == "QUEUE_STATUS":
            result = _queue_status(conn, params)
        elif intent == "DISPENSE_PENDING":
            result = _dispense_pending(conn, params)
        elif intent == "REORDER_RECOMMENDATIONS":
            result = _reorder_recommendations(conn, params)
        elif intent == "RETURN_SUMMARY":
            result = _return_summary(conn, params)
        elif intent == "SUPPLIER_PERFORMANCE":
            result = _supplier_performance(conn, params)
        elif intent == "CATEGORY_BREAKDOWN":
            result = _category_breakdown(conn, params)
        elif intent == "WALK_IN_VS_PATIENT":
            result = _walk_in_vs_patient(conn, params)
        elif intent == "GRN_SUMMARY":
            result = _grn_summary(conn, params)
        elif intent == "PURCHASE_ORDER_STATUS":
            result = _purchase_order_status(conn, params)
        elif intent == "PATIENT_PURCHASE_HISTORY":
            result = _patient_purchase_history(conn, params)
        else:
            result = {"rows": [], "meta": {"intent": intent}}

        meta = result.setdefault("meta", {})
        meta.setdefault("source", getattr(conn, "kind", "unknown"))
        return result
    except Exception as e:
        # Return mock data on error
        if intent in MOCK_DATA:
            return {"rows": MOCK_DATA[intent], "meta": {"source": "mock", "error": str(e)}}
        return {"rows": [], "meta": {"intent": intent, "error": str(e)}}
    finally:
        if conn:
            conn.close()


def _top_medicines_sales(conn, params):
    top_n = params.get("topN") or 5
    start, end = params.get("start_date"), params.get("end_date")
    if not start:
        start, end = _month_range()

    rows = conn.execute("""
        SELECT
            bi.medicineName,
            SUM(bi.quantity)  AS total_qty,
            ROUND(SUM(bi.amount), 2) AS total_revenue
        FROM PharmacyBillItem bi
        JOIN PharmacyBill b ON b.id = bi.billId
        WHERE DATE(b.createdAt) BETWEEN ? AND ?
          AND b.status = 'PAID'
        GROUP BY bi.medicineName
        ORDER BY total_qty DESC
        LIMIT ?
    """, (start, end, top_n)).fetchall()

    return {
        "rows": [dict(r) for r in rows],
        "meta": {"start": start, "end": end, "top_n": top_n},
    }


def _out_of_stock_alert(conn, params):
    rows = conn.execute("""
        SELECT
            m.medicineName,
            m.strength,
            m.category,
            m.dosageForm,
            0 AS total_available,
            COUNT(b.id) AS batch_count
        FROM PharmacyMedicine m
        LEFT JOIN PharmacyInventoryBatch b ON b.medicineId = m.id AND b.status = 'ACTIVE'
        WHERE m.status = 'ACTIVE'
        GROUP BY m.id, m.medicineName, m.strength, m.category, m.dosageForm
        HAVING COALESCE(SUM(b.availableQty), 0) = 0
        ORDER BY m.medicineName ASC
    """).fetchall()

    return {"rows": [dict(r) for r in rows], "meta": {}}


def _low_stock_alert(conn, params):
    threshold = params.get("threshold_qty") or 50

    rows = conn.execute("""
        SELECT
            m.medicineName,
            m.strength,
            m.category,
            m.dosageForm,
            SUM(b.availableQty) AS total_available,
            COUNT(*)          AS batch_count
        FROM PharmacyInventoryBatch b
        JOIN PharmacyMedicine m ON b.medicineId = m.id
        WHERE b.status = 'ACTIVE' AND m.status = 'ACTIVE'
        GROUP BY m.id, m.medicineName, m.strength, m.category, m.dosageForm
        HAVING SUM(b.availableQty) < ?
        ORDER BY total_available ASC
    """, (threshold,)).fetchall()

    return {"rows": [dict(r) for r in rows], "meta": {"threshold": threshold}}


def _expiry_risk(conn, params):
    within_days = params.get("within_days") or params.get("withinDays") or 30
    cutoff = (datetime.now() + timedelta(days=within_days)).strftime("%Y-%m-%d")

    rows = conn.execute("""
        SELECT
            medicineName,
            batchNumber,
            DATE(expiryDate) AS expiry_date,
            availableQty,
            ROUND(mrp * availableQty, 2) AS stock_value
        FROM PharmacyInventoryBatch
        WHERE status = 'ACTIVE'
          AND availableQty > 0
          AND DATE(expiryDate) <= ?
        ORDER BY expiryDate ASC
    """, (cutoff,)).fetchall()

    now = datetime.now().date()
    result = []
    for r in rows:
        d = dict(r)
        exp = d.get("expiry_date", "")
        if exp:
            try:
                exp_date = datetime.strptime(str(exp)[:10], "%Y-%m-%d").date()
                d["days_left"] = (exp_date - now).days
            except ValueError:
                d["days_left"] = 999
        else:
            d["days_left"] = 999
        result.append(d)

    return {"rows": result, "meta": {"within_days": within_days}}


def _daily_revenue(conn, params):
    raw = params.get("date") or params.get("start_date") or "today"
    if raw == "today":
        date = str(datetime.now().date())
    elif raw == "yesterday":
        date = str(datetime.now().date() - timedelta(days=1))
    else:
        date = raw

    row = conn.execute("""
        SELECT
            COUNT(*)                     AS bill_count,
            ROUND(SUM(grandTotal), 2)    AS total_revenue,
            ROUND(SUM(paidAmount), 2)    AS collected,
            ROUND(SUM(pendingAmount), 2) AS pending
        FROM PharmacyBill
        WHERE DATE(createdAt) = ?
          AND status = 'PAID'
    """, (date,)).fetchone()

    # Payment mode breakdown
    modes = conn.execute("""
        SELECT pp.paymentMode, ROUND(SUM(pp.amount), 2) AS amount
        FROM PharmacyPayment pp
        JOIN PharmacyBill b ON b.id = pp.billId
        WHERE DATE(b.createdAt) = ?
        GROUP BY pp.paymentMode
    """, (date,)).fetchall()

    return {
        "rows": [dict(row)],
        "meta": {"date": date, "payment_modes": [dict(m) for m in modes]},
    }


def _monthly_revenue(conn, params):
    start, end = params.get("start_date"), params.get("end_date")
    if not start:
        period = params.get("period", "this_month")
        today = datetime.now().date()
        if period == "last_month":
            first = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
            last = today.replace(day=1) - timedelta(days=1)
            start, end = str(first), str(last)
        elif period == "this_week":
            start = str(today - timedelta(days=today.weekday()))
            end = str(today)
        elif period == "last_week":
            last_sunday = today - timedelta(days=today.weekday() + 1)
            start = str(last_sunday - timedelta(days=6))
            end = str(last_sunday)
        else:
            start, end = _month_range()

    row = conn.execute("""
        SELECT
            COUNT(*)                     AS bill_count,
            ROUND(SUM(grandTotal), 2)    AS total_revenue,
            ROUND(SUM(paidAmount), 2)    AS collected,
            ROUND(SUM(pendingAmount), 2) AS pending
        FROM PharmacyBill
        WHERE DATE(createdAt) BETWEEN ? AND ?
          AND status = 'PAID'
    """, (start, end)).fetchone()

    return {"rows": [dict(row)], "meta": {"start": start, "end": end}}


def _pending_bills(conn, params):
    rows = conn.execute("""
        SELECT
            billNumber,
            COALESCE(patientName, customerName, 'Walk-in') AS patient,
            ROUND(grandTotal, 2)    AS total,
            ROUND(pendingAmount, 2) AS pending,
            DATE(createdAt)         AS bill_date
        FROM PharmacyBill
        WHERE pendingAmount > 0 AND dispenseStatus != 'DISPENSED'
        ORDER BY createdAt ASC
        LIMIT 20
    """).fetchall()

    return {"rows": [dict(r) for r in rows], "meta": {}}


def _queue_status(conn, params):
    today = str(datetime.now().date())

    counts = conn.execute("""
        SELECT status, COUNT(*) AS count
        FROM PharmacyQueue
        WHERE DATE(sentAt) = ?
        GROUP BY status
    """, (today,)).fetchall()

    oldest = conn.execute("""
        SELECT tokenNumber, sentAt
        FROM PharmacyQueue
        WHERE status = 'WAITING'
          AND DATE(sentAt) = ?
        ORDER BY sentAt ASC
        LIMIT 1
    """, (today,)).fetchone()

    return {
        "rows": [dict(r) for r in counts],
        "meta": {"oldest_waiting": dict(oldest) if oldest else None, "date": today},
    }


def _dispense_pending(conn, params):
    rows = conn.execute("""
        SELECT
            billNumber,
            COALESCE(patientName, customerName, 'Walk-in') AS patient,
            billingType,
            ROUND(grandTotal, 2) AS total,
            COUNT(bi.id) AS item_count,
            DATE(createdAt) AS bill_date,
            CAST(createdAt AS TEXT) AS billed_at
        FROM PharmacyBill
        LEFT JOIN PharmacyBillItem bi ON bi.billId = PharmacyBill.id
        WHERE dispenseStatus = 'PENDING'
        GROUP BY billNumber, patientName, customerName,
                 billingType, grandTotal, createdAt
        ORDER BY createdAt ASC
        LIMIT 20
    """).fetchall()

    result = []
    for r in rows:
        d = dict(r)
        # Format billed_at as HH:MM from the full timestamp
        raw = d.get("billed_at", "")
        if raw and " " in raw:
            d["billed_at"] = raw.split(" ")[1][:5]
        result.append(d)

    return {"rows": result, "meta": {}}


def _reorder_recommendations(conn, params):
    """
    Uses computed features from the ML pipeline (PharmacyMedicineFeatures)
    if available, otherwise falls back to raw inventory.
    """
    try:
        rows = conn.execute("""
            SELECT
                f.medicineName,
                f.availableQty,
                f.avgDailyDemand30d,
                f.reorderPoint,
                f.safetyStock,
                f.suggestedOrderQty,
                f.urgency
            FROM PharmacyMedicineFeatures f
            WHERE f.urgency IN ('CRITICAL', 'HIGH', 'WATCH')
            ORDER BY
                CASE f.urgency
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'HIGH'     THEN 2
                    ELSE 3
                END,
                f.availableQty ASC
            LIMIT 15
        """).fetchall()
    except Exception:
        # Fallback: low stock from inventory
        rows = conn.execute("""
            SELECT
                b.medicineName,
                SUM(b.availableQty) AS availableQty,
                CASE
                    WHEN SUM(b.availableQty) < 20 THEN 'CRITICAL'
                    WHEN SUM(b.availableQty) < 50 THEN 'HIGH'
                    ELSE 'WATCH'
                END AS urgency
            FROM PharmacyInventoryBatch b
            WHERE b.status = 'ACTIVE'
            GROUP BY b.medicineId, b.medicineName
            HAVING SUM(b.availableQty) < 100
            ORDER BY SUM(b.availableQty) ASC
            LIMIT 20
        """).fetchall()

    return {"rows": [dict(r) for r in rows], "meta": {}}


def _return_summary(conn, params):
    rows = conn.execute("""
        SELECT
            returnNumber,
            returnType,
            status,
            COALESCE(patientName, supplierName, 'N/A') AS party,
            ROUND(totalAmount, 2) AS amount,
            DATE(createdAt)       AS created_date
        FROM PharmacyReturn
        ORDER BY createdAt DESC
        LIMIT 15
    """).fetchall()

    return {"rows": [dict(r) for r in rows], "meta": {}}


def _supplier_performance(conn, params):
    rows = conn.execute("""
        SELECT
            s.supplierName,
            COUNT(g.id)                        AS grn_count,
            ROUND(AVG(
                julianday(g.receivedDate) - julianday(po.createdAt)
            ), 1)                              AS avg_lead_days,
            ROUND(SUM(g.grandTotal), 2)        AS total_purchased,
            s.status
        FROM PharmacySupplier s
        LEFT JOIN PharmacyGrn g  ON g.supplierId = s.id
        LEFT JOIN PharmacyPurchaseOrder po ON po.id = g.purchaseOrderId
        GROUP BY s.id, s.supplierName, s.status
        ORDER BY total_purchased DESC
    """).fetchall()

    return {"rows": [dict(r) for r in rows], "meta": {}}


def _category_breakdown(conn, params):
    start, end = params.get("start_date"), params.get("end_date")
    if not start:
        start, end = _month_range()

    rows = conn.execute("""
        SELECT
            m.category,
            SUM(bi.quantity)         AS total_qty,
            ROUND(SUM(bi.amount), 2) AS total_revenue
        FROM PharmacyBillItem bi
        JOIN PharmacyMedicine m ON m.id = bi.medicineId
        JOIN PharmacyBill b     ON b.id = bi.billId
        WHERE DATE(b.createdAt) BETWEEN ? AND ?
          AND b.status = 'PAID'
        GROUP BY m.category
        ORDER BY total_revenue DESC
    """, (start, end)).fetchall()

    return {"rows": [dict(r) for r in rows], "meta": {"start": start, "end": end}}


def _walk_in_vs_patient(conn, params):
    start, end = params.get("start_date"), params.get("end_date")
    if not start:
        start, end = _month_range()

    rows = conn.execute("""
        SELECT
            billingType,
            COUNT(*)                     AS bill_count,
            ROUND(SUM(grandTotal), 2)    AS total_revenue,
            ROUND(SUM(paidAmount), 2)    AS collected
        FROM PharmacyBill
        WHERE DATE(createdAt) BETWEEN ? AND ?
          AND status = 'PAID'
        GROUP BY billingType
    """, (start, end)).fetchall()

    return {"rows": [dict(r) for r in rows], "meta": {"start": start, "end": end}}


def _grn_summary(conn, params):
    supplier = params.get("supplier_name")
    rows = conn.execute("""
        SELECT
            g.grnNumber,
            g.supplierName,
            DATE(g.receivedDate) AS received_date,
            g.receiptStatus,
            ROUND(g.grandTotal, 2) AS total_value,
            g.status
        FROM PharmacyGrn g
        WHERE (? IS NULL OR LOWER(g.supplierName) LIKE '%' || LOWER(?) || '%')
        ORDER BY g.receivedDate DESC
        LIMIT 10
    """, (supplier, supplier)).fetchall()

    return {"rows": [dict(r) for r in rows], "meta": {}}


def _purchase_order_status(conn, params):
    rows = conn.execute("""
        SELECT
            poNumber,
            supplierName,
            status,
            ROUND(grandTotal, 2) AS total_value,
            DATE(createdAt)      AS created_date
        FROM PharmacyPurchaseOrder
        ORDER BY createdAt DESC
        LIMIT 10
    """).fetchall()

    return {"rows": [dict(r) for r in rows], "meta": {}}


def _patient_purchase_history(conn, params):
    patient = params.get("patientIdentifier", "").strip()

    if patient:
        rows = conn.execute("""
            SELECT
                b.billNumber,
                b.patientName,
                b.billingType,
                b.grandTotal,
                b.paidAmount,
                b.pendingAmount,
                b.paymentMode,
                b.dispenseStatus,
                b.createdAt,
                COUNT(bi.id) AS item_count
            FROM PharmacyBill b
            LEFT JOIN PharmacyBillItem bi ON bi.billId = b.id
            WHERE (
                b.patientName ILIKE ?
                OR b.customerName ILIKE ?
                OR b.patientUhid ILIKE ?
                OR b.billNumber ILIKE ?
            )
            AND b.status = 'PAID'
            GROUP BY b.id, b.billNumber, b.patientName, b.billingType,
                     b.grandTotal, b.paidAmount, b.pendingAmount,
                     b.paymentMode, b.dispenseStatus, b.createdAt
            ORDER BY b.createdAt DESC
            LIMIT 20
        """, (f"%{patient}%", f"%{patient}%", f"%{patient}%", f"%{patient}%")).fetchall()
    else:
        rows = conn.execute("""
            SELECT
                b.billNumber,
                b.patientName,
                b.billingType,
                b.grandTotal,
                b.paidAmount,
                b.pendingAmount,
                b.paymentMode,
                b.dispenseStatus,
                b.createdAt,
                COUNT(bi.id) AS item_count
            FROM PharmacyBill b
            LEFT JOIN PharmacyBillItem bi ON bi.billId = b.id
            WHERE b.status = 'PAID'
            GROUP BY b.id, b.billNumber, b.patientName, b.billingType,
                     b.grandTotal, b.paidAmount, b.pendingAmount,
                     b.paymentMode, b.dispenseStatus, b.createdAt
            ORDER BY b.createdAt DESC
            LIMIT 20
        """).fetchall()

    return {"rows": [dict(r) for r in rows], "meta": {"patient": patient or "All patients"}}
