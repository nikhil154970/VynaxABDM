"""
pharmacy_formatters.py
---------------------
Pharmacy-specific response formatters.
Converts raw database rows into formatted English text responses.
"""

import logging
import re

logger = logging.getLogger("mqe.pharmacy_formatters")


def _fmt_daily_revenue(data, params, lang):
    total = float(data.get("total", 0)) if data.get("total") else 0
    count = int(data.get("count", 0)) if data.get("count") else 0
    paid = float(data.get("paid", 0)) if data.get("paid") else 0
    pending = float(data.get("pending", 0)) if data.get("pending") else 0

    raw_date = params.get("date", "today")
    if raw_date == "yesterday":
        dl = "Yesterday"
    elif raw_date == "today":
        dl = "Today"
    elif re.match(r'\d{4}-\d{2}-\d{2}', raw_date):
        from datetime import datetime
        try:
            dt = datetime.strptime(raw_date, "%Y-%m-%d")
            day = dt.day
            month = dt.strftime("%B")
            year = dt.year
            dl = f"{day} {month} {year}"
        except ValueError:
            dl = raw_date
    else:
        dl = raw_date

    lines = []
    lines.append(f"**Daily Revenue Report — {dl}**\n")

    if count == 0:
        lines.append(f"**Total Revenue:** ₹{total:,.0f}")
        lines.append(f"**Bills Generated:** 0")
        lines.append(f"\nNo bills generated yet.")
    else:
        lines.append(f"**Total Revenue:** ₹{total:,.0f}")
        lines.append(f"**Bills Generated:** {count}")
        lines.append(f"**Collected:** ₹{paid:,.0f}")
        lines.append(f"**Pending:** ₹{pending:,.0f}")

        # Collection rate
        if total > 0:
            rate = (paid / total) * 100
            lines.append(f"**Collection Rate:** {rate:.0f}%")

    return "\n".join(lines)


def _fmt_monthly_revenue(data, params, lang):
    total = float(data.get("total", 0)) if data.get("total") else 0
    count = int(data.get("count", 0)) if data.get("count") else 0
    paid = float(data.get("paid", 0)) if data.get("paid") else 0
    pending = float(data.get("pending", 0)) if data.get("pending") else 0
    period = params.get("period", "this_month")

    start = data.get("start", "") or params.get("start", "")
    end = data.get("end", "") or params.get("end", "")
    if start and end:
        from datetime import datetime
        try:
            s = datetime.strptime(start, "%Y-%m-%d")
            e = datetime.strptime(end, "%Y-%m-%d")
            if period in ("this_week", "last_week"):
                label = f"Week of {s.strftime('%d %b')} – {e.strftime('%d %b %Y')}"
            elif period == "last_month":
                label = s.strftime("%B %Y")
            else:
                label = f"{s.strftime('%B')} {s.year}"
        except ValueError:
            label = "This month"
    elif period == "last_week":
        label = "Last week"
    elif period == "this_week":
        label = "This week"
    elif period == "last_month":
        label = "Last month"
    else:
        label = "This month"

    lines = []
    lines.append(f"**Revenue Report — {label}**\n")

    if count == 0:
        lines.append(f"**Total Revenue:** ₹{total:,.0f}")
        lines.append(f"**Bills Generated:** 0")
        lines.append(f"\nNo bills generated for this period.")
    else:
        lines.append(f"**Total Revenue:** ₹{total:,.0f}")
        lines.append(f"**Total Bills:** {count}")
        if paid > 0:
            lines.append(f"**Collected:** ₹{paid:,.0f}")
        if pending > 0:
            lines.append(f"**Pending:** ₹{pending:,.0f}")

        # Average per bill
        if count > 0:
            avg = total / count
            lines.append(f"**Average Bill Value:** ₹{avg:,.0f}")

    return "\n".join(lines)


def _fmt_out_of_stock(data, params, lang):
    if not data:
        return "All medicines are in stock. No out-of-stock items found."

    items = data[:30] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0

    lines = []
    lines.append(f"**Out of Stock Alert** ({total} medicines completely out of stock)\n")

    # Group by category
    by_category = {}
    for item in items:
        cat = item.get("category", "General") or "General"
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(item)

    if by_category:
        for cat, cat_items in sorted(by_category.items()):
            lines.append(f"**{cat.upper()} ({len(cat_items)} items):**")
            for i, item in enumerate(cat_items, 1):
                name = item.get("medicineName") or item.get("name", "Unknown")
                strength = item.get("strength", "")
                form = item.get("dosageForm", "")
                batch_count = int(item.get("batch_count", 0) or 0)
                label = f"{name} {strength}".strip() if strength else name
                if form:
                    label += f" ({form})"
                reason = "Previously stocked — all batches depleted" if batch_count > 0 else "Never stocked — no batches created yet"
                lines.append(f"  {i}. **{label}** — {reason}")
            lines.append("")

    if total > 30:
        lines.append(f"... and {total - 30} more medicines out of stock.")

    lines.append("**Action Required:**")
    lines.append("- Immediately place purchase orders for these medicines")
    lines.append("- Check with suppliers for availability")
    lines.append("- Consider alternative medicines if available")

    return "\n".join(lines)


def _fmt_low_stock(data, params, lang):
    if not data:
        return "No medicines are critically low in stock right now. All good!"

    items = data[:20] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0
    
    lines = []
    lines.append(f"**Inventory Alert Report** ({total} items need attention)")
    lines.append(f"Low stock threshold: {params.get('threshold', 50)} units\n")
    
    # Separate out of stock and low stock
    out_of_stock = [item for item in items if item.get("qty", 0) == 0]
    low_stock = [item for item in items if item.get("qty", 0) > 0]
    
    if out_of_stock:
        lines.append(f"**OUT OF STOCK ({len(out_of_stock)} items):**")
        for i, item in enumerate(out_of_stock, 1):
            name = item.get("name", "Unknown")
            strength = item.get("strength", "")
            form = item.get("dosageForm", "")
            batch_count = int(item.get("batch_count", 0) or 0)
            label = f"{name} {strength}".strip() if strength else name
            if form:
                label += f" ({form})"
            reason = "All batches depleted" if batch_count > 0 else "No batches created yet"
            lines.append(f"  {i}. **{label}** — {reason}")
        lines.append("")
    
    if low_stock:
        lines.append(f"**LOW STOCK ({len(low_stock)} items):**")
        for i, item in enumerate(low_stock, 1):
            name = item.get("name", "Unknown")
            strength = item.get("strength", "")
            form = item.get("dosageForm", "")
            qty = item.get("qty", 0)
            label = f"{name} {strength}".strip() if strength else name
            if form:
                label += f" ({form})"
            lines.append(f"  {i}. **{label}** — {qty} units remaining")
        lines.append("")
    
    # Show remaining items if truncated
    if total > 20:
        lines.append(f"... and {total - 20} more items.")
    
    lines.append("**Recommended actions:**")
    if out_of_stock:
        names = [item.get("name", "Unknown") for item in out_of_stock[:3]]
        lines.append(f"- Immediately reorder: {', '.join(names)}")
    if low_stock:
        lines.append("- Place purchase orders for low stock items before they run out")
    
    return "\n".join(lines)


def _fmt_expiry(data, params, lang):
    days = params.get("withinDays", 30)

    if not data:
        return f"No medicines are expiring in the next {days} days. All good!"

    items = data[:30] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0

    lines = []
    lines.append(f"**Expiry Risk Report** ({total} batches expiring within {days} days)\n")

    # Categorize by urgency
    expired = [i for i in items if i.get("days_left", 999) <= 0]
    urgent = [i for i in items if 0 < i.get("days_left", 999) <= 7]
    warning = [i for i in items if 7 < i.get("days_left", 999) <= 30]
    caution = [i for i in items if i.get("days_left", 999) > 30]

    if expired:
        lines.append(f"**EXPIRED ({len(expired)} items):**")
        for i, item in enumerate(expired, 1):
            name = item.get("name", "Unknown")
            batch = item.get("batchNumber", "N/A")
            expiry = item.get("expiry", "")
            qty = item.get("qty", 0)
            value = item.get("stock_value", 0)
            lines.append(f"  {i}. **{name}** (Batch: {batch}) — Expired {expiry}, {qty} units, ₹{value:,.0f}")
        lines.append("")

    if urgent:
        lines.append(f"**EXPIRING IN 7 DAYS ({len(urgent)} items):**")
        for i, item in enumerate(urgent, 1):
            name = item.get("name", "Unknown")
            batch = item.get("batchNumber", "N/A")
            expiry = item.get("expiry", "")
            qty = item.get("qty", 0)
            value = item.get("stock_value", 0)
            days_left = item.get("days_left", 0)
            lines.append(f"  {i}. **{name}** (Batch: {batch}) — Expires {expiry}, {days_left}d left, {qty} units, ₹{value:,.0f}")
        lines.append("")

    if warning:
        lines.append(f"**EXPIRING IN 30 DAYS ({len(warning)} items):**")
        for i, item in enumerate(warning, 1):
            name = item.get("name", "Unknown")
            batch = item.get("batchNumber", "N/A")
            expiry = item.get("expiry", "")
            qty = item.get("qty", 0)
            value = item.get("stock_value", 0)
            days_left = item.get("days_left", 0)
            lines.append(f"  {i}. **{name}** (Batch: {batch}) — Expires {expiry}, {days_left}d left, {qty} units, ₹{value:,.0f}")
        lines.append("")

    if caution:
        lines.append(f"**EXPIRING IN {days} DAYS ({len(caution)} items):**")
        for i, item in enumerate(caution, 1):
            name = item.get("name", "Unknown")
            batch = item.get("batchNumber", "N/A")
            expiry = item.get("expiry", "")
            qty = item.get("qty", 0)
            value = item.get("stock_value", 0)
            days_left = item.get("days_left", 0)
            lines.append(f"  {i}. **{name}** (Batch: {batch}) — Expires {expiry}, {days_left}d left, {qty} units, ₹{value:,.0f}")
        lines.append("")

    if total > 30:
        lines.append(f"... and {total - 30} more batches.")

    # Total value at risk
    total_value = sum(i.get("stock_value", 0) for i in items)
    lines.append(f"**Total stock value at risk: ₹{total_value:,.0f}**")

    return "\n".join(lines)


def _fmt_pending_bills(data, params, lang):
    count = int(data.get("count", 0)) if data.get("count") else 0
    total = float(data.get("total", 0)) if data.get("total") else 0

    lines = []
    lines.append(f"**Pending Bills Report**\n")

    if count == 0:
        lines.append(f"**Status:** All clear!")
        lines.append(f"\nNo pending bills right now.")
    else:
        lines.append(f"**Pending Bills:** {count}")
        lines.append(f"**Total Outstanding:** ₹{total:,.0f}")
        if count > 0:
            avg = total / count
            lines.append(f"**Average Pending:** ₹{avg:,.0f}")

    return "\n".join(lines)


def _fmt_top_medicines(data, params, lang):
    topN = params.get("topN", 5)

    if not data:
        return "No sales data found for this period."

    items = data[:topN] if isinstance(data, list) else []
    total_items = len(data) if isinstance(data, list) else 0

    lines = []
    lines.append(f"**Top Selling Medicines Report** ({total_items} medicines with sales)\n")

    for i, item in enumerate(items, 1):
        name = item.get("name", "Unknown")
        qty = int(item.get("qty", 0)) if item.get("qty") else 0
        amt = float(item.get("amount", 0)) if item.get("amount") else 0
        lines.append(f"  {i}. **{name}** — {qty} units sold — ₹{amt:,.0f}")

    if total_items > topN:
        lines.append(f"\n... and {total_items - topN} more medicines.")

    # Summary
    total_qty = sum(int(item.get("qty", 0)) or 0 for item in items)
    total_amt = sum(float(item.get("amount", 0)) or 0 for item in items)
    lines.append(f"\n**Top {len(items)} Summary:** {total_qty} units — ₹{total_amt:,.0f}")

    return "\n".join(lines)


def _fmt_queue(data, params, lang):
    waiting = data.get("waiting", 0)
    in_progress = data.get("in_progress", 0)
    oldest_wait = data.get("oldest_wait", None)

    lines = []
    lines.append(f"**Queue Status Report**\n")

    lines.append(f"**Waiting:** {waiting} patients")
    lines.append(f"**In Progress:** {in_progress} patients")
    lines.append(f"**Total in Queue:** {waiting + in_progress}")

    if oldest_wait:
        lines.append(f"**Oldest Waiting:** Token #{oldest_wait}")

    if waiting == 0 and in_progress == 0:
        lines.append(f"\nQueue is empty. All patients served.")

    return "\n".join(lines)


def _fmt_patient_history(data, params, lang):
    patient = params.get("patientIdentifier", "").strip()

    if not data:
        if patient:
            return f"**Patient Purchase History — {patient}**\n\nNo purchase history found for **{patient}**."
        return "No purchase history found."

    items = data[:20] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0
    total_spend = sum(i.get("total", 0) or 0 for i in items)

    header = f"**Patient Purchase History — {patient}**\n" if patient else "**Recent Purchase History (All Patients)**\n"

    lines = []
    lines.append(header)
    lines.append(f"**Total Bills:** {total}")
    lines.append(f"**Total Revenue:** ₹{total_spend:,.2f}\n")

    for i, item in enumerate(items, 1):
        bill = item.get("billNumber", "?")
        pname = item.get("patientName", "Walk-in")
        date = item.get("date", "")
        amt = item.get("total", 0) or 0
        items_count = item.get("item_count", 0) or 0
        pay_mode = item.get("paymentMode", "")
        status = item.get("dispenseStatus", "")
        if hasattr(date, 'strftime'):
            date = date.strftime("%d %b %Y, %I:%M %p")
        else:
            date = str(date)[:16] if date else ""
        tag = f" — {pname}" if not patient else ""
        lines.append(f"  {i}. **{bill}**{tag} — ₹{amt:,.2f} ({items_count} items) — {pay_mode} — {status} — {date}")

    if total > 20:
        lines.append(f"\n... and {total - 20} more bills.")

    lines.append("\n**Tip:** Type a patient name or UHID to see their specific history.")
    return "\n".join(lines)


def _fmt_dispense_pending(data, params, lang):
    if not data:
        return "No paid bills pending dispense. All dispensed!"

    items = data[:20] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0

    lines = []
    lines.append(f"**Pending Dispense Report** ({total} bills awaiting dispensing)\n")

    # Separate by billing type
    hospital = [i for i in items if i.get("billingType") == "HOSPITAL_PATIENT"]
    walkin = [i for i in items if i.get("billingType") != "HOSPITAL_PATIENT"]

    if hospital:
        lines.append(f"**HOSPITAL PATIENTS ({len(hospital)} bills):**")
        for i, item in enumerate(hospital, 1):
            bill = item.get("billNumber", "?")
            patient = item.get("patientName", "Unknown")
            total_amt = item.get("total", 0)
            items_count = item.get("item_count", 0)
            time = item.get("billed_at", "")
            lines.append(f"  {i}. **{bill}** — {patient} — ₹{total_amt:,.0f} ({items_count} items) — {time}")
        lines.append("")

    if walkin:
        lines.append(f"**WALK-IN CUSTOMERS ({len(walkin)} bills):**")
        for i, item in enumerate(walkin, 1):
            bill = item.get("billNumber", "?")
            patient = item.get("patientName", "Walk-in")
            total_amt = item.get("total", 0)
            items_count = item.get("item_count", 0)
            time = item.get("billed_at", "")
            lines.append(f"  {i}. **{bill}** — {patient} — ₹{total_amt:,.0f} ({items_count} items) — {time}")
        lines.append("")

    if total > 20:
        lines.append(f"... and {total - 20} more bills.")

    total_value = sum(i.get("total", 0) for i in items)
    lines.append(f"**Total pending value: ₹{total_value:,.0f}**")

    return "\n".join(lines)


def _fmt_reorder(data, params, lang):
    if not data:
        return "No urgent reorder needed right now."

    items = data[:30] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0

    lines = []
    lines.append(f"**Reorder Recommendations** ({total} medicines need restocking)\n")

    # Categorize by urgency
    critical = [i for i in items if i.get("urgency") == "CRITICAL"]
    high = [i for i in items if i.get("urgency") == "HIGH"]
    watch = [i for i in items if i.get("urgency") not in ("CRITICAL", "HIGH")]

    if critical:
        lines.append(f"**CRITICAL ({len(critical)} items):**")
        for i, item in enumerate(critical, 1):
            name = item.get("name", "Unknown")
            available = item.get("availableQty", 0)
            suggested = item.get("suggestedQty", 0) or 0
            lines.append(f"  {i}. **{name}** — {available} in stock, order {suggested} units")
        lines.append("")

    if high:
        lines.append(f"**HIGH PRIORITY ({len(high)} items):**")
        for i, item in enumerate(high, 1):
            name = item.get("name", "Unknown")
            available = item.get("availableQty", 0)
            suggested = item.get("suggestedQty", 0) or 0
            lines.append(f"  {i}. **{name}** — {available} in stock, order {suggested} units")
        lines.append("")

    if watch:
        lines.append(f"**WATCH ({len(watch)} items):**")
        for i, item in enumerate(watch, 1):
            name = item.get("name", "Unknown")
            available = item.get("availableQty", 0)
            suggested = item.get("suggestedQty", 0) or 0
            if suggested > 0:
                lines.append(f"  {i}. **{name}** — {available} in stock, order {suggested} units")
            else:
                lines.append(f"  {i}. **{name}** — {available} in stock, running low")
        lines.append("")

    if total > 30:
        lines.append(f"... and {total - 30} more medicines.")

    lines.append("**Action:** Place purchase orders for CRITICAL and HIGH priority items immediately.")

    return "\n".join(lines)


def _fmt_supplier(data, params, lang):
    if not data:
        return "**Supplier Performance Report**\n\nNo supplier data available right now."

    items = data[:10] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0

    lines = []
    lines.append(f"**Supplier Performance Report** ({total} suppliers)\n")

    for i, item in enumerate(items, 1):
        name = item.get("name", "Unknown")
        score = item.get("score", "N/A")
        orders = item.get("orders", 0) or 0
        on_time = item.get("onTime", 0) or 0
        lines.append(f"  {i}. **{name}** — Score: {score} ({orders} orders, {on_time} on-time)")

    return "\n".join(lines)


def _fmt_return_summary(data, params, lang):
    items = data[:20] if isinstance(data, list) else []
    count = len(data) if isinstance(data, list) else data.get("count", 0)
    total = data.get("total", 0) if isinstance(data, dict) else 0

    if count == 0:
        return "**Return Summary Report**\n\nNo returns for this period."

    lines = []
    lines.append(f"**Return Summary Report**\n")
    lines.append(f"**Total Returns:** {count}")
    lines.append(f"**Total Value:** ₹{total:,.0f}\n")

    for i, item in enumerate(items, 1):
        if isinstance(item, dict):
            num = item.get("returnNumber", item.get("return_number", "?"))
            medicine = item.get("medicineName", item.get("medicine", "Unknown"))
            amt = item.get("total", item.get("amount", 0)) or 0
            reason = item.get("reason", "")
            date = item.get("date", item.get("createdAt", ""))
            lines.append(f"  {i}. **{num}** — {medicine} — ₹{amt:,.0f} — {date}")

    return "\n".join(lines)


def _fmt_grn(data, params, lang):
    if not data:
        return "**GRN Summary Report**\n\nNo recent GRN found."

    items = data[:15] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0

    lines = []
    lines.append(f"**GRN Summary Report** ({total} entries)\n")

    for i, item in enumerate(items, 1):
        if isinstance(item, dict):
            grn = item.get("grnNumber", item.get("grn_number", "?"))
            supplier = item.get("supplierName", item.get("supplier", "Unknown"))
            amt = item.get("total", item.get("amount", 0)) or 0
            date = item.get("date", item.get("createdAt", ""))
            items_count = item.get("itemCount", item.get("items", 0)) or 0
            lines.append(f"  {i}. **{grn}** — {supplier} — ₹{amt:,.0f} ({items_count} items) — {date}")

    return "\n".join(lines)


def _fmt_purchase_order(data, params, lang):
    items = data[:15] if isinstance(data, list) else []
    count = len(data) if isinstance(data, list) else data.get("count", 0)

    if count == 0:
        return "**Purchase Order Status Report**\n\nNo open purchase orders right now."

    lines = []
    lines.append(f"**Purchase Order Status Report** ({count} orders)\n")

    for i, item in enumerate(items, 1):
        if isinstance(item, dict):
            po = item.get("poNumber", item.get("po_number", "?"))
            supplier = item.get("supplierName", item.get("supplier", "Unknown"))
            amt = item.get("total_value", item.get("total", item.get("amount", 0))) or 0
            status = item.get("status", "Pending")
            date = item.get("created_date", item.get("date", item.get("createdAt", "")))
            items_count = item.get("itemCount", item.get("items", 0)) or 0
            date_str = ""
            if date:
                if hasattr(date, 'strftime'):
                    date_str = date.strftime("%d %b %Y")
                else:
                    date_str = str(date)[:10]
            lines.append(f"  {i}. **{po}** — {supplier} — ₹{amt:,.0f} — {status} — {date_str}")

    return "\n".join(lines)


def _fmt_category(data, params, lang):
    if not data:
        return "**Category Breakdown Report**\n\nNo category data available."

    items = data[:10] if isinstance(data, list) else []
    total = len(data) if isinstance(data, list) else 0
    total_amt = sum(i.get("amount", 0) or 0 for i in items)

    lines = []
    lines.append(f"**Category Breakdown Report** ({total} categories)\n")

    for i, item in enumerate(items, 1):
        cat = item.get("category", "Unknown")
        amt = item.get("amount", 0) or 0
        pct = (amt / total_amt * 100) if total_amt > 0 else 0
        count = item.get("count", 0) or 0
        lines.append(f"  {i}. **{cat}** — ₹{amt:,.0f} ({pct:.0f}%) — {count} bills")

    lines.append(f"\n**Total Revenue:** ₹{total_amt:,.0f}")

    return "\n".join(lines)


def _fmt_controlled(data, params, lang):
    items = data[:15] if isinstance(data, list) else []
    count = len(data) if isinstance(data, list) else data.get("count", 0)

    if count == 0:
        return "**Controlled Drug Audit Report**\n\nNo Schedule H / controlled drug records found."

    lines = []
    lines.append(f"**Controlled Drug Audit Report** ({count} records)\n")

    for i, item in enumerate(items, 1):
        if isinstance(item, dict):
            medicine = item.get("medicineName", item.get("medicine", "Unknown"))
            patient = item.get("patientName", item.get("patient", "Unknown"))
            qty = item.get("quantity", 0)
            date = item.get("date", item.get("createdAt", ""))
            lines.append(f"  {i}. **{medicine}** — {patient} — {qty} units — {date}")

    return "\n".join(lines)


def _fmt_walk_in(data, params, lang):
    walkin = data.get("walkin", 0) or 0
    hospital = data.get("hospital", 0) or 0
    total = walkin + hospital

    lines = []
    lines.append(f"**Walk-in vs Hospital Patient Report**\n")

    lines.append(f"**Walk-in Customers:** ₹{walkin:,.0f}")
    lines.append(f"**Hospital Patients:** ₹{hospital:,.0f}")
    lines.append(f"**Total Revenue:** ₹{total:,.0f}")

    if total > 0:
        walkin_pct = (walkin / total) * 100
        hospital_pct = (hospital / total) * 100
        lines.append(f"\n**Walk-in Share:** {walkin_pct:.0f}%")
        lines.append(f"**Hospital Share:** {hospital_pct:.0f}%")

    return "\n".join(lines)


def _fmt_unknown(data, params, lang):
    return (
        "I didn't understand that. Try asking:\n"
        "• 'How much revenue today?'\n"
        "• 'Which medicines are low in stock?'\n"
        "• 'Top 5 medicines'\n"
        "• 'How many patients in queue?'"
    )


# Template registry for pharmacy intents
PHARMACY_TEMPLATES = {
    "DAILY_REVENUE":           _fmt_daily_revenue,
    "MONTHLY_REVENUE":         _fmt_monthly_revenue,
    "OUT_OF_STOCK_ALERT":      _fmt_out_of_stock,
    "LOW_STOCK_ALERT":         _fmt_low_stock,
    "EXPIRY_RISK_REPORT":      _fmt_expiry,
    "PENDING_BILLS":           _fmt_pending_bills,
    "TOP_MEDICINES_SALES":     _fmt_top_medicines,
    "QUEUE_STATUS":            _fmt_queue,
    "PATIENT_PURCHASE_HISTORY": _fmt_patient_history,
    "DISPENSE_PENDING":        _fmt_dispense_pending,
    "REORDER_RECOMMENDATIONS": _fmt_reorder,
    "SUPPLIER_PERFORMANCE":    _fmt_supplier,
    "RETURN_SUMMARY":          _fmt_return_summary,
    "GRN_SUMMARY":             _fmt_grn,
    "PURCHASE_ORDER_STATUS":   _fmt_purchase_order,
    "CATEGORY_BREAKDOWN":      _fmt_category,
    "CONTROLLED_DRUG_AUDIT":   _fmt_controlled,
    "WALK_IN_VS_PATIENT":      _fmt_walk_in,
    "UNKNOWN":                 _fmt_unknown,
}


def format_pharmacy_response(intent: str, data, params: dict, lang: str = "english") -> str:
    """Format pharmacy response using the appropriate template."""
    fn = PHARMACY_TEMPLATES.get(intent, PHARMACY_TEMPLATES["UNKNOWN"])
    try:
        return fn(data, params, lang)
    except Exception as e:
        logger.error("format_pharmacy_response failed for intent=%s: %s", intent, e)
        return "Data was retrieved but there was an issue creating the response. Please try again."
