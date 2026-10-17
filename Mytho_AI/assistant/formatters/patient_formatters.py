"""
patient_formatters.py
--------------------
Patient-specific response formatters.
Converts raw database rows into formatted English text responses for patient queries.
"""

import logging
from datetime import datetime

logger = logging.getLogger("mqe.patient_formatters")


def _fmt_my_prescriptions(data, params, lang):
    """Format patient's prescriptions."""
    if not data:
        return "**My Prescriptions**\n\nNo prescriptions found. Please consult a doctor to get prescriptions."

    items = data[:10] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0

    lines = []
    lines.append(f"**My Prescriptions** ({total} prescriptions found)\n")

    for i, item in enumerate(items, 1):
        prescription = item.get("prescriptionNumber", "?")
        doctor = item.get("doctorName", "Unknown")
        diagnosis = item.get("diagnosis", "N/A")
        date = item.get("prescribedDate", "")
        medicines = item.get("medicines", "")
        
        if hasattr(date, 'strftime'):
            date = date.strftime("%d %b %Y")
        else:
            date = str(date)[:10] if date else "N/A"
        
        lines.append(f"  {i}. **{prescription}** — Dr. {doctor}")
        lines.append(f"     Diagnosis: {diagnosis}")
        if medicines:
            lines.append(f"     Medicines: {medicines}")
        lines.append(f"     Date: {date}\n")

    if total > 10:
        lines.append(f"... and {total - 10} more prescriptions.")

    lines.append("**Tip:** Contact your doctor for new prescriptions or refills.")
    return "\n".join(lines)


def _fmt_my_bills(data, params, lang):
    """Format patient's pharmacy bills."""
    if not data:
        return "**My Bills**\n\nNo pharmacy bills found."

    items = data[:20] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0
    total_amount = sum(i.get("grandTotal", 0) or 0 for i in items)
    total_paid = sum(i.get("paidAmount", 0) or 0 for i in items)
    total_pending = sum(i.get("pendingAmount", 0) or 0 for i in items)

    lines = []
    lines.append(f"**My Bills** ({total} bills found)\n")
    lines.append(f"**Total Amount:** ₹{total_amount:,.2f}")
    lines.append(f"**Paid:** ₹{total_paid:,.2f}")
    lines.append(f"**Pending:** ₹{total_pending:,.2f}\n")

    for i, item in enumerate(items, 1):
        bill = item.get("billNumber", "?")
        total_amt = item.get("grandTotal", 0) or 0
        paid = item.get("paidAmount", 0) or 0
        pending = item.get("pendingAmount", 0) or 0
        status = item.get("dispenseStatus", "")
        date = item.get("createdAt", "")
        
        if hasattr(date, 'strftime'):
            date = date.strftime("%d %b %Y, %I:%M %p")
        else:
            date = str(date)[:16] if date else "N/A"
        
        payment_status = "Paid" if pending == 0 else f"Pending: ₹{pending:,.0f}"
        lines.append(f"  {i}. **{bill}** — ₹{total_amt:,.2f} — {payment_status} — {status} — {date}")

    if total > 20:
        lines.append(f"\n... and {total - 20} more bills.")

    lines.append("\n**Tip:** Pay pending bills to avoid delays in future purchases.")
    return "\n".join(lines)


def _fmt_my_appointments(data, params, lang):
    """Format patient's appointments."""
    if not data:
        return "**My Appointments**\n\nNo appointments found. Book an appointment to consult a doctor."

    items = data[:10] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0

    lines = []
    lines.append(f"**My Appointments** ({total} appointments found)\n")

    for i, item in enumerate(items, 1):
        opd = item.get("opdNumber") or item.get("appointmentNumber") or "?"
        doctor = item.get("doctorName", "Unknown")
        department = item.get("department", "N/A")
        date = item.get("date") or item.get("appointmentDate", "")
        time = item.get("time") or item.get("appointmentTime", "")
        status = item.get("status", "Scheduled")
        
        if hasattr(date, 'strftime'):
            date = date.strftime("%d %b %Y")
        else:
            date = str(date)[:10] if date else "N/A"
        
        if time:
            if hasattr(time, 'strftime'):
                time = time.strftime("%I:%M %p")
            else:
                time = str(time)[:5] if time else ""
        
        lines.append(f"  {i}. **{opd}** — Dr. {doctor}")
        lines.append(f"     Department: {department}")
        lines.append(f"     Date: {date} at {time}")
        lines.append(f"     Status: {status}\n")

    if total > 10:
        lines.append(f"... and {total - 10} more appointments.")

    lines.append("**Tip:** Arrive 15 minutes before your appointment time.")
    return "\n".join(lines)


def _fmt_my_medicine_history(data, params, lang):
    """Format patient's medicine purchase history."""
    if not data:
        return "**My Medicine History**\n\nNo medicine purchase history found."

    items = data[:30] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0
    total_amount = sum(i.get("amount", 0) or 0 for i in items)

    lines = []
    lines.append(f"**My Medicine History** ({total} items found)\n")
    lines.append(f"**Total Spent:** ₹{total_amount:,.2f}\n")

    for i, item in enumerate(items, 1):
        medicine = item.get("medicineName", "Unknown")
        quantity = item.get("quantity", 0)
        amount = item.get("amount", 0) or 0
        date = item.get("purchaseDate", "")
        bill = item.get("billNumber", "?")
        
        if hasattr(date, 'strftime'):
            date = date.strftime("%d %b %Y")
        else:
            date = str(date)[:10] if date else "N/A"
        
        lines.append(f"  {i}. **{medicine}** — {quantity} units — ₹{amount:,.2f} — {bill} — {date}")

    if total > 30:
        lines.append(f"\n... and {total - 30} more items.")

    lines.append("\n**Tip:** Keep track of your medicine purchases for tax and insurance purposes.")
    return "\n".join(lines)


def _fmt_my_lab_reports(data, params, lang):
    """Format patient's lab reports."""
    if not data:
        return "**My Lab Reports**\n\nNo lab reports found. Consult a doctor to get lab tests prescribed."

    items = data[:10] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0

    lines = []
    lines.append(f"**My Lab Reports** ({total} reports found)\n")

    for i, item in enumerate(items, 1):
        report = item.get("orderNumber") or item.get("reportNumber") or "?"
        test_names = item.get("testNames") or item.get("testName", "Unknown")
        date = item.get("testDate") or item.get("createdAt", "")
        status = item.get("reportStatus") or item.get("status", "Pending")
        
        if hasattr(date, 'strftime'):
            date = date.strftime("%d %b %Y")
        else:
            date = str(date)[:10] if date else "N/A"
        
        lines.append(f"  {i}. **{report}** — {test_names}")
        lines.append(f"     Date: {date}")
        lines.append(f"     Status: {status}\n")

    if total > 10:
        lines.append(f"... and {total - 10} more reports.")

    lines.append("\n**Tip:** Download your lab reports from the patient portal for your records.")
    return "\n".join(lines)


def _fmt_my_payment_history(data, params, lang):
    """Format patient's payment history."""
    if not data:
        return "**My Payment History**\n\nNo payment history found."

    items = data[:20] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0
    total_amount = sum(i.get("amount", 0) or 0 for i in items)

    lines = []
    lines.append(f"**My Payment History** ({total} payments found)\n")
    lines.append(f"**Total Paid:** ₹{total_amount:,.2f}\n")

    for i, item in enumerate(items, 1):
        bill = item.get("billNumber", "?")
        amount = item.get("amount", 0) or 0
        mode = item.get("paymentMode", "N/A")
        date = item.get("paymentDate", "")
        
        if hasattr(date, 'strftime'):
            date = date.strftime("%d %b %Y, %I:%M %p")
        else:
            date = str(date)[:16] if date else "N/A"
        
        lines.append(f"  {i}. **{bill}** — ₹{amount:,.2f} — {mode} — {date}")

    if total > 20:
        lines.append(f"\n... and {total - 20} more payments.")

    lines.append("\n**Tip:** Download payment receipts from the patient portal.")
    return "\n".join(lines)


def _fmt_book_appointment(data, params, lang):
    """Format appointment booking response."""
    message = data.get("message", "To book an appointment, please contact the hospital reception or use the patient portal.")
    return f"**Book Appointment**\n\n{message}"


def _fmt_contact_doctor(data, params, lang):
    """Format doctor contact response."""
    message = data.get("message", "Please contact your doctor through the hospital reception or patient portal.")
    return f"**Contact Doctor**\n\n{message}"


def _fmt_greeting(data, params, lang):
    """Format greeting response for patients."""
    return (
        "Hello! I'm your health assistant. I can help you with:\n\n"
        "• **My Prescriptions** — View your prescriptions\n"
        "• **My Bills** — Check your pharmacy bills\n"
        "• **My Appointments** — See upcoming appointments\n"
        "• **My Lab Reports** — View your test results\n"
        "• **My Payment History** — Payment records\n"
        "• **Book Appointment** — Schedule a doctor visit\n\n"
        "Just ask me anything about your health records!"
    )


def _fmt_unknown_patient(data, params, lang):
    """Format unknown patient intent response."""
    return (
        "I didn't understand that. Try asking:\n"
        "• 'Show my prescriptions'\n"
        "• 'Show my bills'\n"
        "• 'Show my appointments'\n"
        "• 'Show my lab reports'\n"
        "• 'Show my payment history'"
    )


# Template registry for patient intents
PATIENT_TEMPLATES = {
    "GREETING":             _fmt_greeting,
    "MY_PRESCRIPTIONS":     _fmt_my_prescriptions,
    "MY_BILLS":             _fmt_my_bills,
    "MY_APPOINTMENTS":      _fmt_my_appointments,
    "MY_MEDICINE_HISTORY":  _fmt_my_medicine_history,
    "MY_LAB_REPORTS":       _fmt_my_lab_reports,
    "MY_PAYMENT_HISTORY":   _fmt_my_payment_history,
    "BOOK_APPOINTMENT":     _fmt_book_appointment,
    "CONTACT_DOCTOR":       _fmt_contact_doctor,
    "UNKNOWN":              _fmt_unknown_patient,
}


def format_patient_response(intent: str, data, params: dict, lang: str = "english") -> str:
    """Format patient response using the appropriate template."""
    fn = PATIENT_TEMPLATES.get(intent, PATIENT_TEMPLATES["UNKNOWN"])
    try:
        return fn(data, params, lang)
    except Exception as e:
        logger.error("format_patient_response failed for intent=%s: %s", intent, e)
        return "Data was retrieved but there was an issue creating the response. Please try again."
