import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MdAdd, MdPrint, MdRefresh, MdSearch } from 'react-icons/md';
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

function statusLabel(s) {
  const v = String(s || '').toUpperCase();
  if (v === 'PAID') return 'Paid';
  if (v === 'PARTIAL') return 'Partial';
  if (v === 'PENDING') return 'Pending';
  return s || '—';
}

export default function AllLabBills() {
  const location = useLocation();
  const flash = location.state?.flash;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/lab/receptionist/bills', { params: search.trim() ? { q: search.trim() } : {} });
      setRows(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      setRows([]);
      setError(e?.response?.data?.message || 'Failed to load lab bills');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => load(), search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const reprint = (row) => {
    const p = row.patient || {};
    const isAyushman = String(row.paymentMode || '')
      .toLowerCase()
      .includes('ayushman');
    const gross = (row.tests || []).reduce((s, t) => s + Math.max(0, Number(t.price) || 0), 0);
    printLabBillSlip({
      patientName: p.name,
      patientUhid: p.uhid,
      sponsor: isAyushman ? 'AYUSHMAN' : '',
      isAyushman,
      doctorName: row.doctorName,
      tests: row.tests || [],
      totalAmount: row.totalAmount,
      grossTotalAmount: gross || row.totalAmount,
      mode: 'issued',
      billNumber: row.billNumber,
      orderNumber: row.orderNumber,
      paidAmount: row.paidAmount ?? row.totalAmount,
      paymentStatus: isAyushman ? 'PAID' : row.paymentStatus,
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
            <h1 className="text-lg font-extrabold text-gray-900">All lab billing</h1>
            <p className="text-xs text-gray-500 mt-1">Sabhi lab bills — OPD advice, reception direct, aur doctor orders</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/dashboard/reception/lab/create-bill"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-extrabold text-white"
              style={{ background: '#00AEEF' }}
            >
              <MdAdd className="text-lg" /> Create new bill
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

        {flash ? (
          <div className="rounded-xl px-4 py-3 text-sm font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
            {flash}
          </div>
        ) : null}

        <div className="relative">
          <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm bg-white"
            placeholder="Search patient, UHID, bill no., order no…"
            style={{ borderColor: 'rgba(0,0,0,0.1)' }}
          />
        </div>

        {error ? (
          <div className="rounded-xl px-4 py-3 text-sm font-semibold bg-red-50 text-red-800 border border-red-100">{error}</div>
        ) : null}

        <div className="rounded-2xl border overflow-hidden bg-white" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500 border-b bg-slate-50/80">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Bill / Order</th>
                  <th className="px-4 py-3">Tests</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500 font-semibold">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500 font-semibold">
                      No lab bills found
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
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 max-w-[220px]">
                          <ul className="space-y-0.5">
                            {(row.tests || []).slice(0, 4).map((t, i) => (
                              <li key={i}>{t.name}</li>
                            ))}
                            {(row.tests || []).length > 4 ? (
                              <li className="text-gray-400">+{(row.tests || []).length - 4} more</li>
                            ) : null}
                          </ul>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-extrabold tabular-nums">{money(row.totalAmount)}</p>
                          {(row.pendingAmount ?? 0) > 0 ? (
                            <p className="text-[10px] font-bold text-amber-700 mt-0.5">Due {money(row.pendingAmount)}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                              String(row.paymentStatus || '').toUpperCase() === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : (row.pendingAmount ?? 0) > 0
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-slate-100 text-gray-700'
                            }`}
                          >
                            {statusLabel(row.paymentStatus)}
                          </span>
                          {row.paymentMode ? (
                            <p className="text-[10px] text-gray-500 mt-0.5">{row.paymentMode}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => reprint(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border bg-white hover:bg-slate-50"
                            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                          >
                            <MdPrint /> Print
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
