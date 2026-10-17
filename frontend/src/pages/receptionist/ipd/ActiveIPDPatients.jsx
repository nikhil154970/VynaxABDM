import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  MdAdd,
  MdBed,
  MdClose,
  MdFilterList,
  MdLocalHospital,
  MdNotes,
  MdOpenInNew,
  MdPayments,
  MdPerson,
  MdRefresh,
  MdSearch,
  MdSwapHoriz,
  MdVisibility,
  MdExitToApp,
} from 'react-icons/md';
import '../patients/PatientList.css';
import { DEPARTMENTS } from '../../../constants/departments';
import api from '../../../utils/api';
import Toast from '../../../components/Toast';
const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

/** @typedef {{
 *   id: string,
 *   ipdNumber: string,
 *   name: string,
 *   uhid: string,
 *   mobile: string,
 *   age: number,
 *   gender: string,
 *   ward: 'General' | 'ICU' | 'Private',
 *   bed: string,
 *   doctor: string,
 *   department: string,
 *   admissionDate: string,
 *   status: 'Stable' | 'Under Observation' | 'Critical' | 'Discharge Pending',
 *   billingPending: number,
 *   treatmentSummary?: string,
 *   bloodGroup?: string,
 *   roomTariffPerDay?: number,
 * }} ActivePatient */

const STATUS_META = {
  Admitted: { bg: '#ffedd5', text: '#9a3412', dot: '#f97316' },
  'Under Treatment': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  'Ready for Discharge': { bg: '#dcfce7', text: '#14532d', dot: '#22c55e' },
  'Discharge Requested': { bg: '#ede9fe', text: '#4c1d95', dot: '#8b5cf6' },
};

const DEFAULT_STATUS_META = { bg: '#f1f5f9', text: '#334155', dot: '#64748b' };

const WARDS = ['General', 'ICU', 'Private'];

function parseAdmissionDate(iso) {
  if (!iso) return null;
  const s = String(iso);
  if (s.includes('T')) return new Date(s);
  const day = s.slice(0, 10);
  return new Date(`${day}T12:00:00`);
}

function daysStayed(isoDate) {
  const d0 = parseAdmissionDate(isoDate);
  if (!d0 || Number.isNaN(d0.getTime())) return 0;
  const now = new Date();
  const ms = now - d0;
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function formatDisplayDate(iso) {
  const d = parseAdmissionDate(iso);
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ipdApi = {
  async fetchActivePatients(query) {
    const res = await api.get('/receptionist/ipd/active', {
      params: {
        q: query?.q || undefined,
        wardId: undefined, // UI uses ward label filter; kept client-side for now
        department: query?.department || undefined,
        doctorId: undefined,
        status: undefined,
      },
    });
    return {
      patients: Array.isArray(res?.data?.patients) ? res.data.patients : [],
      bedStats: res?.data?.bedStats || { totalBeds: 0, occupiedBeds: 0 },
    };
  },
  async fetchPatientDetail(id) {
    const res = await api.get(`/receptionist/ipd/admissions/${encodeURIComponent(id)}`);
    const a = res?.data?.admission;
    if (!a) return null;
    const wtype = String(a.ward?.type || '').toUpperCase();
    const wardLabel = wtype === 'ICU' ? 'ICU' : wtype === 'PRIVATE' ? 'Private' : 'General';
    const bill = a.billing || {};
    const admissionDate = a.admissionDate ? new Date(a.admissionDate) : null;
    const daysSinceAdmission = admissionDate
      ? Math.max(1, Math.floor((Date.now() - admissionDate.getTime()) / 86400000))
      : 1;
    const admissionCharge = bill.admissionCharge || 0;
    const roomTariffPerDay = bill.roomChargePerDay || 0;
    const advancePaid = bill.advance || 0;
    const estRoomCharge = roomTariffPerDay * daysSinceAdmission;
    const estimatedBillTotal = admissionCharge + estRoomCharge;
    const billingPending = Math.max(0, estimatedBillTotal - advancePaid);

    return {
      ...a,
      patientId: a.patient?.id || null,
      doctorId: a.doctor?.id || null,
      treatmentPlan: a.treatmentPlan || null,
      name: a.patient?.name || '',
      uhid: a.patient?.uhid || '',
      mobile: a.patient?.mobile || '',
      age: a.patient?.age ?? '',
      gender: a.patient?.gender ? String(a.patient.gender) : '',
      bloodGroup: a.patient?.bloodGroup || '',
      doctor: a.doctor?.user?.name || '',
      department: a.department || '',
      ward: wardLabel,
      bed: a.bed?.code || a.bedNumber || '',
      admissionDate: a.admissionDate,
      ipdNumber: a.ipdNumber || '',
      advancePaid,
      roomTariffPerDay,
      estimatedBillTotal,
      billingPending,
    };
  },
  async transferBed({ admissionId, toBedId, reason }) {
    const res = await api.post('/receptionist/ipd/transfers', { admissionId, toBedId, reason });
    return res?.data?.admission || null;
  },
  async dischargePatient(admissionId) {
    const res = await api.post(`/receptionist/ipd/discharge/${encodeURIComponent(admissionId)}`);
    return res?.data?.admission || null;
  },
  async addClinicalNote(admissionId, note) {
    const res = await api.patch(`/receptionist/ipd/admissions/${encodeURIComponent(admissionId)}/notes`, { notesText: note });
    return res?.data?.admission || null;
  },
};

const initialFilters = {
  ward: '',
  department: '',
  doctor: '',
  status: '',
};

export default function ActiveIPDPatients() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState(/** @type {ActivePatient[]} */ ([]));
  const [bedStats, setBedStats] = useState({ totalBeds: 0, occupiedBeds: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(initialFilters);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesPatient, setNotesPatient] = useState(/** @type {ActivePatient | null} */ (null));
  const [noteText, setNoteText] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  const [toast, setToast] = useState({ type: 'success', message: '' });
  const doctorOptions = useMemo(() => {
    const set = new Set(patients.map((p) => p.doctor).filter(Boolean));
    return Array.from(set).sort();
  }, [patients]);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = String(p.name || '').toLowerCase().includes(q);
        const uhidMatch = String(p.uhid || '').toLowerCase().includes(q);
        const ipdMatch = String(p.ipdNumber || p.id || '').toLowerCase().includes(q);
        const mobileMatch = String(p.mobile || '').toLowerCase().includes(q);
        if (!nameMatch && !uhidMatch && !ipdMatch && !mobileMatch) return false;
      }
      if (filters.ward) {
        if (String(p.ward || '').toLowerCase() !== filters.ward.toLowerCase()) return false;
      }
      if (filters.department) {
        if (String(p.department || '').toLowerCase() !== filters.department.toLowerCase()) return false;
      }
      if (filters.doctor) {
        if (String(p.doctor || '').toLowerCase() !== filters.doctor.toLowerCase()) return false;
      }
      if (filters.status) {
        if (String(p.status || '').toLowerCase() !== filters.status.toLowerCase()) return false;
      }
      return true;
    });
  }, [patients, searchQuery, filters]);

  const fetchActivePatients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ipdApi.fetchActivePatients({
        q: searchQuery,
        ward: filters.ward,
        department: filters.department,
        doctor: filters.doctor,
        status: filters.status,
      });
      setPatients(res.patients);
      setBedStats(res.bedStats);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters]);

  useEffect(() => {
    fetchActivePatients();
    // Manual refresh mode: do not auto-refetch on every filter/search change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (value) => {
    setSearchQuery(value);
  };

  const handleFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleViewPatient = async (p) => {
    setDetailOpen(true);
    setSelectedPatient(null);
    setDetailLoading(true);
    try {
      const detail = await ipdApi.fetchPatientDetail(p.id);
      setSelectedPatient(detail);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTransferBed = async (p) => {
    const next = window.prompt(`Transfer ${p.name} — enter new bed code (e.g. GW-A-12)`, p.bed);
    if (next === null) return;
    const code = String(next).trim();
    if (!code) return;
    const bedsRes = await api.get('/receptionist/ipd/beds', { params: { status: 'AVAILABLE' } });
    const beds = Array.isArray(bedsRes?.data?.items) ? bedsRes.data.items : [];
    const hit = beds.find((b) => String(b.code || '').toLowerCase() === code.toLowerCase());
    if (!hit?.id) {
      alert('Bed code not found or not available.');
      return;
    }
    await ipdApi.transferBed({ admissionId: p.id, toBedId: hit.id, reason: 'Transfer' });
    await fetchActivePatients();
  };

  const handleDischarge = async (p) => {
    if (!window.confirm(`Initiate discharge workflow for ${p.name}?`)) return;
    await ipdApi.dischargePatient(p.id);
    setPatients((prev) => prev.filter((x) => x.id !== p.id));
    setDetailOpen(false);
  };

  const handleOpenBilling = (p) => {
    navigate('/dashboard/reception/billing/generate', { state: { uhid: p.uhid, ipdId: p.ipdNumber || p.id } });
  };

  const handleAddNotes = (p) => {
    setNotesPatient(p);
    setNoteText('');
    setNotesOpen(true);
  };

  const submitNotes = async () => {
    if (!notesPatient || !noteText.trim()) return;
    setNotesSaving(true);
    try {
      await ipdApi.addClinicalNote(notesPatient.id, noteText.trim());
      setNotesOpen(false);
      setNotesPatient(null);
      setNoteText('');
    } finally {
      setNotesSaving(false);
    }
  };

  const summary = useMemo(() => {
    const total = bedStats.totalBeds || 0;
    const occ = bedStats.occupiedBeds || 0;
    const avail = Math.max(0, total - occ);
    const active = patients.length;
    return { totalBeds: total, occupiedBeds: occ, availableBeds: avail, totalActivePatients: active };
  }, [bedStats, patients.length]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast({ ...toast, message: '' })} />
      <div className="p-6 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Beds', value: summary.totalBeds, icon: MdBed, bg: '#0f2d5e', light: '#dbeafe' },
            { label: 'Occupied Beds', value: summary.occupiedBeds, icon: MdLocalHospital, bg: '#92400e', light: '#ffedd5' },
            { label: 'Available Beds', value: summary.availableBeds, icon: MdBed, bg: '#14532d', light: '#dcfce7' },
            { label: 'Total Active Patients', value: summary.totalActivePatients, icon: MdPerson, bg: '#1d4ed8', light: '#dbeafe' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition"
              >
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

        {/* Search + filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-gray-500">
            <MdFilterList className="w-4 h-4" />
            Search & filters
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-3 relative">
              <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Name / UHID / Mobile"
                className={`${inputCls} pl-9`}
                aria-label="Search by name, UHID, or mobile"
              />
            </div>
            <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-2">
              <select
                className="pl-select w-full"
                value={filters.ward}
                onChange={(e) => handleFilter('ward', e.target.value)}
              >
                <option value="">All wards</option>
                {WARDS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
              <select
                className="pl-select w-full"
                value={filters.department}
                onChange={(e) => handleFilter('department', e.target.value)}
              >
                <option value="">All departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                className="pl-select w-full"
                value={filters.doctor}
                onChange={(e) => handleFilter('doctor', e.target.value)}
              >
                <option value="">All doctors</option>
                {doctorOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                className="pl-select w-full"
                value={filters.status}
                onChange={(e) => handleFilter('status', e.target.value)}
              >
                <option value="">All statuses</option>
                {Object.keys(STATUS_META).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2 flex lg:justify-end lg:items-center">
              <button
                type="button"
                onClick={() => navigate('/dashboard/reception/ipd/admit')}
                className="w-full lg:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white bg-[#0077B6] hover:bg-[#00B4D8] shadow-sm hover:shadow-md transition whitespace-nowrap"
                title="Admit new patient"
              >
                <MdAdd className="w-4 h-4" /> Admit
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-extrabold text-gray-900">Admitted patients</p>
            <button
              type="button"
              onClick={() => fetchActivePatients()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
              disabled={loading}
            >
              <MdRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto max-h-[min(70vh,640px)] overflow-y-auto">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="sticky top-0 z-[1] shadow-sm" style={{ background: '#f8faff' }}>
                  {[
                    'Patient',
                    'UHID',
                    'Age / Gender',
                    'Ward / Bed',
                    'Doctor',
                    'Admission',
                    'Days',
                    'Status',
                    'Pending bill',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-14 text-center text-gray-400 text-sm">
                      Loading active IPD patients…
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-14 text-center text-gray-400 text-sm">
                      No active patients found matching current search/filters.
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((p) => {
                    const st = STATUS_META[p.status] || DEFAULT_STATUS_META;
                    const rowCls = 'transition hover:bg-blue-50/30';
                    return (
                      <tr key={p.id} className={rowCls}>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <MdPerson className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                              <p className="text-[11px] font-mono text-blue-600 truncate">{p.ipdNumber || p.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                            {p.uhid}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-gray-600 whitespace-nowrap">
                          {p.age} · {p.gender}
                        </td>
                        <td className="px-3 py-3 align-top text-xs">
                          <span className="font-semibold text-gray-800">{p.ward}</span>
                          <span className="text-gray-400"> · </span>
                          <span className="font-mono text-gray-700">{p.bed}</span>
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-gray-700">
                          <span className="block font-semibold">{p.doctor}</span>
                          <span className="text-gray-400">{p.department}</span>
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-gray-600 whitespace-nowrap">
                          {formatDisplayDate(p.admissionDate)}
                        </td>
                        <td className="px-3 py-3 align-top text-xs font-bold text-gray-800">{daysStayed(p.admissionDate)}</td>
                        <td className="px-3 py-3 align-top">
                          <span className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700 whitespace-nowrap">
                            <span className="pl-dot" style={{ background: st.dot }} />
                            {p.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-xs font-extrabold text-gray-800">
                          {p.billingPending > 0 ? (
                            <span>₹{p.billingPending.toLocaleString('en-IN')}</span>
                          ) : (
                            <span className="text-gray-400 font-semibold">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              title="View details"
                              onClick={() => handleViewPatient(p)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-700 transition"
                            >
                              <MdVisibility className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title="Add notes"
                              onClick={() => handleAddNotes(p)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition"
                            >
                              <MdNotes className="w-4 h-4" />
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

          {!loading && patients.length === 0 ? (
            <div className="text-center py-14 text-gray-400 border-t border-gray-50">
              <MdBed className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No active patients found</p>
              <p className="text-xs mt-1 text-gray-400">Adjust search or filters, or admit a new patient.</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Detail modal */}
      {detailOpen
        ? createPortal(
            <div className="pl-modalOverlay" role="dialog" aria-modal="true">
              <div className="pl-modal pl-modalAnimate max-w-[880px]">
                <div className="pl-modalHeader">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {detailLoading ? 'Loading…' : selectedPatient?.name || 'Patient'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      UHID:{' '}
                      <span className="font-mono font-bold text-blue-600">{selectedPatient?.uhid || '—'}</span>
                      {' · '}
                      IPD:{' '}
                      <span className="font-mono font-bold text-blue-600">
                        {selectedPatient?.ipdNumber || selectedPatient?.id || '—'}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailOpen(false)}
                    className="pl-modalClose"
                    title="Close"
                  >
                    <MdClose className="w-5 h-5" />
                  </button>
                </div>

                <div className="pl-modalBody">
                  {detailLoading ? (
                    <p className="text-sm text-gray-500 py-6 text-center">Loading patient record…</p>
                  ) : selectedPatient ? (
                    <>
                      <div className="pl-modalGrid">
                        <div className="pl-modalCard">
                          <p className="pl-modalCardTitle">Patient</p>
                          <div className="pl-kv">
                            <div>
                              <p className="k">Name</p>
                              <p className="v">{selectedPatient.name}</p>
                            </div>
                            <div>
                              <p className="k">Age / Gender</p>
                              <p className="v">
                                {selectedPatient.age} · {selectedPatient.gender}
                              </p>
                            </div>
                            <div>
                              <p className="k">Mobile</p>
                              <p className="v font-mono">{selectedPatient.mobile}</p>
                            </div>
                            <div>
                              <p className="k">Blood group</p>
                              <p className="v">{selectedPatient.bloodGroup || '—'}</p>
                            </div>
                          </div>
                        </div>

                        <div className="pl-modalCard">
                          <p className="pl-modalCardTitle">Admission</p>
                          <div className="pl-kv">
                            <div>
                              <p className="k">Department</p>
                              <p className="v">{selectedPatient.department}</p>
                            </div>
                            <div>
                              <p className="k">Consultant</p>
                              <p className="v">{selectedPatient.doctor}</p>
                            </div>
                            <div>
                              <p className="k">Ward / Bed</p>
                              <p className="v">
                                {selectedPatient.ward} · {selectedPatient.bed}
                              </p>
                            </div>
                            <div>
                              <p className="k">Admitted on</p>
                              <p className="v">{formatDisplayDate(selectedPatient.admissionDate)}</p>
                            </div>
                            <div>
                              <p className="k">Days stayed</p>
                              <p className="v">{daysStayed(selectedPatient.admissionDate)}</p>
                            </div>
                            <div>
                              <p className="k">Status</p>
                              <p className="v">{selectedPatient.status}</p>
                            </div>
                          </div>
                        </div>

                        <div className="pl-modalCard">
                          <p className="pl-modalCardTitle">Treatment summary</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{selectedPatient.treatmentSummary || '—'}</p>
                          <p className="text-xs text-gray-400 mt-3">
                            Last vitals (mock): {selectedPatient.lastVitals || '—'}
                          </p>
                        </div>

                        <div className="pl-modalCard">
                          <p className="pl-modalCardTitle">Billing</p>
                          <div className="pl-kv">
                            <div>
                              <p className="k">Pending amount</p>
                              <p className="v text-amber-700">
                                ₹{(selectedPatient.billingPending ?? 0).toLocaleString('en-IN')}
                              </p>
                            </div>
                            <div>
                              <p className="k">Est. total (mock)</p>
                              <p className="v">₹{(selectedPatient.estimatedBillTotal ?? 0).toLocaleString('en-IN')}</p>
                            </div>
                            <div>
                              <p className="k">Advance paid</p>
                              <p className="v">₹{(selectedPatient.advancePaid ?? 0).toLocaleString('en-IN')}</p>
                            </div>
                            <div>
                              <p className="k">Room tariff / day</p>
                              <p className="v">
                                ₹{(selectedPatient.roomTariffPerDay ?? 0).toLocaleString('en-IN')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pl-modalActions">
                        <button
                          type="button"
                          className="pl-actionBtn"
                          onClick={() => handleOpenBilling(selectedPatient)}
                          title="Open billing"
                        >
                          <MdPayments className="w-4 h-4" /> Open billing
                        </button>
                        <button
                          type="button"
                          className="pl-actionBtn"
                          onClick={() => handleTransferBed(selectedPatient)}
                        >
                          <MdSwapHoriz className="w-4 h-4" /> Transfer bed
                        </button>
                        <button
                          type="button"
                          className="pl-actionBtn"
                          onClick={() => handleAddNotes(selectedPatient)}
                        >
                          <MdNotes className="w-4 h-4" /> Add notes
                        </button>
                        <button
                          type="button"
                          className="pl-actionBtn"
                          onClick={() => handleDischarge(selectedPatient)}
                          disabled={selectedPatient.status === 'Critical'}
                        >
                          <MdExitToApp className="w-4 h-4" /> Discharge
                        </button>
                        <button
                          type="button"
                          className="pl-actionBtn"
                          onClick={() => navigate('/dashboard/reception/ipd/transfers')}
                        >
                          <MdOpenInNew className="w-4 h-4" /> Transfers queue
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 py-6 text-center">Record not found.</p>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Notes modal */}
      {notesOpen && notesPatient
        ? createPortal(
            <div className="pl-modalOverlay" role="dialog" aria-modal="true">
              <div className="pl-modal pl-modalAnimate max-w-[520px]">
                <div className="pl-modalHeader">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Add reception note</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {notesPatient.name} · {notesPatient.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="pl-modalClose"
                    onClick={() => {
                      setNotesOpen(false);
                      setNotesPatient(null);
                    }}
                  >
                    <MdClose className="w-5 h-5" />
                  </button>
                </div>
                <div className="pl-modalBody">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={5}
                    placeholder="Visitor request, billing follow-up, etc."
                    className={inputCls}
                  />
                  <div className="pl-modalActions justify-end">
                    <button
                      type="button"
                      className="pl-actionBtn"
                      disabled={notesSaving || !noteText.trim()}
                      onClick={submitNotes}
                    >
                      <MdNotes className="w-4 h-4" />
                      Save note
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

