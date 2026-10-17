"""
lab_report_pdf.py
-----------------
Generates professional lab report PDF using fpdf2.
Matches the S.D. Pathology style from the patient portal.
"""

import base64
import logging
from datetime import datetime

logger = logging.getLogger("mqe.lab_report_pdf")


def generate_lab_report_pdf(lab_reports: list, patient_name: str = "Patient") -> str | None:
    """
    Generate a professional lab report PDF.
    Each report dict should contain: orderNumber, results (list of test dicts),
    doctorName, patientName, testDate, notes.
    Returns base64-encoded PDF string, or None on failure.
    """
    try:
        from fpdf import FPDF
    except ImportError:
        logger.error("fpdf2 not installed")
        return None

    if not lab_reports:
        return None

    try:
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=20)

        for idx, report in enumerate(lab_reports):
            if idx > 0:
                pdf.add_page()

            pdf.add_page()
            pdf.set_margins(15, 15, 15)

            # ── Header: Hospital Name ──
            pdf.set_fill_color(0, 51, 102)  # Dark blue
            pdf.rect(0, 0, 210, 28, "F")
            pdf.set_font("Helvetica", "B", 22)
            pdf.set_text_color(255, 255, 255)
            pdf.set_xy(15, 6)
            pdf.cell(0, 10, "VyanX", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 9)
            pdf.set_xy(15, 16)
            pdf.cell(0, 5, "Healthcare & Diagnostics", new_x="LMARGIN", new_y="NEXT")

            # ── Report Title ──
            pdf.set_y(32)
            pdf.set_text_color(0, 0, 0)
            pdf.set_font("Helvetica", "B", 14)
            pdf.cell(0, 10, "LABORATORY REPORT", new_x="LMARGIN", new_y="NEXT", align="C")
            pdf.ln(2)

            # ── Patient Info Table ──
            order_number = report.get("orderNumber", "N/A")
            date = report.get("testDate", "")
            if hasattr(date, "strftime"):
                date_str = date.strftime("%d %b %Y")
            else:
                date_str = str(date)[:10] if date else "N/A"

            doctor_name = report.get("doctorName", "Doctor")
            notes = report.get("notes", "")
            status = report.get("reportStatus", report.get("status", "Pending"))

            patient_name = report.get("patientName", patient_name)

            pdf.set_font("Helvetica", "B", 10)
            pdf.set_fill_color(230, 240, 250)
            col_w = 45
            val_w = 50

            # Row 1
            pdf.cell(col_w, 7, "  Patient Name", border=1, fill=True)
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(val_w, 7, f"  {patient_name}", border=1)
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(col_w, 7, "  Report Date", border=1, fill=True)
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(val_w, 7, f"  {date_str}", border=1, new_x="LMARGIN", new_y="NEXT")

            # Row 2
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(col_w, 7, "  Ref. Doctor", border=1, fill=True)
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(val_w, 7, f"  {doctor_name}", border=1)
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(col_w, 7, "  Report No.", border=1, fill=True)
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(val_w, 7, f"  {order_number}", border=1, new_x="LMARGIN", new_y="NEXT")

            # Row 3
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(col_w, 7, "  Status", border=1, fill=True)
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(0, 7, f"  {status}", border=1, new_x="LMARGIN", new_y="NEXT")

            if notes:
                pdf.set_font("Helvetica", "B", 10)
                pdf.cell(col_w, 7, "  Notes", border=1, fill=True)
                pdf.set_font("Helvetica", "", 10)
                pdf.cell(0, 7, f"  {notes}", border=1, new_x="LMARGIN", new_y="NEXT")

            pdf.ln(6)

            # ── Results Table ──
            results = report.get("results", [])
            if results:
                pdf.set_font("Helvetica", "B", 11)
                pdf.set_fill_color(0, 51, 102)
                pdf.set_text_color(255, 255, 255)
                pdf.cell(0, 8, "  TEST RESULTS", new_x="LMARGIN", new_y="NEXT", fill=True)
                pdf.set_text_color(0, 0, 0)

                # Table header
                pdf.set_font("Helvetica", "B", 9)
                pdf.set_fill_color(200, 220, 240)
                pdf.cell(60, 7, "  INVESTIGATION", border=1, fill=True)
                pdf.cell(30, 7, "  RESULT", border=1, fill=True)
                pdf.cell(30, 7, "  UNIT", border=1, fill=True)
                pdf.cell(0, 7, "  REF. RANGE", border=1, fill=True, new_x="LMARGIN", new_y="NEXT")

                # Table rows
                pdf.set_font("Helvetica", "", 9)
                for ri, res in enumerate(results):
                    fill = ri % 2 == 0
                    if fill:
                        pdf.set_fill_color(245, 248, 252)

                    test_name = res.get("testName", "N/A")
                    value = res.get("value", "N/A")
                    unit = res.get("unit", "")
                    ref_range = res.get("referenceRange", "")
                    remarks = res.get("remarks", "")

                    pdf.cell(60, 6, f"  {test_name}", border=1, fill=fill)
                    pdf.cell(30, 6, f"  {value}", border=1, fill=fill)
                    pdf.cell(30, 6, f"  {unit or ''}", border=1, fill=fill)
                    pdf.cell(0, 6, f"  {ref_range or ''}", border=1, fill=fill, new_x="LMARGIN", new_y="NEXT")

                    # Show remarks if present
                    if remarks:
                        pdf.set_font("Helvetica", "I", 8)
                        pdf.set_text_color(180, 0, 0)
                        pdf.cell(60, 5, f"    Note: {remarks}", new_x="LMARGIN", new_y="NEXT")
                        pdf.set_text_color(0, 0, 0)
                        pdf.set_font("Helvetica", "", 9)
            else:
                pdf.set_font("Helvetica", "I", 10)
                pdf.set_text_color(128, 128, 128)
                pdf.cell(0, 10, "No test results available for this report.", new_x="LMARGIN", new_y="NEXT", align="C")
                pdf.set_text_color(0, 0, 0)

            # ── Footer ──
            pdf.ln(15)
            pdf.set_draw_color(0, 51, 102)
            pdf.set_line_width(0.3)
            pdf.line(15, pdf.get_y(), 195, pdf.get_y())
            pdf.ln(5)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(100, 100, 100)
            pdf.cell(0, 5, f"Generated on {datetime.now().strftime('%d %b %Y, %I:%M %p')} | VyanX Lab Information System", new_x="LMARGIN", new_y="NEXT", align="C")

        # Output to bytes
        pdf_output = pdf.output()
        if isinstance(pdf_output, (bytes, bytearray)):
            pdf_bytes = bytes(pdf_output)
        else:
            pdf_bytes = pdf_output.encode("latin-1")
        return base64.b64encode(pdf_bytes).decode("utf-8")

    except Exception as e:
        logger.error("Failed to generate lab report PDF: %s", e, exc_info=True)
        return None
