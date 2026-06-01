import api from './api';
import { printBillingSlip } from './printBillingSlip';

/**
 * Opens the same billing slip layout as "Generate bill" / All Bills print,
 * for one payment row: loads the bill by id, then prints with that payment's mode/time in the header area.
 *
 * @param {object} paymentRow — row from GET /receptionist/billing/patient-payments (billId, paidAt, mode, note, uhid, …)
 * @param {object} [enrich] — optional ward/doctor from current screen when patient matches (e.g. selected patient card)
 */
export async function printPaymentAsBillingSlip(paymentRow, enrich = {}) {
  const billId = paymentRow?.billId;
  if (!billId) return;

  const res = await api.get(`/receptionist/billing/${encodeURIComponent(billId)}`);
  const b = res?.data;
  if (!b) return;

  const noteParts = [b.notes, paymentRow.note].map((x) => (x == null ? '' : String(x).trim())).filter(Boolean);
  const notesJoined = noteParts.length ? noteParts.join(' · ') : '—';

  await printBillingSlip({
    billId: b.billNumber || b.id,
    data: {
      visitType: b.visitType,
      billNumber: b.billNumber || b.id,
      patientName: b.patientName || paymentRow.patientName,
      uhid: b.uhid || paymentRow.uhid,
      mobile: b.mobile,
      doctorName: enrich.doctorName ?? b.doctorName ?? '',
      wardName: enrich.wardName,
      bedCode: enrich.bedCode,
      ipdNumber: enrich.ipdNumber,
      createdAt: paymentRow.paidAt || b.createdAt || b.date,
      items: b.items || [],
      totals: {
        subtotal: b.subtotal ?? b.total,
        discount: b.discount ?? 0,
        taxAmt: b.tax ?? 0,
        total: b.total,
        paid: b.paid,
        pending: b.pending,
      },
      paymentMode: paymentRow.mode || b.paymentMode,
      paymentStatus: b.paymentStatus,
      notes: notesJoined,
    },
  });
}
