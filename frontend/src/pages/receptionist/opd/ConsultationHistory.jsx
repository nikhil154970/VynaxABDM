import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MdArrowBack,
  MdPhone,
  MdCalendarToday,
  MdExpandMore,
  MdExpandLess,
  MdLocalHospital,
  MdScience,
  MdReceiptLong,
  MdPrint,
  MdEventAvailable,
  MdVisibility,
  MdWarning,
  MdClose,
  MdBed,
  MdSearch,
  MdFilterList,
} from 'react-icons/md';
import '../patients/PatientList.css';
import { DEPARTMENTS_WITH_ALL } from '../../../constants/departments';
import api from '../../../utils/api';

const DOCTORS = ['All']; // optional; can be replaced by API later

const STATUS_BADGE = {
  Completed: { bg: '#dcfce7', text: '#14532d', dot: '#22c55e' },
  'Follow-up': { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  Cancelled: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
};

const DISP_BADGE = {
  NORMAL: { bg: '#f1f5f9', text: '#334155', dot: '#94a3b8', label: 'Normal' },
  REFER_ADMIT: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444', label: 'Refer for Admit' },
};

const historyApi = {
  async fetchHistoryPatientList(q) {
    const res = await api.get('/receptionist/opd/history/patients', { params: { q: q || undefined } });
    return Array.isArray(res?.data?.items) ? res.data.items : [];
  },
  async fetchConsultationHistory(uhid, filters) {
    const res = await api.get(`/receptionist/opd/history/${encodeURIComponent(uhid)}`, {
      params: {
        from: filters?.from || undefined,
        to: filters?.to || undefined,
        doctor: filters?.doctor || undefined,
        department: filters?.department || undefined,
        visitType: filters?.visitType || undefined,
      },
    });
    return { patient: res?.data?.patient || null, items: Array.isArray(res?.data?.items) ? res.data.items : [] };
  },
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function parseYmdToStart(d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(String(d).trim())) return null;
  const x = new Date(`${String(d).trim()}T00:00:00`);
  return Number.isNaN(x.getTime()) ? null : x;
}

function parseYmdToEnd(d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(String(d).trim())) return null;
  const x = new Date(`${String(d).trim()}T23:59:59.999`);
  return Number.isNaN(x.getTime()) ? null : x;
}

function applyMasterListFilters(rows, f) {
  let out = rows;
  const doc = (f.doctorContains || '').trim().toLowerCase();
  if (doc) {
    out = out.filter((r) => String(r.latestDoctor || '').toLowerCase().includes(doc));
  }
  const opd = (f.opdContains || '').trim().toLowerCase();
  if (opd) {
    out = out.filter((r) => String(r.opdNumber || r.opd_number || '').toLowerCase().includes(opd));
  }
  if (f.department && f.department !== 'All') {
    out = out.filter((r) => String(r.latestDepartment || '').trim() === f.department);
  }
  if (f.status && f.status !== 'All') {
    out = out.filter((r) => String(r.latestStatus || '') === f.status);
  }
  const from = parseYmdToStart(f.visitFrom);
  const to = parseYmdToEnd(f.visitTo);
  if (from) {
    out = out.filter((r) => {
      const t = r.latestVisitDate ? new Date(r.latestVisitDate).getTime() : 0;
      return t >= from.getTime();
    });
  }
  if (to) {
    out = out.filter((r) => {
      const t = r.latestVisitDate ? new Date(r.latestVisitDate).getTime() : 0;
      return t <= to.getTime();
    });
  }
  return out;
}

export default function ConsultationHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  const routePatientId = location?.state?.uhid || location?.state?.patientId || '';

  const [patientRows, setPatientRows] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [masterSearchInput, setMasterSearchInput] = useState('');
  const [masterSearchDebounced, setMasterSearchDebounced] = useState('');
  const [masterFilters, setMasterFilters] = useState({
    department: 'All',
    status: 'All',
    doctorContains: '',
    opdContains: '',
    visitFrom: '',
    visitTo: '',
  });
  const [viewRow, setViewRow] = useState(null);
  const [viewDetails, setViewDetails] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');

  const [selectedPatientId, setSelectedPatientId] = useState(routePatientId || '');
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const [filters, setFilters] = useState({
    from: '',
    to: '',
    doctor: 'All',
    department: 'All',
    visitType: 'All',
  });

  const patientId = patient?.uhid || patient?.id || selectedPatientId || routePatientId || '';

  useEffect(() => {
    const t = window.setTimeout(() => setMasterSearchDebounced(masterSearchInput.trim()), 400);
    return () => window.clearTimeout(t);
  }, [masterSearchInput]);

  // Master list: server search by name / UHID / mobile (debounced)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      try {
        const rows = await historyApi.fetchHistoryPatientList(masterSearchDebounced);
        if (!cancelled) setPatientRows(rows);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [masterSearchDebounced]);

  const masterDepartmentOptions = useMemo(() => {
    const s = new Set();
    for (const r of patientRows) {
      const d = String(r.latestDepartment || '').trim();
      if (d && d !== '—') s.add(d);
    }
    return ['All', ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [patientRows]);

  const masterStatusOptions = useMemo(() => {
    const s = new Set();
    for (const r of patientRows) {
      const st = String(r.latestStatus || '').trim();
      if (st) s.add(st);
    }
    return ['All', ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [patientRows]);

  const filteredMasterRows = useMemo(
    () => applyMasterListFilters(patientRows, masterFilters),
    [patientRows, masterFilters],
  );

  useEffect(() => {
    if (masterFilters.department !== 'All' && !masterDepartmentOptions.includes(masterFilters.department)) {
      setMasterFilters((p) => ({ ...p, department: 'All' }));
    }
  }, [masterDepartmentOptions, masterFilters.department]);

  useEffect(() => {
    if (masterFilters.status !== 'All' && !masterStatusOptions.includes(masterFilters.status)) {
      setMasterFilters((p) => ({ ...p, status: 'All' }));
    }
  }, [masterStatusOptions, masterFilters.status]);

  const clearMasterFilters = () => {
    setMasterFilters({
      department: 'All',
      status: 'All',
      doctorContains: '',
      opdContains: '',
      visitFrom: '',
      visitTo: '',
    });
    setMasterSearchInput('');
  };

  useEffect(() => {
    if (!viewRow) return;
    const apptId = viewRow.latestAppointmentId;
    if (!apptId) {
      setViewDetails(null);
      setViewError('Appointment details not available for this record.');
      return;
    }
    let alive = true;
    setViewLoading(true);
    setViewError('');
    setViewDetails(null);
    (async () => {
      try {
        const res = await api.get(`/receptionist/opd/appointment/${encodeURIComponent(apptId)}`);
        if (!alive) return;
        setViewDetails(res?.data?.item || null);
      } catch (e) {
        if (!alive) return;
        setViewError(e?.response?.data?.message || 'Failed to load appointment details.');
      } finally {
        if (alive) setViewLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [viewRow]);

  // Load patient details when a UHID is selected
  useEffect(() => {
    if (!selectedPatientId && !routePatientId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const pid = selectedPatientId || routePatientId;
        const { patient: p } = await historyApi.fetchConsultationHistory(pid, filters);
        if (!cancelled) setPatient(p);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routePatientId, selectedPatientId]);

  // History when patient or filters change (backend-ready)
  useEffect(() => {
    if (!patient?.uhid) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { items: list } = await historyApi.fetchConsultationHistory(patient.uhid, filters);
        if (cancelled) return;
        setHistory(list);
        if (list.length) setExpandedId((prev) => prev || list[0].id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [patient, filters]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const latestId = useMemo(() => (history.length ? history[0].id : null), [history]);

  const handleViewDetails = (c) => {
    setExpandedId((id) => (id === c.id ? null : c.id));
  };

  const handlePrintPrescription = (c) => {
    const w = window.open('', '_blank', 'noopener,noreferrer,width=820,height=900');
    if (!w) return;
    const meds = (c.prescription || [])
      .map(
        (m) =>
          `<tr><td>${m.medicine || m.name || ''}</td><td>${m.dosage || ''}</td><td>${m.duration || ''}</td><td>${m.mode || ''}</td></tr>`,
      )
      .join('');
    w.document.write(`
      <!DOCTYPE html><html><head><title>Prescription</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#0f172a;}
        h1{font-size:18px;margin:0 0 8px;}
        table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px;}
        th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;}
        th{background:#f8fafc;}
      </style></head><body>
        <h1>New H T Hospital — Prescription</h1>
        <p><strong>${patient?.name || 'Patient'}</strong> · UHID ${patient?.uhid || '—'} · ${formatDate(c.date)}</p>
        <p>Dr. ${c.doctor} · ${c.department}</p>
        <table><thead><tr><th>Medicine</th><th>Dosage</th><th>Duration</th><th>Mode</th></tr></thead><tbody>${meds}</tbody></table>
        <script>window.onload=function(){window.print();};</script>
      </body></html>
    `);
    w.document.close();
  };

  const handleBookFollowUp = async (c) => {
    navigate('/dashboard/reception/appointments/book', {
      state: {
        prefillPatient: {
          patientId,
          uhid: patient?.uhid,
          name: patient?.name,
          mobile: patient?.mobile,
          age: patient?.age,
          gender: patient?.gender,
        },
        followUpFromConsultation: c.id,
      },
    });
  };

  const handleLabView = async (report) => {
    if (report?.fileUrl && report.fileUrl !== '#') window.open(report.fileUrl, '_blank', 'noopener,noreferrer');
    else alert('Report not available yet.');
  };

  const hasAllergies = Boolean(patient?.allergies && String(patient.allergies).trim());

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        {/* Master table: patients who already consulted */}
        {!selectedPatientId ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-gray-900">Consulted Patients</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Search by name, UHID or mobile. Use filters to narrow the list — click a row for full timeline.
                </p>
                {!loadingList && patientRows.length ? (
                  <p className="text-[11px] font-semibold text-gray-500 mt-1">
                    Showing <span className="text-gray-900 font-extrabold">{filteredMasterRows.length}</span> of{' '}
                    <span className="text-gray-900 font-extrabold">{patientRows.length}</span> loaded
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={async () => {
                  setLoadingList(true);
                  try {
                    const rows = await historyApi.fetchHistoryPatientList(masterSearchDebounced);
                    setPatientRows(rows);
                  } finally {
                    setLoadingList(false);
                  }
                }}
                className="px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-600 hover:bg-gray-50 transition shrink-0 self-start sm:self-auto"
                disabled={loadingList}
              >
                Refresh
              </button>
            </div>

            <div className="px-5 py-4 border-b border-gray-100 bg-slate-50/80 space-y-3">
              <div className="relative">
                <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  value={masterSearchInput}
                  onChange={(e) => setMasterSearchInput(e.target.value)}
                  placeholder="Search name, UHID, mobile…"
                  className="pl-select w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"
                  aria-label="Search consulted patients"
                />
              </div>
              <div className="flex items-center gap-2 text-xs font-extrabold text-gray-600">
                <MdFilterList className="w-4 h-4 text-gray-500" />
                <span>Filters</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
                <select
                  value={masterFilters.department}
                  onChange={(e) => setMasterFilters((p) => ({ ...p, department: e.target.value }))}
                  className="pl-select w-full min-w-0 text-sm"
                  aria-label="Department"
                >
                  {masterDepartmentOptions.map((d) => (
                    <option key={d} value={d}>
                      {d === 'All' ? 'All departments' : d}
                    </option>
                  ))}
                </select>
                <select
                  value={masterFilters.status}
                  onChange={(e) => setMasterFilters((p) => ({ ...p, status: e.target.value }))}
                  className="pl-select w-full min-w-0 text-sm"
                  aria-label="Status"
                >
                  {masterStatusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s === 'All' ? 'All statuses' : s}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={masterFilters.doctorContains}
                  onChange={(e) => setMasterFilters((p) => ({ ...p, doctorContains: e.target.value }))}
                  placeholder="Doctor name contains…"
                  className="pl-select w-full min-w-0 text-sm"
                  aria-label="Filter by doctor"
                />
                <input
                  type="text"
                  value={masterFilters.opdContains}
                  onChange={(e) => setMasterFilters((p) => ({ ...p, opdContains: e.target.value }))}
                  placeholder="OPD number contains…"
                  className="pl-select w-full min-w-0 text-sm font-mono"
                  aria-label="Filter by OPD number"
                />
                <input
                  type="date"
                  value={masterFilters.visitFrom}
                  onChange={(e) => setMasterFilters((p) => ({ ...p, visitFrom: e.target.value }))}
                  className="pl-select w-full min-w-0 text-sm"
                  aria-label="Visit from"
                />
                <input
                  type="date"
                  value={masterFilters.visitTo}
                  onChange={(e) => setMasterFilters((p) => ({ ...p, visitTo: e.target.value }))}
                  className="pl-select w-full min-w-0 text-sm"
                  aria-label="Visit to"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={clearMasterFilters}
                  className="px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition"
                >
                  Clear search & filters
                </button>
                <span className="text-[11px] text-gray-500">Visit dates filter by latest visit date in the list.</span>
              </div>
            </div>

            <table className="w-full text-sm min-w-0">
              <thead>
                <tr style={{ background: '#f8faff' }}>
                  {['Patient', 'OPD No', 'Latest Visit', 'Doctor', 'Department', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loadingList ? (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">Loading records…</td></tr>
                ) : patientRows.length ? (
                  filteredMasterRows.length ? (
                  filteredMasterRows.map((r) => (
                    <tr
                      key={r.uhid}
                      className="hover:bg-blue-50/30 transition cursor-pointer"
                      onClick={() => setSelectedPatientId(r.uhid)}
                      title="View consultation history"
                    >
                      <td className="px-3 py-2 font-semibold text-gray-900 truncate">{r.name}</td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                          {r.opdNumber || r.opd_number || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">{formatDate(r.latestVisitDate)}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{r.latestDoctor}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{r.latestDepartment}</td>
                      <td className="px-3 py-2">
                        {(() => {
                          const meta = STATUS_BADGE[r.latestStatus] || STATUS_BADGE.Completed;
                          return (
                            <span className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700 whitespace-nowrap">
                              <span className="pl-dot" style={{ background: meta.dot }} />
                              {r.latestStatus}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewRow(r);
                          }}
                          className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition bg-white"
                          title="View appointment details"
                        >
                          <MdVisibility className="w-4 h-4" /> View
                        </button>
                      </td>
                    </tr>
                  ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-3 py-12 text-center text-gray-500 text-sm font-semibold">
                        No rows match your filters. Try clearing filters or changing the search.
                      </td>
                    </tr>
                  )
                ) : (
                  <tr><td colSpan={7} className="px-3 py-12 text-center text-gray-400">No records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {viewRow ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              onClick={() => {
                setViewRow(null);
                setViewDetails(null);
                setViewError('');
              }}
              aria-label="Close"
            />

            <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900 truncate">{viewDetails?.patientName || viewRow?.name || 'Consultation'}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    OPD: <span className="font-mono font-bold text-blue-600">{viewDetails?.opdNumber || viewRow?.opdNumber || '—'}</span> · Token:{' '}
                    <span className="font-mono font-bold text-blue-600">{viewDetails?.token || '—'}</span> · UHID:{' '}
                    <span className="font-mono font-bold text-blue-600">{viewDetails?.uhid || viewRow?.uhid || '—'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setViewRow(null);
                    setViewDetails(null);
                    setViewError('');
                  }}
                  className="p-2 rounded-xl hover:bg-gray-50 transition text-gray-600"
                  title="Close"
                >
                  <MdClose className="w-5 h-5" />
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
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs font-extrabold text-gray-600 mb-2">Patient Basic Info</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><p className="text-[11px] font-semibold text-gray-500">Patient Name</p><p className="font-extrabold text-gray-900">{viewDetails?.patientName || '—'}</p></div>
                        <div><p className="text-[11px] font-semibold text-gray-500">OPD No</p><p className="font-mono font-extrabold text-gray-900">{viewDetails?.opdNumber || '—'}</p></div>
                        <div><p className="text-[11px] font-semibold text-gray-500">Token</p><p className="font-mono font-extrabold text-gray-900">{viewDetails?.token || '—'}</p></div>
                        <div><p className="text-[11px] font-semibold text-gray-500">UHID</p><p className="font-mono font-extrabold text-gray-900">{viewDetails?.uhid || '—'}</p></div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs font-extrabold text-gray-600 mb-2">Appointment Details</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><p className="text-[11px] font-semibold text-gray-500">Doctor</p><p className="font-extrabold text-gray-900">{viewDetails?.doctor || '—'}</p></div>
                        <div><p className="text-[11px] font-semibold text-gray-500">Time Slot</p><p className="font-extrabold text-gray-900">{viewDetails?.timeSlot || '—'}</p></div>
                        <div><p className="text-[11px] font-semibold text-gray-500">Status</p><p className="font-extrabold text-gray-900">{viewDetails?.status || '—'}</p></div>
                        <div><p className="text-[11px] font-semibold text-gray-500">Department</p><p className="font-extrabold text-gray-900">{viewDetails?.department || '—'}</p></div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-white p-4 lg:col-span-2">
                      <p className="text-xs font-extrabold text-gray-600 mb-2">Doctor Notes</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[11px] font-semibold text-gray-500 mb-1">Doctor&apos;s decision</p>
                          {(() => {
                            const disp = viewDetails?.consultation?.disposition || 'NORMAL';
                            const meta = DISP_BADGE[disp] || DISP_BADGE.NORMAL;
                            return (
                              <span
                                className="inline-flex items-center gap-2 text-xs font-extrabold whitespace-nowrap px-2 py-1 rounded-full"
                                style={{ background: meta.bg, color: meta.text }}
                              >
                                <span className="pl-dot" style={{ background: meta.dot }} />
                                {meta.label}
                              </span>
                            );
                          })()}
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-gray-500 mb-1">Follow-up date</p>
                          <p className="text-sm font-extrabold text-gray-900">
                            {viewDetails?.consultation?.followUpDate
                              ? new Date(viewDetails.consultation.followUpDate).toLocaleDateString('en-IN')
                              : '—'}
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-[11px] font-semibold text-gray-500 mb-1">Diagnosis</p>
                          <p className="text-sm font-extrabold text-gray-900">{viewDetails?.consultation?.diagnosis || '—'}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-[11px] font-semibold text-gray-500 mb-1">Symptoms</p>
                          <p className="text-sm font-extrabold text-gray-900">{viewDetails?.consultation?.symptoms || '—'}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-[11px] font-semibold text-gray-500 mb-1">Advised lab tests</p>
                          {Array.isArray(viewDetails?.consultation?.labTestLabels) && viewDetails.consultation.labTestLabels.length ? (
                            <ul className="flex flex-wrap gap-1.5">
                              {viewDetails.consultation.labTestLabels.map((name, i) => (
                                <li key={i} className="text-xs font-semibold bg-cyan-50 border border-cyan-100 rounded-lg px-2 py-0.5 text-cyan-950">
                                  {name}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm font-semibold text-gray-500">—</p>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-[11px] font-semibold text-gray-500 mb-2">Medicines</p>
                          {Array.isArray(viewDetails?.consultation?.prescription) && viewDetails.consultation.prescription.length ? (
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
                                  {viewDetails.consultation.prescription.map((m, i) => (
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
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-gray-100 flex flex-wrap justify-end gap-2">
                {viewDetails?.uhid ? (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/dashboard/reception/lab/advised?uhid=${encodeURIComponent(viewDetails.uhid)}`);
                      setViewRow(null);
                      setViewDetails(null);
                      setViewError('');
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm font-extrabold text-white shadow-sm transition"
                    style={{ background: '#00AEEF' }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <MdReceiptLong className="w-4 h-4" /> Lab billing
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setViewRow(null);
                    setViewDetails(null);
                    setViewError('');
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition bg-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Detail view */}
        {selectedPatientId ? (
          <>
            {/* Patient summary — no duplicate global header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-blue-700 tracking-wide">Patient summary</p>
              <h2 className="text-lg font-extrabold text-gray-900 mt-0.5 truncate">
                {loading && !patient ? 'Loading…' : `${patient?.name || '—'} · `}
                {patient?.uhid ? <span className="font-mono text-blue-600">{patient.uhid}</span> : null}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedPatientId('');
                setExpandedId(null);
                setHistory([]);
              }}
              className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition bg-white"
              title="Back to patient list"
            >
              <MdArrowBack className="w-4 h-4" /> Back
            </button>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-gray-500">Age / Gender</p>
              <p className="text-sm font-extrabold text-gray-900">
                {patient ? `${patient.age || '—'} / ${patient.gender || '—'}` : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 flex items-start gap-2">
              <MdPhone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-gray-500">Mobile</p>
                <p className="text-sm font-extrabold text-gray-900">{patient?.phone || '—'}</p>
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-gray-500">Blood group</p>
              <p className="text-sm font-extrabold text-gray-900">{patient?.bloodGroup || '—'}</p>
            </div>
            <div
              className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 sm:col-span-2 lg:col-span-2"
            >
              <p className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                {hasAllergies ? <MdWarning className="w-3.5 h-3.5 text-gray-400" /> : null}
                Allergies
              </p>
              <p className="text-sm font-extrabold text-gray-900">
                {patient?.allergies || 'None recorded'}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-extrabold text-gray-500 mb-3">Filters</p>
          <div className="flex flex-col xl:flex-row xl:items-end gap-3">
            <div className="flex flex-col gap-2 min-w-0">
              <span className="text-xs font-semibold text-gray-500">Date range</span>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-center min-w-0">
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => handleFilterChange('from', e.target.value)}
                  className="pl-select w-full sm:w-auto min-w-0"
                />
                <span className="text-xs text-gray-400 shrink-0">to</span>
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => handleFilterChange('to', e.target.value)}
                  className="pl-select w-full sm:w-auto min-w-0"
                />
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
              <select
                value={filters.doctor}
                onChange={(e) => handleFilterChange('doctor', e.target.value)}
                className="pl-select w-full min-w-0"
              >
                {DOCTORS.map((d) => (
                  <option key={d} value={d}>
                    {d === 'All' ? 'All doctors' : d}
                  </option>
                ))}
              </select>

              <select
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
                className="pl-select w-full min-w-0"
              >
                {DEPARTMENTS_WITH_ALL.map((d) => (
                  <option key={d} value={d}>
                    {d === 'All' ? 'All departments' : d}
                  </option>
                ))}
              </select>

              <select
                value={filters.visitType}
                onChange={(e) => handleFilterChange('visitType', e.target.value)}
                className="pl-select w-full min-w-0"
              >
                {['All', 'OPD', 'IPD'].map((v) => (
                  <option key={v} value={v}>
                    {v === 'All' ? 'Visit type' : v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-gray-400">
              <MdLocalHospital className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">Loading consultation history…</p>
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 text-gray-400">
              <MdLocalHospital className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No consultation history for selected filters</p>
            </div>
          ) : (
            <div className="space-y-0 pl-0 md:pl-8">
              <div
                className="hidden md:block absolute left-3 top-2 bottom-2 w-0.5 rounded-full"
                style={{ background: 'linear-gradient(180deg, #1d4ed8 0%, #93c5fd 100%)' }}
                aria-hidden
              />
              {history.map((c, idx) => {
                const open = expandedId === c.id;
                const isLatest = c.id === latestId && idx === 0;
                const st = STATUS_BADGE[c.status] || STATUS_BADGE.Completed;

                return (
                  <div key={c.id} className="relative mb-4 md:ml-2">
                    <div
                      className="hidden md:flex absolute -left-[1.15rem] top-6 w-3 h-3 rounded-full border-2 border-white shadow z-10"
                      style={{ background: isLatest ? '#1d4ed8' : '#94a3b8' }}
                    />
                    <div
                      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition ${
                        isLatest ? 'ring-2 ring-blue-200 border-blue-200' : 'border-gray-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleViewDetails(c)}
                        className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50/80 transition"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                            <MdCalendarToday className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-extrabold text-gray-900">{formatDate(c.date)}</p>
                              <span
                                className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                                  c.visitType === 'IPD' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {c.visitType}
                              </span>
                              {isLatest ? (
                                <span className="text-[10px] font-extrabold uppercase tracking-wide text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                                  Latest
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm text-gray-600 mt-0.5">
                              {c.doctor} · {c.department}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700 whitespace-nowrap">
                            <span className="pl-dot" style={{ background: st.dot }} />
                            {c.status}
                          </span>
                          {c.disposition ? (
                            <span className="inline-flex items-center gap-2 text-xs font-extrabold whitespace-nowrap px-2 py-1 rounded-full"
                              style={{
                                background: (DISP_BADGE[c.disposition] || DISP_BADGE.NORMAL).bg,
                                color: (DISP_BADGE[c.disposition] || DISP_BADGE.NORMAL).text,
                              }}
                            >
                              <span className="pl-dot" style={{ background: (DISP_BADGE[c.disposition] || DISP_BADGE.NORMAL).dot }} />
                              {(DISP_BADGE[c.disposition] || DISP_BADGE.NORMAL).label}
                            </span>
                          ) : null}
                          {open ? <MdExpandLess className="w-5 h-5 text-gray-400" /> : <MdExpandMore className="w-5 h-5 text-gray-400" />}
                        </div>
                      </button>

                      {open ? (
                        <div className="px-5 pb-5 border-t border-gray-100 animate-[fadeIn_0.2s_ease-out]">
                          <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                              <p className="text-xs font-extrabold text-gray-500 mb-2 flex items-center gap-1">
                                <MdLocalHospital className="w-4 h-4" /> Symptoms / complaint
                              </p>
                              <p className="text-sm text-gray-800">{c.symptoms || '—'}</p>
                            </div>
                            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                              <p className="text-xs font-extrabold text-blue-700 mb-2">Diagnosis</p>
                              <p className="text-sm font-semibold text-blue-900">{c.diagnosis || '—'}</p>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                              <p className="text-xs font-extrabold text-gray-500 mb-2">Doctor notes</p>
                              <p className="text-sm text-gray-700">{c.notes || '—'}</p>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50/30 p-4">
                            <p className="text-xs font-extrabold text-cyan-900 mb-2 flex items-center gap-1">
                              <MdScience className="w-4 h-4" /> Advised lab tests
                            </p>
                            {c.labTestLabels?.length ? (
                              <ul className="flex flex-wrap gap-1.5">
                                {c.labTestLabels.map((name, i) => (
                                  <li key={i} className="text-xs font-semibold bg-white border border-cyan-100 rounded-lg px-2 py-1 text-gray-800">
                                    {name}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-gray-500">None advised for this visit</p>
                            )}
                          </div>

                          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                              <p className="text-xs font-extrabold text-emerald-800 mb-3 flex items-center gap-1">
                                <MdReceiptLong className="w-4 h-4" /> Prescription
                              </p>
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
                                    {(c.prescription || []).length ? (
                                      c.prescription.map((m, i) => (
                                        <tr key={i} className="border-t border-emerald-100">
                                          <td className="py-2 pr-2 font-semibold text-gray-900">{m.medicine || m.name || '—'}</td>
                                          <td className="py-2 pr-2 text-gray-700">{m.dosage || '—'}</td>
                                          <td className="py-2 pr-2 text-gray-700">{m.duration || '—'}</td>
                                          <td className="py-2 text-gray-700">{m.mode || '—'}</td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={4} className="py-2 text-gray-400">
                                          No medicines recorded
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-4">
                              <p className="text-xs font-extrabold text-violet-900 mb-3 flex items-center gap-1">
                                <MdScience className="w-4 h-4" /> Lab reports
                              </p>
                              <ul className="space-y-2">
                                {(c.labReports || []).length ? (
                                  c.labReports.map((r, i) => (
                                    <li
                                      key={i}
                                      className="flex items-center justify-between gap-2 text-xs bg-white rounded-lg border border-violet-100 px-3 py-2"
                                    >
                                      <span className="font-semibold text-gray-800">{r.testName}</span>
                                      <span className="text-gray-500">{r.status}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleLabView(r, c.id)}
                                        className="text-[11px] font-extrabold text-blue-700 hover:underline"
                                      >
                                        View
                                      </button>
                                    </li>
                                  ))
                                ) : (
                                  <li className="text-xs text-gray-500">No lab reports</li>
                                )}
                              </ul>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3">
                            <div className="flex items-center gap-2 text-sm">
                              <MdEventAvailable className="w-4 h-4 text-amber-700" />
                              <span className="text-gray-600">Follow-up:</span>
                              <span className="font-extrabold text-gray-900">{formatDate(c.followUpDate)}</span>
                              <span className="text-xs text-gray-500">· {c.followUpRemarks || '—'}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-gray-600">
                                Fee: <strong>₹{c.billing?.fee ?? '—'}</strong>
                              </span>
                              <span
                                className={`text-xs font-extrabold px-2 py-1 rounded-full ${
                                  c.billing?.paymentStatus === 'Paid'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-900'
                                }`}
                              >
                                {c.billing?.paymentStatus || '—'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewDetails(c)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                            >
                              <MdVisibility className="w-4 h-4" /> View full details
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintPrescription(c)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold text-white transition shadow-sm"
                              style={{ background: 'linear-gradient(135deg, #1d4ed8, #0d6ebd)' }}
                            >
                              <MdPrint className="w-4 h-4" /> Print prescription
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBookFollowUp(c)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold border border-blue-200 text-blue-800 bg-blue-50 hover:bg-blue-100 transition"
                            >
                              <MdCalendarToday className="w-4 h-4" /> Book follow-up
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const u = patient?.uhid;
                                if (!u) return;
                                navigate(`/dashboard/reception/lab/advised?uhid=${encodeURIComponent(u)}`);
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm transition disabled:opacity-50"
                              style={{ background: '#00AEEF' }}
                              disabled={!patient?.uhid}
                              title="Bill advised tests for this patient"
                            >
                              <MdReceiptLong className="w-4 h-4" /> Lab billing
                            </button>
                            {String(c.disposition || '') === 'REFER_ADMIT' ? (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate('/dashboard/reception/ipd/admit', {
                                    state: {
                                      prefillPatient: {
                                        patientId,
                                        uhid: patient?.uhid,
                                        name: patient?.name,
                                        mobile: patient?.phone || patient?.mobile || '',
                                        age: patient?.age,
                                        gender: patient?.gender,
                                      },
                                      prefillAdmission: {
                                        department: c.department || '',
                                      },
                                    },
                                  })
                                }
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold border border-rose-200 text-rose-800 bg-rose-50 hover:bg-rose-100 transition"
                              >
                                <MdBed className="w-4 h-4" /> Admit to IPD
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
