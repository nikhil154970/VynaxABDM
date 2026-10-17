import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  MdSearch,
  MdAdd,
  MdPerson,
  MdPhone,
  MdCalendarToday,
  MdEdit,
  MdVisibility,
  MdClose,
  MdReceiptLong,
  MdBed,
  MdPrint,
  MdFilterList,
  MdGroups,
  MdTrendingUp,
  MdDownload,
} from 'react-icons/md';
import './PatientList.css';
import api from '../../../utils/api';
import {
  ABDM_LINK_LABEL,
  abdmCareContextLabel,
  abdmLinkTokenLabel,
  abdmLinkUserMessage,
  getHipPatientStatus,
  linkHipPatient,
  readAbdmLinkState,
  retryContextNotify,
  shouldRetryContextNotify,
  shouldStopAbdmPoll,
} from '../../../services/abdm/abhaService';
import AbdmPatientRecordSync from '../../../components/abdm/AbdmPatientRecordSync';
import { downloadPatientListCsv } from '../../../utils/exportPatientListCsv';
import { DEPARTMENTS_WITH_ALL } from '../../../constants/departments';

const STORAGE_KEYS = ['patients', 'hims_patients']; // supports both legacy + new key

// UI testing dummy data (used only when storage is empty)


const STATUS_META = {
  Waiting: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  Admitted: { bg: '#ffedd5', text: '#9a3412', dot: '#f97316' },
  Discharged: { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' },
  Active: { bg: '#dcfce7', text: '#14532d', dot: '#22c55e' },
};

const GENDERS = ['All', 'Male', 'Female', 'Other'];
const VISIT_TYPES = ['All', 'OPD', 'IPD'];
const DATE_FILTERS = ['All', 'Today', 'Custom'];

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function safeParseArray(raw) {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function normalizePatient(p) {
  const visitType = p?.visitType || p?.type || '';
  const status =
    p?.status ||
    (visitType === 'IPD' ? 'Admitted' : visitType === 'OPD' ? 'Waiting' : 'Waiting');

  return {
    uhid: p?.uhid || p?.id || '',
    name: p?.name || '',
    phone: p?.phone || '',
    dob: p?.dob || '',
    age: p?.age ?? '',
    gender: p?.gender || '',
    address: p?.address || '',
    visitType,
    department: p?.department || '',
    doctor: p?.doctor || '',
    token: p?.token || '',
    paymentStatus: p?.paymentStatus || '',
    paymentMode: p?.paymentMode || '',
    registrationFee: p?.registrationFee || '',
    sponsor: p?.sponsor || '',
    isAyushman: p?.isAyushman === true || p?.sponsor === 'AYUSHMAN',
    visitDate: p?.visitDate || p?.lastVisit || '',
    createdAt: p?.createdAt || '',
    status,
  };
}

function writePatientsToPrimaryKey(list) {
  // TODO: Replace with PUT /patients/:id (server-side update)
  localStorage.setItem('hims_patients', JSON.stringify(list));
}

function uniqueByUHID(list) {
  const seen = new Set();
  const out = [];
  for (const x of list) {
    const key = x?.uhid || x?.id || '';
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(x);
  }
  return out;
}

export default function PatientList() {
  const navigate = useNavigate();
  const todayISO = toISODate(new Date());

  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState({ total: 0, todayRegs: 0, ipdActive: 0, discharged: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [visitType, setVisitType] = useState('All');
  const [gender, setGender] = useState('All');
  const [department, setDepartment] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selected, setSelected] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [abdmLive, setAbdmLive] = useState(null);
  const [abdmRetrying, setAbdmRetrying] = useState(false);
  const abdmPollRef = useRef(null);

  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const pageSize = 8;

  const fetchPatients = async () => {
    setLoading(true);
    try {
      let df = undefined;
      let dt = undefined;
      if (dateFilter === 'Today') {
        df = todayISO;
        dt = todayISO;
      } else if (dateFilter === 'Custom') {
        df = dateFrom || undefined;
        dt = dateTo || undefined;
      }
      const res = await api.get('/receptionist/patients', {
        params: {
          q: search || undefined,
          visitType,
          gender,
          department,
          dateFrom: df,
          dateTo: dt,
          page,
          pageSize,
        },
      });
      setPatients(Array.isArray(res?.data?.items) ? res.data.items : []);
      setStats(res?.data?.stats || { total: res?.data?.total || 0, todayRegs: 0, ipdActive: 0, discharged: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, visitType, gender, department, dateFilter, dateFrom, dateTo, page]);

  const handleSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const handleFilter = (key, value) => {
    if (key === 'visitType') setVisitType(value);
    if (key === 'gender') setGender(value);
    if (key === 'department') setDepartment(value);
    if (key === 'dateFilter') setDateFilter(value);
    if (key === 'dateFrom') setDateFrom(value);
    if (key === 'dateTo') setDateTo(value);
    setPage(1);
  };

  const handleDownloadList = async () => {
    setDownloading(true);
    try {
      let df = undefined;
      let dt = undefined;
      if (dateFilter === 'Today') {
        df = todayISO;
        dt = todayISO;
      } else if (dateFilter === 'Custom') {
        df = dateFrom || undefined;
        dt = dateTo || undefined;
      }
      const params = {
        export: '1',
        page: 1,
        pageSize: 5000,
      };
      if (search?.trim()) params.q = search.trim();
      if (visitType && visitType !== 'All') params.visitType = visitType;
      if (gender && gender !== 'All') params.gender = gender;
      if (department && department !== 'All') params.department = department;
      if (df) params.dateFrom = df;
      if (dt) params.dateTo = dt;

      const res = await api.get('/receptionist/patients', { params });
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      if (items.length === 0) {
        window.alert('Download ke liye koi patient nahi mila. Filters check karein.');
        return;
      }
      const filterTag = [
        visitType !== 'All' ? visitType : '',
        gender !== 'All' ? gender : '',
        department !== 'All' ? department.replace(/\s+/g, '-') : '',
        dateFilter !== 'All' ? dateFilter : '',
      ]
        .filter(Boolean)
        .join('_');
      downloadPatientListCsv(items, {
        filename: `vyanx-patients${filterTag ? `-${filterTag}` : ''}-${todayISO}.csv`,
      });
    } catch (e) {
      window.alert(e?.response?.data?.message || e?.message || 'Download failed.');
    } finally {
      setDownloading(false);
    }
  };

  const stopAbdmPoll = () => {
    if (abdmPollRef.current) {
      clearInterval(abdmPollRef.current);
      abdmPollRef.current = null;
    }
  };

  useEffect(() => () => stopAbdmPoll(), []);

  const handleViewPatient = (patient) => {
    setSelected(patient);
    setSelectedDetails(null);
    setAbdmLive(null);
    setDetailsError('');
    setIsModalOpen(true);
    stopAbdmPoll();

    const uhid = patient?.uhid;
    if (!uhid) return;
    setDetailsLoading(true);
    api
      .get(`/receptionist/patients/${encodeURIComponent(uhid)}/details`)
      .then(async (res) => {
        const details = res?.data || null;
        setSelectedDetails(details);
        const patientId = details?.id || patient?.patientId;
        if (!patientId) return;
        try {
          const status = await getHipPatientStatus(patientId);
          setAbdmLive({ patientId, ...status });
        } catch {
          setAbdmLive(null);
        }
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || err?.message || 'Could not load full patient details';
        setDetailsError(msg);
      })
      .finally(() => setDetailsLoading(false));
  };

  const startAbdmStatusPoll = (patientId) => {
    stopAbdmPoll();
    let ticks = 0;
    abdmPollRef.current = setInterval(async () => {
      ticks += 1;
      if (ticks > 12) {
        stopAbdmPoll();
        return;
      }
      try {
        const status = await getHipPatientStatus(patientId);
        const merged = { patientId, ...status };
        setAbdmLive(merged);
        if (shouldStopAbdmPoll(merged)) stopAbdmPoll();
      } catch {
        if (ticks > 12) stopAbdmPoll();
      }
    }, 8000);
  };

  const handleRetryContextNotify = async (patientId) => {
    if (!patientId || abdmRetrying) return;
    setAbdmRetrying(true);
    stopAbdmPoll();
    try {
      const data = await retryContextNotify({ patientId });
      setAbdmLive({ patientId, ...data, message: undefined });
      if (data?.pendingCallback || data?.syncStatus === 'PENDING') startAbdmStatusPoll(patientId);
    } catch (err) {
      const data = err?.response?.data || {};
      setAbdmLive({
        patientId,
        ...data,
        message: abdmLinkUserMessage(data, err),
      });
    } finally {
      setAbdmRetrying(false);
    }
  };

  const handleRetryAbdm = async (patientId) => {
    if (!patientId || abdmRetrying) return;
    setAbdmRetrying(true);
    stopAbdmPoll();
    try {
      const data = await linkHipPatient({ patientId });
      const next = { patientId, ...data };
      setAbdmLive(next);
      const state = readAbdmLinkState(next);
      if (state === 'TOKEN_PENDING') startAbdmStatusPoll(patientId);
    } catch (err) {
      const data = err?.response?.data || {};
      setAbdmLive({
        patientId,
        ...data,
        message: abdmLinkUserMessage(data, err),
      });
    } finally {
      setAbdmRetrying(false);
    }
  };

  const handleEditPatient = (patient) => {
    navigate('/dashboard/reception/patients/register', {
      state: {
        mode: 'edit',
        patient: {
          visitId: patient?.id || undefined,
          uhid: patient?.uhid,
          name: patient?.name,
          phone: patient?.phone,
          dob: patient?.dob,
          age: patient?.age,
          gender: patient?.gender,
          address: patient?.address,
          visitType: patient?.visitType || undefined,
          status: patient?.status || undefined,
          department: patient?.department || undefined,
          doctor: patient?.doctor || undefined,
          visitDate: patient?.visitDate || undefined,
          token: patient?.token || undefined,
          paymentStatus: patient?.paymentStatus || undefined,
          paymentMode: patient?.paymentMode || undefined,
          registrationFee: patient?.registrationFee || undefined,
          referBy: patient?.referBy || undefined,
          sponsor: patient?.sponsor || undefined,
        },
      },
    });
  };

  const handleAdmitPatient = (patient) => {
    if (!patient?.uhid) return;
    setIsModalOpen(false);
    navigate('/dashboard/reception/ipd/admit', {
      state: {
        prefillPatient: {
          uhid: patient.uhid,
          name: patient.name,
          mobile: patient.phone,
          age: patient.age,
          gender: patient.gender,
        },
      },
    });
  };

  const handleBilling = (patient, details) => {
    const full = details && details.uhid === patient?.uhid ? { ...patient, ...details } : patient;
    if (full?.sponsor === 'AYUSHMAN' || full?.isAyushman) {
      window.alert(
        'यह मरीज Ayushman (आयुष्मान) के तहत registered है। Bill normal charges के साथ बनेगी; slip पर PAID BY AYUSHMAN दिखेगा — patient से due नहीं।',
      );
    }
    navigate('/dashboard/reception/billing/generate', { state: { uhid: full?.uhid } });
  };

  const handleBookAppointment = (patient, details) => {
    const full = details && details.uhid === patient?.uhid ? { ...patient, ...details } : patient;
    const uhid = full?.uhid;
    if (!uhid) return;
    setIsModalOpen(false);
    navigate('/dashboard/reception/appointments/book', {
      state: {
        prefillPatient: {
          patientId: uhid,
          uhid,
          name: full?.name || '',
          mobile: full?.phone || '',
          age: full?.age ?? '',
          gender: full?.gender || '',
        },
      },
    });
  };

  const handlePrintSlip = (patient) => {
    const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=650');
    if (!w) return;
    const html = `
      <html>
        <head>
          <title>Patient Slip</title>
          <style>
            body{font-family:Arial, sans-serif; padding:24px; color:#0f172a;}
            .card{border:1px solid #e2e8f0; border-radius:14px; padding:18px;}
            .title{font-size:18px; font-weight:800; margin:0 0 4px;}
            .sub{color:#64748b; font-size:12px; margin:0 0 14px;}
            .grid{display:grid; grid-template-columns:1fr 1fr; gap:10px;}
            .k{color:#64748b; font-size:11px; font-weight:700;}
            .v{font-size:13px; font-weight:800;}
            .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;}
          </style>
        </head>
        <body>
          <div class="card">
            <p class="title">MQE HIMS — Patient Registration Slip</p>
            <p class="sub">Please keep this slip for your visit.</p>
            ${patient?.sponsor === 'AYUSHMAN' ? '<p class="sub"><b>Patient Type:</b> Ayushman &nbsp;|&nbsp; <b>Sponsor:</b> Ayushman</p>' : ''}
            <div class="grid">
              <div><div class="k">UHID</div><div class="v mono">${patient?.uhid || '—'}</div></div>
              <div><div class="k">Token</div><div class="v mono">${patient?.token || '—'}</div></div>
              <div><div class="k">Name</div><div class="v">${patient?.name || '—'}</div></div>
              <div><div class="k">Mobile</div><div class="v">${patient?.phone || '—'}</div></div>
              <div><div class="k">Visit Type</div><div class="v">${patient?.visitType || '—'}</div></div>
              <div><div class="k">Department</div><div class="v">${patient?.department || '—'}</div></div>
              <div><div class="k">Doctor</div><div class="v">${patient?.doctor || '—'}</div></div>
              <div><div class="k">Visit Date</div><div class="v">${formatDate(patient?.visitDate)}</div></div>
            </div>
          </div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const totalPages = Math.max(1, Math.ceil((stats?.total || 0) / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = patients;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Patients', value: stats.total, icon: MdGroups, bg: '#0f2d5e', light: '#dbeafe' },
            { label: 'Today Registrations', value: stats.todayRegs, icon: MdTrendingUp, bg: '#1d4ed8', light: '#dbeafe' },
            { label: 'Active Patients (IPD)', value: stats.ipdActive, icon: MdBed, bg: '#92400e', light: '#fef3c7' },
            { label: 'Discharged Patients', value: stats.discharged, icon: MdPerson, bg: '#475569', light: '#e2e8f0' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.light }}>
                    <Icon className="w-5 h-5" style={{ color: s.bg }} />
                  </div>
                  <div className="min-w-0">
                <p className="text-xl font-extrabold text-gray-900 leading-tight">{s.value}</p>
                    <p className="text-xs font-semibold text-gray-600 mt-0.5 truncate">{s.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-gray-500">
            <MdFilterList className="w-4 h-4" />
            Search & filters
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2 relative">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Search Query</label>
              <div className="relative">
                <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by Name / UHID / Mobile..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Visit Type</label>
              <select
                value={visitType}
                onChange={(e) => handleFilter('visitType', e.target.value)}
                className="pl-select w-full"
              >
                {VISIT_TYPES.map((v) => (
                  <option key={v} value={v}>{v === 'All' ? 'All visits' : v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Gender</label>
              <select
                value={gender}
                onChange={(e) => handleFilter('gender', e.target.value)}
                className="pl-select w-full"
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{g === 'All' ? 'All genders' : g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Department</label>
              <select
                value={department}
                onChange={(e) => handleFilter('department', e.target.value)}
                className="pl-select w-full"
              >
                {DEPARTMENTS_WITH_ALL.map((d) => (
                  <option key={d} value={d}>{d === 'All' ? 'All departments' : d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Date Filter</label>
              <select
                value={dateFilter}
                onChange={(e) => handleFilter('dateFilter', e.target.value)}
                className="pl-select w-full"
              >
                {DATE_FILTERS.map((d) => (
                  <option key={d} value={d}>{d === 'All' ? 'All dates' : d === 'Today' ? 'Today' : 'Select Date'}</option>
                ))}
              </select>
            </div>
          </div>

          {dateFilter === 'Custom' ? (
            <div className="flex items-center gap-3 pt-2">
              <div className="w-full max-w-[200px]">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => handleFilter('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <span className="self-end mb-2.5 text-gray-400 text-sm">to</span>
              <div className="w-full max-w-[200px]">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => handleFilter('dateTo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
          
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setVisitType('All');
                  setGender('All');
                  setDepartment('All');
                  setDateFilter('All');
                  setDateFrom('');
                  setDateTo('');
                  setPage(1);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
              >
                Clear filters
              </button>

              <button
                type="button"
                onClick={handleDownloadList}
                disabled={downloading || loading}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              >
                <MdDownload className="w-4 h-4" />
                {downloading ? 'Downloading…' : 'Download CSV'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/dashboard/reception/patients/register')}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow hover:shadow-md transition hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #065f46, #059669)' }}
              >
                <MdAdd className="w-4 h-4" /> Register Patient
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f8faff' }}>
                  {['Reg No', 'Patient Name', 'Age / Gender', 'Mobile', 'Source', 'Visit Type', 'Doctor', 'Status', 'ABDM', 'Date', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageItems.map((p) => (
                  <tr key={p.uhid} className="hover:bg-blue-50/30 transition">
                    <td className="px-4 py-3">
                      <span
                        className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md whitespace-nowrap inline-block min-w-[72px] text-center"
                        title={p.uhid ? `UHID: ${p.uhid}` : ''}
                      >
                        {p.registrationNumber || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <MdPerson className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate">{p.name || '—'}</p>
                          <p className="text-xs text-gray-400 truncate">{p.department || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.age || '—'} yrs / {p.gender || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <MdPhone className="w-3 h-3" />{p.phone || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.registrationSource === 'SELF' ? (
                        <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Online</span>
                      ) : (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Offline</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.visitType === 'IPD' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                        {p.visitType || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.doctor || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700 whitespace-nowrap">
                        <span className="pl-dot" style={{ background: (STATUS_META[p.status] || STATUS_META.Waiting).dot }} />
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const abdmState = readAbdmLinkState(p);
                        const tone = abdmState === 'CARE_LINKED'
                          ? 'text-green-700 bg-green-50'
                          : abdmState === 'TOKEN_PENDING' || abdmState === 'CARE_LINKING' || abdmState === 'TOKEN_GENERATED'
                            ? 'text-amber-700 bg-amber-50'
                            : abdmState === 'UNAVAILABLE'
                              ? 'text-orange-700 bg-orange-50'
                              : abdmState === 'LINK_FAILED'
                                ? 'text-red-700 bg-red-50'
                                : 'text-gray-600 bg-gray-100';
                        return (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${tone}`}>
                            {ABDM_LINK_LABEL[abdmState]}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <MdCalendarToday className="w-3 h-3" />{formatDate(p.visitDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleViewPatient(p)}
                          className="text-xs font-extrabold text-blue-700 hover:text-blue-900 underline underline-offset-4"
                          title="View"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditPatient(p)}
                          className="text-xs font-extrabold text-amber-600 hover:text-amber-800 underline underline-offset-4"
                          title="Edit"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && pageItems.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <MdPerson className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No patients found</p>
            </div>
          )}

          {/* Pagination */}
          {stats?.total > 0 ? (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white">
              <p className="text-xs text-gray-500">
                Showing <span className="font-semibold text-gray-700">{(safePage - 1) * pageSize + 1}</span>-
                <span className="font-semibold text-gray-700">{Math.min(safePage * pageSize, stats.total)}</span> of{' '}
                <span className="font-semibold text-gray-700">{stats.total}</span>
              </p>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalPages }).slice(0, 6).map((_, i) => {
                  const n = i + 1;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className="pl-pageBtn"
                      style={{
                        background: safePage === n ? '#1d4ed8' : '#f1f5f9',
                        color: safePage === n ? '#fff' : '#64748b',
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Detail Modal (portal to body for perfect centering) */}
      {isModalOpen && selected
        ? createPortal(
        <div className="pl-modalOverlay" role="dialog" aria-modal="true">
          <div className="pl-modal pl-modalAnimate">
            <div className="pl-modalHeader">
              {(() => {
                const full = selectedDetails && selectedDetails.uhid === selected.uhid ? { ...selected, ...selectedDetails } : selected;
                const statusMeta = STATUS_META[full.status] || STATUS_META.Waiting;
                const tokenFromAppointment = full?.appointmentToken || '';
                const opdNumber = full?.opdNumber || '';
                return (
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="pl-avatar">
                      <MdPerson className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-gray-900 truncate">{full.name}</p>
                      <div className="pl-headerMeta">
                        <span className="pl-chip">
                          UHID <span className="pl-chipMono">{full.uhid}</span>
                        </span>
                        {tokenFromAppointment ? (
                          <span className="pl-chip">
                            Token <span className="pl-chipMono">{tokenFromAppointment}</span>
                          </span>
                        ) : null}
                        {opdNumber ? (
                          <span className="pl-chip">
                            OPD <span className="pl-chipMono">{opdNumber}</span>
                          </span>
                        ) : null}
                        <span className="pl-chip" style={{ background: statusMeta.bg, color: statusMeta.text }}>
                          <span className="pl-chipDot" style={{ background: statusMeta.dot }} />
                          {full.status || '—'}
                        </span>
                      </div>
                      {detailsLoading ? <p className="pl-miniLoading">Loading full details…</p> : null}
                      {detailsError ? <p className="pl-miniError">{detailsError}</p> : null}
                    </div>
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={() => {
                  stopAbdmPoll();
                  setIsModalOpen(false);
                }}
                className="pl-modalClose"
                title="Close"
              >
                <MdClose className="w-5 h-5" />
              </button>
            </div>

            <div className="pl-modalBody">
              {(() => {
                const full = selectedDetails && selectedDetails.uhid === selected.uhid ? { ...selected, ...selectedDetails } : selected;
                const sponsorLabel =
                  full.sponsor === 'AYUSHMAN' ? 'Ayushman' : full.sponsor === 'TPA' ? 'TPA' : full.sponsor ? 'General Patient' : '—';

                return (
                  <div className="pl-modalGrid">
                    <div className="pl-modalCard">
                      <p className="pl-modalCardTitle">Patient</p>
                      <div className="pl-kv">
                        <div><p className="k">Registration No</p><p className="v">{full.registrationNumber || '—'}</p></div>
                        <div><p className="k">Mobile</p><p className="v">{full.phone || '—'}</p></div>
                        <div><p className="k">Age / Gender</p><p className="v">{full.age || '—'} / {full.gender || '—'}</p></div>
                        <div><p className="k">DOB</p><p className="v">{full.dob ? formatDate(full.dob) : '—'}</p></div>
                        <div><p className="k">Aadhaar / ID</p><p className="v">{full.aadhaarId || '—'}</p></div>
                        <div><p className="k">Registration</p><p className="v">{full.registrationSource === 'SELF' ? 'Online (Self)' : 'Reception'}</p></div>
                        <div className="colspan2"><p className="k">Address</p><p className="v">{full.address || '—'}</p></div>
                      </div>
                    </div>

                    <div className="pl-modalCard">
                      <p className="pl-modalCardTitle">Medical</p>
                      <div className="pl-kv">
                        <div><p className="k">Blood Group</p><p className="v">{full.bloodGroup || '—'}</p></div>
                        <div><p className="k">Allergies</p><p className="v">{full.allergies || '—'}</p></div>
                        <div><p className="k">Height</p><p className="v">{full.heightCm ? `${full.heightCm} cm` : '—'}</p></div>
                        <div><p className="k">Weight</p><p className="v">{full.weightKg ? `${full.weightKg} kg` : '—'}</p></div>
                      </div>
                      <div className="pl-divider" />
                      <p className="pl-modalCardTitle" style={{ marginTop: 0 }}>Emergency Contact</p>
                      <div className="pl-kv">
                        <div><p className="k">Name</p><p className="v">{full.emergencyName || '—'}</p></div>
                        <div><p className="k">Relation</p><p className="v">{full.emergencyRelation || '—'}</p></div>
                        <div className="colspan2"><p className="k">Phone</p><p className="v">{full.emergencyPhone || '—'}</p></div>
                      </div>
                    </div>

                    <div className="pl-modalCard pl-modalCardWide">
                      {(() => {
                        const abdm = { ...full, ...(abdmLive || {}) };
                        const abdmState = readAbdmLinkState(abdm);
                        const patientId = abdm.id || abdm.patientId || full.id || full.patientId;
                        const message = abdmLive?.message || abdmLinkUserMessage(abdm);
                        const lastAttempt = abdm.linkedAt || abdm.syncTime || null;
                        return (
                          <>
                            <p className="pl-modalCardTitle">ABDM Integration</p>
                            <div className="pl-kv">
                              <div><p className="k">ABDM Link Status</p><p className="v">{ABDM_LINK_LABEL[abdmState] || 'ABDM Not Linked'}</p></div>
                              <div><p className="k">Link Token</p><p className="v">{abdmLinkTokenLabel(abdmState)}</p></div>
                              <div><p className="k">Care Context</p><p className="v">{abdmCareContextLabel(abdmState, abdm)}</p></div>
                              <div><p className="k">Last Attempt</p><p className="v">{lastAttempt ? formatDate(lastAttempt) : '—'}</p></div>
                              <div className="colspan2"><p className="k">Message</p><p className="v">{message || '—'}</p></div>
                            </div>
                            <p className="text-xs text-gray-500 mt-3">
                              ABDM Linking → Link Token → Care Context → Context Notify (Coming Next)
                            </p>
                            {shouldRetryContextNotify(abdm) && patientId ? (
                              <button
                                type="button"
                                className="pl-actionBtn mt-3"
                                disabled={abdmRetrying}
                                onClick={() => handleRetryContextNotify(patientId)}
                              >
                                {abdmRetrying ? 'Retrying…' : 'Retry Context Notify'}
                              </button>
                            ) : abdmState !== 'CARE_LINKED' && patientId ? (
                              <button
                                type="button"
                                className="pl-actionBtn mt-3"
                                disabled={abdmRetrying}
                                onClick={() => handleRetryAbdm(patientId)}
                              >
                                {abdmRetrying ? 'Retrying…' : 'Retry ABDM Linking'}
                              </button>
                            ) : null}
                            {patientId ? <AbdmPatientRecordSync patientId={patientId} /> : null}
                          </>
                        );
                      })()}
                    </div>

                    <div className="pl-modalCard pl-modalCardWide">
                      <p className="pl-modalCardTitle">Visit & Billing</p>
                      <div className="pl-kv">
                        <div><p className="k">Visit Type</p><p className="v">{full.visitType || '—'}</p></div>
                        <div><p className="k">Visit Date</p><p className="v">{formatDate(full.visitDate)}</p></div>
                        <div><p className="k">Department</p><p className="v">{full.department || '—'}</p></div>
                        <div><p className="k">Doctor</p><p className="v">{full.doctor || '—'}</p></div>
                        <div><p className="k">Refer By</p><p className="v">{full.referBy || '—'}</p></div>
                        <div><p className="k">Sponsor</p><p className="v">{sponsorLabel}</p></div>
                        <div><p className="k">Registration Fee</p><p className="v">{full.registrationFee ?? '—'}</p></div>
                        <div><p className="k">Payment</p><p className="v">{full.paymentStatus || '—'} {full.paymentMode ? `(${full.paymentMode})` : ''}</p></div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="pl-modalActions">
                <button
                  type="button"
                  className="pl-actionBtn"
                  onClick={() => handleBookAppointment(selected, selectedDetails)}
                  disabled={!selected?.uhid}
                >
                  <MdCalendarToday className="w-4 h-4" /> Book Appointment
                </button>
                <button type="button" className="pl-actionBtn" onClick={() => handleEditPatient(selected)}>
                  <MdEdit className="w-4 h-4" /> Edit Patient
                </button>
                <button
                  type="button"
                  className="pl-actionBtn"
                  onClick={() => handleBilling(selected, selectedDetails)}
                >
                  <MdReceiptLong className="w-4 h-4" /> Billing
                </button>
                {(() => {
                  const disp = selectedDetails?.consultation?.disposition;
                  const canAdmit = !disp || disp === 'REFER_ADMIT';
                  if (!canAdmit) return null;
                  return (
                    <button
                      type="button"
                      className="pl-actionBtn"
                      onClick={() => handleAdmitPatient(selected)}
                      disabled={Boolean(
                        selectedDetails?.uhid === selected?.uhid && selectedDetails?.hasActiveIpdAdmission,
                      )}
                      title={
                        selectedDetails?.uhid === selected?.uhid && selectedDetails?.hasActiveIpdAdmission
                          ? 'Patient already has an active IPD admission'
                          : 'Open full IPD admission form'
                      }
                    >
                      <MdBed className="w-4 h-4" /> Admit
                    </button>
                  );
                })()}
                <button type="button" className="pl-actionBtn" onClick={() => handlePrintSlip(selected)}>
                  <MdPrint className="w-4 h-4" /> Print Slip
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
        : null}
    </div>
  );
}
