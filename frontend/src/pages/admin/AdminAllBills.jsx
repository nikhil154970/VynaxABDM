import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MdSearch, MdFilterList, MdReceiptLong, MdCalendarToday,
  MdPrint, MdClose, MdRefresh, MdTrendingUp, MdCheckCircle,
  MdHourglassEmpty, MdScience, MdLocalHospital,
} from 'react-icons/md';
import api from '../../utils/api';
import { printBillingSlip } from '../../utils/printBillingSlip';

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
const selectCls = 'text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700';

const CATEGORY_BADGE = {
  OPD: { bg: '#eff6ff', text: '#1d4ed8' },
  IPD: { bg: '#f0fdf4', text: '#15803d' },
  LAB: { bg: '#fefce8', text: '#a16207' },
  OT: { bg: '#fdf2f8', text: '#9d174d' },
};

const STATUS_META = {
  Paid: { bg: '#dcfce7', text: '#14532d', dot: '#22c55e' },
  Partial: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  Pending: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
  Cancelled: { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af' },
};

function billPaidFromPayments(bill) {
  const payments = Array.isArray(bill?.payments) ? bill.payments : [];
  return payments.reduce((s, p) => s + Math.max(0, Number(p?.amount) || 0), 0);
}

function billDetailAmounts(bill) {
  const total = Math.max(0, Number(bill?.total) || 0);
  const paidByPayments = billPaidFromPayments(bill);
  const paidRaw = Math.max(0, Number(bill?.paid) || 0);
  const paid = Math.max(paidRaw, paidByPayments);
  const pending = Math.max(0, Math.round(total - paid));
  return { total, paid, pending };
}

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDateRange(preset) {
  const now = new Date();
  if (preset === 'today') {
    const s = toISODate(now);
    return { dateFrom: s, dateTo: s };
  }
  if (preset === 'week') {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { dateFrom: toISODate(from), dateTo: toISODate(now) };
  }
  if (preset === 'month') {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { dateFrom: toISODate(from), dateTo: toISODate(now) };
  }
  return { dateFrom: '', dateTo: '' };
}

export default function AdminAllBills() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bills, setBills] = useState([]);
  const [apiSummary, setApiSummary] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [visitType, setVisitType] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [category, setCategory] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let df = dateFrom;
      let dt = dateTo;
      if (datePreset !== 'custom') {
        const range = getDateRange(datePreset);
        df = range.dateFrom;
        dt = range.dateTo;
      }
      const params = {
        q: searchQuery.trim() || undefined,
        visitType: visitType || undefined,
        paymentStatus: paymentStatus || undefined,
        paymentMode: paymentMode || undefined,
        category: category || undefined,
        dateFrom: df || undefined,
        dateTo: dt || undefined,
      };
      const res = await api.get('/admin/finance/bills', { params, silent: true });
      setBills(Array.isArray(res.data?.items) ? res.data.items : []);
      setApiSummary(res.data?.summary || null);
    } catch (e) {
      setBills([]);
      setApiSummary(null);
      setError(e?.response?.data?.message || 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, datePreset, dateFrom, dateTo, visitType, paymentStatus, paymentMode, category]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const filteredBills = bills;

  const summary = useMemo(() => {
    const s = apiSummary || {};
    return {
      total: s.total ?? bills.length,
      paid: s.paidCount ?? bills.filter((b) => b.paymentStatus === 'Paid').length,
      partial: s.partialCount ?? bills.filter((b) => b.paymentStatus === 'Partial').length,
      pending: s.pendingCount ?? bills.filter((b) => b.paymentStatus === 'Pending').length,
      totalCollected: s.totalCollected ?? bills.reduce((acc, b) => acc + (b.paid || 0), 0),
      totalBilled: s.totalBilled ?? bills.reduce((acc, b) => acc + (b.total || 0), 0),
      totalPending: s.totalPending ?? bills.reduce((acc, b) => acc + (b.pending || 0), 0),
      revenueToday: s.revenueToday ?? 0,
      revenueMonth: s.revenueMonth ?? 0,
    };
  }, [apiSummary, bills]);

  const handleViewBill = async (row) => {
    setDetailOpen(true);
    setSelectedBill(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/receptionist/billing/${row.id}`, { silent: true });
      setSelectedBill(res.data || null);
    } catch {
      setSelectedBill(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePrintBill = async (row) => {
    let billData = row;
    if (!billData.items) {
      try {
        const res = await api.get(`/receptionist/billing/${row.id}`, { silent: true });
        billData = res.data || row;
      } catch {
        return;
      }
    }
    await printBillingSlip({
      billId: billData.billNumber || billData.id,
      data: {
        visitType: billData.visitType,
        billNumber: billData.billNumber || billData.id,
        patientName: billData.patientName,
        uhid: billData.uhid,
        mobile: billData.mobile || '',
        doctorName: billData.doctorName || '',
        createdAt: billData.date || billData.createdAt,
        items: billData.items || [],
        totals: {
          subtotal: billData.subtotal || billData.total,
          discount: billData.discount || 0,
          taxAmt: billData.tax || 0,
          total: billData.total,
          paid: billData.paid,
          pending: billData.pending,
        },
        paymentMode: billData.paymentMode,
        paymentStatus: billData.paymentStatus,
        notes: billData.notes || '',
      },
    });
  };

  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const range = getDateRange(preset);
      setDateFrom(range.dateFrom);
      setDateTo(range.dateTo);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setVisitType('');
    setPaymentStatus('');
    setPaymentMode('');
    setCategory('');
  };

  const hasActiveFilters = searchQuery || datePreset !== 'all' || visitType || paymentStatus || paymentMode || category;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">All Bills</h1>
          <p className="text-xs text-gray-400 mt-1">
            {summary.total} bills · ₹{summary.totalCollected.toLocaleString('en-IN')} collected · ₹{summary.totalPending.toLocaleString('en-IN')} pending
          </p>
        </div>
        <button
          type="button"
          onClick={fetchBills}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
        >
          <MdRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={fetchBills} className="ml-3 text-xs font-semibold underline">Retry</button>
        </div>
      ) : null}

      {loading && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Loading bills…
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Bills', value: summary.total, Icon: MdReceiptLong, color: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
          { label: 'Collected (filtered)', value: `₹${summary.totalCollected.toLocaleString('en-IN')}`, Icon: MdTrendingUp, color: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
          { label: 'Pending (filtered)', value: `₹${summary.totalPending.toLocaleString('en-IN')}`, Icon: MdHourglassEmpty, color: '#fee2e2', border: '#fecaca', text: '#dc2626' },
          { label: 'Paid', value: summary.paid, Icon: MdCheckCircle, color: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
          { label: 'Partial', value: summary.partial, Icon: MdHourglassEmpty, color: '#fefce8', border: '#fde68a', text: '#a16207' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition"
            style={{ borderColor: s.border }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl" style={{ color: '#0077B6' }}>
                <s.Icon className="w-6 h-6" />
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs font-semibold text-gray-500">
          <MdFilterList className="w-4 h-4" />
          Search & filters
          {hasActiveFilters ? (
            <button type="button" onClick={clearFilters} className="ml-2 text-blue-600 hover:underline">
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-4">
            <MdSearch className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bill no. / patient / UHID"
              className={`${inputCls} pl-9`}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:col-span-8 gap-2">
            <select
              className={selectCls}
              value={datePreset}
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              <option value="all">All dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom</option>
            </select>
            <select className={selectCls} value={visitType} onChange={(e) => setVisitType(e.target.value)}>
              <option value="">Visit: All</option>
              <option value="OPD">OPD</option>
              <option value="IPD">IPD</option>
            </select>
            <select className={selectCls} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="">Status: All</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Pending">Pending</option>
            </select>
            <select className={selectCls} value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              <option value="">Mode: All</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
            </select>
          </div>
        </div>

        {datePreset === 'custom' ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls + ' max-w-[200px]'} />
            <span className="self-center text-xs text-gray-400">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls + ' max-w-[200px]'} />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">Category:</span>
          {['', 'OPD', 'IPD', 'LAB', 'OT'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? '' : c)}
              className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition ${
                category === c
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              {c || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Bill No.', 'Patient', 'UHID', 'Category', 'Visit', 'Total', 'Paid', 'Pending', 'Status', 'Mode', 'Date', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={12} className="px-4 py-14 text-center text-gray-400">Loading bills…</td></tr>
              ) : filteredBills.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-14 text-center text-gray-400">
                  <MdReceiptLong className="mx-auto mb-2 w-10 h-10 opacity-30" />
                  <p className="text-sm font-medium">No bills found</p>
                  <p className="text-xs text-gray-400 mt-1">Adjust search or filters</p>
                </td></tr>
              ) : filteredBills.map((b) => {
                const st = STATUS_META[b.paymentStatus] || STATUS_META.Pending;
                const cat = CATEGORY_BADGE[b.category] || { bg: '#f3f4f6', text: '#374151' };
                return (
                  <tr key={b.id} className="hover:bg-blue-50/40 transition">
                    <td className="px-4 py-3"><span className="font-mono text-xs font-bold text-blue-600">{b.billNumber || b.id}</span></td>
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{b.patientName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{b.uhid}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: cat.bg, color: cat.text }}>
                        {b.category === 'LAB' ? <MdScience className="w-3 h-3" /> : b.category === 'OT' ? <MdLocalHospital className="w-3 h-3" /> : null}
                        {b.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        b.visitType === 'IPD' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-800'
                      }`}>{b.visitType}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">₹{b.total.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-gray-800">₹{b.paid.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">₹{b.pending.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap" style={{ color: st.text }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                        {b.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{b.paymentMode}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <MdCalendarToday className="w-3.5 h-3.5 text-blue-400" />
                        {b.date ? new Date(`${b.date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <button type="button" onClick={() => handleViewBill(b)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition">View</button>
                        <button type="button" onClick={() => handlePrintBill(b)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition flex items-center gap-1"><MdPrint className="w-3 h-3" /> Print</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detailOpen ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => { if (!detailLoading) setDetailOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[820px] max-h-[90vh] overflow-y-auto mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  {detailLoading ? 'Loading…' : selectedBill?.billNumber || selectedBill?.id || 'Bill'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {selectedBill ? `${selectedBill.patientName} · ${selectedBill.uhid}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setDetailOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 transition">
                <MdClose className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {detailLoading ? (
                <p className="py-8 text-center text-gray-400">Loading bill…</p>
              ) : selectedBill ? (() => {
                const amounts = billDetailAmounts(selectedBill);
                return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase">Patient</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-500 text-xs">Name</span><p className="font-medium text-gray-900">{selectedBill.patientName}</p></div>
                        <div><span className="text-gray-500 text-xs">UHID</span><p className="font-mono font-medium text-gray-900">{selectedBill.uhid}</p></div>
                        <div><span className="text-gray-500 text-xs">Mobile</span><p className="font-medium text-gray-900">{selectedBill.mobile || '—'}</p></div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase">Bill Info</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-500 text-xs">Visit</span><p className="font-medium text-gray-900">{selectedBill.visitType}</p></div>
                        <div><span className="text-gray-500 text-xs">Date</span><p className="font-medium text-gray-900">{selectedBill.date ? new Date(`${selectedBill.date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p></div>
                        <div><span className="text-gray-500 text-xs">Status</span><p className="font-medium">{selectedBill.paymentStatus}</p></div>
                        <div><span className="text-gray-500 text-xs">Mode</span><p className="font-medium text-gray-900">{selectedBill.paymentMode}</p></div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Amounts</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Subtotal', value: selectedBill.subtotal != null ? selectedBill.subtotal : selectedBill.total },
                        { label: 'Discount', value: selectedBill.discount || 0 },
                        { label: 'Tax', value: selectedBill.tax || 0 },
                      ].map((x) => (
                        <div key={x.label} className="bg-white rounded-lg p-3">
                          <p className="text-xs text-gray-500">{x.label}</p>
                          <p className="text-lg font-bold text-gray-900">₹{x.value.toLocaleString('en-IN')}</p>
                        </div>
                      ))}
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-semibold">Total</p>
                        <p className="text-lg font-bold text-blue-700">₹{selectedBill.total.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3">
                        <p className="text-xs text-emerald-600 font-semibold">Paid</p>
                        <p className="text-lg font-bold text-emerald-700">₹{amounts.paid.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-3">
                        <p className="text-xs text-amber-600 font-semibold">Pending</p>
                        <p className="text-lg font-bold text-amber-700">₹{amounts.pending.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Line Items</h3>
                    {selectedBill.items && selectedBill.items.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                        <table className="w-full min-w-[400px] text-xs">
                          <thead><tr className="bg-gray-50 text-left text-gray-500"><th className="px-3 py-2">Item</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Price</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                          <tbody className="divide-y divide-gray-50">
                            {(selectedBill.items || []).map((it, i) => (
                              <tr key={i}><td className="px-3 py-2 font-medium text-gray-800">{it.name}</td><td className="px-3 py-2">{it.qty}</td><td className="px-3 py-2">₹{it.price}</td><td className="px-3 py-2 text-right font-semibold">₹{it.total}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="text-sm text-gray-400">No line items</p>}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Payment History</h3>
                    {selectedBill.payments && selectedBill.payments.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedBill.payments.map((p, i) => (
                          <li key={i} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white border border-gray-100 px-3 py-2 text-sm">
                            <span className="text-gray-500 text-xs">
                              {new Date(p.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="font-bold text-emerald-700">₹{p.amount.toLocaleString('en-IN')}</span>
                            <span className="text-xs text-gray-500">{p.mode} · {p.by || '—'}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-sm text-gray-400">No payments recorded</p>}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => handlePrintBill(selectedBill)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition">
                      <MdPrint className="w-4 h-4" /> Print
                    </button>
                  </div>
                </>
              );})() : (
                <p className="text-center text-gray-500">Bill not found</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
