import { useAuth } from '../../context/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import {
  MdPeople,
  MdEventAvailable,
  MdHotel,
  MdCurrencyRupee,
  MdMedicalServices,
  MdBed,
  MdAdminPanelSettings,
  MdBadge,
  MdLocalHospital,
  MdTimer,
  MdCheckCircle,
  MdInventory,
  MdRefresh,
  MdArrowForward,
  MdTrendingUp,
} from 'react-icons/md';

const STATUS_STYLE = {
  Consulting: { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  Admitted: { bg: '#fff7ed', text: '#c2410c', dot: '#f97316' },
  Waiting: { bg: '#fefce8', text: '#a16207', dot: '#eab308' },
  Discharged: { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' },
};

const CARD_DEFS = [
  { key: 'totalPatients', label: 'Total Patients', sub: 'All-time', Icon: MdPeople, accent: '#3b82f6', bg: '#eff6ff', route: '/dashboard/admin/patients' },
  { key: 'opdToday', label: 'OPD Today', sub: 'Appointments today', Icon: MdEventAvailable, accent: '#10b981', bg: '#f0fdf4', route: '/dashboard/admin/appointments' },
  { key: 'ipdActive', label: 'IPD Active', sub: 'Active admissions', Icon: MdHotel, accent: '#f97316', bg: '#fff7ed', route: '/dashboard/admin/ipd' },
  { key: 'revenueToday', label: 'Revenue Today', sub: 'Collected today', Icon: MdCurrencyRupee, accent: '#8b5cf6', bg: '#fdf4ff', route: '/dashboard/admin/finance/bills', rupee: true },
  { key: 'doctorsActive', label: 'Doctors Active', sub: 'doctors.inactive', Icon: MdMedicalServices, accent: '#0ea5e9', bg: '#f0f9ff', route: '/dashboard/admin/doctors', inactiveProp: 'doctors' },
  { key: 'bedsAvailable', label: 'Beds Available', sub: 'beds.occupied', Icon: MdBed, accent: '#ef4444', bg: '#fef2f2', route: '/dashboard/admin/beds', bedProp: true },
  { key: 'usersActive', label: 'Users Active', sub: 'users.inactive', Icon: MdAdminPanelSettings, accent: '#22c55e', bg: '#f0fdf4', route: '/dashboard/admin/users', inactiveProp: 'users' },
  { key: 'doctorsTotal', label: 'Total Doctors', sub: 'All profiles', Icon: MdBadge, accent: '#f59e0b', bg: '#fffbeb', route: '/dashboard/admin/doctors' },
  { key: 'otScheduled', label: 'OT Scheduled', sub: 'Today surgeries', Icon: MdLocalHospital, accent: '#6366f1', bg: '#eef2ff' },
  { key: 'otInProgress', label: 'OT In Progress', sub: 'Active surgeries', Icon: MdTimer, accent: '#f59e0b', bg: '#fffbeb' },
  { key: 'otCompleted', label: 'OT Completed', sub: 'Done today', Icon: MdCheckCircle, accent: '#10b981', bg: '#f0fdf4' },
  { key: 'equipment', label: 'Equipment', sub: 'ot.allocated', Icon: MdInventory, accent: '#8b5cf6', bg: '#fdf4ff' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/dashboard/overview');
      setData(res.data || null);
    } catch (e) {
      setData(null);
      setError(e?.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const s = data?.stats || {};
  const beds = s.beds || {};
  const docs = s.doctors || {};
  const users = s.users || {};
  const ot = s.ot || {};

  const getValue = (def) => {
    if (loading) return '—';
    if (def.rupee) return `₹${Number(s.revenueToday || 0).toLocaleString('en-IN')}`;
    if (def.bedProp) return `${beds.available ?? 0} / ${beds.total ?? 0}`;
    const map = {
      totalPatients: s.totalPatients ?? 0,
      opdToday: s.opdToday ?? 0,
      ipdActive: s.ipdActive ?? 0,
      doctorsActive: docs.active ?? 0,
      usersActive: users.active ?? 0,
      doctorsTotal: docs.total ?? 0,
      otScheduled: ot.scheduledToday ?? 0,
      otInProgress: ot.inProgress ?? 0,
      otCompleted: ot.completedToday ?? 0,
      equipment: ot.totalEquipment ?? 0,
    };
    return String(map[def.key] ?? 0);
  };

  const getSub = (def) => {
    if (loading) return '…';
    if (def.inactiveProp === 'doctors') return `${docs.inactive ?? 0} inactive`;
    if (def.inactiveProp === 'users') return `${users.inactive ?? 0} inactive`;
    if (def.bedProp) return `${beds.occupied ?? 0} occupied`;
    if (def.key === 'equipment') return `${ot.allocatedEquipment ?? 0} allocated`;
    return def.sub;
  };

  const recentPatients = useMemo(() => (Array.isArray(data?.recentPatients) ? data.recentPatients : []), [data]);

  const formatTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-gray-50/50 min-h-screen">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Welcome back, {user?.name?.split(' ')[0] || 'Admin'} 
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{today}</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white text-[#0077B6] border border-[#0077B6]/20 hover:border-[#0077B6] hover:bg-sky-50 transition-all duration-200 shadow-sm disabled:opacity-60 cursor-pointer shrink-0"
        >
          <MdRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────── */}
      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={load} className="text-xs font-semibold underline ml-3">Retry</button>
        </div>
      ) : null}

      {/* ── Stats Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {CARD_DEFS.map((def) => {
          const inner = (
            <div className="p-4 h-full flex flex-col justify-between gap-2">
              {/* top row: icon + accent bar */}
              <div className="flex items-start justify-between">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: def.bg }}>
                  <def.Icon className="w-5 h-5" style={{ color: def.accent }} />
                </div>
                <MdTrendingUp className="w-3.5 h-3.5 text-emerald-400 mt-0.5" />
              </div>
              {/* value */}
              <div>
                <p className="text-xl font-bold text-gray-900 leading-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {getValue(def)}
                </p>
                <p className="text-[11px] font-semibold text-gray-700 mt-0.5">{def.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{getSub(def)}</p>
              </div>
              {/* accent bar */}
              <div className="h-0.5 w-full rounded-full mt-1" style={{ background: def.bg }}>
                <div className="h-0.5 rounded-full w-2/3" style={{ background: def.accent }} />
              </div>
            </div>
          );

          const cls = "bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden";

          return def.route ? (
            <button
              key={def.key}
              type="button"
              onClick={() => navigate(def.route)}
              className={`${cls} text-left w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0077B6]/40`}
            >
              {inner}
            </button>
          ) : (
            <div key={def.key} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* ── Quick Actions ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'All Appointments', route: '/dashboard/admin/appointments', accent: '#3b82f6', bg: '#eff6ff' },
          { label: 'All Patients', route: '/dashboard/admin/patients', accent: '#10b981', bg: '#f0fdf4' },
          { label: 'IPD & Admissions', route: '/dashboard/admin/ipd', accent: '#f97316', bg: '#fff7ed' },
          { label: 'Revenue Snapshot', route: '/dashboard/admin/finance/revenue-snapshot', accent: '#8b5cf6', bg: '#fdf4ff' },
        ].map((qa) => (
          <button
            key={qa.label}
            type="button"
            onClick={() => navigate(qa.route)}
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 px-4 py-3 flex items-center justify-between gap-2 cursor-pointer"
          >
            <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 transition">{qa.label}</span>
            <span className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200" style={{ background: qa.bg }}>
              <MdArrowForward className="w-4 h-4" style={{ color: qa.accent }} />
            </span>
          </button>
        ))}
      </div>

      {/* ── Recent Patients ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* table header bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Recent Patients</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Latest patient activity across all departments</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/admin/patients')}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0077B6] bg-blue-50 hover:bg-sky-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
          >
            View All
            <MdArrowForward className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#001B48] text-left text-[10px] font-semibold uppercase tracking-wider text-white/70 border-b border-[#0077B6]/20">
                <th className="px-5 py-3 whitespace-nowrap">Patient ID</th>
                <th className="px-5 py-3 whitespace-nowrap">Name</th>
                <th className="px-5 py-3 whitespace-nowrap">Age</th>
                <th className="px-5 py-3 whitespace-nowrap">Doctor</th>
                <th className="px-5 py-3 whitespace-nowrap">Status</th>
                <th className="px-5 py-3 whitespace-nowrap">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-xs">Loading…</td></tr>
              ) : recentPatients.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-xs">No patients found today.</td></tr>
              ) : recentPatients.map((p) => {
                const st = STATUS_STYLE[p.status] || { bg: '#f3f4f6', text: '#374151', dot: '#9ca3af' };
                return (
                  <tr key={p.id} className="hover:bg-gray-50/70 transition duration-150">
                    <td className="px-5 py-3 font-mono text-[11px] text-[#0077B6] font-semibold whitespace-nowrap">{p.id}</td>
                    <td className="px-5 py-3 text-xs font-semibold text-gray-800">{p.name}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{p.age != null ? `${p.age} yrs` : '—'}</td>
                    <td className="px-5 py-3 text-xs text-gray-600">{p.doctor}</td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: st.bg, color: st.text }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[11px] text-gray-400 whitespace-nowrap">{formatTime(p.time)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
