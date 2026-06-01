import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import {
  MdCalendarToday,
  MdArrowForward,
  MdRefresh,
  MdTrendingUp,
  MdLocalHospital,
  MdAccessTime,
  MdPerson,
  MdBed,
  MdPlayArrow,
} from 'react-icons/md';

function StatCard({ title, value, sub, icon: Icon, tone }) {
  const tones = {
    navy: { bg: '#0f2d5e', light: '#dbeafe' },
    blue: { bg: '#1d4ed8', light: '#dbeafe' },
    amber: { bg: '#92400e', light: '#ffedd5' },
    teal: { bg: '#065f46', light: '#d1fae5' },
  };
  const t = tones[tone] || tones.blue;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: t.light }}>
          <Icon className="h-5 w-5" style={{ color: t.bg }} />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-extrabold text-gray-900 leading-tight sm:text-xl">{value}</p>
          <p className="mt-0.5 text-xs font-semibold text-gray-600 truncate">{title}</p>
          {sub ? <p className="mt-0.5 text-[11px] text-gray-400 truncate">{sub}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [ipd, setIpd] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    let alive = true;
    (async () => {
      try {
        const [a, ad] = await Promise.all([
          api.get('/appointments/doctor?today=1'),
          api.get('/admissions/doctor'),
        ]);
        if (!alive) return;
        setTodayAppointments(a.data?.appointments || []);
        setIpd(ad.data?.admissions || []);
      } catch {
        if (!alive) return;
        setTodayAppointments([]);
        setIpd([]);
        setError('Failed to load doctor dashboard');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const activeIpd = ipd.filter((x) => String(x.status || '').toLowerCase() !== 'discharged').length;
    const waiting = todayAppointments.filter((x) => String(x.status || '').toUpperCase() === 'WAITING').length;
    const inProgress = todayAppointments.filter((x) => String(x.status || '').toUpperCase() === 'IN_PROGRESS').length;
    return {
      appt: todayAppointments.length,
      waiting,
      inProgress,
      ipd: activeIpd,
      totalIpd: ipd.length,
    };
  }, [todayAppointments, ipd]);

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-100/50 to-gray-50 min-h-0">
      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top bar */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-slate-900">Doctor Dashboard</p>
            
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
              title="Refresh"
            >
              <MdRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/doctor/opd/consultation')}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:shadow-md"
              style={{ background: 'linear-gradient(135deg, #0f2d5e 0%, #1a4a8a 60%, #1d4ed8 100%)' }}
            >
              <MdPlayArrow className="h-4 w-4" />
              Start consultation
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
          <StatCard title="Appointments (today)" value={loading ? '—' : counts.appt} sub={`${counts.waiting} waiting · ${counts.inProgress} in progress`} icon={MdCalendarToday} tone="blue" />
          <StatCard title="Active IPD" value={loading ? '—' : counts.ipd} sub={`Active (of ${counts.totalIpd} admissions)`} icon={MdBed} tone="amber" />
          <StatCard title="Next actions" value="OPD" sub="Consultation & notes" icon={MdLocalHospital} tone="navy" />
          <StatCard title="Trends" value={loading ? '—' : 'Stable'} sub="Queue & rounds" icon={MdTrendingUp} tone="teal" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Today appointments */}
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-5"
              style={{ background: 'linear-gradient(135deg, #1e3a8a08, #1e40af05)' }}
            >
              <div>
                <p className="text-sm font-extrabold text-gray-900">Today appointments</p>
             
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/doctor/appointments/today')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-800 transition hover:bg-blue-100"
              >
                Open list <MdArrowForward className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              {loading ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : todayAppointments.length === 0 ? (
                <p className="text-sm text-gray-500">No appointments for today.</p>
              ) : (
                <div className="space-y-2">
                  {todayAppointments.slice(0, 8).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => navigate(`/dashboard/doctor/opd/consultation?patientId=${encodeURIComponent(a.patient_id || '')}`)}
                      className="w-full text-left flex items-center justify-between gap-3 rounded-2xl border border-gray-100 px-4 py-3 transition hover:bg-blue-50/40"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-gray-900 truncate">{a.patient_name || 'Patient'}</p>
                        <p className="text-[11px] text-gray-500 truncate">Patient ID: {a.patient_id || '—'}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] font-extrabold text-blue-700 inline-flex items-center gap-1">
                          <MdAccessTime className="h-3.5 w-3.5 text-blue-400" />
                          {a.time || (a.date ? new Date(a.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}
                        </p>
                        <p className="text-[11px] text-gray-400">{String(a.status || '').replace(/_/g, ' ') || '—'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* IPD admissions */}
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-5"
              style={{ background: 'linear-gradient(135deg, #1e3a8a08, #1e40af05)' }}
            >
              <div>
                <p className="text-sm font-extrabold text-gray-900">IPD admissions</p>
         
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/doctor/ipd')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 transition hover:bg-gray-50"
              >
                Manage IPD <MdArrowForward className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              {loading ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : ipd.length === 0 ? (
                <p className="text-sm text-gray-500">No IPD admissions assigned.</p>
              ) : (
                <div className="space-y-2">
                  {ipd.slice(0, 8).map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => navigate(`/dashboard/doctor/ipd/detail/${encodeURIComponent(x.id)}`)}
                      className="w-full text-left flex items-center justify-between gap-3 rounded-2xl border border-gray-100 px-4 py-3 transition hover:bg-blue-50/40"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-gray-900 truncate">{x.patient_name || 'Patient'}</p>
                        <p className="text-[11px] text-gray-500 truncate">Status: {x.status || '—'}</p>
                      </div>
                      <p className="shrink-0 text-[11px] font-extrabold text-sky-700">
                        {x.createdAt ? new Date(x.createdAt).toLocaleDateString('en-IN') : '—'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

