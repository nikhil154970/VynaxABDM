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
} from 'react-icons/md';

const STATUS_STYLE = {
  Consulting: { bg: '#eff6ff', text: '#1d4ed8' },
  Admitted:   { bg: '#fff7ed', text: '#c2410c' },
  Waiting:    { bg: '#fefce8', text: '#a16207' },
  Discharged: { bg: '#f0fdf4', text: '#15803d' },
};

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
      setError(e?.response?.data?.message || 'Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = useMemo(() => {
    const s = data?.stats || {};
    const beds = s.beds || {};
    const doctors = s.doctors || {};
    const users = s.users || {};

    return [
      {
        label: 'Total Patients',
        value: loading ? '—' : (s.totalPatients ?? 0).toLocaleString('en-IN'),
        change: 'All-time',
        Icon: MdPeople,
        color: '#eff6ff',
        border: '#bfdbfe',
        text: '#1d4ed8',
        to: '/dashboard/admin/patients',
      },
      { label: 'OPD Today', value: loading ? '—' : (s.opdToday ?? 0).toLocaleString('en-IN'), change: 'Appointments today', Icon: MdEventAvailable, color: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
      { label: 'IPD Active', value: loading ? '—' : (s.ipdActive ?? 0).toLocaleString('en-IN'), change: 'Active admissions', Icon: MdHotel, color: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
      { label: 'Revenue Today', value: loading ? '—' : `₹${Number(s.revenueToday || 0).toLocaleString('en-IN')}`, change: 'Collected today', Icon: MdCurrencyRupee, color: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce' },
      { label: 'Doctors Active', value: loading ? '—' : `${doctors.active ?? 0}`, change: `${doctors.inactive ?? 0} inactive`, Icon: MdMedicalServices, color: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
      { label: 'Beds Available', value: loading ? '—' : `${beds.available ?? 0} / ${beds.total ?? 0}`, change: `${beds.occupied ?? 0} occupied`, Icon: MdBed, color: '#fef2f2', border: '#fecaca', text: '#dc2626' },
      { label: 'Users Active', value: loading ? '—' : `${users.active ?? 0}`, change: `${users.inactive ?? 0} inactive`, Icon: MdAdminPanelSettings, color: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
      { label: 'Doctors Total', value: loading ? '—' : `${doctors.total ?? 0}`, change: 'Profiles', Icon: MdBadge, color: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
    ];
  }, [data, loading]);

  const recentPatients = useMemo(() => (Array.isArray(data?.recentPatients) ? data.recentPatients : []), [data]);

  const formatTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome back, {user?.name} &bull; {today}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
          System Online
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={load}
            className="ml-3 text-xs font-semibold underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((s) => {
          const cardInner = (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl" style={{ color: s.text }}>
                  {s.Icon ? <s.Icon className="w-6 h-6" /> : null}
                </span>
                <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: s.color, color: s.text }}>
                  {s.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </>
          );
          if (s.to) {
            return (
              <button
                key={s.label}
                type="button"
                title="Open All Patients"
                onClick={() => navigate(s.to)}
                className="bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition text-left w-full cursor-pointer hover:border-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
                style={{ borderColor: s.border }}
              >
                {cardInner}
              </button>
            );
          }
          return (
            <div key={s.label} className="bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition" style={{ borderColor: s.border }}>
              {cardInner}
            </div>
          );
        })}
      </div>

      {/* Recent Patients */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Recent Patients</h2>
          <button className="text-xs text-blue-600 hover:text-blue-800 font-medium transition">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
                <th className="px-6 py-3">Patient ID</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Age</th>
                <th className="px-6 py-3">Doctor</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : recentPatients.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">No patients found today.</td></tr>
              ) : recentPatients.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-mono text-xs text-blue-600 font-medium">{p.id}</td>
                  <td className="px-6 py-4 font-medium text-gray-800">{p.name}</td>
                  <td className="px-6 py-4 text-gray-500">{p.age ?? '—'}{p.age != null ? ' yrs' : ''}</td>
                  <td className="px-6 py-4 text-gray-600">{p.doctor}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={STATUS_STYLE[p.status]}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">{formatTime(p.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
