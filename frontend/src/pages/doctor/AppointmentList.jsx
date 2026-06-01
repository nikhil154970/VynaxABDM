import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { createPortal } from 'react-dom';
import PatientLabReportsPanel from '../../components/PatientLabReportsPanel';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
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
      ? { bg: 'rgba(22,163,74,0.12)', fg: '#15803d', label: 'Completed' }
      : s === 'IN_PROGRESS'
        ? { bg: 'rgba(0,174,239,0.14)', fg: '#0369a1', label: 'In Progress' }
        : { bg: 'rgba(148,163,184,0.18)', fg: '#475569', label: 'Waiting' };

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold"
      style={{ background: meta.bg, color: meta.fg }}>
      {meta.label}
    </span>
  );
}

const DISP_BADGE = {
  NORMAL: { bg: 'rgba(148,163,184,0.18)', fg: '#475569', label: 'Normal' },
  REFER_ADMIT: { bg: 'rgba(239,68,68,0.12)', fg: '#991b1b', label: 'Refer for Admit' },
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
    <div className="p-6 space-y-4" style={{ background: '#F5F7FA' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-gray-900">Appointment List</h2>
      </div>

      <div className="rounded-2xl border p-4" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="sm:col-span-1">
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            />
          </div>

          <div className="sm:col-span-1">
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-1 lg:col-span-2">
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search patient / OPD No"
              className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            />
          </div>

          <div className="sm:col-span-3 lg:col-span-1 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setDate(''); setStatus(''); setQ(''); setPage(1); }}
              className="px-3 py-2.5 rounded-xl text-xs font-extrabold border bg-white"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setPage(1)}
              className="px-3 py-2.5 rounded-xl text-xs font-extrabold text-white"
              style={{ background: '#E53935' }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: '#F5F7FA' }}>
                <th className="px-5 py-3 font-extrabold text-gray-700">Date</th>
                <th className="px-5 py-3 font-extrabold text-gray-700">Time</th>
                <th className="px-5 py-3 font-extrabold text-gray-700">Patient Name</th>
                <th className="px-5 py-3 font-extrabold text-gray-700">OPD No</th>
                <th className="px-5 py-3 font-extrabold text-gray-700">Status</th>
                <th className="px-5 py-3 font-extrabold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-6 text-gray-500">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-6 text-gray-500">No results.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                    <td className="px-5 py-3 font-extrabold text-gray-900">{toYMD(r.date) || '—'}</td>
                    <td className="px-5 py-3 text-gray-900">{r.time || '—'}</td>
                    <td className="px-5 py-3 text-gray-900">{r.patient_name || '—'}</td>
                    <td className="px-5 py-3 text-gray-700">{r.opd_number || r.opdNumber || '—'}</td>
                    <td className="px-5 py-3"><StatusPill status={r.status} /></td>
                    <td className="px-5 py-3">
                      {String(r.status || '').toUpperCase() === 'COMPLETED' ? (
                        <button
                          type="button"
                          onClick={() => openView(r)}
                          className="px-3 py-2 rounded-xl text-xs font-extrabold border bg-white"
                          style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                        >
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

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {pagination.total} total
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-2 rounded-xl text-xs font-extrabold border bg-white disabled:opacity-50"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
          >
            Prev
          </button>
          <span className="text-xs font-extrabold text-gray-700">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            className="px-3 py-2 rounded-xl text-xs font-extrabold border bg-white disabled:opacity-50"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
          >
            Next
          </button>
        </div>
      </div>

      {viewOpen
        ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              onClick={() => {
                if (viewLoading) return;
                setViewOpen(false);
                setViewError('');
                setViewAppt(null);
                setViewConsult(null);
              }}
              aria-label="Close"
            />
            <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900 truncate">Consultation details</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {viewAppt?.patientName || '—'} · OPD <span className="font-mono font-bold text-blue-600">{viewAppt?.opdNumber || '—'}</span>
                  </p>
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
                  className="px-3 py-2 rounded-xl text-xs font-extrabold border bg-white"
                  style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                >
                  Close
                </button>
              </div>

              <div className="p-5 max-h-[70vh] overflow-auto">
                {viewLoading ? (
                  <div className="py-10 text-center text-gray-400 text-sm font-semibold">Loading…</div>
                ) : viewError ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {viewError}
                  </div>
                ) : (
                  <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs font-extrabold text-gray-600 mb-2">Appointment</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><p className="text-[11px] font-semibold text-gray-500">Token</p><p className="font-mono font-extrabold text-gray-900">{viewAppt?.token || '—'}</p></div>
                        <div><p className="text-[11px] font-semibold text-gray-500">UHID</p><p className="font-mono font-extrabold text-gray-900">{viewAppt?.uhid || '—'}</p></div>
                        <div><p className="text-[11px] font-semibold text-gray-500">Date</p><p className="font-extrabold text-gray-900">{toYMD(viewAppt?.date) || '—'}</p></div>
                        <div><p className="text-[11px] font-semibold text-gray-500">Time</p><p className="font-extrabold text-gray-900">{viewAppt?.time || '—'}</p></div>
                        <div><p className="text-[11px] font-semibold text-gray-500">Department</p><p className="font-extrabold text-gray-900">{viewAppt?.department || '—'}</p></div>
                        <div><p className="text-[11px] font-semibold text-gray-500">Status</p><p className="font-extrabold text-gray-900">{String(viewAppt?.status || '—')}</p></div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-white p-4">
                      <p className="text-xs font-extrabold text-gray-600 mb-2">Doctor Notes</p>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[11px] font-semibold text-gray-500 mb-1">Doctor decision</p>
                          {(() => {
                            const disp = String(viewConsult?.disposition || 'NORMAL').toUpperCase();
                            const meta = DISP_BADGE[disp] || DISP_BADGE.NORMAL;
                            return (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold" style={{ background: meta.bg, color: meta.fg }}>
                                {meta.label}
                              </span>
                            );
                          })()}
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-gray-500">Diagnosis</p>
                          <p className="text-sm font-extrabold text-gray-900">{viewConsult?.diagnosis || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-gray-500">Symptoms</p>
                          <p className="text-sm font-extrabold text-gray-900">{viewConsult?.symptoms || '—'}</p>
                        </div>
                        {(() => {
                          const labLabels = advisedLabLabelsFromConsult(viewConsult);
                          return (
                            <div>
                              <p className="text-[11px] font-semibold text-gray-500 mb-1">Advised lab tests</p>
                              {labLabels.length ? (
                                <ul className="flex flex-wrap gap-1.5">
                                  {labLabels.map((name, i) => (
                                    <li
                                      key={`${name}-${i}`}
                                      className="text-xs font-semibold bg-cyan-50 border border-cyan-100 rounded-lg px-2 py-0.5 text-gray-800"
                                    >
                                      {name}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm font-semibold text-gray-500">—</p>
                              )}
                            </div>
                          );
                        })()}
                        <div>
                          <p className="text-[11px] font-semibold text-gray-500 mb-2">Medicines</p>
                          {(() => {
                            const meds = (Array.isArray(viewConsult?.prescription) ? viewConsult.prescription : []).filter(
                              (m) => (m?.medicine || m?.name) || !(m?.labTest || m?.lab_test),
                            );
                            return meds.length ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-gray-500">
                                      <th className="pb-2 pr-2">Medicine</th>
                                      <th className="pb-2 pr-2">Dosage</th>
                                      <th className="pb-2 pr-2">Duration</th>
                                      <th className="pb-2">Mode</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {meds.map((m, i) => (
                                      <tr key={i} className="border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                        <td className="py-2 pr-2 font-semibold text-gray-900">{m?.medicine || m?.name || '—'}</td>
                                        <td className="py-2 pr-2 text-gray-700">{m?.dosage || '—'}</td>
                                        <td className="py-2 pr-2 text-gray-700">{m?.duration || '—'}</td>
                                        <td className="py-2 text-gray-700">{m?.mode || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm font-semibold text-gray-500">—</p>
                            );
                          })()}
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-gray-500">Follow-up date</p>
                          <p className="text-sm font-extrabold text-gray-900">
                            {viewConsult?.followUpDate ? new Date(viewConsult.followUpDate).toLocaleDateString('en-IN') : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

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

