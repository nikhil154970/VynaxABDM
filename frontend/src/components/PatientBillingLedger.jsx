import { useCallback, useEffect, useState } from 'react';
import { MdRefresh, MdPayments, MdReceiptLong, MdPrint } from 'react-icons/md';
import api from '../utils/api';
import { printBillingSlip } from '../utils/printBillingSlip';

const KIND_META = {
  REGISTRATION: { label: 'Registration', bg: '#eff6ff', text: '#1e40af' },
  APPOINTMENT: { label: 'OPD / Appointment', bg: '#eef2ff', text: '#4338ca' },
  OPD: { label: 'OPD Bill', bg: '#e0f2fe', text: '#075985' },
  IPD: { label: 'IPD Bill', bg: '#f1f5f9', text: '#334155' },
  OT: { label: 'OT / Surgery', bg: '#fce7f3', text: '#9d174d' },
  LAB: { label: 'Lab', bg: '#ecfccb', text: '#3f6212' },
  PHARMACY: { label: 'Pharmacy', bg: '#f3e8ff', text: '#6b21a8' },
  EXPENSE: { label: 'Nursing Expense', bg: '#fff7ed', text: '#9a3412' },
  ADVANCE: { label: 'IPD Advance', bg: '#dcfce7', text: '#166534' },
};

const PH_STATUS_META = {
  PAID: { bg: '#dcfce7', text: '#14532d' },
  PARTIALLY_PAID: { bg: '#fef9c3', text: '#854d0e' },
  PENDING_PAYMENT: { bg: '#fee2e2', text: '#991b1b' },
  DRAFT: { bg: '#e2e8f0', text: '#475569' },
};

const STATUS_META = {
  Paid: { bg: '#dcfce7', text: '#14532d', dot: '#22c55e' },
  Partial: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  Pending: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Unified, read-through billing ledger for ONE patient.
 * Shows registration fee + OPD appointment fee + every bill (OPD/IPD/OT/Lab),
 * per-row paid/pending and grand totals. Pending on real bills can be collected inline.
 */
export default function PatientBillingLedger({ patientId, reloadToken = 0, onAfterPayment }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [collectFor, setCollectFor] = useState(null); // entry being paid
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [saving, setSaving] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkMode, setBulkMode] = useState('Cash');
  const [bulkSaving, setBulkSaving] = useState(false);

  const [pharmacy, setPharmacy] = useState(null);
  const [pharmacyLoading, setPharmacyLoading] = useState(false);

  const load = useCallback(async () => {
    if (!patientId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/receptionist/billing/patient-ledger', { params: { patientId } });
      setData(res.data || null);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load billing ledger');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const loadPharmacy = useCallback(async () => {
    if (!patientId) {
      setPharmacy(null);
      return;
    }
    setPharmacyLoading(true);
    try {
      const params = { patientId };
      if (data?.admissionId) params.admissionId = data.admissionId;
      const res = await api.get('/receptionist/billing/pharmacy-bills', { params });
      setPharmacy(res.data || null);
    } catch {
      setPharmacy(null);
    } finally {
      setPharmacyLoading(false);
    }
  }, [patientId, data?.admissionId]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  useEffect(() => {
    loadPharmacy();
  }, [loadPharmacy, reloadToken]);

  const openCollect = (entry) => {
    setCollectFor(entry);
    setPayAmount(entry.pending > 0 ? String(entry.pending) : '');
    setPayMode(entry.mode && entry.mode !== '—' ? entry.mode : 'Cash');
  };

  const printEntry = useCallback(
    async (entry) => {
      if (!entry) return;
      const p = data?.patient || {};
      try {
        if (entry.billId) {
          const res = await api.get(`/receptionist/billing/${entry.billId}`);
          const b = res.data || {};
          await printBillingSlip({
            billId: b.billNumber || entry.ref,
            data: {
              visitType: b.visitType,
              billNumber: b.billNumber || entry.ref,
              patientName: b.patientName || p.name,
              uhid: b.uhid || p.uhid,
              mobile: b.mobile || p.mobile,
              doctorName: b.doctorName || '',
              createdAt: b.date || entry.date,
              items: b.items || [],
              totals: { subtotal: b.subtotal, discount: b.discount, taxAmt: b.tax, total: b.total, paid: b.paid, pending: b.pending },
              paymentMode: b.paymentMode,
              paymentStatus: b.paymentStatus,
              sponsor: data?.sponsor,
              isAyushman: data?.isAyushman,
              notes: b.notes,
            },
          });
        } else {
          // Registration / appointment fee — no Bill record, print a simple receipt.
          await printBillingSlip({
            billId: entry.ref,
            data: {
              visitType: 'OPD',
              billNumber: entry.ref,
              patientName: p.name,
              uhid: p.uhid,
              mobile: p.mobile,
              createdAt: entry.date,
              items: [{ name: entry.label, qty: 1, price: entry.total, total: entry.total }],
              totals: { subtotal: entry.total, discount: 0, taxAmt: 0, total: entry.total, paid: entry.paid, pending: entry.pending },
              paymentMode: entry.mode,
              paymentStatus: entry.status,
              sponsor: data?.sponsor,
              isAyushman: data?.isAyushman,
            },
          });
        }
      } catch (e) {
        setError(e?.response?.data?.message || 'Could not open slip');
      }
    },
    [data],
  );

  // Consolidated slip: every ledger entry (registration, OPD, IPD, OT, lab,
  // pharmacy, nursing) as line items on a single "complete bill".
  const printFullBill = useCallback(async () => {
    if (!data || !Array.isArray(data.entries) || data.entries.length === 0) return;
    const p = data.patient || {};
    const t = data.totals || { billed: 0, paid: 0, pending: 0 };
    const items = data.entries.map((e) => {
      const km = KIND_META[e.kind] || KIND_META.OPD;
      const ref = e.ref && e.ref !== '—' ? ` (${e.ref})` : '';
      const name = `${km.label}${ref} — ${e.particulars || e.label || ''}`.trim();
      return { name, qty: 1, price: e.total, total: e.total };
    });
    try {
      await printBillingSlip({
        billId: `FULL-${p.uhid || patientId}`,
        data: {
          visitType: 'CONSOLIDATED',
          billNumber: `FULL-${p.uhid || ''}`,
          patientName: p.name,
          uhid: p.uhid,
          mobile: p.mobile,
          doctorName: '',
          createdAt: new Date().toISOString(),
          items,
          totals: {
            subtotal: t.billed,
            discount: 0,
            taxAmt: 0,
            total: t.billed,
            paid: t.paid,
            pending: t.pending,
          },
          paymentMode: '—',
          paymentStatus: t.pending > 0 ? (t.paid > 0 ? 'Partial' : 'Pending') : 'Paid',
          sponsor: data?.sponsor,
          isAyushman: data?.isAyushman,
          notes: 'Consolidated bill — all charges for this patient',
        },
      });
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not open consolidated slip');
    }
  }, [data, patientId]);

  const submitCollect = async () => {
    const entry = collectFor;
    if (!entry) return;
    const amt = Math.max(0, Math.round(Number(payAmount) || 0));
    if (amt <= 0 || amt > entry.pending) return;
    setSaving(true);
    try {
      let printTarget = entry;
      if (entry.billId) {
        await api.post(`/receptionist/billing/${entry.billId}/payments`, { amount: amt, mode: payMode });
      } else if (entry.admissionId) {
        // Accrued IPD package (no bill yet) — finalise into a real bill + record payment.
        const res = await api.post(`/receptionist/billing/admissions/${entry.admissionId}/collect`, { amount: amt, mode: payMode });
        const newBill = res.data?.bill;
        if (newBill?.id) printTarget = { billId: newBill.id, ref: newBill.billNumber };
      } else {
        setSaving(false);
        return;
      }
      setCollectFor(null);
      await load();
      if (onAfterPayment) onAfterPayment();
      // Auto-generate the payment slip for the just-collected bill.
      await printEntry(printTarget);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not record payment');
    } finally {
      setSaving(false);
    }
  };

  const submitBulkCollect = async () => {
    let remaining = Math.max(0, Math.round(Number(bulkAmount) || 0));
    if (remaining <= 0) return;
    setBulkSaving(true);
    try {
      // Pay off pending bills oldest-first; front-desk reg/appointment fees are skipped (no bill to attach to).
      const payables = (data?.entries || [])
        .filter((e) => (e.billId || e.admissionId) && e.pending > 0)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      for (const e of payables) {
        if (remaining <= 0) break;
        const pay = Math.min(remaining, e.pending);
        if (pay <= 0) continue;
        if (e.billId) {
          await api.post(`/receptionist/billing/${e.billId}/payments`, { amount: pay, mode: bulkMode });
        } else {
          await api.post(`/receptionist/billing/admissions/${e.admissionId}/collect`, { amount: pay, mode: bulkMode });
        }
        remaining -= pay;
      }
      setBulkOpen(false);
      await load();
      if (onAfterPayment) onAfterPayment();
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not record payment');
    } finally {
      setBulkSaving(false);
    }
  };

  const totals = data?.totals || { billed: 0, paid: 0, pending: 0 };

  const pharmacyRows = pharmacy?.rows || [];
  const pharmacyTotals = pharmacy?.totals || { amount: 0, paid: 0, pending: 0 };

  return (
    <div className="space-y-4">
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-700 ring-1 ring-slate-200">
            <MdReceiptLong className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-gray-900">Complete billing history</p>
            <p className="text-[11px] text-gray-500">Registration, OPD, IPD, OT, Lab, Pharmacy & Nursing — all charges in one place</p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-extrabold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          <MdRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-3 gap-px bg-gray-100">
        <div className="bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Total billed</p>
          <p className="text-base font-extrabold text-gray-900">{inr(totals.billed)}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Total paid</p>
          <p className="text-base font-extrabold text-emerald-700">{inr(totals.paid)}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Total pending</p>
          <p className={`text-base font-extrabold ${totals.pending > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{inr(totals.pending)}</p>
        </div>
      </div>

      {data?.isAyushman ? (
        <div className="border-t border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
          Ayushman patient — charges settled under scheme; patient due ₹0.
        </div>
      ) : null}

      <div className="max-h-[min(360px,50vh)] overflow-auto">
        {error ? (
          <p className="px-4 py-6 text-center text-sm font-semibold text-red-600">{error}</p>
        ) : loading ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">Loading ledger…</p>
        ) : !data || !data.entries?.length ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">No billing records for this patient yet.</p>
        ) : (
          <table className="w-full min-w-[640px] text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Reference</th>
                <th className="px-3 py-2 text-left">Particulars</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Pending</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.entries.map((e, idx) => {
                const km = KIND_META[e.kind] || KIND_META.OPD;
                const sm = STATUS_META[e.status] || STATUS_META.Pending;
                return (
                  <tr key={`${e.billId || e.kind}-${idx}`} className="hover:bg-blue-50/40 transition">
                    <td className="px-3 py-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: km.bg, color: km.text }}>
                        {km.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-blue-700">{e.ref}</td>
                    <td className="px-3 py-2 max-w-[190px] truncate text-gray-700" title={e.particulars || e.label}>
                      {e.particulars || e.label}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{fmtDate(e.date)}</td>
                    <td className="px-3 py-2 text-right font-extrabold text-gray-900">{inr(e.total)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{inr(e.paid)}</td>
                    <td className="px-3 py-2 text-right font-extrabold text-amber-800">{inr(e.pending)}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: sm.text }}>
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: sm.dot }} />
                        {e.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {(e.billId || e.admissionId) && e.pending > 0 ? (
                          <button
                            type="button"
                            onClick={() => openCollect(e)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-extrabold text-blue-800 transition hover:bg-blue-100"
                          >
                            <MdPayments className="h-3.5 w-3.5" /> Collect
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => printEntry(e)}
                          title="Print slip"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-extrabold text-gray-700 transition hover:bg-gray-50"
                        >
                          <MdPrint className="h-3.5 w-3.5" /> Print
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 bg-slate-100 font-extrabold text-gray-900">
              <tr className="border-t-2 border-slate-300">
                <td className="px-3 py-2.5 text-left" colSpan={4}>
                  Grand total
                </td>
                <td className="px-3 py-2.5 text-right">{inr(totals.billed)}</td>
                <td className="px-3 py-2.5 text-right text-emerald-700">{inr(totals.paid)}</td>
                <td className={`px-3 py-2.5 text-right ${totals.pending > 0 ? 'text-amber-700' : ''}`}>{inr(totals.pending)}</td>
                <td className="px-3 py-2.5 text-right" colSpan={2}>
                  <div className="flex items-center justify-end gap-1.5">
                    {totals.pending > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCollectFor(null);
                          setBulkAmount(String(totals.pending));
                          setBulkMode('Cash');
                          setBulkOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-extrabold text-white shadow transition hover:bg-blue-700"
                      >
                        <MdPayments className="h-3.5 w-3.5" /> Collect pending
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={printFullBill}
                      title="Print complete bill (all charges on one slip)"
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-1.5 text-[11px] font-extrabold text-white shadow transition hover:bg-slate-800"
                    >
                      <MdPrint className="h-3.5 w-3.5" /> Print full bill
                    </button>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Inline collect payment */}
      {collectFor ? (
        <div className="border-t border-gray-100 bg-slate-50/70 px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold text-gray-500">Collecting for</p>
              <p className="text-sm font-bold text-gray-900">{collectFor.ref} · pending {inr(collectFor.pending)}</p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-extrabold text-gray-500">Amount (₹)</label>
              <input
                type="number"
                min={1}
                max={collectFor.pending}
                value={payAmount}
                onChange={(ev) => setPayAmount(ev.target.value)}
                className="w-28 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-extrabold text-gray-500">Mode</label>
              <select
                value={payMode}
                onChange={(ev) => setPayMode(ev.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {['Cash', 'UPI', 'Card'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={saving || Number(payAmount) <= 0 || Number(payAmount) > collectFor.pending}
              onClick={submitCollect}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Record'}
            </button>
            <button
              type="button"
              onClick={() => setCollectFor(null)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-extrabold text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Bulk collect against total pending */}
      {bulkOpen ? (
        <div className="border-t border-gray-100 bg-blue-50/60 px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold text-gray-500">Collect total pending</p>
              <p className="text-sm font-bold text-gray-900">Outstanding {inr(totals.pending)} · oldest bills first</p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-extrabold text-gray-500">Amount (₹)</label>
              <input
                type="number"
                min={1}
                max={totals.pending}
                value={bulkAmount}
                onChange={(ev) => setBulkAmount(ev.target.value)}
                className="w-28 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-extrabold text-gray-500">Mode</label>
              <select
                value={bulkMode}
                onChange={(ev) => setBulkMode(ev.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {['Cash', 'UPI', 'Card'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={bulkSaving || Number(bulkAmount) <= 0 || Number(bulkAmount) > totals.pending}
              onClick={submitBulkCollect}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
            >
              {bulkSaving ? 'Collecting…' : 'Collect'}
            </button>
            <button
              type="button"
              onClick={() => setBulkOpen(false)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-extrabold text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            Note: front-desk registration / appointment fees are collected at their own desk and are skipped here.
          </p>
        </div>
      ) : null}
    </div>

    {/* Read-only Pharmacy Billing Details — every pharmacy-billed medicine for this admission */}
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-700 ring-1 ring-purple-200">
            <MdReceiptLong className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-gray-900">Pharmacy billing details</p>
            <p className="text-[11px] text-gray-500">Every medicine billed by pharmacy for this admission (read-only)</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadPharmacy}
          disabled={pharmacyLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-extrabold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          <MdRefresh className={`h-4 w-4 ${pharmacyLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="max-h-[min(320px,45vh)] overflow-auto">
        {pharmacyLoading ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">Loading pharmacy bills…</p>
        ) : !pharmacyRows.length ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">No pharmacy-billed medicines for this patient yet.</p>
        ) : (
          <table className="w-full min-w-[640px] text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Bill No</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Medicine</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pharmacyRows.map((r, idx) => {
                const ps = PH_STATUS_META[r.status] || PH_STATUS_META.PENDING_PAYMENT;
                return (
                  <tr key={`${r.billNumber}-${idx}`} className="hover:bg-purple-50/40 transition">
                    <td className="px-3 py-2 font-mono font-bold text-purple-700">{r.billNumber}</td>
                    <td className="px-3 py-2 text-gray-500">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2 text-gray-800">{r.medicine}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{r.quantity}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{inr(r.rate)}</td>
                    <td className="px-3 py-2 text-right font-extrabold text-gray-900">{inr(r.amount)}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: ps.bg, color: ps.text }}>
                        {String(r.status || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 bg-slate-100 font-extrabold text-gray-900">
              <tr className="border-t-2 border-slate-300">
                <td className="px-3 py-2.5 text-left" colSpan={5}>
                  Pharmacy total · paid {inr(pharmacyTotals.paid)} · pending {inr(pharmacyTotals.pending)}
                </td>
                <td className="px-3 py-2.5 text-right">{inr(pharmacyTotals.amount)}</td>
                <td className="px-3 py-2.5" />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
    </div>
  );
}
