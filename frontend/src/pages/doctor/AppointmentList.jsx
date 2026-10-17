import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { createPortal } from 'react-dom';
import PatientLabReportsPanel from '../../components/PatientLabReportsPanel';
import AbdmHealthDocumentStatus from '../../components/abdm/AbdmHealthDocumentStatus';
import {
  MdCalendarToday,
  MdSearch,
  MdFilterList,
  MdRefresh,
  MdClear,
  MdChevronLeft,
  MdChevronRight,
  MdVisibility,
} from 'react-icons/md';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
];

function toYMD(d) {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function StatusPill({ status }) {
  const s = String(status || 'WAITING').toUpperCase();
  const meta =
    s === 'COMPLETED'
      ? { bg: 'rgba(22,163,74,0.1)', fg: '#16A34A', label: 'Completed' }
      : s === 'IN_PROGRESS'
        ? { bg: 'rgba(0,119,182,0.1)', fg: '#0077B6', label: 'In Progress' }
        : { bg: 'rgba(71,85,105,0.1)', fg: '#475569', label: 'Waiting' };

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: meta.bg, color: meta.fg }}>
      {meta.label}
    </span>
  );
}

const DISP_BADGE = {
  NORMAL: { bg: 'rgba(71,85,105,0.1)', fg: '#475569', label: 'Normal' },
  REFER_ADMIT: { bg: 'rgba(220,38,38,0.1)', fg: '#DC2626', label: 'Refer for Admit' },
};

/** Backend sends `advisedLabTests`; fall back to parsing `labTests` JSON or prescription `labTest` rows. */
function advisedLabLabelsFromConsult(consult) {
  if (!consult) return [];
  if (Array.isArray(consult.advisedLabTests) && consult.advisedLabTests.length) {
    return consult.advisedLabTests.map((x) => String(x).trim()).filter(Boolean);
  }
  const raw = consult.labTests;
  if (raw == null) {
    const rx = Array.isArray(consult.prescription) ? consult.prescription : [];
    return rx.map((row) => String(row?.labTest || row?.lab_test || '').trim()).filter(Boolean);
  }
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const x of arr) {
    if (x && typeof x === 'object') {
      const n = x.testName || x.name || x.labTest || x.label;
      if (n) out.push(String(n).trim());
    }
  }
  const fromJson = out.filter(Boolean);
  if (fromJson.length) return fromJson;
  const rx = Array.isArray(consult.prescription) ? consult.prescription : [];
  return rx.map((row) => String(row?.labTest || row?.lab_test || '').trim()).filter(Boolean);
}

export default function AppointmentList() {
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');
  const [viewAppt, setViewAppt] = useState(null);
  const [viewConsult, setViewConsult] = useState(null);

  const queryKey = useMemo(() => ({ date, status, q, page, pageSize }), [date, status, q, page, pageSize]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams();
        if (date) params.set('date', date);
        if (status) params.set('status', status);
        if (q.trim()) params.set('q', q.trim());
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));

        const res = await api.get(`/appointments?${params.toString()}`);
        if (!alive) return;
        setRows(res.data?.appointments || []);
        setPagination(res.data?.pagination || { page, pageSize, total: 0, totalPages: 1 });
      } catch {
        if (!alive) return;
        setRows([]);
        setPagination({ page, pageSize, total: 0, totalPages: 1 });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [queryKey, page, pageSize]);

  const openView = async (row) => {
    setViewOpen(true);
    setViewLoading(true);
    setViewError('');
    setViewAppt(null);
    setViewConsult(null);
    try {
      const res = await api.get(`/consultations/appointment/${encodeURIComponent(row.id)}`);
      setViewAppt(res?.data?.appointment || null);
      setViewConsult(res?.data?.consultation || null);
    } catch (e) {
      setViewError(e?.response?.data?.message || 'Failed to load consultation.');
    } finally {
      setViewLoading(false);
    }
  };

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top bar header banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdCalendarToday className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">Appointment List</h1>
        
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setPage(1); }}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</label>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Search</label>
              <div className="relative">
                <MdSearch className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(1); }}
                  placeholder="Search patient name or OPD number..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all"
                />
              </div>
            </div>

            <div className="flex items-end gap-2.5 lg:justify-end">
              <button
                type="button"
                onClick={() => { setDate(''); setStatus(''); setQ(''); setPage(1); }}
                className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition-all duration-200"
              >
                <MdClear className="w-4 h-4" />
                Clear
              </button>
              <button
                type="button"
                onClick={() => setPage(1)}
                className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0077B6] hover:bg-[#005B8C] shadow-sm hover:shadow active:scale-95 transition-all duration-200"
              >
                <MdFilterList className="w-4 h-4" />
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Content Table Container */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50/70">
                <tr>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Date</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Time</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Patient Name</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">OPD No</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Status</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500 font-semibold">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-[#0077B6] border-t-transparent rounded-full animate-spin"></div>
                        Loading appointments...
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500 font-semibold">
                      No matching appointments found.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-[#001B48]">
                        {toYMD(r.date) || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-600">
                        {r.time || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                        {r.patient_name || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-600 font-mono">
                        {r.opd_number || r.opdNumber || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {String(r.status || '').toUpperCase() === 'COMPLETED' ? (
                          <button
                            type="button"
                            onClick={() => openView(r)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#0077B6] bg-[#0077B6]/10 hover:bg-[#0077B6]/20 transition-all active:scale-95 duration-200"
                          >
                            <MdVisibility className="w-3.5 h-3.5" />
                            View
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Section */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-500">
            Showing <span className="font-extrabold text-[#001B48]">{rows.length}</span> of{' '}
            <span className="font-extrabold text-[#001B48]">{pagination.total}</span> records
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center justify-center p-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-95 disabled:opacity-50 disabled:hover:bg-white transition-all duration-200"
            >
              <MdChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-extrabold text-[#001B48]">
              {pagination.page} <span className="text-gray-400 font-semibold">/</span> {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="inline-flex items-center justify-center p-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-95 disabled:opacity-50 disabled:hover:bg-white transition-all duration-200"
            >
              <MdChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal portal view */}
      {viewOpen
        ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 bg-transparent cursor-default"
              onClick={() => {
                if (viewLoading) return;
                setViewOpen(false);
                setViewError('');
                setViewAppt(null);
                setViewConsult(null);
              }}
              aria-label="Close"
            />
            <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal header layout */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#0077B6] shrink-0">
                    <MdCalendarToday className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-[#001B48] truncate">Consultation Details</h3>
                    <p className="text-xs font-semibold text-gray-500 mt-0.5 truncate">
                      {viewAppt?.patientName || '—'} · OPD <span className="font-mono font-bold text-[#0077B6]">{viewAppt?.opdNumber || '—'}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (viewLoading) return;
                    setViewOpen(false);
                    setViewError('');
                    setViewAppt(null);
                    setViewConsult(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-95 transition-all duration-200"
                >
                  Close
                </button>
              </div>

              {/* Modal contents */}
              <div className="p-6 overflow-y-auto space-y-5">
                {viewLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-500 font-semibold text-sm">
                    <div className="w-8 h-8 border-3 border-[#0077B6] border-t-transparent rounded-full animate-spin"></div>
                    Loading consultation details...
                  </div>
                ) : viewError ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {viewError}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Left: Appointment Info */}
                      <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5 space-y-4">
                        <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Appointment Info</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Token</p>
                            <p className="font-mono font-extrabold text-gray-900 mt-0.5">{viewAppt?.token || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">UHID</p>
                            <p className="font-mono font-extrabold text-gray-900 mt-0.5">{viewAppt?.uhid || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</p>
                            <p className="font-extrabold text-[#001B48] mt-0.5">{toYMD(viewAppt?.date) || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Time</p>
                            <p className="font-extrabold text-[#001B48] mt-0.5">{viewAppt?.time || '—'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Department</p>
                            <p className="font-semibold text-gray-900 mt-0.5">{viewAppt?.department || '—'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</p>
                            <div className="mt-1">
                              <StatusPill status={viewAppt?.status} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Notes & Advice */}
                      <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4">
                        <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Doctor Decision & Notes</h4>
                        <div className="space-y-4">
                          <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Disposition</p>
                            <div className="mt-1">
                              {(() => {
                                const disp = String(viewConsult?.disposition || 'NORMAL').toUpperCase();
                                const meta = DISP_BADGE[disp] || DISP_BADGE.NORMAL;
                                return (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: meta.bg, color: meta.fg }}>
                                    {meta.label}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Diagnosis</p>
                            <p className="text-sm font-semibold text-gray-900 mt-0.5">{viewConsult?.diagnosis || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Symptoms</p>
                            <p className="text-sm font-semibold text-gray-900 mt-0.5">{viewConsult?.symptoms || '—'}</p>
                          </div>
                          {(() => {
                            const labLabels = advisedLabLabelsFromConsult(viewConsult);
                            return (
                              <div>
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Advised Lab Tests</p>
                                {labLabels.length ? (
                                  <ul className="flex flex-wrap gap-1.5">
                                    {labLabels.map((name, i) => (
                                      <li
                                        key={`${name}-${i}`}
                                        className="text-xs font-bold bg-[#0077B6]/10 border border-[#0077B6]/20 rounded-lg px-2.5 py-1 text-[#0077B6]"
                                      >
                                        {name}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm font-medium text-gray-500">—</p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Prescription Medicines */}
                    <div className="rounded-2xl border border-gray-100 p-5 space-y-3">
                      <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Prescribed Medicines</h4>
                      {(() => {
                        const meds = (Array.isArray(viewConsult?.prescription) ? viewConsult.prescription : []).filter(
                          (m) => (m?.medicine || m?.name) || !(m?.labTest || m?.lab_test),
                        );
                        return meds.length ? (
                          <div className="overflow-x-auto rounded-xl border border-gray-100">
                            <table className="min-w-full divide-y divide-gray-100 text-sm">
                              <thead className="bg-gray-50/70">
                                <tr>
                                  <th className="px-4 py-2.5 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Medicine</th>
                                  <th className="px-4 py-2.5 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Dosage</th>
                                  <th className="px-4 py-2.5 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Duration</th>
                                  <th className="px-4 py-2.5 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Mode</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {meds.map((m, i) => (
                                  <tr key={i} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-3 font-semibold text-gray-900">{m?.medicine || m?.name || '—'}</td>
                                    <td className="px-4 py-3 text-gray-700 font-medium">{m?.dosage || '—'}</td>
                                    <td className="px-4 py-3 text-gray-700 font-medium">{m?.duration || '—'}</td>
                                    <td className="px-4 py-3 text-gray-700 font-medium">{m?.mode || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm font-medium text-gray-500">—</p>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-4 bg-blue-50/50 border border-blue-100/50 p-4 rounded-xl">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Follow-up Date</p>
                        <p className="text-sm font-extrabold text-[#0077B6] mt-0.5">
                          {viewConsult?.followUpDate ? new Date(viewConsult.followUpDate).toLocaleDateString('en-IN') : 'None scheduled'}
                        </p>
                      </div>
                    </div>

                    {viewConsult?.id ? <AbdmHealthDocumentStatus sourceId={viewConsult.id} /> : null}

                    {viewAppt?.patientId ? (
                      <PatientLabReportsPanel
                        patientId={viewAppt.patientId}
                        consultationId={viewConsult?.id || null}
                        title="Final lab reports (completed — print / download)"
                      />
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}

