import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MdSearch,
  MdPerson,
  MdPhone,
  MdCalendarToday,
  MdBed,
  MdReceiptLong,
  MdArrowForward,
  MdClose,
  MdWarning,
  MdPayments,
  MdEdit,
  MdPrint,
  MdCheckCircle,
  MdTimer,
} from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import './SearchPatient.css';
import api from '../../../utils/api';

const STORAGE_KEYS = ['patients', 'hims_patients'];

// UI testing dummy data (used only when storage is empty)
const DUMMY_PATIENTS = [
  {
    uhid: 'UH202604180123',
    name: 'Ravi Kumar',
    phone: '9876543210',
    dob: '1992-03-12',
    age: '34',
    gender: 'Male',
    address: 'Ward 6, Naitik Nagar',
    visitType: 'OPD',
    department: 'General Medicine',
    doctor: 'Dr. Sharma',
    visitDate: '2026-04-18',
    token: 'T-001',
    paymentStatus: 'Paid',
    status: 'Waiting',
  },
  {
    uhid: 'UH202604180124',
    name: 'Priya Singh',
    phone: '9123456780',
    dob: '1998-09-02',
    age: '28',
    gender: 'Female',
    address: 'Shastri Colony, Naitik',
    visitType: 'OPD',
    department: 'Gynecology',
    doctor: 'Dr. Gupta',
    visitDate: '2026-04-18',
    token: 'T-002',
    paymentStatus: 'Pending',
    status: 'Waiting',
  },
  {
    uhid: 'UH202604170987',
    name: 'Mohan Das',
    phone: '9988776655',
    dob: '1974-01-25',
    age: '52',
    gender: 'Male',
    address: 'Station Road, Naitik',
    visitType: 'IPD',
    department: 'Cardiology',
    doctor: 'Dr. Kapoor',
    visitDate: '2026-04-17',
    token: 'T-006',
    paymentStatus: 'Paid',
    status: 'Admitted',
  },
  {
    uhid: 'UH202604120042',
    name: 'Arjun Yadav',
    phone: '7766554433',
    dob: '1997-11-21',
    age: '29',
    gender: 'Male',
    address: 'Old City, Naitik',
    visitType: 'OPD',
    department: 'Orthopedics',
    doctor: 'Dr. Mehta',
    visitDate: '2026-04-12',
    token: 'T-019',
    paymentStatus: 'Paid',
    status: 'Discharged',
  },
];

const STATUS_META = {
  Waiting: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  'In Consultation': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  Completed: { bg: '#dcfce7', text: '#14532d', dot: '#22c55e' },
  Admitted: { bg: '#ffedd5', text: '#9a3412', dot: '#f97316' },
  Discharged: { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' },
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function safeParseArray(raw) {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalizePatient(p) {
  const visitType = p?.visitType || p?.type || '';
  const status =
    p?.status ||
    (visitType === 'IPD' ? 'Admitted' : visitType === 'OPD' ? 'Waiting' : 'Waiting');

  return {
    id: p?.id || p?.uhid || '',
    uhid: p?.uhid || p?.id || '',
    name: p?.name || '',
    phone: p?.phone || '',
    age: p?.age ?? '',
    gender: p?.gender || '',
    visitType,
    doctor: p?.doctor || '',
    department: p?.department || p?.dept || '',
    token: p?.token || '',
    status,
    visitDate: p?.visitDate || p?.lastVisit || '',
    address: p?.address || '',
    dob: p?.dob || '',
    paymentStatus: p?.paymentStatus || '',
    registrationFee: p?.registrationFee || '',
  };
}

function mergePatients() {
  const merged = STORAGE_KEYS.flatMap((k) => safeParseArray(localStorage.getItem(k)));
  const normalized = merged.map(normalizePatient).filter((p) => p.uhid);
  return normalized.length ? normalized : DUMMY_PATIENTS.map(normalizePatient);
}

const patientApi = {
  async search(q) {
    await wait(120);
    const res = await api.get('/receptionist/patients/search', { params: { q } });
    return Array.isArray(res?.data?.items) ? res.data.items : [];
  },

  async getFullDetails(uhid) {
    const res = await api.get(`/receptionist/patients/${uhid}/details`);
    return res?.data || null;
  },

  async admit(uhid) {
    await api.patch(`/receptionist/patients/${uhid}/admit`);
    return true;
  },
};

export default function SearchPatient() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null); // full details
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);

  const inputRef = useRef(null);
  const lastReq = useRef(0);

  const handleSearchChange = (value) => {
    setQuery(value);
    setOpenDropdown(true);
    setSelected(null);
  };

  const fetchPatientSuggestions = async (q) => {
    setLoadingSuggestions(true);
    const reqId = ++lastReq.current;
    try {
      const items = await patientApi.search(q);
      if (reqId !== lastReq.current) return;
      setSuggestions(items);
    } finally {
      if (reqId === lastReq.current) setLoadingSuggestions(false);
    }
  };

  const fetchPatientFullDetails = async (patientId) => {
    setLoadingDetails(true);
    try {
      const data = await patientApi.getFullDetails(patientId);
      setSelected(data);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSelectPatient = async (p) => {
    setOpenDropdown(false);
    setSuggestions([]);
    setQuery(p?.name ? `${p.name} (${p.uhid})` : p?.uhid || '');
    await fetchPatientFullDetails(p.uhid);
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }
    const t = setTimeout(() => fetchPatientSuggestions(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const onClick = (e) => {
      const el = e.target;
      if (!el) return;
      const container = document.getElementById('sp-searchContainer');
      if (container && !container.contains(el)) setOpenDropdown(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const pendingDues = selected?.billing?.pending || 0;
  const currentStatusLabel = useMemo(() => {
    if (!selected) return '';
    if (selected.status === 'Discharged') return 'Discharged';
    if (selected.visitType === 'IPD' || selected.status === 'Admitted') return 'IPD';
    return 'OPD';
  }, [selected]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        {/* Smart Search */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div id="sp-searchContainer" className="relative flex-1 min-w-[280px]">
              <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => setOpenDropdown(true)}
                placeholder="Search by Name / UHID / Mobile..."
                className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSelected(null);
                    setSuggestions([]);
                    setOpenDropdown(false);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Clear"
                >
                  <MdClose className="w-5 h-5" />
                </button>
              ) : null}

              {/* Suggestions dropdown */}
              {openDropdown && query.trim().length >= 2 ? (
                <div className="sp-suggestBox">
                  <div className="sp-suggestHeader">
                    <p className="text-xs font-semibold text-gray-500">
                      {loadingSuggestions ? 'Searching...' : `${suggestions.length} suggestion${suggestions.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>

                  {loadingSuggestions ? (
                    <div className="sp-suggestLoading">
                      <span className="sp-spinner" />
                      <span className="text-xs text-gray-500">Fetching suggestions</span>
                    </div>
                  ) : suggestions.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                      {suggestions.map((p) => (
                        <button
                          key={p.uhid}
                          type="button"
                          onClick={() => handleSelectPatient(p)}
                          className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50/40 transition text-left"
                        >
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <MdPerson className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{p.name}</p>
                            <p className="text-xs text-gray-500 truncate">
                              <span className="font-mono font-bold text-blue-600">{p.uhid}</span> · {p.age || '—'} yrs · {p.gender || '—'} · {p.phone || '—'}
                            </p>
                          </div>
                          <span
                            className="sp-badge"
                            style={{
                              background: (STATUS_META[p.status] || STATUS_META.Waiting).bg,
                              color: (STATUS_META[p.status] || STATUS_META.Waiting).text,
                            }}
                          >
                            {p.status}
                          </span>
                          <MdArrowForward className="w-4 h-4 text-gray-300 shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center">
                      <MdSearch className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-gray-500">No patient found</p>
                      <p className="text-xs text-gray-400 mt-1">Try a different name, UHID, or mobile number</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => navigate('/dashboard/reception/patients/register')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow hover:shadow-md transition hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #0f2d5e 0%, #1a4a8a 60%, #1d4ed8 100%)' }}
            >
              <MdCalendarToday className="w-4 h-4" /> Register Patient
            </button>
          </div>

          {query.length > 0 && query.trim().length < 2 ? (
            <p className="text-xs text-gray-400 mt-2 pl-1">Type at least 2 characters to search</p>
          ) : null}
        </div>

        {/* Empty state */}
        {!selected && !loadingDetails ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-14 text-center">
            <MdPerson className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">Search and select a patient to view full details</p>
            <p className="text-xs text-gray-400 mt-1">You’ll see OPD/IPD status, consultation, billing, and visit history here.</p>
          </div>
        ) : null}

        {/* Loader */}
        {loadingDetails ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <span className="sp-spinnerLg" />
            <p className="text-sm font-semibold text-gray-600 mt-3">Loading full patient details...</p>
            <p className="text-xs text-gray-400 mt-1">Please wait</p>
          </div>
        ) : null}

        {/* Full Detail View */}
        {selected && !loadingDetails ? (
          <div className="space-y-5">
            {/* Patient Summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div
                className="px-6 py-4 flex items-center justify-between flex-wrap gap-3"
                style={{ background: 'linear-gradient(135deg, #1e3a8a08, #1e40af05)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <MdPerson className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{selected.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      UHID: <span className="font-mono font-bold text-blue-600">{selected.uhid}</span> · Mobile: {selected.phone || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="sp-pill">
                    <MdTimer className="w-4 h-4" /> {selected.token ? `Token: ${selected.token}` : 'Token: —'}
                  </span>
                  <span className="sp-pill">
                    <MdBed className="w-4 h-4" /> Status: {currentStatusLabel}
                  </span>
                  <span className={`sp-pill ${pendingDues > 0 ? 'sp-pillDanger' : ''}`}>
                    <MdPayments className="w-4 h-4" /> Pending: ₹{pendingDues}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="sp-miniCard">
                    <p className="sp-miniLabel">Age / Gender</p>
                    <p className="sp-miniValue">{selected.age || '—'} / {selected.gender || '—'}</p>
                  </div>
                  <div className="sp-miniCard">
                    <p className="sp-miniLabel">Doctor Assigned</p>
                    <p className="sp-miniValue">{selected.doctor || '—'}</p>
                  </div>
                  <div className="sp-miniCard">
                    <p className="sp-miniLabel">Department</p>
                    <p className="sp-miniValue">{selected.department || '—'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {/* Left */}
              <div className="space-y-5">
                {/* Visit & Consultation Status */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #1e3a8a08, #1e40af05)' }}>
                    <h2 className="font-bold text-gray-800">Visit & Consultation Status</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Current visit tracking</p>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="sp-miniCard">
                        <p className="sp-miniLabel">Visit Type</p>
                        <p className="sp-miniValue">{selected.visitType || '—'}</p>
                      </div>
                      <div className="sp-miniCard">
                        <p className="sp-miniLabel">Token Number</p>
                        <p className="sp-miniValue font-mono">{selected.token || '—'}</p>
                      </div>
                      <div className="sp-miniCard">
                        <p className="sp-miniLabel">Doctor</p>
                        <p className="sp-miniValue">{selected.doctor || '—'}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <span
                        className="sp-status"
                        style={{
                          background: (STATUS_META[selected.consultation?.visitStatus] || STATUS_META.Waiting).bg,
                          color: (STATUS_META[selected.consultation?.visitStatus] || STATUS_META.Waiting).text,
                        }}
                      >
                        <span className="sp-dot" style={{ background: (STATUS_META[selected.consultation?.visitStatus] || STATUS_META.Waiting).dot }} />
                        {selected.consultation?.visitStatus || 'Waiting'}
                      </span>
                      {selected.consultation?.visitStatus === 'Waiting' ? (
                        <p className="text-xs text-gray-500 mt-2">
                          Waiting for Dr. <span className="font-semibold text-gray-700">{selected.doctor || '—'}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Admission Details (IPD only) */}
                {selected.admission ? (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #1e3a8a08, #1e40af05)' }}>
                      <h2 className="font-bold text-gray-800">Admission Details</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Visible for IPD patients</p>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="sp-miniCard">
                          <p className="sp-miniLabel">Admission Date</p>
                          <p className="sp-miniValue">{formatDate(selected.admission.date)}</p>
                        </div>
                        <div className="sp-miniCard">
                          <p className="sp-miniLabel">Ward / Room</p>
                          <p className="sp-miniValue">{selected.admission.ward} · {selected.admission.room}</p>
                        </div>
                        <div className="sp-miniCard">
                          <p className="sp-miniLabel">Bed</p>
                          <p className="sp-miniValue">{selected.admission.bed}</p>
                        </div>
                      </div>
                      {Array.isArray(selected.admission.transferHistory) && selected.admission.transferHistory.length > 0 ? (
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Transfer History</p>
                          <ul className="text-xs text-gray-500 space-y-1">
                            {selected.admission.transferHistory.map((t, idx) => (
                              <li key={idx} className="flex items-center justify-between">
                                <span>{t.from} → {t.to}</span>
                                <span>{formatDate(t.date)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Right */}
              <div className="space-y-5">
                {/* Billing Summary */}
                {selected.billing ? (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #1e3a8a08, #1e40af05)' }}>
                      <h2 className="font-bold text-gray-800">Billing Summary</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Payment snapshot for this patient</p>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="sp-miniCard">
                          <p className="sp-miniLabel">Total Bill</p>
                          <p className="sp-miniValue">₹{selected.billing?.total ?? '—'}</p>
                        </div>
                        <div className="sp-miniCard">
                          <p className="sp-miniLabel">Paid Amount</p>
                          <p className="sp-miniValue">₹{selected.billing?.paid ?? '—'}</p>
                        </div>
                        <div className={`sp-miniCard ${pendingDues > 0 ? 'sp-miniDanger' : ''}`}>
                          <p className="sp-miniLabel">Pending Amount</p>
                          <p className="sp-miniValue">₹{pendingDues}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-3">
                        Last Payment: <span className="font-semibold text-gray-700">{formatDate(selected.billing?.lastPaymentDate)}</span>
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Alerts */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #1e3a8a08, #1e40af05)' }}>
                    <h2 className="font-bold text-gray-800">Alerts</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Important attention items</p>
                  </div>
                  <div className="p-6 space-y-2">
                    {selected.alerts?.length ? (
                      selected.alerts.map((a, idx) => (
                        <div key={idx} className={`sp-alert ${a.type === 'payment' ? 'sp-alertDanger' : ''}`}>
                          {a.type === 'payment' ? <MdWarning className="w-4 h-4" /> : <MdCheckCircle className="w-4 h-4" />}
                          <span className="text-xs font-semibold">{a.text}</span>
                        </div>
                      ))
                    ) : (
                      <div className="sp-alert">
                        <MdCheckCircle className="w-4 h-4" />
                        <span className="text-xs font-semibold">No alerts</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Visit History */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2"
                style={{ background: 'linear-gradient(135deg, #1e3a8a08, #1e40af05)' }}>
                <div>
                  <h2 className="font-bold text-gray-800">Visit History</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Previous OPD / IPD visits</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      navigate('/dashboard/reception/appointments/book', {
                        state: {
                          prefillPatient: {
                            patientId: selected?.uhid || '',
                            uhid: selected?.uhid || '',
                            name: selected?.name || '',
                            mobile: selected?.phone || '',
                            age: selected?.age || '',
                            gender: selected?.gender || '',
                          },
                        },
                      })
                    }
                    className="sp-quickBtn"
                    style={{ background: 'linear-gradient(135deg, #1d4ed8, #0d6ebd)' }}
                  >
                    <MdCalendarToday className="w-4 h-4" /> Book Appointment
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/reception/billing/generate', { state: { uhid: selected.uhid } })}
                    className="sp-quickBtn"
                    style={{ background: 'linear-gradient(135deg, #92400e, #d97706)' }}
                  >
                    <MdReceiptLong className="w-4 h-4" /> Open Billing
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await patientApi.admit(selected.uhid);
                      await fetchPatientFullDetails(selected.uhid);
                    }}
                    className="sp-quickBtn"
                    style={{ background: 'linear-gradient(135deg, #065f46, #059669)' }}
                    disabled={selected.visitType === 'IPD'}
                    title={selected.visitType === 'IPD' ? 'Already IPD' : 'Admit patient'}
                  >
                    <MdBed className="w-4 h-4" /> Admit Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const w = window.open('', '_blank', 'noopener,noreferrer,width=820,height=680');
                      if (!w) return;
                      const html = `
                        <html>
                          <head>
                            <title>Receipt</title>
                            <style>
                              body{font-family:Arial, sans-serif; padding:24px; color:#0f172a;}
                              .card{border:1px solid #e2e8f0; border-radius:14px; padding:18px;}
                              .title{font-size:18px; font-weight:800; margin:0 0 4px;}
                              .sub{color:#64748b; font-size:12px; margin:0 0 14px;}
                              .grid{display:grid; grid-template-columns:1fr 1fr; gap:10px;}
                              .k{color:#64748b; font-size:11px; font-weight:700;}
                              .v{font-size:13px; font-weight:800;}
                            </style>
                          </head>
                          <body>
                            <div class="card">
                              <p class="title">New H.T. Hospital — Billing Receipt</p>
                              <p class="sub">Patient: ${selected.name} · UHID: ${selected.uhid}</p>
                              ${selected.sponsor === 'AYUSHMAN' ? '<p class="sub"><b>Patient Type:</b> Ayushman &nbsp;|&nbsp; <b>Sponsor:</b> Ayushman</p>' : ''}
                              <div class="grid">
                                <div><div class="k">Total</div><div class="v">₹${selected.billing?.total ?? '—'}</div></div>
                                <div><div class="k">Paid</div><div class="v">${selected.sponsor === 'AYUSHMAN' ? 'PAID BY AYUSHMAN' : `₹${selected.billing?.paid ?? '—'}`}</div></div>
                                <div><div class="k">Pending</div><div class="v">₹${selected.sponsor === 'AYUSHMAN' ? '0' : (selected.billing?.pending ?? '—')}</div></div>
                                <div><div class="k">Date</div><div class="v">${formatDate(selected.billing?.lastPaymentDate)}</div></div>
                              </div>
                            </div>
                            <script>window.onload = () => { window.print(); };</script>
                          </body>
                        </html>
                      `;
                      w.document.open();
                      w.document.write(html);
                      w.document.close();
                    }}
                    className="sp-quickBtn"
                    style={{ background: 'linear-gradient(135deg, #0f2d5e, #1a4a8a)' }}
                  >
                    <MdPrint className="w-4 h-4" /> Print Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate('/dashboard/reception/patients/register', {
                        state: {
                          mode: 'edit',
                          patient: {
                            visitId: selected?.latestVisitId,
                            uhid: selected?.uhid,
                            name: selected?.name,
                            phone: selected?.phone,
                            dob: selected?.dob,
                            age: selected?.age,
                            gender: selected?.gender,
                            address: selected?.address,
                            visitType: selected?.visitType,
                            department: selected?.department,
                            doctor: selected?.doctor,
                            visitDate: selected?.consultation?.lastDate,
                            token: selected?.token,
                            paymentStatus: selected?.billing?.pending > 0 ? 'Pending' : 'Paid',
                            paymentMode: '',
                            registrationFee: 200,
                          },
                        },
                      })
                    }
                    className="sp-quickBtn"
                    style={{ background: 'linear-gradient(135deg, #334155, #475569)' }}
                  >
                    <MdEdit className="w-4 h-4" /> Edit Patient
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#f8faff' }}>
                      {['Date', 'Visit Type', 'Department', 'Doctor', 'Token', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(selected.history || []).slice(0, 10).map((v, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30 transition">
                        <td className="px-4 py-3 text-xs text-gray-600">{formatDate(v.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${v.visitType === 'IPD' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                            {v.visitType || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{v.department || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{v.doctor || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{v.token || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="sp-status"
                            style={{
                              background: (STATUS_META[v.status] || STATUS_META.Waiting).bg,
                              color: (STATUS_META[v.status] || STATUS_META.Waiting).text,
                            }}
                          >
                            <span className="sp-dot" style={{ background: (STATUS_META[v.status] || STATUS_META.Waiting).dot }} />
                            {v.status || 'Waiting'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
