import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MdPayments, MdPrint, MdRefresh } from 'react-icons/md';
import api from '../../../utils/api';
import { printLabBillSlip } from '../../../utils/printLabBillSlip';

function money(n) {
  return `₹${Math.max(0, Number(n || 0)).toLocaleString('en-IN')}`;
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export default function LabPendingPayments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payRow, setPayRow] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [paySubmitting, setPaySubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/lab/receptionist/bills', { params: { dueOnly: 1 } });
      setRows(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      setRows([]);
      setError(e?.response?.data?.message || 'Failed to load pending lab payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openPay = (row) => {
    setPayRow(row);
    setPayAmount(String(row.pendingAmount ?? 0));
    setPayMode(row.paymentMode && row.paymentMode !== 'PAID BY AYUSHMAN' ? row.paymentMode : 'Cash');
  };

  const submitPay = async () => {
    if (!payRow?.billId) return;
    const amt = Math.min(
      Math.max(0, Math.trunc(Number(payAmount) || 0)),
      Math.max(0, Math.trunc(Number(payRow.pendingAmount) || 0)),
    );
    if (amt <= 0) return;
    setPaySubmitting(true);
    setError('');
    try {
      await api.post(`/receptionist/billing/${payRow.billId}/payments`, {
        amount: amt,
        mode: payMode,
      });
      setPayRow(null);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || 'Payment failed');
    } finally {
      setPaySubmitting(false);
    }
  };

  const reprint = (row) => {
    const p = row.patient || {};
    const isAyushman = String(row.paymentMode || '')
      .toLowerCase()
      .includes('ayushman');
    printLabBillSlip({
      patientName: p.name,
      patientUhid: p.uhid,
      sponsor: isAyushman ? 'AYUSHMAN' : '',
      isAyushman,
      doctorName: row.doctorName,
      tests: row.tests || [],
      totalAmount: row.totalAmount,
      grossTotalAmount: row.totalAmount,
      mode: 'issued',
      billNumber: row.billNumber,
      orderNumber: row.orderNumber,
      paidAmount: row.paidAmount,
      paymentStatus: row.paymentStatus,
    });
  };

  return (
    <div className="min-h-screen w-full bg-[#F5F7FA]">
      <div className="w-full px-4 sm:px-6 py-4 sm:py-5 max-w-6xl mx-auto space-y-4">
        <div
          className="rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white"
          style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        >
          <div>
            <h1 className="text-lg font-extrabold text-gray-900">Pending lab payment</h1>
            <p className="text-xs text-gray-500 mt-1">Billed lab tests jinka balance abhi baki hai (Partial / Pending)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/dashboard/reception/lab/advised"
              className="inline-flex items-center h-10 px-4 rounded-xl text-sm font-extrabold border bg-white"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            >
              Advised OPD tests
            </Link>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-extrabold border bg-white disabled:opacity-50"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            >
              <MdRefresh className={`text-lg ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl px-4 py-3 text-sm font-semibold bg-red-50 text-red-800 border border-red-100">{error}</div>
        ) : null}

        <div className="rounded-2xl border overflow-hidden bg-white" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500 border-b bg-slate-50/80">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Bill / Order</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500 font-semibold">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500 font-semibold">
                      No pending lab payments — sab clear hai
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const p = row.patient || {};
                    return (
                      <tr key={row.orderId} className="border-t border-gray-100 align-top hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(row.billedAt)}</td>
                        <td className="px-4 py-3">
                          <p className="font-extrabold text-gray-900">{p.name || '—'}</p>
                          <p className="text-[11px] font-mono text-gray-500">{p.uhid || ''}</p>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono">
                          <p>{row.billNumber || '—'}</p>
                          <p className="text-gray-500">{row.orderNumber || ''}</p>
                          <p className="text-[10px] text-amber-800 font-bold mt-1 uppercase">{row.paymentStatus}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-extrabold text-amber-800 tabular-nums">{money(row.pendingAmount)}</p>
                          <p className="text-[10px] text-gray-500">
                            of {money(row.totalAmount)} · paid {money(row.paidAmount)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col sm:flex-row gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => openPay(row)}
                              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-extrabold text-white"
                              style={{ background: '#00AEEF' }}
                            >
                              <MdPayments /> Collect
                            </button>
                            <button
                              type="button"
                              onClick={() => reprint(row)}
                              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-extrabold border bg-white"
                              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                            >
                              <MdPrint /> Print
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {payRow ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <h2 className="text-base font-extrabold text-gray-900">Collect payment</h2>
              <p className="text-xs text-gray-500 mt-1">
                {payRow.billNumber} · Due {money(payRow.pendingAmount)}
              </p>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-gray-600">
                  Amount (₹)
                  <input
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                    inputMode="decimal"
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Mode
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                  >
                    {['Cash', 'UPI', 'Card'].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2 mt-5 justify-end">
                <button
                  type="button"
                  onClick={() => setPayRow(null)}
                  className="px-4 py-2 rounded-xl text-sm font-extrabold border bg-white"
                  style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitPay}
                  disabled={paySubmitting}
                  className="px-4 py-2 rounded-xl text-sm font-extrabold text-white disabled:opacity-50"
                  style={{ background: '#00AEEF' }}
                >
                  {paySubmitting ? 'Saving…' : 'Save payment'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
