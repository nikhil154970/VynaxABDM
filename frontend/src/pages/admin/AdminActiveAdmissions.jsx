import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MdBed, MdClose, MdFilterList, MdLocalHospital, MdPerson,
  MdRefresh, MdSearch, MdVisibility, MdPeople,
} from 'react-icons/md';
import api from '../../utils/api';
import { DEPARTMENTS } from '../../constants/departments';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

const STATUS_META = {
  Admitted: { bg: '#ffedd5', text: '#9a3412', dot: '#f97316' },
  'Under Treatment': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  'Ready for Discharge': { bg: '#dcfce7', text: '#14532d', dot: '#22c55e' },
  'Discharge Requested': { bg: '#ede9fe', text: '#4c1d95', dot: '#8b5cf6' },
};

const DEFAULT_STATUS_META = { bg: '#f1f5f9', text: '#334155', dot: '#64748b' };

const WARD_TYPES = ['General', 'ICU', 'Private'];
const STATUS_OPTIONS = ['Admitted', 'Under Treatment', 'Ready for Discharge', 'Discharge Requested'];

function admissionStatusLabel(raw) {
  const s = String(raw || '').toUpperCase();
  if (s === 'ADMITTED') return 'Admitted';
  if (s === 'UNDER_TREATMENT') return 'Under Treatment';
  if (s === 'READY_FOR_DISCHARGE') return 'Ready for Discharge';
  if (s === 'DISCHARGE_REQUESTED') return 'Discharge Requested';
  return raw || 'Admitted';
}

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
  return Math.max(0, Math.floor((Date.now() - d0.getTime()) / (24 * 60 * 60 * 1000)));
}

function formatDisplayDate(iso) {
  const d = parseAdmissionDate(iso);
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminActiveAdmissions() {
  const [patients, setPatients] = useState([]);
  const [bedStats, setBedStats] = useState({ totalBeds: 0, occupiedBeds: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState({ ward: '', department: '', doctorId: '', status: '' });
  const [doctors, setDoctors] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    api.get('/doctors/lookup').then((res) => {
      const rows = Array.isArray(res?.data?.items) ? res.data.items : [];
      setDoctors(rows);
    }).catch(() => setDoctors([]));
  }, []);

  const fetchActivePatients = useCallback(async (search, dept, docId, stat) => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (search) params.q = search;
      if (dept) params.department = dept;
      if (docId) params.doctorId = docId;
      if (stat) params.status = stat;

      const mainRes = await api.get('/receptionist/ipd/active', { params });
      const mainPatients = Array.isArray(mainRes?.data?.patients) ? mainRes.data.patients : [];

      setPatients(mainPatients);
      setBedStats(mainRes?.data?.bedStats || { totalBeds: 0, occupiedBeds: 0 });
    } catch (e) {
      setPatients([]);
      setBedStats({ totalBeds: 0, occupiedBeds: 0 });
      setError(e?.response?.data?.message || 'Failed to load active admissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivePatients(searchQuery, filters.department, filters.doctorId, filters.status);
  }, [fetchActivePatients, searchQuery, filters]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchQuery(searchDraft);
  };

  const handleFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setSearchDraft('');
    setSearchQuery('');
    setFilters({ ward: '', department: '', doctorId: '', status: '' });
  };

  const handleViewPatient = async (p) => {
    setDetailOpen(true);
    setSelectedPatient(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/receptionist/ipd/admissions/${encodeURIComponent(p.id)}`);
      const a = res?.data?.admission;
      if (!a) { setDetailLoading(false); return; }
      const wtype = String(a.ward?.type || '').toUpperCase();
      const wardLabel = wtype === 'ICU' ? 'ICU' : wtype === 'PRIVATE' ? 'Private' : 'General';
      const bill = a.billing || {};
      const admissionDate = a.admissionDate ? new Date(a.admissionDate) : null;
      const daysSince = admissionDate ? Math.max(1, Math.floor((Date.now() - admissionDate.getTime()) / 86400000)) : 1;
      const admissionCharge = bill.admissionCharge || 0;
      const roomTariffPerDay = bill.roomChargePerDay || 0;
      const advancePaid = bill.advance || 0;
      const estRoomCharge = roomTariffPerDay * daysSince;
      const estimatedBillTotal = admissionCharge + estRoomCharge;
      const billingPending = Math.max(0, estimatedBillTotal - advancePaid);

      setSelectedPatient({
        ...a,
        patientId: a.patient?.id || null,
        doctorId: a.doctor?.id || null,
        name: a.patient?.name || '',
        uhid: a.patient?.uhid || '',
        mobile: a.patient?.mobile || '',
        age: a.patient?.age ?? '',
        gender: a.patient?.gender ? String(a.patient.gender) : '',
        bloodGroup: a.patient?.bloodGroup || '',
        allergies: a.patient?.allergies || '',
        doctor: a.doctor?.user?.name || '',
        department: a.department || '',
        ward: wardLabel,
        wardName: a.ward?.name || '',
        bed: a.bed?.code || a.bedNumber || '',
        admissionDate: a.admissionDate,
        ipdNumber: a.ipdNumber || '',
        advancePaid,
        roomTariffPerDay,
        estimatedBillTotal,
        billingPending,
        treatmentPlan: a.treatmentPlan || null,
        notesText: a.notesText || '',
        status: admissionStatusLabel(a.status),
        nurse: a.nurse?.name || a.nurse?.email || '',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  // Client-side ward filter
  const filteredPatients = useMemo(() => {
    if (!filters.ward) return patients;
    return patients.filter((p) => p.ward === filters.ward);
  }, [patients, filters.ward]);

  const summary = useMemo(() => {
    const total = bedStats.totalBeds || 0;
    const occ = bedStats.occupiedBeds || 0;
    const active = filteredPatients.length;
    const icu = filteredPatients.filter((p) => p.ward === 'ICU').length;
    const dischargePending = filteredPatients.filter(
      (p) => p.status === 'Ready for Discharge' || p.status === 'Discharge Requested',
    ).length;
    const occPct = total > 0 ? Math.round((occ / total) * 100) : 0;
    return {
      totalBeds: total,
      occupiedBeds: occ,
      availableBeds: Math.max(0, total - occ),
      totalActivePatients: active,
      icuPatients: icu,
      readyForDischarge: dischargePending,
      bedOccupancyPct: occPct,
    };
  }, [bedStats, filteredPatients]);

  const hasActiveFilters = searchQuery || filters.department || filters.ward || filters.doctorId || filters.status;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Active Admissions</h1>
          <p className="text-xs text-gray-400 mt-1">
            {summary.totalActivePatients} patients · {summary.occupiedBeds}/{summary.totalBeds} beds occupied ({summary.bedOccupancyPct}%)
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchActivePatients(searchQuery, filters.department, filters.doctorId, filters.status)}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
        >
          <MdRefresh className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={() => fetchActivePatients(searchQuery, filters.department, filters.doctorId, filters.status)}
            className="ml-3 text-xs font-semibold underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Admissions', value: summary.totalActivePatients, icon: MdPerson, bg: '#1d4ed8', light: '#dbeafe' },
          { label: 'ICU Patients', value: summary.icuPatients, icon: MdLocalHospital, bg: '#0f2d5e', light: '#dbeafe' },
          { label: 'Ready for Discharge', value: summary.readyForDischarge, icon: MdPeople, bg: '#14532d', light: '#dcfce7' },
          { label: 'Bed Occupancy', value: `${summary.bedOccupancyPct}%`, icon: MdBed, bg: '#92400e', light: '#ffedd5' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl" style={{ color: s.bg }}>
                  <Icon className="w-6 h-6" />
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{loading ? '—' : s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
          <MdFilterList className="w-4 h-4" /> Search &amp; filters
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Name / UHID / IPD No / Mobile"
              className={`${inputCls} pl-9`}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition shrink-0"
          >
            Search
          </button>
        </form>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <select value={filters.ward} onChange={(e) => handleFilter('ward', e.target.value)} className={inputCls}>
            <option value="">All ward types</option>
            {WARD_TYPES.map((w) => (<option key={w} value={w}>{w}</option>))}
          </select>
          <select value={filters.department} onChange={(e) => handleFilter('department', e.target.value)} className={inputCls}>
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
          <select value={filters.doctorId} onChange={(e) => handleFilter('doctorId', e.target.value)} className={inputCls}>
            <option value="">All doctors</option>
            {doctors.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
          </select>
          <select value={filters.status} onChange={(e) => handleFilter('status', e.target.value)} className={inputCls}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-2.5 rounded-xl text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">Admitted patients</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50 bg-gray-50/50">
                <th className="px-4 py-3">IPD No</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Age/Gender</th>
                <th className="px-4 py-3">Ward &amp; Bed</th>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Admitted On</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">Loading…</td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    <MdBed className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No active admissions match your filters</p>
                  </td>
                </tr>
              ) : filteredPatients.map((p) => {
                const st = STATUS_META[p.status] || DEFAULT_STATUS_META;
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 font-medium">{p.ipdNumber}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <MdPerson className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                          <p className="text-[11px] font-mono text-blue-600">{p.uhid}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {p.age} · {p.gender}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-semibold text-gray-800">{p.ward}</span>
                      <span className="text-gray-300 mx-1">/</span>
                      <span className="font-mono text-gray-600">{p.bed}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{p.doctor}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.department}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {formatDisplayDate(p.admissionDate)}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-gray-800">{daysStayed(p.admissionDate)}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: st.bg, color: st.text }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: st.dot }} />
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        title="View details"
                        onClick={() => handleViewPatient(p)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-700 transition"
                      >
                        <MdVisibility className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      {detailOpen ? createPortal(
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white shadow-2xl h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-gray-900 truncate">
                  {detailLoading ? 'Loading…' : selectedPatient?.name || 'Patient'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  UHID: <span className="font-mono font-semibold text-blue-600">{selectedPatient?.uhid || '—'}</span>
                  {' · '}
                  IPD: <span className="font-mono font-semibold text-blue-600">{selectedPatient?.ipdNumber || '—'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"
              >
                <MdClose className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {detailLoading ? (
                <p className="text-sm text-gray-500 py-10 text-center">Loading patient record…</p>
              ) : selectedPatient ? (
                <>
                  {/* Patient Demographics */}
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Patient</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-[11px] text-gray-400">Name</p>
                        <p className="font-semibold text-gray-900">{selectedPatient.name}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Age / Gender</p>
                        <p className="font-semibold text-gray-900">{selectedPatient.age} · {selectedPatient.gender}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Mobile</p>
                        <p className="font-mono text-gray-800">{selectedPatient.mobile}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Blood Group</p>
                        <p className="font-semibold text-gray-900">{selectedPatient.bloodGroup || '—'}</p>
                      </div>
                      {selectedPatient.allergies ? (
                        <div className="col-span-2">
                          <p className="text-[11px] text-gray-400">Allergies</p>
                          <p className="text-gray-800">{selectedPatient.allergies}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Admission Info */}
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Admission</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-[11px] text-gray-400">Department</p>
                        <p className="font-semibold text-gray-900">{selectedPatient.department}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Consultant</p>
                        <p className="font-semibold text-gray-900">{selectedPatient.doctor}</p>
                      </div>
                      {selectedPatient.nurse ? (
                        <div>
                          <p className="text-[11px] text-gray-400">Assigned Nurse</p>
                          <p className="font-semibold text-gray-900">{selectedPatient.nurse}</p>
                        </div>
                      ) : null}
                      <div>
                        <p className="text-[11px] text-gray-400">Ward</p>
                        <p className="font-semibold text-gray-900">{selectedPatient.wardName || selectedPatient.ward}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Bed</p>
                        <p className="font-mono text-gray-800">{selectedPatient.bed}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Admitted On</p>
                        <p className="font-semibold text-gray-900">{formatDisplayDate(selectedPatient.admissionDate)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Days Stayed</p>
                        <p className="font-semibold text-gray-900">{daysStayed(selectedPatient.admissionDate)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Status</p>
                        <p className="font-semibold text-gray-900">{selectedPatient.status}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Room Tariff / Day</p>
                        <p className="font-semibold text-gray-900">
                          {selectedPatient.roomTariffPerDay ? `₹${Number(selectedPatient.roomTariffPerDay).toLocaleString('en-IN')}` : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Billing Summary */}
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Billing</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-[11px] text-gray-400">Pending Amount</p>
                        <p className="font-semibold text-amber-700">
                          ₹{(selectedPatient.billingPending ?? 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Estimated Total</p>
                        <p className="font-semibold text-gray-900">
                          ₹{(selectedPatient.estimatedBillTotal ?? 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Advance Paid</p>
                        <p className="font-semibold text-gray-900">
                          ₹{(selectedPatient.advancePaid ?? 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Room Tariff / Day</p>
                        <p className="font-semibold text-gray-900">
                          {selectedPatient.roomTariffPerDay ? `₹${Number(selectedPatient.roomTariffPerDay).toLocaleString('en-IN')}` : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Notes / Treatment Summary */}
                  {selectedPatient.notesText ? (
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</h3>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedPatient.notesText}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-gray-500 py-10 text-center">Record not found.</p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

