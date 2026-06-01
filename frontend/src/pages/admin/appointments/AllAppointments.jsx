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
  WAITING: 'bg-amber-50 text-amber-900 ring-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-900 ring-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
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
    <div className="p-6 sm:p-8 bg-[#F5F7FA] min-h-full">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            {/* <p className="text-xs font-extrabold uppercase tracking-wide text-[#2D2A6E]/80">Admin · Appointment &amp; OPD</p> */}
            <h1 className="text-2xl font-extrabold text-gray-900 mt-1">All appointments</h1>
            {/* <p className="text-sm text-gray-500 mt-1">
              Live data from hospital bookings — search, filter by date, doctor, and department.
            </p> */}
          </div>
          <button
            type="button"
            onClick={() => fetchList(pagination.page)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-extrabold bg-white text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50 transition disabled:opacity-60 shrink-0"
          >
            <MdRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl bg-rose-50 text-rose-800 text-sm ring-1 ring-rose-100 px-4 py-3">{error}</div>
        ) : null}

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-extrabold text-gray-800">
            <MdFilterList className="w-5 h-5 text-[#2D2A6E]" />
            Filters
          </div>

          <form onSubmit={onSearchSubmit} className="space-y-2">
            <label className="block text-xs font-bold text-gray-500">Search (name / UHID / mobile / token)</label>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch max-w-3xl">
              <input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#2D2A6E]/25 focus:border-[#2D2A6E] outline-none"
                placeholder="Type and press Search"
              />
              <button
                type="submit"
                className="inline-flex justify-center items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-extrabold bg-[#2D2A6E] text-white hover:opacity-95 transition shrink-0 sm:w-auto w-full"
              >
                <MdSearch className="w-4 h-4" />
                Search
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
            <div className="min-w-0">
              <label className="block text-xs font-bold text-gray-500 mb-1">Date scope</label>
              <select
                value={dateMode}
                onChange={(e) => setDateMode(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 bg-white"
              >
                <option value="range">Date range</option>
                <option value="day">Single day</option>
                <option value="all">All dates</option>
              </select>
            </div>

            {dateMode === 'range' ? (
              <>
                <div className="min-w-0">
                  <label className="block text-xs font-bold text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-bold text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
              </>
            ) : null}

            {dateMode === 'day' ? (
              <div className="min-w-0">
                <label className="block text-xs font-bold text-gray-500 mb-1">Appointment date</label>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            ) : null}

            <div className="min-w-0">
              <label className="block text-xs font-bold text-gray-500 mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 bg-white"
              >
                {DEPARTMENTS_WITH_ALL.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-bold text-gray-500 mb-1">Doctor</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 bg-white"
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

          <p className="text-xs text-gray-500 flex items-center gap-2">
            <MdCalendarToday className="w-4 h-4 shrink-0" />
            {summaryLine}
          </p>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-extrabold uppercase tracking-wide text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 whitespace-nowrap">OPD #</th>
                  <th className="px-4 py-3 whitespace-nowrap">Token</th>
                  <th className="px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 whitespace-nowrap">Time</th>
                  <th className="px-4 py-3 whitespace-nowrap min-w-[140px]">Patient</th>
                  <th className="px-4 py-3 whitespace-nowrap">UHID</th>
                  <th className="px-4 py-3 whitespace-nowrap">Mobile</th>
                  <th className="px-4 py-3 whitespace-nowrap min-w-[120px]">Doctor</th>
                  <th className="px-4 py-3 whitespace-nowrap">Specialization</th>
                  <th className="px-4 py-3 whitespace-nowrap">Department</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right">Fee</th>
                  <th className="px-4 py-3 whitespace-nowrap">Payment</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 whitespace-nowrap">Created</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right"> </th>
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
                    <tr key={a.id} className="hover:bg-gray-50/80 transition">
                      <td className="px-4 py-3 font-mono font-semibold text-gray-900 whitespace-nowrap">{a.opdNumber || '—'}</td>
                      <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{a.token || '—'}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDateCell(a.date)}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{a.time || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{a.patientName || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs whitespace-nowrap">{a.uhid || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.mobile || '—'}</td>
                      <td className="px-4 py-3 text-gray-800">{a.doctorName || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[160px]">{a.specialization || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[140px]">{a.department || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {a.fee != null ? `₹${Number(a.fee).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span className="text-gray-600">{a.paymentMode || '—'}</span>
                        <span className="mx-1 text-gray-300">·</span>
                        <span
                          className={
                            String(a.paymentStatus || '').toUpperCase() === 'PAID'
                              ? 'text-emerald-700 font-bold'
                              : 'text-amber-700 font-bold'
                          }
                        >
                          {a.paymentStatus || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold ring-1 ${badge}`}>
                          {STATUS_LABEL[st] || st}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openDetail(a.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold text-[#2D2A6E] bg-[#2D2A6E]/8 hover:bg-[#2D2A6E]/15 transition"
                        >
                          <MdVisibility className="w-4 h-4" />
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
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/45 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={closeDetail}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            <header
              className="shrink-0 px-5 sm:px-6 py-4 text-white"
              style={{ background: 'linear-gradient(135deg, #2D2A6E 0%, #3d3a8a 55%, #2D2A6E 100%)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">OPD appointment</p>
                  <h2 className="text-xl font-extrabold tracking-tight mt-0.5 truncate">
                    {detailLoading ? 'Loading…' : detail?.patientName || 'Appointment'}
                  </h2>
                  {detail && !detailLoading ? (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-mono font-bold ring-1 ring-white/20">
                        <MdTag className="w-3.5 h-3.5 opacity-90" />
                        {detail.opdNumber || '—'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-mono font-bold ring-1 ring-white/20">
                        {detail.token || '—'}
                      </span>
                      {(() => {
                        const st = String(detail.status || '').toUpperCase();
                        const badge = STATUS_BADGE_HEADER[st] || 'bg-white/15 text-white ring-white/25';
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
                  className="shrink-0 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition"
                  aria-label="Close"
                >
                  <MdClose className="w-5 h-5" />
                </button>
              </div>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 bg-[#f8fafc]">
              {detailLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
                  <MdAccessTime className="w-10 h-10 animate-pulse text-[#2D2A6E]/40" />
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
                  <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/80">
                      <MdCalendarToday className="w-4 h-4 text-[#2D2A6E]" />
                      <h3 className="text-xs font-extrabold uppercase tracking-wide text-gray-700">Visit summary</h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Date</p>
                        <p className="text-sm font-semibold text-gray-900">{formatDateCell(detail.date)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Time slot</p>
                        <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                          <MdAccessTime className="w-4 h-4 text-gray-400 shrink-0" />
                          {detail.time || '—'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Department</p>
                        <p className="text-sm font-semibold text-gray-900">{detail.department || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Booked at</p>
                        <p className="text-sm text-gray-700">{formatDateTime(detail.createdAt)}</p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/80">
                      <MdPerson className="w-4 h-4 text-[#2D2A6E]" />
                      <h3 className="text-xs font-extrabold uppercase tracking-wide text-gray-700">Patient</h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2 min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Full name</p>
                        <p className="text-base font-extrabold text-gray-900">{detail.patientName || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">UHID</p>
                        <p className="text-sm font-mono font-semibold text-gray-900">{detail.uhid || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Registration #</p>
                        <p className="text-sm font-mono text-gray-800">{detail.registrationNumber || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <MdPhone className="w-3 h-3" /> Mobile
                        </p>
                        <p className="text-sm font-semibold text-gray-900">{detail.mobile || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Age / gender</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {detail.age != null ? `${detail.age} yrs` : '—'}
                          <span className="text-gray-300 mx-1.5">|</span>
                          {detail.gender || '—'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Weight</p>
                        <p className="text-sm font-semibold text-gray-900">{detail.weight != null ? `${detail.weight} kg` : '—'}</p>
                      </div>
                      <div className="sm:col-span-2 min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <MdHome className="w-3 h-3" /> Address
                        </p>
                        <p className="text-sm text-gray-800 leading-relaxed">{detail.address || '—'}</p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/80">
                      <MdLocalHospital className="w-4 h-4 text-[#2D2A6E]" />
                      <h3 className="text-xs font-extrabold uppercase tracking-wide text-gray-700">Doctor &amp; billing</h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2 min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Consultant</p>
                        <p className="text-base font-extrabold text-gray-900">{detail.doctorName || '—'}</p>
                        <p className="text-xs text-gray-500 mt-1">{detail.specialization || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Consultation fee</p>
                        <p className="text-lg font-extrabold text-gray-900 tabular-nums">
                          {detail.fee != null ? `₹${Number(detail.fee).toLocaleString('en-IN')}` : '—'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <MdPayments className="w-3 h-3" /> Payment
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="text-sm font-semibold text-gray-800">{detail.paymentMode || '—'}</span>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ring-1 ${
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

            <footer className="shrink-0 px-5 sm:px-6 py-3 border-t border-gray-100 bg-white flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDetail}
                className="px-5 py-2.5 rounded-xl text-sm font-extrabold bg-[#2D2A6E] text-white hover:opacity-95 transition shadow-sm"
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
