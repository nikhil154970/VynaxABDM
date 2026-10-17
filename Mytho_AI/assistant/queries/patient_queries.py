"""
patient_queries.py
------------------
Patient-specific query handlers.
These queries are filtered by patient UHID to ensure patients only see their own data.
All tables use patientId (UUID) as FK, so we first look up Patient by UHID.
NOTE: Table names are PascalCase in PostgreSQL and MUST be quoted.
"""

import json
import logging
from datetime import datetime, timedelta
from .base_queries import get_conn, _today_range, _month_range, _to_number

logger = logging.getLogger("mqe.patient_queries")


def run_patient_query(intent: str, params: dict) -> dict:
    """Run patient-specific queries with UHID-based filtering."""
    uhid = params.get("uhid")
    user_id = params.get("userId")

    if not uhid and not user_id:
        return {"rows": [], "meta": {"error": "uhid or userId is required for patient queries"}}

    try:
        conn = get_conn()
    except Exception as conn_err:
        return {"rows": [], "meta": {"error": f"Database connection failed: {str(conn_err)}"}}

    try:
        patient_uuid = None
        if uhid:
            row = conn.execute('SELECT id FROM "Patient" WHERE uhid = ?', (uhid,)).fetchone()
            if row:
                patient_uuid = dict(row)["id"]
            else:
                return {"rows": [], "meta": {"error": f"No patient found with UHID: {uhid}"}}
        elif user_id:
            patient_uuid = user_id

        if not patient_uuid:
            return {"rows": [], "meta": {"error": "Could not resolve patient identity"}}

        if intent == "MY_PRESCRIPTIONS":
            result = _my_prescriptions(conn, params, patient_uuid)
        elif intent == "MY_BILLS":
            result = _my_bills(conn, params, patient_uuid)
        elif intent == "MY_APPOINTMENTS":
            result = _my_appointments(conn, params, patient_uuid)
        elif intent == "MY_MEDICINE_HISTORY":
            result = _my_medicine_history(conn, params, patient_uuid)
        elif intent == "MY_LAB_REPORTS":
            result = _my_lab_reports(conn, params, patient_uuid)
        elif intent == "MY_PAYMENT_HISTORY":
            result = _my_payment_history(conn, params, patient_uuid)
        elif intent == "BOOK_APPOINTMENT":
            result = _book_appointment(conn, params, patient_uuid)
        elif intent == "CONTACT_DOCTOR":
            result = _contact_doctor(conn, params, patient_uuid)
        else:
            result = {"rows": [], "meta": {"intent": intent}}

        meta = result.setdefault("meta", {})
        meta.setdefault("source", getattr(conn, "kind", "unknown"))
        return result
    except Exception as e:
        logger.error("Patient query failed: %s", e, exc_info=True)
        return {"rows": [], "meta": {"intent": intent, "error": str(e)}}
    finally:
        if conn:
            conn.close()


def _my_prescriptions(conn, params, patient_uuid):
    """Get prescriptions for the logged-in patient.
    Prescriptions are stored as JSON in Consultation.prescription.
    Doctor name is in User.name via Doctor.userId."""
    try:
        rows = conn.execute("""
            SELECT
                c.id,
                c."createdAt" AS "prescribedDate",
                c.diagnosis,
                c.prescription,
                c."doctorId"
            FROM "Consultation" c
            WHERE c."patientId" = ?
            ORDER BY c."createdAt" DESC
            LIMIT 10
        """, (patient_uuid,)).fetchall()

        logger.info("Prescriptions query found %d rows for patient_uuid=%s", len(rows), patient_uuid)

        results = []
        for r in rows:
            rd = dict(r)
            prescription = rd.get("prescription")
            if isinstance(prescription, str):
                try:
                    prescription = json.loads(prescription)
                except Exception:
                    pass

            medicines = ""
            if isinstance(prescription, list):
                medicines = ", ".join(
                    f"{m.get('medicine', m.get('name', m.get('medicineName', '')))} {m.get('dosage', m.get('quantity', ''))}".strip()
                    for m in prescription if isinstance(m, dict)
                )
            elif isinstance(prescription, dict):
                meds = prescription.get("medicines", [])
                if isinstance(meds, list):
                    medicines = ", ".join(
                        f"{m.get('medicine', m.get('name', m.get('medicineName', '')))} {m.get('dosage', m.get('quantity', ''))}".strip()
                        for m in meds if isinstance(m, dict)
                    )

            # Get doctor name via User table
            doctor_name = "Doctor"
            try:
                doc_row = conn.execute("""
                    SELECT u.name FROM "User" u
                    INNER JOIN "Doctor" doc ON doc."userId" = u.id
                    WHERE doc.id = ?
                """, (str(rd.get("doctorId", "")),)).fetchone()
                if doc_row:
                    doctor_name = dict(doc_row).get("name", "Doctor")
            except Exception as e:
                logger.warning("Failed to get doctor name: %s", e)

            results.append({
                "prescriptionNumber": f"RX-{str(rd['id'])[:8]}",
                "doctorName": doctor_name,
                "diagnosis": rd.get("diagnosis", "N/A"),
                "prescribedDate": rd.get("prescribedDate"),
                "medicines": medicines,
            })
        return {"rows": results, "meta": {"userId": patient_uuid}}
    except Exception as e:
        logger.error("MY_PRESCRIPTIONS query failed: %s", e, exc_info=True)
        return {"rows": [], "meta": {"userId": patient_uuid, "error": str(e)}}


def _my_bills(conn, params, patient_uuid):
    """Get pharmacy bills for the logged-in patient."""
    try:
        rows = conn.execute("""
            SELECT
                b."billNumber",
                b."patientName",
                b."billingType",
                b."grandTotal",
                b."paidAmount",
                b."pendingAmount",
                b."paymentMode",
                b."dispenseStatus",
                b."createdAt",
                COUNT(bi.id) AS item_count
            FROM "PharmacyBill" b
            LEFT JOIN "PharmacyBillItem" bi ON bi."billId" = b.id
            WHERE b."patientId" = ?
              AND b.status != 'CANCELLED'
            GROUP BY b.id, b."billNumber", b."patientName", b."billingType",
                     b."grandTotal", b."paidAmount", b."pendingAmount",
                     b."paymentMode", b."dispenseStatus", b."createdAt"
            ORDER BY b."createdAt" DESC
            LIMIT 20
        """, (patient_uuid,)).fetchall()
    except Exception as e:
        logger.error("MY_BILLS query failed: %s", e, exc_info=True)
        rows = []

    return {"rows": [dict(r) for r in rows], "meta": {"userId": patient_uuid}}


def _my_appointments(conn, params, patient_uuid):
    """Get appointments for the logged-in patient."""
    try:
        rows = conn.execute("""
            SELECT
                a.id,
                a."opdNumber",
                a.date,
                a.time,
                a.token,
                a.department,
                a.status,
                a.fee,
                a."createdAt",
                u.name AS "doctorName"
            FROM "Appointment" a
            LEFT JOIN "Doctor" doc ON doc.id = a."doctorId"
            LEFT JOIN "User" u ON u.id = doc."userId"
            WHERE a."patientId" = ?
            ORDER BY a.date DESC, a.time DESC
            LIMIT 10
        """, (patient_uuid,)).fetchall()
        logger.info("Appointments query found %d rows", len(rows))
    except Exception as e:
        logger.error("MY_APPOINTMENTS query failed: %s", e, exc_info=True)
        rows = []

    return {"rows": [dict(r) for r in rows], "meta": {"userId": patient_uuid}}


def _my_medicine_history(conn, params, patient_uuid):
    """Get medicine purchase history for the logged-in patient."""
    try:
        rows = conn.execute("""
            SELECT
                b."billNumber",
                bi."medicineName",
                bi.quantity,
                bi.amount,
                b."createdAt" AS "purchaseDate"
            FROM "PharmacyBill" b
            JOIN "PharmacyBillItem" bi ON bi."billId" = b.id
            WHERE b."patientId" = ?
              AND b.status != 'CANCELLED'
            ORDER BY b."createdAt" DESC
            LIMIT 30
        """, (patient_uuid,)).fetchall()
    except Exception as e:
        logger.error("MY_MEDICINE_HISTORY query failed: %s", e, exc_info=True)
        rows = []

    return {"rows": [dict(r) for r in rows], "meta": {"userId": patient_uuid}}


def _my_lab_reports(conn, params, patient_uuid):
    """Get lab reports (LabOrder + LabOrderItem + LabResult) for the logged-in patient."""
    try:
        rows = conn.execute("""
            SELECT
                lo.id,
                lo."orderNumber",
                lo.status,
                lo."reportStatus",
                lo.notes,
                lo."createdAt" AS "testDate",
                lo."doctorId",
                STRING_AGG(loi."testName", ', ') AS "testNames"
            FROM "LabOrder" lo
            LEFT JOIN "LabOrderItem" loi ON loi."labOrderId" = lo.id
            WHERE lo."patientId" = ?
            GROUP BY lo.id, lo."orderNumber", lo.status, lo."reportStatus", lo.notes, lo."createdAt", lo."doctorId"
            ORDER BY lo."createdAt" DESC
            LIMIT 10
        """, (patient_uuid,)).fetchall()

        # Fetch LabResult details for each order
        result_rows = []
        for r in rows:
            rd = dict(r)
            order_id = rd["id"]
            results = conn.execute("""
                SELECT lr."testName", lr."value", lr."unit", lr."referenceRange", lr."remarks"
                FROM "LabResult" lr
                WHERE lr."labOrderId" = ?
                ORDER BY lr."createdAt" ASC
            """, (order_id,)).fetchall()
            rd["results"] = [dict(res) for res in results]

            # Get doctor name
            doctor_name = "Doctor"
            try:
                doc_row = conn.execute("""
                    SELECT u.name FROM "User" u
                    INNER JOIN "Doctor" doc ON doc."userId" = u.id
                    WHERE doc.id = ?
                """, (str(rd.get("doctorId", "")),)).fetchone()
                if doc_row:
                    doctor_name = dict(doc_row).get("name", "Doctor")
            except Exception:
                pass
            rd["doctorName"] = doctor_name

            # Get patient name
            patient_row = conn.execute('SELECT name FROM "Patient" WHERE id = ?', (patient_uuid,)).fetchone()
            rd["patientName"] = dict(patient_row)["name"] if patient_row else "Patient"

            result_rows.append(rd)
    except Exception as e:
        logger.error("MY_LAB_REPORTS query failed: %s", e, exc_info=True)
        result_rows = []

    return {"rows": result_rows, "meta": {"userId": patient_uuid}}


def _my_payment_history(conn, params, patient_uuid):
    """Get payment history for the logged-in patient."""
    try:
        rows = conn.execute("""
            SELECT
                pp.id,
                b."billNumber",
                pp.amount,
                pp."paymentMode",
                pp."createdAt" AS "paymentDate"
            FROM "PharmacyPayment" pp
            JOIN "PharmacyBill" b ON b.id = pp."billId"
            WHERE pp."patientId" = ?
            ORDER BY pp."createdAt" DESC
            LIMIT 20
        """, (patient_uuid,)).fetchall()
    except Exception as e:
        logger.error("MY_PAYMENT_HISTORY query failed: %s", e, exc_info=True)
        rows = []

    return {"rows": [dict(r) for r in rows], "meta": {"userId": patient_uuid}}


def _book_appointment(conn, params, patient_uuid):
    """Book an appointment for the logged-in patient."""
    return {
        "rows": [],
        "meta": {
            "userId": patient_uuid,
            "message": "To book an appointment, please contact the hospital reception or use the patient portal.",
            "action": "BOOK_APPOINTMENT"
        }
    }


def _contact_doctor(conn, params, patient_uuid):
    """Get contact information for the logged-in patient's doctor."""
    return {
        "rows": [],
        "meta": {
            "userId": patient_uuid,
            "message": "Please contact your doctor through the hospital reception or patient portal.",
            "action": "CONTACT_DOCTOR"
        }
    }
