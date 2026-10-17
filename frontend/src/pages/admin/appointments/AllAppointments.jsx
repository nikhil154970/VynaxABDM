import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MdAccessTime,
  MdCalendarToday,
  MdClose,
  MdFilterList,
  MdHome,
  MdLocalHospital,
  MdPayments,
  MdPerson,
  MdPhone,
  MdRefresh,
  MdSearch,
  MdTag,
  MdVisibility,
} from 'react-icons/md';
import api from '../../../utils/api';
import Pagination from '../../../components/Pagination';
import { DEPARTMENTS_WITH_ALL } from '../../../constants/departments';

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso, deltaDays) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return toISODate(d);
}

function formatDateCell(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL = {
  WAITING: 'Waiting',
  IN_PROGRESS: 'In consultation',
  COMPLETED: 'Completed',
};

const STATUS_BADGE = {
  WAITING: 'bg-amber-50 text-amber-700 ring-amber-200/60',
  IN_PROGRESS: 'bg-blue-50 text-[#0077B6] ring-blue-200/60',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60',
};

/** Status pill on dark modal header (readable on purple gradient). */
const STATUS_BADGE_HEADER = {
  WAITING: 'bg-amber-400/25 text-amber-50 ring-amber-300/40',
  IN_PROGRESS: 'bg-sky-400/25 text-sky-50 ring-sky-300/40',
  COMPLETED: 'bg-emerald-400/25 text-emerald-50 ring-emerald-300/40',
};

const LIST_PAGE_SIZE = 25;

export default function AllAppointments() {
  const today = toISODate(new Date());
  const defaultFrom = addDaysISO(today, -30);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [qDraft, setQDraft] = useState('');
  const [dateMode, setDateMode] = useState('range'); // all | range | day
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(today);
  const [singleDate, setSingleDate] = useState(today);
  const [department, setDepartment] = useState('All');
  const [doctorId, setDoctorId] = useState('');

  const [doctors, setDoctors] = useState([]);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailReqSeq = useRef(0);

  const loadDoctors = useCallback(async () => {
    try {
      const res = await api.get('/doctors/lookup');
      const rows = Array.isArray(res?.data?.items) ? res.data.items : [];
      setDoctors(rows);
    } catch {
      setDoctors([]);
    }
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const fetchList = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        pageSize: LIST_PAGE_SIZE,
        q: q.trim() || undefined,
        department: department !== 'All' ? department : undefined,
        doctorId: doctorId || undefined,
      };

      if (dateMode === 'all') {
        // no date filters
      } else if (dateMode === 'day') {
        params.date = singleDate;
      } else {
        params.from = fromDate;
        params.to = toDate;
      }

      const res = await api.get('/receptionist/appointments', { params });
      const list = Array.isArray(res?.data?.items) ? res.data.items : [];
      const pg = res?.data?.pagination || {};
      setItems(list);
      setPagination({
        page: pg.page || page,
        total: pg.total ?? list.length,
        totalPages: Math.max(1, pg.totalPages || 1),
      });
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load appointments.');
      setItems([]);
      setPagination({ page: 1, total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [q, dateMode, fromDate, toDate, singleDate, department, doctorId]);

  useEffect(() => {
    fetchList(1);
  }, [fetchList]);

  const onSearchSubmit = (e) => {
    e.preventDefault();
    setQ(qDraft.trim());
  };

  const closeDetail = () => {
    detailReqSeq.current += 1;
    setDetail(null);
    setDetailLoading(false);
  };

  const openDetail = async (id) => {
    const seq = ++detailReqSeq.current;
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/receptionist/appointments/${encodeURIComponent(id)}`);
      if (detailReqSeq.current !== seq) return;
      setDetail(res?.data?.appointment || null);
    } catch {
      if (detailReqSeq.current !== seq) return;
      setDetail(null);
    } finally {
      if (detailReqSeq.current === seq) setDetailLoading(false);
    }
  };

  const summaryLine = useMemo(() => {
    const t = pagination.total;
    if (dateMode === 'all') return `Showing ${items.length} on this page · ${t} total matching filters`;
    if (dateMode === 'day') return `Date ${formatDateCell(singleDate)} · ${t} appointment(s) matching filters`;
    return `${fromDate} → ${toDate} · ${t} appointment(s) matching filters`;
  }, [dateMode, fromDate, toDate, singleDate, pagination.total, items.length]);

  return (
    <div className="p-4 space-y-4">
      <div className="max-w-[1400px] mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdCalendarToday className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">All Appointments</h1>
              <p className="text-xs md:text-sm text-gray-500">
                Live data from hospital bookings — search, filter by date, doctor, and department.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchList(pagination.page)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-[#0077B6] border border-[#0077B6]/20 hover:border-[#0077B6] hover:bg-sky-50 active:bg-sky-100 transition-all duration-200 disabled:opacity-60 shrink-0 shadow-sm cursor-pointer"
          >
            <MdRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl bg-rose-50 text-rose-800 text-sm border border-rose-100 px-4 py-3">{error}</div>
        ) : null}

        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#0077B6]">
              <MdFilterList className="w-4 h-4" />
            </div>
            Filters
          </div>

          <form onSubmit={onSearchSubmit} className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500">Search (name / UHID / mobile / token)</label>
            <div className="flex flex-col sm:flex-row gap-2.5 sm:items-stretch max-w-3xl">
              <div className="relative flex-1">
                <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] outline-none transition duration-200 placeholder-gray-400 bg-gray-50/50 hover:bg-white focus:bg-white"
                  placeholder="Search by patient name, UHID, mobile, or token..."
                />
              </div>
              <button
                type="submit"
                className="inline-flex justify-center items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#005f92] active:bg-[#001B48] transition duration-200 shrink-0 sm:w-auto w-full cursor-pointer shadow-sm"
              >
                Search
              </button>
            </div>
          </form>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-gray-100">
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Date scope</label>
              <select
                value={dateMode}
                onChange={(e) => setDateMode(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] outline-none transition duration-200 hover:border-gray-300 cursor-pointer"
              >
                <option value="range">Date range</option>
                <option value="day">Single day</option>
                <option value="all">All dates</option>
              </select>
            </div>

            {dateMode === 'range' ? (
              <>
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] outline-none transition duration-200 hover:border-gray-300 cursor-pointer bg-white"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] outline-none transition duration-200 hover:border-gray-300 cursor-pointer bg-white"
                  />
                </div>
              </>
            ) : null}

            {dateMode === 'day' ? (
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Appointment date</label>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] outline-none transition duration-200 hover:border-gray-300 cursor-pointer bg-white"
                />
              </div>
            ) : null}

            <div className="min-w-0">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] outline-none transition duration-200 hover:border-gray-300 cursor-pointer"
              >
                {DEPARTMENTS_WITH_ALL.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Doctor</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] outline-none transition duration-200 hover:border-gray-300 cursor-pointer"
              >
                <option value="">All doctors</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.specialization || '—'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/50 border border-blue-100/50 rounded-xl w-fit">
            <MdCalendarToday className="w-3.5 h-3.5 shrink-0 text-[#0077B6]" />
            <span className="text-xs font-semibold text-[#0077B6]">{summaryLine}</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-xs">
              <thead>
                <tr className="bg-[#001B48] text-left text-[9px] font-semibold uppercase tracking-wider text-white/70 border-b border-[#0077B6]/30">
                  <th className="px-1.5 py-2 whitespace-nowrap">#</th>
                  <th className="px-1.5 py-2 whitespace-nowrap hidden md:table-cell">Token</th>
                  <th className="px-1.5 py-2 whitespace-nowrap">Date</th>
                  <th className="px-1.5 py-2 whitespace-nowrap">Time</th>
                  <th className="px-1.5 py-2 whitespace-nowrap">Patient</th>
                  <th className="px-1.5 py-2 whitespace-nowrap hidden sm:table-cell">UHID</th>
                  <th className="px-1.5 py-2 whitespace-nowrap hidden lg:table-cell">Mobile</th>
                  <th className="px-1.5 py-2 whitespace-nowrap">Doctor</th>
                  <th className="px-1.5 py-2 whitespace-nowrap hidden xl:table-cell">Dept</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-right">Fee</th>
                  <th className="px-1.5 py-2 whitespace-nowrap hidden sm:table-cell">Pay</th>
                  <th className="px-1.5 py-2 whitespace-nowrap">Status</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && !items.length ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-12 text-center text-gray-500 font-medium">
                      Loading appointments…
                    </td>
                  </tr>
                ) : null}
                {!loading && !items.length ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-12 text-center text-gray-500 font-medium">
                      No appointments match these filters.
                    </td>
                  </tr>
                ) : null}
                {items.map((a) => {
                  const st = String(a.status || '').toUpperCase();
                  const badge = STATUS_BADGE[st] || 'bg-gray-50 text-gray-800 ring-gray-200';
                  return (
                    <tr key={a.id} className="hover:bg-gray-50/80 transition duration-150">
                      <td className="px-1.5 py-2 font-mono font-semibold text-[11px] text-gray-900 whitespace-nowrap">{a.opdNumber || '—'}</td>
                      <td className="px-1.5 py-2 font-mono text-[10px] text-gray-700 whitespace-nowrap hidden md:table-cell">{a.token || '—'}</td>
                      <td className="px-1.5 py-2 text-[10px] text-gray-700 whitespace-nowrap">{formatDateCell(a.date)}</td>
                      <td className="px-1.5 py-2 text-[10px] text-gray-700 whitespace-nowrap">{a.time || '—'}</td>
                      <td className="px-1.5 py-2 text-[11px] font-semibold text-gray-900 truncate max-w-[110px]">{a.patientName || '—'}</td>
                      <td className="px-1.5 py-2 text-gray-600 font-mono text-[9px] whitespace-nowrap hidden sm:table-cell">{a.uhid || '—'}</td>
                      <td className="px-1.5 py-2 text-[10px] text-gray-600 whitespace-nowrap hidden lg:table-cell">{a.mobile || '—'}</td>
                      <td className="px-1.5 py-2 text-[10px] text-gray-800 truncate max-w-[100px]">{a.doctorName || '—'}</td>
                      <td className="px-1.5 py-2 text-[10px] text-gray-600 hidden xl:table-cell">{a.department || '—'}</td>
                      <td className="px-1.5 py-2 text-right text-[11px] font-semibold text-gray-900 whitespace-nowrap">
                        {a.fee != null ? `₹${Number(a.fee).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-1.5 py-2 text-[10px] whitespace-nowrap hidden sm:table-cell">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-800 font-medium leading-tight">{a.paymentMode || '—'}</span>
                          <span
                            className={`inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold w-fit ${
                              String(a.paymentStatus || '').toUpperCase() === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/40'
                                : 'bg-amber-50 text-amber-700 border border-amber-200/40'
                            }`}
                          >
                            {a.paymentStatus || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-1.5 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ring-1 ${badge}`}>
                          {STATUS_LABEL[st] || st}
                        </span>
                      </td>
                      <td className="px-1.5 py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openDetail(a.id)}
                          className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-[9px] font-semibold text-[#0077B6] bg-blue-50 border border-transparent hover:border-[#0077B6]/30 hover:bg-sky-50 active:bg-sky-100 transition-all duration-200 cursor-pointer shadow-sm"
                        >
                          <MdVisibility className="w-2.5 h-2.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={(p) => fetchList(p)} />
      </div>

      {(detail != null || detailLoading) && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-all duration-300"
          role="dialog"
          aria-modal="true"
          onClick={closeDetail}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden ring-1 ring-black/5 animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="shrink-0 px-6 py-5 text-white bg-[#001B48] border-b border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">OPD appointment</p>
                  <h2 className="text-xl font-extrabold tracking-tight mt-0.5 truncate text-white">
                    {detailLoading ? 'Loading…' : detail?.patientName || 'Appointment'}
                  </h2>
                  {detail && !detailLoading ? (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-mono font-bold ring-1 ring-white/20">
                        <MdTag className="w-3.5 h-3.5 opacity-90 text-white/80" />
                        {detail.opdNumber || '—'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-mono font-bold ring-1 ring-white/20">
                        Token: {detail.token || '—'}
                      </span>
                      {(() => {
                        const st = String(detail.status || '').toUpperCase();
                        const badge = STATUS_BADGE_HEADER[st] || 'bg-white/10 text-white ring-white/25';
                        return (
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ring-1 ${badge}`}>
                            {STATUS_LABEL[st] || detail.status}
                          </span>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="shrink-0 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all duration-200 cursor-pointer"
                  aria-label="Close"
                >
                  <MdClose className="w-5 h-5" />
                </button>
              </div>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 bg-[#f8fafc]">
              {detailLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
                  <MdAccessTime className="w-10 h-10 animate-pulse text-[#0077B6]/40" />
                  <p className="text-sm font-semibold">Fetching appointment…</p>
                </div>
              ) : null}
              {!detailLoading && !detail ? (
                <div className="rounded-2xl bg-rose-50 text-rose-800 text-sm font-medium px-4 py-3 ring-1 ring-rose-100">
                  Could not load this appointment.
                </div>
              ) : null}
              {detail && !detailLoading ? (
                <div className="space-y-4">
                  <section className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-gray-100 bg-gray-50/50">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-[#0077B6]">
                        <MdCalendarToday className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">Visit summary</h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Date</p>
                        <p className="text-sm font-semibold text-gray-900">{formatDateCell(detail.date)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Time slot</p>
                        <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                          <MdAccessTime className="w-4 h-4 text-[#0077B6] shrink-0" />
                          {detail.time || '—'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Department</p>
                        <p className="text-sm font-semibold text-[#0077B6] bg-blue-50/50 border border-blue-100/30 rounded-lg px-2.5 py-1 w-fit font-medium">
                          {detail.department || '—'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Booked at</p>
                        <p className="text-sm font-medium text-gray-700">{formatDateTime(detail.createdAt)}</p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-gray-100 bg-gray-50/50">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-[#0077B6]">
                        <MdPerson className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">Patient</h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2 flex items-center gap-3 bg-gray-50/30 p-2.5 rounded-xl border border-gray-100/50">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#001B48] to-[#0077B6] flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                          {detail.patientName ? detail.patientName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'PT'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Full name</p>
                          <p className="text-base font-bold text-gray-900 leading-tight">{detail.patientName || '—'}</p>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">UHID</p>
                        <p className="text-sm font-mono font-semibold text-gray-900">{detail.uhid || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Registration #</p>
                        <p className="text-sm font-mono text-gray-800">{detail.registrationNumber || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <MdPhone className="w-3 h-3 text-[#0077B6]" /> Mobile
                        </p>
                        <p className="text-sm font-semibold text-gray-900">{detail.mobile || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Age / gender</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {detail.age != null ? `${detail.age} yrs` : '—'}
                          <span className="text-gray-300 mx-1.5">|</span>
                          {detail.gender || '—'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Weight</p>
                        <p className="text-sm font-semibold text-gray-900">{detail.weight != null ? `${detail.weight} kg` : '—'}</p>
                      </div>
                      <div className="sm:col-span-2 min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <MdHome className="w-3 h-3 text-[#0077B6]" /> Address
                        </p>
                        <p className="text-sm text-gray-800 leading-relaxed">{detail.address || '—'}</p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden animate-fadeIn">
                    <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-gray-100 bg-gray-50/50">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-[#0077B6]">
                        <MdLocalHospital className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">Doctor &amp; billing</h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2 flex items-center gap-3 bg-gray-50/30 p-2.5 rounded-xl border border-gray-100/50">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-[#0077B6] shrink-0 border border-blue-100/60 shadow-sm">
                          DR
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Consultant</p>
                          <p className="text-base font-bold text-gray-900 leading-tight">{detail.doctorName || '—'}</p>
                          <p className="text-xs text-[#0077B6] font-medium mt-0.5">{detail.specialization || '—'}</p>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Consultation fee</p>
                        <p className="text-lg font-bold text-[#0077B6] tabular-nums">
                          {detail.fee != null ? `₹${Number(detail.fee).toLocaleString('en-IN')}` : '—'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <MdPayments className="w-3 h-3 text-[#0077B6]" /> Payment details
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-sm font-semibold text-gray-800">{detail.paymentMode || '—'}</span>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ring-1 ${
                              String(detail.paymentStatus || '').toUpperCase() === 'PAID'
                                ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                                : 'bg-amber-50 text-amber-900 ring-amber-200'
                            }`}
                          >
                            {detail.paymentStatus || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              ) : null}
            </div>

            <footer className="shrink-0 px-6 py-4 border-t border-gray-100 bg-white flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDetail}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#005f92] active:bg-[#001B48] transition duration-200 shadow-sm cursor-pointer"
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

