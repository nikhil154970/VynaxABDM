import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import {
  MdPeople,
  MdBed,
  MdReceiptLong,
  MdCalendarToday,
  MdAdd,
  MdArrowForward,
  MdRefresh,
  MdAccessTime,
  MdPerson,
  MdTrendingUp,
  MdLocalHospital,
  MdScience,
} from 'react-icons/md';

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const OPD_STATUS_META = {
  Waiting: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  'In Consultation': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  Completed: { bg: '#dcfce7', text: '#14532d', dot: '#22c55e' },
};

export default function ReceptionDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const todayISO = toISODate(new Date());
  const todayHuman = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stats, setStats] = useState({
    todayRegs: 0,
    opdToday: 0,
    ipdActive: 0,
    pendingBills: 0,
    pendingAmount: 0,
    totalBeds: 0,
    occupiedBeds: 0,
  });

  const [opdItems, setOpdItems] = useState([]);
  const [recentRegs, setRecentRegs] = useState([]);

  const fetchOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const [patientsSet, apptSet, opdSet, ipdSet, billingSet] = await Promise.allSettled([
        api.get('/receptionist/patients', { params: { date: todayISO, page: 1, pageSize: 6 } }),
        api.get('/receptionist/appointments', { params: { date: todayISO, page: 1, pageSize: 1 } }),
        api.get('/receptionist/opd/today', { params: { date: todayISO } }),
        api.get('/receptionist/ipd/active'),
        api.get('/receptionist/billing', { params: { dateFrom: todayISO, dateTo: todayISO } }),
      ]);

      const patientsRes = patientsSet.status === 'fulfilled' ? patientsSet.value : null;
      const apptRes = apptSet.status === 'fulfilled' ? apptSet.value : null;
      const opdRes = opdSet.status === 'fulfilled' ? opdSet.value : null;
      const ipdRes = ipdSet.status === 'fulfilled' ? ipdSet.value : null;
      const billingRes = billingSet.status === 'fulfilled' ? billingSet.value : null;

      const pStats = patientsRes?.data?.stats || {};
      const apptTotal = apptRes?.data?.pagination?.total ?? 0;
      const opdList = Array.isArray(opdRes?.data?.items) ? opdRes.data.items : [];
      const ipdPatients = Array.isArray(ipdRes?.data?.patients) ? ipdRes.data.patients : [];
      const bedStats = ipdRes?.data?.bedStats || { totalBeds: 0, occupiedBeds: 0 };
      const bills = Array.isArray(billingRes?.data?.items) ? billingRes.data.items : [];

      const pendingBills = bills.filter((b) => String(b.paymentStatus || '').toLowerCase() !== 'paid' && (b.pending || 0) > 0);
      const pendingAmount = pendingBills.reduce((s, b) => s + Math.max(0, Number(b.pending || 0)), 0);

      setStats({
        todayRegs: Number(pStats.todayRegs || 0),
        opdToday: Number(apptTotal || opdList.length || 0),
        ipdActive: Number(pStats.ipdActive || ipdPatients.length || 0),
        pendingBills: pendingBills.length,
        pendingAmount,
        totalBeds: Number(bedStats.totalBeds || 0),
        occupiedBeds: Number(bedStats.occupiedBeds || 0),
      });

      setOpdItems(opdList);
      setRecentRegs(Array.isArray(patientsRes?.data?.items) ? patientsRes.data.items : []);

      // If everything failed, show a single error banner.
      const anyOk =
        patientsSet.status === 'fulfilled' ||
        apptSet.status === 'fulfilled' ||
        opdSet.status === 'fulfilled' ||
        ipdSet.status === 'fulfilled' ||
        billingSet.status === 'fulfilled';
      if (!anyOk) {
        const firstErr =
          patientsSet.status === 'rejected'
            ? patientsSet.reason
            : apptSet.status === 'rejected'
              ? apptSet.reason
              : opdSet.status === 'rejected'
                ? opdSet.reason
                : ipdSet.status === 'rejected'
                  ? ipdSet.reason
                  : billingSet.status === 'rejected'
                    ? billingSet.reason
                    : null;
        setError(firstErr?.response?.data?.message || 'Failed to load dashboard overview');
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load dashboard overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const derived = useMemo(() => {
    const totalBeds = stats.totalBeds || 0;
    const occupiedBeds = stats.occupiedBeds || 0;
    const availableBeds = Math.max(0, totalBeds - occupiedBeds);
    const occPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    const waiting = opdItems.filter((x) => x.status === 'Waiting').length;
    const consulting = opdItems.filter((x) => x.status === 'In Consultation').length;
    return { availableBeds, occPct, waiting, consulting };
  }, [stats.totalBeds, stats.occupiedBeds, opdItems]);

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-100/50 to-gray-50 min-h-0">
      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top bar */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-slate-900">Reception Dashboard</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {todayHuman} {user?.name ? `· Welcome, ${user.name}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchOverview}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
              title="Refresh"
            >
              <MdRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/reception/patients/register')}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:shadow-md"
              style={{ background: 'linear-gradient(135deg, #0f2d5e 0%, #1a4a8a 60%, #1d4ed8 100%)' }}
            >
              <MdAdd className="h-4 w-4" />
              Register patient
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: 'Today registrations',
              value: loading ? '—' : stats.todayRegs,
              sub: 'Patients registered today',
              icon: MdPeople,
              bg: '#0f2d5e',
              light: '#dbeafe',
            },
            {
              label: 'OPD (today)',
              value: loading ? '—' : stats.opdToday,
              sub: `${derived.waiting} waiting · ${derived.consulting} in consultation`,
              icon: MdCalendarToday,
              bg: '#1d4ed8',
              light: '#dbeafe',
            },
            {
              label: 'Active IPD',
              value: loading ? '—' : stats.ipdActive,
              sub: `${derived.occPct}% beds occupied`,
              icon: MdBed,
              bg: '#92400e',
              light: '#ffedd5',
            },
            {
              label: 'Pending bills (today)',
              value: loading ? '—' : stats.pendingBills,
              sub: `₹${Number(stats.pendingAmount || 0).toLocaleString('en-IN')} pending`,
              icon: MdReceiptLong,
              bg: '#991b1b',
              light: '#fee2e2',
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: s.light }}>
                    <Icon className="h-5 w-5" style={{ color: s.bg }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold text-gray-900 leading-tight sm:text-xl">{s.value}</p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-600 truncate">{s.label}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400 truncate">{s.sub}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* OPD preview */}
          <div className="xl:col-span-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-5"
              style={{ background: 'linear-gradient(135deg, #1e3a8a08, #1e40af05)' }}
            >
              <div>
                <p className="text-sm font-extrabold text-gray-900">Today’s OPD queue</p>
                <p className="text-xs text-gray-400">{loading ? 'Loading…' : `${opdItems.length} appointments`}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/reception/opd')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-800 transition hover:bg-blue-100"
              >
                Open OPD <MdArrowForward className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[min(70vh,520px)] overflow-x-auto overflow-y-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="sticky top-0 z-[1] border-b border-gray-200 shadow-sm" style={{ background: '#f8faff' }}>
                    {['Token', 'Patient', 'UHID', 'Doctor', 'Department', 'Status', 'Time'].map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                        Loading OPD…
                      </td>
                    </tr>
                  ) : opdItems.slice(0, 10).map((p) => {
                    const st = OPD_STATUS_META[p.status] || OPD_STATUS_META.Waiting;
                    return (
                      <tr key={p.id} className="transition hover:bg-blue-50/40">
                        <td className="px-4 py-3 align-top">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{p.token || '—'}</span>
                        </td>
                        <td className="px-4 py-3 align-top font-semibold text-gray-900">
                          <span className="inline-flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
                              <MdPerson className="h-4 w-4 text-blue-600" />
                            </span>
                            <span className="truncate">{p.patientName || '—'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top font-mono text-xs font-semibold text-blue-700">{p.uhid || '—'}</td>
                        <td className="px-4 py-3 align-top text-xs text-gray-700">{p.doctor || '—'}</td>
                        <td className="px-4 py-3 align-top text-xs text-gray-600">{p.department || '—'}</td>
                        <td className="px-4 py-3 align-top">
                          <span className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700 whitespace-nowrap">
                            <span className="pl-dot" style={{ background: st.dot }} />
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap text-xs text-gray-600">
                          <span className="inline-flex items-center gap-1">
                            <MdAccessTime className="h-3.5 w-3.5 text-blue-400" />
                            {p.timeSlot || '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!loading && opdItems.length === 0 ? (
              <div className="border-t border-gray-50 py-14 text-center text-gray-400">
                <MdCalendarToday className="mx-auto mb-2 h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">No OPD appointments for today</p>
              </div>
            ) : null}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Bed occupancy */}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div
                className="border-b border-gray-100 px-4 py-3 sm:px-5"
                style={{ background: 'linear-gradient(135deg, #1e3a8a08, #1e40af05)' }}
              >
                <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                  <MdBed className="h-4 w-4 text-blue-600" /> Bed occupancy
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {loading ? 'Loading…' : `${stats.occupiedBeds} occupied · ${derived.availableBeds} available`}
                </p>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-extrabold text-slate-900">{loading ? '—' : `${derived.occPct}%`}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Occupancy rate</p>
                  </div>
                  <div className="w-24">
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, Math.max(0, derived.occPct))}%` }} />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Total beds: <span className="font-semibold text-slate-600">{loading ? '—' : stats.totalBeds}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/reception/ipd')}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-extrabold text-gray-700 transition hover:bg-gray-50"
                >
                  Manage IPD <MdArrowForward className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Recent registrations */}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div
                className="border-b border-gray-100 px-4 py-3 sm:px-5"
                style={{ background: 'linear-gradient(135deg, #1e3a8a08, #1e40af05)' }}
              >
                <p className="text-sm font-extrabold text-gray-900">Recent registrations</p>
                <p className="text-xs text-gray-400 mt-0.5">Latest patient entries</p>
              </div>
              <div className="divide-y divide-gray-50">
                {(loading ? Array.from({ length: 5 }).map((_, i) => ({ _k: i })) : recentRegs.slice(0, 6)).map((r, idx) => (
                  <div key={r?._k ?? r?.id ?? r?.uhid ?? idx} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/60 transition">
                    <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 shrink-0">
                      <MdPerson className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-slate-900 truncate">
                        {loading ? 'Loading…' : (r?.name || '—')}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {loading ? '—' : `UHID ${r?.uhid || '—'} · ${r?.department || '—'}`}
                      </p>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                      {loading ? '—' : todayISO}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/reception/patients')}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-extrabold text-gray-700 transition hover:bg-gray-50"
                >
                  Open patient list <MdArrowForward className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-4 flex items-center gap-2 text-sm font-extrabold text-gray-900">
            <MdLocalHospital className="h-4 w-4 text-blue-600" /> Quick actions
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Register Patient', icon: MdPeople, color: '#1d4ed8', bg: '#dbeafe', to: '/dashboard/reception/patients/register' },
              { label: 'Book Appointment', icon: MdCalendarToday, color: '#065f46', bg: '#d1fae5', to: '/dashboard/reception/appointments/book' },
              { label: 'Generate Bill', icon: MdReceiptLong, color: '#92400e', bg: '#fef3c7', to: '/dashboard/reception/billing/generate' },
              { label: 'Pending lab payment', icon: MdScience, color: '#0e7490', bg: '#cffafe', to: '/dashboard/reception/lab/pending-payment' },
              { label: 'Advised OPD tests', icon: MdScience, color: '#0369a1', bg: '#e0f2fe', to: '/dashboard/reception/lab/advised' },
              { label: 'Admit Patient', icon: MdBed, color: '#6b21a8', bg: '#f3e8ff', to: '/dashboard/reception/ipd/admit' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className="group flex items-center gap-3 rounded-xl border-2 border-transparent p-4 text-left transition hover:border-current"
                  style={{ background: action.bg, color: action.color }}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-extrabold">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
