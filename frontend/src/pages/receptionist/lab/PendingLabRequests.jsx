import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MdClose, MdRefresh } from 'react-icons/md';
import api from '../../../utils/api';
import { printLabBillSlip } from '../../../utils/printLabBillSlip';

function money(n) {
  const x = Number(n || 0);
  return `₹${Math.max(0, x).toLocaleString('en-IN')}`;
}

export default function PendingLabRequests() {
  const [searchParams, setSearchParams] = useSearchParams();
  const uhidFilter = (searchParams.get('uhid') || '').trim();
  const highlightRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [error, setError] = useState('');
  const [viewRow, setViewRow] = useState(null);

  const filteredRows = useMemo(() => {
    if (!uhidFilter) return rows;
    const q = uhidFilter.toLowerCase();
    return rows.filter((r) => String(r.patientUhid || '').toLowerCase() === q);
  }, [rows, uhidFilter]);

  useEffect(() => {
    if (!uhidFilter || !filteredRows.length) return;
    const t = window.setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 150);
    return () => window.clearTimeout(t);
  }, [uhidFilter, filteredRows.length, loading]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/lab/advice/pending');
      const list = Array.isArray(res.data) ? res.data : [];
      setRows(list);
    } catch (e) {
      setRows([]);
      const apiMsg = e?.response?.data?.message;
      const status = e?.response?.status;
      const net = !e?.response && e?.message ? String(e.message) : '';
      setError(
        apiMsg ||
          (status === 403 ? 'Access denied' : status === 401 ? 'Please login again' : '') ||
          net ||
          (status ? `Request failed (${status})` : 'Failed to load — check API is running')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const printIssuedSlip = useCallback((row, bill, order) => {
    if (!row || !bill) return;
    const gross = (row.tests || []).reduce((s, t) => s + Math.max(0, Number(t.price) || 0), 0);
    printLabBillSlip({
      patientName: row.patient,
      patientUhid: row.patientUhid,
      sponsor: row.sponsor || (row.isAyushman ? 'AYUSHMAN' : ''),
      isAyushman: row.isAyushman,
      doctorName: row.doctor,
      tests: row.tests || [],
      totalAmount: bill.totalAmount ?? row.totalAmount,
      grossTotalAmount: gross,
      mode: 'issued',
      billNumber: bill.billNumber,
      orderNumber: order?.orderNumber,
      adviceId: row.id,
      createdAt: row.createdAt,
      paidAmount: bill.paidAmount ?? row.totalAmount,
      paymentStatus: row.isAyushman ? 'PAID' : bill.status,
    });
  }, []);

  const confirm = async (id, rowForPrint = null, { closeModalOnSuccess = false } = {}) => {
    setActingId(id);
    setError('');
    try {
      const res = await api.post('/lab/confirm', { advice_id: id });
      const bill = res.data?.bill;
      const order = res.data?.order;
      if (rowForPrint && bill) printIssuedSlip(rowForPrint, bill, order);
      if (closeModalOnSuccess) setViewRow(null);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not confirm');
    } finally {
      setActingId(null);
    }
  };

  const printPreviewFromRow = (row) => {
    printLabBillSlip({
      patientName: row.patient,
      patientUhid: row.patientUhid,
      sponsor: row.sponsor,
      isAyushman: row.isAyushman,
      doctorName: row.doctor,
      tests: row.tests || [],
      totalAmount: row.totalAmount,
      mode: 'preview',
      adviceId: row.id,
      createdAt: row.createdAt,
    });
  };

  return (
    <div className="min-h-screen w-full bg-[#F5F7FA]">
      <div className="w-full px-4 sm:px-6 py-4 sm:py-5 max-w-6xl mx-auto space-y-4">
        <div
          className="rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}
        >
          <div>
            <h1 className="text-lg font-extrabold text-gray-900">Advised OPD tests</h1>
            <p className="text-xs text-gray-500 mt-1">
              Doctor ne consultation me tests select kiye — abhi bill nahi bana. Paid / partial bills yahan nahi dikhte.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/dashboard/reception/lab/pending-payment"
              className="inline-flex items-center h-10 px-4 rounded-xl text-sm font-extrabold border bg-white"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            >
              Pending payment
            </Link>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-extrabold border bg-white disabled:opacity-50"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            >
              <MdRefresh className={`text-lg ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl px-4 py-3 text-sm font-semibold bg-red-50 text-red-800 border border-red-100">
            {error}
          </div>
        ) : null}

        {uhidFilter ? (
          <div
            className="rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm"
            style={{ background: '#ecfeff', borderColor: 'rgba(6,182,212,0.35)' }}
          >
            <p className="text-cyan-950 font-semibold">
              Filter: UHID <span className="font-mono font-extrabold">{uhidFilter}</span>
              {!loading && filteredRows.length === 0 ? (
                <span className="block sm:inline sm:ml-2 text-cyan-800 text-xs mt-1 sm:mt-0">
                  — no pending advised tests for this patient right now.
                </span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('uhid');
                setSearchParams(next, { replace: true });
              }}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-extrabold border border-cyan-300 bg-white text-cyan-900 hover:bg-cyan-50"
            >
              Show all patients
            </button>
          </div>
        ) : null}

        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500 border-b bg-slate-50/80"
                  style={{ borderColor: 'rgba(0,0,0,0.06)' }}
                >
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Doctor</th>
                  <th className="px-4 py-3 min-w-[200px]">Tests</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 min-w-[220px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500 font-semibold">
                      Loading…
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500 font-semibold">
                      {uhidFilter ? 'No matching pending rows for this UHID.' : 'No advised tests waiting for billing'}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r, idx) => (
                    <tr
                      key={r.id}
                      ref={uhidFilter && idx === 0 ? highlightRef : undefined}
                      className={`border-t border-gray-100 align-top hover:bg-slate-50/40 ${
                        uhidFilter && String(r.patientUhid || '').toLowerCase() === uhidFilter.toLowerCase()
                          ? 'bg-cyan-50/80 ring-1 ring-cyan-200'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        <span className="block">{r.patient || '—'}</span>
                        {r.patientUhid ? (
                          <span className="block text-[11px] font-mono text-gray-500 mt-0.5">{r.patientUhid}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-gray-800">{r.doctor || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <ul className="space-y-0.5">
                          {(r.tests || []).map((t, i) => (
                            <li key={i} className="text-xs sm:text-sm">
                              {t.name}{' '}
                              <span className="text-gray-500 font-mono">({money(t.price)})</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-gray-900 tabular-nums">
                        {money(r.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => setViewRow(r)}
                            className="px-3 py-2 rounded-xl text-xs font-extrabold border bg-white hover:bg-slate-50 whitespace-nowrap"
                            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            title="Generate bill & send to lab"
                            onClick={() => confirm(r.id, r)}
                            disabled={actingId != null}
                            className="px-3 py-2 rounded-xl text-xs font-extrabold text-white disabled:opacity-50 shadow-sm whitespace-nowrap"
                            style={{ background: '#00AEEF' }}
                          >
                            {actingId === r.id ? '…' : 'Bill & Lab'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {viewRow ? (
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lab-advice-view-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setViewRow(null);
            }}
          >
            <div
              className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
              style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b"
                style={{ borderColor: 'rgba(0,0,0,0.06)' }}
              >
                <div>
                  <h2 id="lab-advice-view-title" className="text-base font-extrabold text-gray-900">
                    Advised lab tests
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">Review line items and prices, then bill to send the order to lab.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewRow(null)}
                  className="shrink-0 p-2 rounded-xl hover:bg-slate-100 text-gray-600"
                  aria-label="Close"
                >
                  <MdClose className="text-xl" />
                </button>
              </div>
              <div className="px-4 sm:px-5 py-4 overflow-y-auto space-y-4">
                <div className="rounded-xl border p-3 text-sm space-y-1.5" style={{ borderColor: 'rgba(0,0,0,0.08)', background: '#f8fafc' }}>
                  <p>
                    <span className="text-gray-500 font-semibold">Patient</span>{' '}
                    <span className="font-bold text-gray-900">{viewRow.patient || '—'}</span>
                    {viewRow.patientUhid ? (
                      <span className="block text-xs font-mono text-gray-600 mt-0.5">{viewRow.patientUhid}</span>
                    ) : null}
                  </p>
                  <p>
                    <span className="text-gray-500 font-semibold">Doctor</span>{' '}
                    <span className="font-semibold text-gray-900">{viewRow.doctor || '—'}</span>
                  </p>
                  {viewRow.createdAt ? (
                    <p className="text-xs text-gray-500">
                      Advised on {new Date(viewRow.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500 border-b border-gray-100">
                        <th className="px-3 py-2">Test</th>
                        <th className="px-3 py-2 text-right w-28">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewRow.tests || []).map((t, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-3 py-2.5 font-medium text-gray-900">{t.name}</td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-gray-800">{money(t.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-slate-50/80">
                        <td className="px-3 py-3 font-extrabold text-gray-900">Total</td>
                        <td className="px-3 py-3 text-right font-extrabold tabular-nums text-gray-900">{money(viewRow.totalAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => printPreviewFromRow(viewRow)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-extrabold border bg-white hover:bg-slate-50"
                    style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  >
                    Print estimate (slip)
                  </button>
                  <button
                    type="button"
                    onClick={() => confirm(viewRow.id, viewRow, { closeModalOnSuccess: true })}
                    disabled={actingId != null}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white disabled:opacity-50 shadow-sm"
                    style={{ background: '#00AEEF' }}
                  >
                    {actingId === viewRow.id ? 'Working…' : 'Generate bill & send to lab'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  After you confirm, a lab order is created for technicians, a bill is registered, and the official lab bill slip opens for printing (same layout as OPD billing).
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
