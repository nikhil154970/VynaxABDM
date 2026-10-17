import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  MdAdd,
  MdCall,
  MdCheckCircle,
  MdClose,
  MdFilterList,
  MdInfo,
  MdPayments,
  MdRefresh,
  MdSearch,
  MdSend,
  MdVisibility,
  MdWhatsapp,
} from 'react-icons/md';
import '../patients/PatientList.css';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
const selectCls = 'pl-select w-full';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDisplayDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysBetween(fromIso, toIso) {
  const a = new Date(`${fromIso}T12:00:00`);
  const b = new Date(`${toIso}T12:00:00`);
  const ms = b - a;
  return Number.isFinite(ms) ? Math.floor(ms / (24 * 60 * 60 * 1000)) : 0;
}

function calculateOverdueDays(dueDateIso) {
  const today = toISODate(new Date());
  const diff = daysBetween(dueDateIso, today);
  return Math.max(0, diff);
}

function deriveStatus(row) {
  if (!row || Number(row.pending || 0) <= 0) return 'Paid';
  const overdueDays = calculateOverdueDays(row.dueDate);
  return overdueDays > 0 ? 'Overdue' : 'Pending';
}

const STATUS_META = {
  Pending: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  Overdue: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
};

const PAYMENT_DUE_API = {
  // TODO: Replace with backend API (GET /payment-due)
  async getMock() {
    await wait(180);
    return [
      {
        id: 'DUE-001',
        patientName: 'Mohan Das',
        uhid: 'UH202604170987',
        billId: 'INV-2026-2403',
        visitType: 'IPD',
        total: 18500,
        paid: 10000,
        pending: 8500,
        dueDate: '2026-04-16',
        status: 'Overdue',
        history: [
          { amount: 5000, mode: 'Card', date: '2026-04-16T10:00:00' },
          { amount: 5000, mode: 'Card', date: '2026-04-17T15:30:00' },
        ],
        reminderLog: [{ channel: 'SMS', date: '2026-04-18T10:05:00' }],
      },
      {
        id: 'DUE-002',
        patientName: 'Sunita Gupta',
        uhid: 'UH202604160555',
        billId: 'INV-2026-2404',
        visitType: 'IPD',
        total: 24000,
        paid: 0,
        pending: 24000,
        dueDate: '2026-04-15',
        status: 'Overdue',
        history: [],
        reminderLog: [],
      },
      {
        id: 'DUE-003',
        patientName: 'Vijay Kumar',
        uhid: 'UH202604140312',
        billId: 'INV-2026-2407',
        visitType: 'IPD',
        total: 35000,
        paid: 20000,
        pending: 15000,
        dueDate: '2026-04-14',
        status: 'Overdue',
        history: [{ amount: 20000, mode: 'UPI', date: '2026-04-14T12:00:00' }],
        reminderLog: [{ channel: 'Call', date: '2026-04-19T11:20:00' }],
      },
      {
        id: 'DUE-004',
        patientName: 'Priya Singh',
        uhid: 'UH202604180124',
        billId: 'INV-2026-2402',
        visitType: 'OPD',
        total: 800,
        paid: 300,
        pending: 500,
        dueDate: '2026-04-20',
        status: 'Pending',
        history: [{ amount: 300, mode: 'Cash', date: '2026-04-20T10:10:00' }],
        reminderLog: [],
      },
      {
        id: 'DUE-005',
        patientName: 'Ravi Kumar',
        uhid: 'UH202604180123',
        billId: 'INV-2026-2401',
        visitType: 'OPD',
        total: 1200,
        paid: 700,
        pending: 500,
        dueDate: '2026-04-20',
        status: 'Pending',
        history: [{ amount: 700, mode: 'UPI', date: '2026-04-20T09:50:00' }],
        reminderLog: [],
      },
    ];
  },
};

function Section({ icon: Icon, title, subtitle, headerRight, children }) {
  return (
    <div className="w-full overflow-visible rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-[#f8faff] via-white to-slate-50/40 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-gradient-to-br from-blue-100 to-indigo-50 text-blue-700 shadow-sm">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold tracking-tight text-gray-900">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p> : null}
          </div>
        </div>
        {headerRight}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function formatDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PaymentDue() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: 'All',
    visitType: 'All',
    from: '',
    to: '',
    onlyOverdue: false,
    sort: 'highest_due',
  });

  const [summary, setSummary] = useState({
    totalDueAmount: 0,
    totalDuePatients: 0,
    overdueCount: 0,
    collectedToday: 0,
  });

  const [toast, setToast] = useState(null); // {type, message}

  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderRow, setReminderRow] = useState(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentRow, setPaymentRow] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await PAYMENT_DUE_API.getMock();
      setRows(
        list.map((r) => {
          const status = deriveStatus(r);
          return { ...r, status: status === 'Paid' ? r.status : status };
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    const { status, visitType, from, to, onlyOverdue, sort } = filters;

    let out = (rows || []).filter((r) => Number(r.pending || 0) > 0);

    if (q) {
      out = out.filter(
        (r) =>
          String(r.patientName || '').toLowerCase().includes(q) ||
          String(r.uhid || '').toLowerCase().includes(q) ||
          String(r.billId || '').toLowerCase().includes(q),
      );
    }

    if (onlyOverdue) out = out.filter((r) => deriveStatus(r) === 'Overdue');
    if (status !== 'All') out = out.filter((r) => deriveStatus(r) === status);
    if (visitType !== 'All') out = out.filter((r) => r.visitType === visitType);

    if (from) out = out.filter((r) => String(r.dueDate || '') >= String(from));
    if (to) out = out.filter((r) => String(r.dueDate || '') <= String(to));

    const dueAmt = (r) => Number(r.pending || 0);
    const oldest = (r) => calculateOverdueDays(r.dueDate);

    if (sort === 'highest_due') out.sort((a, b) => dueAmt(b) - dueAmt(a));
    if (sort === 'oldest_due') out.sort((a, b) => oldest(b) - oldest(a));

    return out;
  }, [rows, searchQuery, filters]);

  useEffect(() => {
    const totalDueAmount = (filteredRows || []).reduce((s, r) => s + Number(r.pending || 0), 0);
    const totalDuePatients = (filteredRows || []).length;
    const overdueCount = (filteredRows || []).filter((r) => deriveStatus(r) === 'Overdue').length;

    const todayISO = toISODate(new Date());
    const collectedToday = (rows || []).reduce((s, r) => {
      const hits = (r.history || []).filter((h) => String(h.date || '').startsWith(todayISO));
      return s + hits.reduce((ss, h) => ss + Number(h.amount || 0), 0);
    }, 0);

    setSummary({ totalDueAmount, totalDuePatients, overdueCount, collectedToday });
  }, [rows, filteredRows]);

  const openReminder = (r) => {
    setReminderRow(r);
    setReminderOpen(true);
  };

  const handleSendReminder = (channel) => {
    if (!reminderRow) return;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== reminderRow.id) return r;
        const entry = { channel, date: new Date().toISOString() };
        return { ...r, reminderLog: Array.isArray(r.reminderLog) ? [entry, ...r.reminderLog] : [entry] };
      }),
    );
    setReminderOpen(false);
    setReminderRow(null);
    setToast({ type: 'success', message: 'Reminder sent successfully' });
    setTimeout(() => setToast(null), 1800);
  };

  const openAddPayment = (r) => {
    setPaymentRow(r);
    setPaymentAmount('');
    setPaymentMode('Cash');
    setPaymentOpen(true);
  };

  const handleAddPayment = () => {
    if (!paymentRow) return;
    const amt = Math.max(0, Number(paymentAmount) || 0);
    if (!amt) return;

    setRows((prev) =>
      prev
        .map((r) => {
          if (r.id !== paymentRow.id) return r;
          const paidNext = Number(r.paid || 0) + amt;
          const pendingNext = Math.max(0, Number(r.total || 0) - paidNext);
          const histEntry = { amount: amt, mode: paymentMode, date: new Date().toISOString() };
          const next = {
            ...r,
            paid: paidNext,
            pending: pendingNext,
            history: Array.isArray(r.history) ? [histEntry, ...r.history] : [histEntry],
          };
          const st = deriveStatus(next);
          return { ...next, status: st === 'Paid' ? 'Paid' : st };
        })
        .filter((r) => Number(r.pending || 0) > 0),
    );

    setPaymentOpen(false);
    setPaymentRow(null);
    setToast({ type: 'success', message: 'Payment updated' });
    setTimeout(() => setToast(null), 1800);
  };

  const handleMarkAsPaid = (r) => {
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, paid: x.total, pending: 0, status: 'Paid' } : x)).filter((x) => Number(x.pending || 0) > 0));
    setToast({ type: 'success', message: 'Marked as paid' });
    setTimeout(() => setToast(null), 1600);
  };

  const handleViewDetails = (r) => {
    setDetailRow(r);
    setDetailOpen(true);
  };

  const closeAllModals = () => {
    setReminderOpen(false);
    setReminderRow(null);
    setPaymentOpen(false);
    setPaymentRow(null);
    setDetailOpen(false);
    setDetailRow(null);
  };

  const highPendingThreshold = 10000;

  return (
    <div className="w-full bg-gradient-to-b from-slate-100/50 to-gray-50 pb-24">
      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        {toast ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm ${
              toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MdCheckCircle className="h-5 w-5" />
                <span>{toast.message}</span>
              </div>
              <button type="button" onClick={() => setToast(null)} className="text-emerald-800/70 hover:text-emerald-900">
                <MdClose className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Due Amount', value: `₹${summary.totalDueAmount.toLocaleString('en-IN')}`, icon: MdPayments, bg: '#991b1b', light: '#fee2e2' },
            { label: 'Total Due Patients', value: summary.totalDuePatients, icon: MdFilterList, bg: '#0f2d5e', light: '#dbeafe' },
            { label: 'Overdue Payments', value: summary.overdueCount, icon: MdSend, bg: '#991b1b', light: '#fee2e2' },
            { label: 'Collected Today', value: `₹${summary.collectedToday.toLocaleString('en-IN')}`, icon: MdCheckCircle, bg: '#14532d', light: '#dcfce7' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.light }}>
                    <Icon className="w-5 h-5" style={{ color: s.bg }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-extrabold text-gray-900 leading-tight">{loading ? '—' : s.value}</p>
                    <p className="text-xs font-semibold text-gray-600 mt-0.5 truncate">{s.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Section
          icon={MdFilterList}
          title="Search & filters"
          subtitle="Find dues by patient, UHID or bill ID"
          headerRight={
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:bg-gray-50 transition"
                disabled={loading}
                title="Refresh"
              >
                <MdRefresh className="h-4 w-4" /> Refresh
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/reception/billing')}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:bg-gray-50 transition"
                title="All bills"
              >
                <MdInfo className="h-4 w-4" /> All bills
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/reception/billing/payments')}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:bg-gray-50 transition"
                title="Payments"
              >
                <MdPayments className="h-4 w-4" /> Payments
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:bg-gray-50 transition"
                onClick={() =>
                  setFilters((p) => ({
                    ...p,
                    status: 'All',
                    visitType: 'All',
                    from: '',
                    to: '',
                    onlyOverdue: false,
                    sort: 'highest_due',
                  }))
                }
                title="Reset filters"
              >
                <MdRefresh className="h-4 w-4" /> Reset
              </button>
            </div>
          }
        >
          <div className="flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[260px]">
              <MdSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Patient / UHID / Bill ID"
                className={`${inputCls} pl-10`}
                aria-label="Search"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[170px]">
                <p className="text-[11px] font-extrabold text-gray-500 mb-1">Status</p>
                <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className={selectCls}>
                  {['All', 'Pending', 'Overdue'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[170px]">
                <p className="text-[11px] font-extrabold text-gray-500 mb-1">Visit</p>
                <select value={filters.visitType} onChange={(e) => setFilters((p) => ({ ...p, visitType: e.target.value }))} className={selectCls}>
                  {['All', 'OPD', 'IPD'].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2">
                <div className="min-w-[150px]">
                  <p className="text-[11px] font-extrabold text-gray-500 mb-1">From</p>
                  <input type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} className={selectCls} />
                </div>
                <div className="min-w-[150px]">
                  <p className="text-[11px] font-extrabold text-gray-500 mb-1">To</p>
                  <input type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} className={selectCls} />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFilters((p) => ({ ...p, onlyOverdue: !p.onlyOverdue, status: p.onlyOverdue ? p.status : 'All' }))}
                className="px-3 py-2 rounded-xl text-xs font-extrabold transition border"
                style={{
                  background: filters.onlyOverdue ? '#fee2e2' : '#ffffff',
                  color: filters.onlyOverdue ? '#991b1b' : '#475569',
                  borderColor: filters.onlyOverdue ? '#fecaca' : '#e2e8f0',
                }}
                title="Show only overdue"
              >
                Overdue only
              </button>

              <div className="min-w-[200px]">
                <p className="text-[11px] font-extrabold text-gray-500 mb-1">Sort</p>
                <select value={filters.sort} onChange={(e) => setFilters((p) => ({ ...p, sort: e.target.value }))} className={selectCls}>
                  <option value="highest_due">Highest due amount</option>
                  <option value="oldest_due">Oldest due</option>
                </select>
              </div>
            </div>
          </div>
        </Section>

        <div className="-mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-10 bg-white rounded-none sm:rounded-2xl border-x-0 sm:border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-extrabold text-gray-900">Due patients</p>
              <p className="text-xs text-gray-500 mt-0.5">Update payments and send reminders (mock)</p>
            </div>
            <p className="text-xs text-gray-400">{filteredRows.length} rows</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-sm">
              <colgroup>
                <col style={{ width: '220px' }} />
                <col style={{ width: '170px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '70px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '300px' }} />
              </colgroup>
              <thead>
                <tr style={{ background: '#f8faff', position: 'sticky', top: 0, zIndex: 1 }}>
                  {[
                    'Patient',
                    'UHID',
                    'Bill ID',
                    'Visit',
                    'Total',
                    'Paid',
                    'Pending',
                    'Due date',
                    'Days overdue',
                    'Status',
                    'Actions',
                  ].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-gray-400">
                      Loading dues…
                    </td>
                  </tr>
                ) : filteredRows.length ? (
                  filteredRows.map((r) => {
                    const st = deriveStatus(r);
                    const overdueDays = calculateOverdueDays(r.dueDate);
                    const meta = STATUS_META[st] || STATUS_META.Pending;

                    return (
                      <tr
                        key={r.id}
                        className="transition hover:bg-blue-50/30"
                        title={st === 'Overdue' ? 'Overdue' : undefined}
                      >
                        <td className="px-3 py-2 align-top">
                          <p className="font-extrabold text-gray-900 truncate">{r.patientName}</p>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{r.uhid}</span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">{r.billId}</span>
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-gray-600 whitespace-nowrap">{r.visitType}</td>
                        <td className="px-3 py-2 align-top text-xs font-extrabold text-gray-900 whitespace-nowrap">₹{Number(r.total || 0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 align-top text-xs text-gray-700 whitespace-nowrap">₹{Number(r.paid || 0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 align-top">
                          <span className="text-xs font-extrabold text-gray-900 whitespace-nowrap">
                            ₹{Number(r.pending || 0).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-gray-600 whitespace-nowrap">{formatDisplayDate(r.dueDate)}</td>
                        <td className="px-3 py-2 align-top text-xs font-bold text-gray-800 whitespace-nowrap">{overdueDays || '—'}</td>
                        <td className="px-3 py-2 align-top">
                          <span className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700 whitespace-nowrap">
                            <span className="pl-dot" style={{ background: meta.dot }} />
                            {st}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => openReminder(r)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition inline-flex items-center gap-1.5"
                              title="Send reminder"
                            >
                              <MdSend className="w-4 h-4" /> Reminder
                            </button>
                            <button
                              type="button"
                              onClick={() => handleViewDetails(r)}
                              className="px-2.5 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition inline-flex items-center justify-center gap-1.5"
                              title="View details"
                            >
                              <MdVisibility className="w-4 h-4" /> <span className="text-xs font-extrabold">View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openAddPayment(r)}
                              disabled={Number(r.pending || 0) <= 0}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-extrabold border border-blue-200 text-blue-800 bg-blue-50 hover:bg-blue-100 transition inline-flex items-center gap-1.5 disabled:opacity-50"
                              title="Add payment"
                            >
                              <MdAdd className="w-4 h-4" /> Add
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkAsPaid(r)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-extrabold border border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition inline-flex items-center gap-1.5"
                              title="Mark as paid"
                            >
                              <MdCheckCircle className="w-4 h-4" /> Paid
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="px-3 py-12 text-center text-gray-400">
                      No pending payments
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {reminderOpen && reminderRow
        ? createPortal(
          <div className="pl-modalOverlay" role="dialog" aria-modal="true">
            <div className="pl-modal pl-modalAnimate">
              <div className="pl-modalHeader">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">Send reminder</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {reminderRow.patientName} · <span className="font-mono font-bold text-blue-600">{reminderRow.uhid}</span>
                  </p>
                </div>
                <button type="button" onClick={closeAllModals} className="pl-modalClose" title="Close">
                  <MdClose className="w-5 h-5" />
                </button>
              </div>
              <div className="pl-modalBody">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'SMS', label: 'SMS', icon: MdSend, bg: '#dbeafe', color: '#1d4ed8' },
                    { id: 'Call', label: 'Call', icon: MdCall, bg: '#dcfce7', color: '#14532d' },
                    { id: 'WhatsApp', label: 'WhatsApp', icon: MdWhatsapp, bg: '#f0fdf4', color: '#15803d' },
                  ].map((c) => {
                    const Icon = c.icon;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSendReminder(c.id)}
                        className="rounded-2xl border border-gray-100 bg-white p-4 text-left hover:shadow-sm transition"
                        title={c.label}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: c.bg }}>
                          <Icon className="w-5 h-5" style={{ color: c.color }} />
                        </div>
                        <p className="text-sm font-extrabold text-gray-900">{c.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">UI only (mock)</p>
                      </button>
                    );
                  })}
                </div>
                {(reminderRow.reminderLog || []).length ? (
                  <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs font-extrabold text-gray-600 mb-2">Reminder history</p>
                    <div className="space-y-2">
                      {(reminderRow.reminderLog || []).slice(0, 5).map((x, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 text-xs text-gray-600">
                          <span className="font-extrabold text-gray-900">{x.channel}</span>
                          <span className="font-mono">{formatDateTime(x.date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}

      {paymentOpen && paymentRow
        ? createPortal(
          <div className="pl-modalOverlay" role="dialog" aria-modal="true">
            <div className="pl-modal pl-modalAnimate">
              <div className="pl-modalHeader">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">Add payment</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    Bill <span className="font-mono font-bold text-gray-700">{paymentRow.billId}</span> · Pending{' '}
                    <span className="font-extrabold text-red-700">₹{Number(paymentRow.pending || 0).toLocaleString('en-IN')}</span>
                  </p>
                </div>
                <button type="button" onClick={closeAllModals} className="pl-modalClose" title="Close">
                  <MdClose className="w-5 h-5" />
                </button>
              </div>
              <div className="pl-modalBody">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-gray-600 mb-1.5">Amount</label>
                    <input
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className={inputCls}
                      inputMode="decimal"
                      placeholder="e.g. 2000"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">This updates paid/pending in local state.</p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-gray-600 mb-1.5">Payment mode</label>
                    <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className={selectCls}>
                      {['Cash', 'UPI', 'Card'].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="pl-modalActions">
                  <button type="button" className="pl-actionBtn" onClick={closeAllModals}>
                    <MdClose className="w-4 h-4" /> Cancel
                  </button>
                  <button
                    type="button"
                    className="pl-actionBtn"
                    onClick={handleAddPayment}
                    disabled={Number(paymentAmount || 0) <= 0}
                    style={{ borderColor: 'rgba(29,78,216,0.28)', background: 'rgba(29, 78, 216, 0.06)', color: '#1d4ed8' }}
                  >
                    <MdPayments className="w-4 h-4" /> Save payment
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}

      {detailOpen && detailRow
        ? createPortal(
          <div className="pl-modalOverlay" role="dialog" aria-modal="true">
            <div className="pl-modal pl-modalAnimate">
              <div className="pl-modalHeader">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{detailRow.patientName}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    UHID: <span className="font-mono font-bold text-blue-600">{detailRow.uhid}</span> · Bill:{' '}
                    <span className="font-mono font-bold text-gray-700">{detailRow.billId}</span>
                  </p>
                </div>
                <button type="button" onClick={closeAllModals} className="pl-modalClose" title="Close">
                  <MdClose className="w-5 h-5" />
                </button>
              </div>
              <div className="pl-modalBody">
                <div className="pl-modalGrid">
                  <div className="pl-modalCard">
                    <p className="pl-modalCardTitle">Patient info</p>
                    <div className="pl-kv">
                      <div>
                        <p className="k">Visit type</p>
                        <p className="v">{detailRow.visitType}</p>
                      </div>
                      <div>
                        <p className="k">Due date</p>
                        <p className="v">{formatDisplayDate(detailRow.dueDate)}</p>
                      </div>
                      <div>
                        <p className="k">Status</p>
                        <p className="v">{deriveStatus(detailRow)}</p>
                      </div>
                      <div>
                        <p className="k">Days overdue</p>
                        <p className="v">{calculateOverdueDays(detailRow.dueDate) || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pl-modalCard">
                    <p className="pl-modalCardTitle">Billing details</p>
                    <div className="pl-kv">
                      <div>
                        <p className="k">Total</p>
                        <p className="v">₹{Number(detailRow.total || 0).toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="k">Paid</p>
                        <p className="v">₹{Number(detailRow.paid || 0).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="colspan2">
                        <p className="k">Pending</p>
                        <p className="v">₹{Number(detailRow.pending || 0).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pl-modalCard">
                    <p className="pl-modalCardTitle">Payment history</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="pb-2 pr-2">Date</th>
                            <th className="pb-2 pr-2">Mode</th>
                            <th className="pb-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detailRow.history || []).length ? (
                            (detailRow.history || []).map((h, i) => (
                              <tr key={i} className="border-t border-slate-100">
                                <td className="py-2 pr-2 text-gray-700 whitespace-nowrap">{formatDateTime(h.date)}</td>
                                <td className="py-2 pr-2 font-extrabold text-gray-900">{h.mode}</td>
                                <td className="py-2 font-extrabold text-gray-900">₹{Number(h.amount || 0).toLocaleString('en-IN')}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="py-2 text-gray-400">
                                No payments recorded
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="pl-modalActions">
                  <button type="button" className="pl-actionBtn" onClick={() => openReminder(detailRow)}>
                    <MdSend className="w-4 h-4" /> Send reminder
                  </button>
                  <button type="button" className="pl-actionBtn" onClick={() => openAddPayment(detailRow)} disabled={Number(detailRow.pending || 0) <= 0}>
                    <MdAdd className="w-4 h-4" /> Add payment
                  </button>
                  <button type="button" className="pl-actionBtn" onClick={() => handleMarkAsPaid(detailRow)}>
                    <MdCheckCircle className="w-4 h-4" /> Mark as paid
                  </button>
                  <button type="button" className="pl-actionBtn" onClick={closeAllModals}>
                    <MdClose className="w-4 h-4" /> Close
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


