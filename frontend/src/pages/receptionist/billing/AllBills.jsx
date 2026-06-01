import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  MdSearch,
  MdFilterList,
  MdReceiptLong,
  MdCalendarToday,
  MdPrint,
  MdPayments,
  MdClose,
  MdRefresh,
  MdTrendingUp,
  MdCheckCircle,
  MdHourglassEmpty,
} from 'react-icons/md';
import api from '../../../utils/api';
import { printBillingSlip } from '../../../utils/printBillingSlip';
import '../patients/PatientList.css';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
const selectCls = 'pl-select w-full';

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const STATUS_META = {
  Paid: { bg: '#dcfce7', text: '#14532d', dot: '#22c55e' },
  Partial: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  Pending: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
};

const initialFilters = {
  datePreset: 'all',
  dateFrom: '',
  dateTo: '',
  visitType: '',
  paymentStatus: '',
  paymentMode: '',
};

export default function AllBills() {
  const navigate = useNavigate();
  const todayISO = toISODate(new Date());

  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState({
    revenueToday: 0,
    revenueMonth: 0,
    paidCount: 0,
    partialCount: 0,
    pendingCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(initialFilters);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentBill, setPaymentBill] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [paySubmitting, setPaySubmitting] = useState(false);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      let dateFrom = filters.dateFrom;
      let dateTo = filters.dateTo;
      if (filters.datePreset === 'today') {
        dateFrom = todayISO;
        dateTo = todayISO;
      }
      const params = {
        q: searchQuery.trim() || undefined,
        visitType: filters.visitType || undefined,
        paymentStatus: filters.paymentStatus || undefined,
        paymentMode: filters.paymentMode || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };
      const res = await api.get('/receptionist/billing', { params });
      setBills(Array.isArray(res.data?.items) ? res.data.items : []);
      if (res.data?.summary) setSummary(res.data.summary);
    } catch {
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters, todayISO]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleSearch = (value) => {
    setSearchQuery(value);
  };

  const handleFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleViewBill = async (row) => {
    setDetailOpen(true);
    setSelectedBill(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/receptionist/billing/${row.id}`);
      setSelectedBill(res.data || null);
    } catch {
      setSelectedBill(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePrintBill = async (rowOrBill) => {
    const b = rowOrBill || selectedBill;
    if (!b) return;
    await printBillingSlip({
      billId: b.billNumber || b.id,
      data: {
        visitType: b.visitType,
        billNumber: b.billNumber || b.id,
        patientName: b.patientName,
        uhid: b.uhid,
        mobile: b.mobile,
        doctorName: b.doctorName,
        createdAt: b.date || b.createdAt,
        items: b.items || [],
        totals: {
          subtotal: b.subtotal,
          discount: b.discount,
          taxAmt: b.tax,
          total: b.total,
          paid: b.paid,
          pending: b.pending,
        },
        paymentMode: b.paymentMode,
        paymentStatus: b.paymentStatus,
        notes: b.notes,
      },
    });
  };

  const openPayment = (row) => {
    setPaymentBill(row);
    setPayAmount(row.pending > 0 ? String(row.pending) : '');
    setPayMode(row.paymentMode || 'Cash');
    setPaymentOpen(true);
  };

  const handleAddPayment = async () => {
    if (!paymentBill) return;
    const amt = Math.max(0, Math.round(Number(payAmount) || 0));
    if (amt <= 0) return;
    setPaySubmitting(true);
    try {
      const billId = paymentBill.id;
      await api.post(`/receptionist/billing/${billId}/payments`, {
        amount: amt,
        mode: payMode,
      });
      setPaymentOpen(false);
      setPaymentBill(null);
      await fetchBills();
      if (selectedBill?.id === billId) {
        setDetailLoading(true);
        try {
          const res = await api.get(`/receptionist/billing/${billId}`);
          setSelectedBill(res.data || null);
        } finally {
          setDetailLoading(false);
        }
      }
    } finally {
      setPaySubmitting(false);
    }
  };

  const formatRowDate = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-100/50 to-gray-50 min-h-0">
      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: 'Revenue (today)',
              value: `₹${Number(summary.revenueToday || 0).toLocaleString('en-IN')}`,
              sub: 'Collected today',
              icon: MdTrendingUp,
              bg: '#0f2d5e',
              light: '#dbeafe',
            },
            {
              label: 'Revenue (month)',
              value: `₹${summary.revenueMonth.toLocaleString('en-IN')}`,
              sub: 'Collected this month',
              icon: MdReceiptLong,
              bg: '#14532d',
              light: '#dcfce7',
            },
            {
              label: 'Paid bills',
              value: summary.paidCount ?? 0,
              sub: 'Fully paid',
              icon: MdCheckCircle,
              bg: '#1d4ed8',
              light: '#dbeafe',
            },
            {
              label: 'Partial / Pending',
              value: `${summary.partialCount ?? 0} / ${summary.pendingCount ?? 0}`,
              sub: 'Needs follow-up',
              icon: MdHourglassEmpty,
              bg: '#92400e',
              light: '#ffedd5',
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: s.light }}>
                    <Icon className="h-5 w-5" style={{ color: s.bg }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold text-gray-900 leading-tight sm:text-xl">{s.value}</p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-600 truncate">{s.label}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400 truncate">{s.sub}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Search + filters */}
        <div className="overflow-visible rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-extrabold text-gray-500">
            <MdFilterList className="h-4 w-4" />
            Search & filters
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="relative lg:col-span-4">
              <MdSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Patient name / UHID / Bill ID"
                className={`${inputCls} pl-9`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:col-span-8">
              <select
                className={selectCls}
                value={filters.datePreset}
                onChange={(e) => {
                  const v = e.target.value;
                  handleFilter('datePreset', v);
                  if (v === 'today' || v === 'all') {
                    handleFilter('dateFrom', '');
                    handleFilter('dateTo', '');
                  }
                }}
              >
                <option value="all">All dates</option>
                <option value="today">Today</option>
                <option value="custom">Custom range</option>
              </select>
              <select
                className={selectCls}
                value={filters.visitType}
                onChange={(e) => handleFilter('visitType', e.target.value)}
              >
                <option value="">Visit: All</option>
                <option value="OPD">OPD</option>
                <option value="IPD">IPD</option>
              </select>
              <select
                className={selectCls}
                value={filters.paymentStatus}
                onChange={(e) => handleFilter('paymentStatus', e.target.value)}
              >
                <option value="">Status: All</option>
                <option value="Paid">Paid</option>
                <option value="Partial">Partial</option>
                <option value="Pending">Pending</option>
              </select>
              <select
                className={selectCls}
                value={filters.paymentMode}
                onChange={(e) => handleFilter('paymentMode', e.target.value)}
              >
                <option value="">Mode: All</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
              </select>
            </div>
          </div>
          {filters.datePreset === 'custom' ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilter('dateFrom', e.target.value)}
                className={inputCls + ' max-w-[200px]'}
              />
              <span className="self-center text-gray-400">to</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilter('dateTo', e.target.value)}
                className={inputCls + ' max-w-[200px]'}
              />
            </div>
          ) : null}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
            <p className="text-sm font-extrabold text-gray-900">Billing records</p>
            <button
              type="button"
              onClick={() => fetchBills()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-extrabold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <MdRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <div className="max-h-[min(70vh,640px)] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr
                  className="sticky top-0 z-[1] border-b border-gray-200 shadow-sm"
                  style={{ background: '#f8faff' }}
                >
                  {[
                    'Bill ID',
                    'Patient',
                    'UHID',
                    'Visit',
                    'Total',
                    'Paid',
                    'Pending',
                    'Status',
                    'Mode',
                    'Date',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 lg:px-4"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-14 text-center text-gray-400">
                      Loading bills…
                    </td>
                  </tr>
                ) : (
                  bills.map((b) => {
                    const st = STATUS_META[b.paymentStatus] || STATUS_META.Pending;
                    return (
                      <tr
                        key={b.id}
                        className="transition hover:bg-blue-50/40"
                      >
                        <td className="px-3 py-3 align-top lg:px-4">
                          <span className="font-mono text-xs font-bold text-blue-600">{b.billNumber || b.id}</span>
                        </td>
                        <td className="px-3 py-3 align-top font-semibold text-gray-900">{b.patientName}</td>
                        <td className="px-3 py-3 align-top font-mono text-xs font-semibold text-blue-700">{b.uhid}</td>
                        <td className="px-3 py-3 align-top">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                              b.visitType === 'IPD' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {b.visitType}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top font-extrabold text-gray-900">
                          ₹{b.total.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-3 align-top font-semibold text-gray-800">
                          ₹{b.paid.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-3 align-top font-extrabold text-gray-900">
                          ₹{b.pending.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700 whitespace-nowrap">
                            <span className="pl-dot" style={{ background: st.dot }} />
                            {b.paymentStatus}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-gray-600">{b.paymentMode}</td>
                        <td className="px-3 py-3 align-top whitespace-nowrap text-xs text-gray-600">
                          <span className="inline-flex items-center gap-1">
                            <MdCalendarToday className="h-3.5 w-3.5 text-blue-400" />
                            {formatRowDate(b.date)}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                            <button
                              type="button"
                              title="View bill"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewBill(b);
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              title="Add payment"
                              disabled={b.pending <= 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPayment(b);
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-extrabold border border-blue-200 text-blue-800 bg-blue-50 hover:bg-blue-100 transition disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              Payment
                            </button>
                            <button
                              type="button"
                              title="Print invoice"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintBill(b);
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                            >
                              Print
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
          {!loading && bills.length === 0 ? (
            <div className="border-t border-gray-50 py-14 text-center text-gray-400">
              <MdReceiptLong className="mx-auto mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">No bills found</p>
              <p className="mt-1 text-xs text-gray-400">Adjust search or filters</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Detail modal */}
      {detailOpen
        ? createPortal(
            <div className="pl-modalOverlay" role="dialog" aria-modal="true">
              <div className="pl-modal pl-modalAnimate max-h-[90vh] max-w-[820px] overflow-y-auto">
                <div className="pl-modalHeader">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      {detailLoading ? 'Loading…' : selectedBill?.billNumber || selectedBill?.id || 'Bill'}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {selectedBill ? `${selectedBill.patientName} · ${selectedBill.uhid}` : ''}
                    </p>
                  </div>
                  <button type="button" className="pl-modalClose" onClick={() => setDetailOpen(false)} title="Close">
                    <MdClose className="h-5 w-5" />
                  </button>
                </div>
                <div className="pl-modalBody">
                  {detailLoading ? (
                    <p className="py-8 text-center text-gray-400">Loading bill…</p>
                  ) : selectedBill ? (
                    <>
                      <div className="pl-modalGrid">
                        <div className="pl-modalCard">
                          <p className="pl-modalCardTitle">Patient</p>
                          <div className="pl-kv">
                            <div>
                              <p className="k">Name</p>
                              <p className="v">{selectedBill.patientName}</p>
                            </div>
                            <div>
                              <p className="k">UHID</p>
                              <p className="v font-mono">{selectedBill.uhid}</p>
                            </div>
                            <div>
                              <p className="k">Visit</p>
                              <p className="v">{selectedBill.visitType}</p>
                            </div>
                            <div>
                              <p className="k">Date</p>
                              <p className="v">{formatRowDate(selectedBill.date)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="pl-modalCard">
                          <p className="pl-modalCardTitle">Amounts</p>
                          <div className="pl-kv">
                            <div>
                              <p className="k">Total</p>
                              <p className="v">₹{selectedBill.total.toLocaleString('en-IN')}</p>
                            </div>
                            <div>
                              <p className="k">Paid</p>
                              <p className="v text-emerald-800">₹{selectedBill.paid.toLocaleString('en-IN')}</p>
                            </div>
                            <div>
                              <p className="k">Pending</p>
                              <p className="v text-amber-800">₹{selectedBill.pending.toLocaleString('en-IN')}</p>
                            </div>
                            <div>
                              <p className="k">Mode</p>
                              <p className="v">{selectedBill.paymentMode}</p>
                            </div>
                          </div>
                        </div>
                        <div className="pl-modalCard" style={{ gridColumn: '1 / -1' }}>
                          <p className="pl-modalCardTitle">Line items</p>
                          <div className="overflow-x-auto rounded-xl border border-gray-100">
                            <table className="w-full min-w-[400px] text-xs">
                              <thead>
                                <tr className="bg-slate-50 text-left text-gray-500">
                                  <th className="px-3 py-2">Item</th>
                                  <th className="px-3 py-2">Qty</th>
                                  <th className="px-3 py-2">Price</th>
                                  <th className="px-3 py-2 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {(selectedBill.items || []).map((it, i) => (
                                  <tr key={i}>
                                    <td className="px-3 py-2 font-semibold text-gray-800">{it.name}</td>
                                    <td className="px-3 py-2">{it.qty}</td>
                                    <td className="px-3 py-2">₹{it.price}</td>
                                    <td className="px-3 py-2 text-right font-extrabold">₹{it.total}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="pl-modalCard" style={{ gridColumn: '1 / -1' }}>
                          <p className="pl-modalCardTitle">Payment history</p>
                          {(selectedBill.payments || []).length ? (
                            <ul className="space-y-2 text-sm">
                              {selectedBill.payments.map((p, i) => (
                                <li
                                  key={i}
                                  className="flex flex-wrap justify-between gap-2 rounded-lg border border-gray-100 bg-slate-50/80 px-3 py-2"
                                >
                                  <span className="text-gray-600">
                                    {new Date(p.date).toLocaleString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                  <span className="font-extrabold text-emerald-800">₹{p.amount.toLocaleString('en-IN')}</span>
                                  <span className="text-xs text-gray-500">
                                    {p.mode} · {p.by}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-400">No payments recorded</p>
                          )}
                        </div>
                      </div>
                      <div className="pl-modalActions">
                        <button type="button" className="pl-actionBtn" onClick={() => selectedBill && openPayment(selectedBill)}>
                          <MdPayments className="h-4 w-4" />
                          Add payment
                        </button>
                        <button type="button" className="pl-actionBtn" onClick={() => handlePrintBill(selectedBill)}>
                          <MdPrint className="h-4 w-4" />
                          Print
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-center text-gray-500">Bill not found</p>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Payment modal */}
      {paymentOpen && paymentBill
        ? createPortal(
            <div className="pl-modalOverlay" role="dialog" aria-modal="true">
              <div className="pl-modal pl-modalAnimate max-w-[440px]">
                <div className="pl-modalHeader">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Add payment</p>
                    <p className="text-xs text-gray-500">
                      {paymentBill.billNumber || paymentBill.id} · Pending ₹{paymentBill.pending.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="pl-modalClose"
                    onClick={() => {
                      setPaymentOpen(false);
                      setPaymentBill(null);
                    }}
                  >
                    <MdClose className="h-5 w-5" />
                  </button>
                </div>
                <div className="pl-modalBody space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-extrabold text-gray-600">Amount (₹)</label>
                    <input
                      type="number"
                      min={1}
                      max={paymentBill.pending}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-extrabold text-gray-600">Mode</label>
                    <select className={selectCls} value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                      {['Cash', 'UPI', 'Card'].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-gray-400">Payment is saved to the hospital billing ledger.</p>
                  <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <button
                      type="button"
                      className="pl-actionBtn"
                      onClick={() => {
                        setPaymentOpen(false);
                        setPaymentBill(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
                      disabled={paySubmitting || Number(payAmount) <= 0 || Number(payAmount) > paymentBill.pending}
                      onClick={handleAddPayment}
                    >
                      {paySubmitting ? 'Saving…' : 'Record payment'}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
