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
    navy: { bg: '#001B48', light: '#E8F1F5' },
    blue: { bg: '#0077B6', light: '#E0F2FE' },
    amber: { bg: '#B45309', light: '#FEF3C7' },
    teal: { bg: '#0F766E', light: '#CCFBF1' },
    rose: { bg: '#9B1C1C', light: '#FFE4E4' },
  };
  const t = tones[tone] || tones.blue;

  return (
    <div className="min-h-[112px] rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: t.light }}>
          <Icon className="h-5 w-5" style={{ color: t.bg }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold leading-none text-slate-900 sm:text-2xl">{value}</p>
          <p className="mt-1 text-xs font-bold leading-snug text-slate-600 whitespace-normal break-words">{title}</p>
          {sub ? <p className="mt-1 text-[11px] font-medium leading-snug text-[#0077B6] whitespace-normal break-words">{sub}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [ipd, setIpd] = useState([]);
  const [otSchedule, setOtSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    let alive = true;
    (async () => {
      try {
        const [a, ad, ot] = await Promise.all([
          api.get('/appointments/doctor?today=1'),
          api.get('/admissions/doctor'),
          api.get('/doctor/ot/schedule'),
        ]);
        if (!alive) return;
        setTodayAppointments(a.data?.appointments || []);
        setIpd(ad.data?.admissions || []);
        setOtSchedule(ot.data?.items || []);
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
    const otScheduled = otSchedule.filter((x) => String(x.status || '').toUpperCase() === 'SCHEDULED').length;
    const otInProgress = otSchedule.filter((x) => String(x.status || '').toUpperCase() === 'IN_PROGRESS').length;
    const otActive = otSchedule.filter((x) => !['COMPLETED', 'CANCELLED'].includes(String(x.status || '').toUpperCase())).length;
    return {
      appt: todayAppointments.length,
      waiting,
      inProgress,
      ipd: activeIpd,
      totalIpd: ipd.length,
      otScheduled,
      otInProgress,
      otActive,
      otTotal: otSchedule.length,
    };
  }, [todayAppointments, ipd, otSchedule]);

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-0">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top bar banner style */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdLocalHospital className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Doctor Dashboard</h1>

            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-600 transition duration-200 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 cursor-pointer shadow-sm"
              title="Refresh"
            >
              <MdRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/doctor/opd/consultation')}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition duration-200 hover:shadow-md cursor-pointer hover:bg-blue-800"
              style={{ background: 'linear-gradient(135deg, #001B48 0%, #0077B6 100%)' }}
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
          <div className={`min-h-[112px] rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 ${counts.otActive > 0 ? 'border-red-300 ring-2 ring-red-200 animate-pulse' : 'border-slate-200/80'} hover:-translate-y-0.5 hover:shadow-md`}>
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: '#FFE4E4' }}>
                <MdLocalHospital className="h-5 w-5" style={{ color: '#9B1C1C' }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-extrabold leading-none text-slate-900 sm:text-2xl">{loading ? '—' : counts.otActive}</p>
                <p className="mt-1 text-xs font-bold leading-snug text-slate-600 whitespace-normal break-words">OT Surgeries</p>
                {counts.otActive > 0 ? (
                  <p className="mt-1 text-[11px] font-medium leading-snug text-red-700 whitespace-normal break-words">
                    {counts.otScheduled} scheduled · {counts.otInProgress} in progress
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] font-medium leading-snug text-slate-400 whitespace-normal break-words">No active surgeries</p>
                )}
              </div>
            </div>
            {counts.otActive > 0 ? (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-[11px] font-bold text-red-700">LIVE</span>
              </div>
            ) : null}
          </div>
          <StatCard title="Next actions" value="OPD" sub="Consultation & notes" icon={MdPlayArrow} tone="navy" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Today appointments */}
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4"
              style={{ background: 'linear-gradient(135deg, rgba(0, 119, 182, 0.03), rgba(0, 27, 72, 0.01))' }}
            >
              <div>
                <p className="text-sm font-extrabold text-gray-900">Today appointments</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/doctor/appointments/today')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#0077B6]/20 bg-blue-50/50 px-3 py-2 text-xs font-bold text-[#0077B6] transition duration-200 hover:bg-sky-50 active:bg-sky-100 cursor-pointer"
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
                      onClick={() => navigate(`/dashboard/doctor/opd/consultation?appointmentId=${encodeURIComponent(a.id)}`)}
                      className="w-full text-left flex items-center justify-between gap-3 rounded-2xl border border-gray-100 px-4 py-3 transition duration-200 hover:bg-blue-50/40 cursor-pointer"
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
              className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4"
              style={{ background: 'linear-gradient(135deg, rgba(0, 119, 182, 0.03), rgba(0, 27, 72, 0.01))' }}
            >
              <div>
                <p className="text-sm font-extrabold text-gray-900">IPD admissions</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/doctor/ipd')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition duration-200 hover:bg-gray-50 cursor-pointer"
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
                      className="w-full text-left flex items-center justify-between gap-3 rounded-2xl border border-gray-100 px-4 py-3 transition duration-200 hover:bg-blue-50/40 cursor-pointer"
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

