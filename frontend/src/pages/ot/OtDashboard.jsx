import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdLocalHospital, MdSchedule, MdPlayArrow, MdWarning, MdPerson, MdBed,
  MdRefresh, MdCheckCircle, MdHourglassEmpty, MdMedicalServices, MdPeople,
  MdNotificationsActive, MdCleaningServices, MdBuild, MdMeetingRoom,
  MdArrowForward, MdTimer, MdTrendingUp, MdAssignment,
} from 'react-icons/md';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import './SurgeryScheduling.css';

const CARD = { blue: '#eff6ff', iconBlue: '#2563eb', purple: '#faf5ff', iconPurple: '#9333ea', emerald: '#ecfdf5', iconEmerald: '#059669', amber: '#fffbeb', iconAmber: '#d97706', red: '#fef2f2', iconRed: '#dc2626', teal: '#f0fdfa', iconTeal: '#0d9488', indigo: '#eef2ff', iconIndigo: '#4f46e5', rose: '#fff1f2', iconRose: '#e11d48', orange: '#fff7ed', iconOrange: '#ea580c' };

function StatCard({ label, value, icon: Icon, bg, iconColor, textColor, sub }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-4 flex items-center gap-3 transition hover:shadow-md">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
        <Icon className="w-5.5 h-5.5" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-gray-500 leading-tight break-words">{label}</p>
        <p className="text-xl font-bold mt-0.5" style={{ color: textColor || '#111827' }}>{value ?? '—'}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function PipelineBar({ items }) {
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <MdTrendingUp className="w-4 h-4 text-blue-600" /> Surgery Pipeline
      </h3>
      <div className="flex h-8 rounded-lg overflow-hidden">
        {items.map((i) => {
          const pct = Math.max(3, (i.count / total) * 100);
          const colors = { APPROVED_FOR_OT: '#3b82f6', SCHEDULED: '#8b5cf6', IN_PROGRESS: '#f59e0b', IN_RECOVERY: '#059669', COMPLETED: '#6b7280' };
          return (
            <div key={i.key} className="flex items-center justify-center text-[10px] font-bold text-white relative transition-all" style={{ width: `${pct}%`, background: colors[i.key] || '#94a3b8', minWidth: pct < 3 ? '3%' : undefined }}>
              {i.count > 0 && <span className="drop-shadow-sm">{i.count}</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {items.map((i) => {
          const colors = { APPROVED_FOR_OT: '#3b82f6', SCHEDULED: '#8b5cf6', IN_PROGRESS: '#f59e0b', IN_RECOVERY: '#059669', COMPLETED: '#6b7280' };
          return (
            <span key={i.key} className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className="w-2 h-2 rounded-full" style={{ background: colors[i.key] }} />
              {i.label}: <strong>{i.count}</strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function OtDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/ot/dashboard', { silent: true });
      setData(res.data);
    } catch {
      setError('Failed to load OT dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const s = data?.summary || {};
  const todayList = data?.todaySchedule || [];
  const inProgress = data?.inProgressList || [];
  const delayed = data?.delayedAlerts || [];
  const rooms = data?.roomStats || {};
  const recovery = data?.recoverySummary || {};
  const pipeline = data?.pipeline || [];

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">OT Dashboard</h1>
              <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2.5 py-1 rounded-full">
                {new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Operation Theatre — live surgery pipeline, rooms & recovery</p>
          </div>
          <button onClick={load} disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm flex items-center gap-2 disabled:opacity-50">
            <MdRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <MdWarning className="w-4 h-4 shrink-0" /> {error}
            <button onClick={load} className="ml-auto text-xs font-medium text-red-600 hover:text-red-800 underline">Retry</button>
          </div>
        )}

        {loading && !data && <div className="text-center py-16"><p className="text-gray-400 text-sm">Loading OT dashboard...</p></div>}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
              <StatCard label="Today's Surgeries" value={s.todaySurgeries ?? '—'} icon={MdLocalHospital} bg="#eff6ff" iconColor="#2563eb" />
              <StatCard label="Scheduled Today" value={s.scheduledToday ?? '—'} icon={MdSchedule} bg="#faf5ff" iconColor="#9333ea" />
              <StatCard label="In Progress" value={s.inProgress ?? '—'} icon={MdPlayArrow} bg="#fffbeb" iconColor="#d97706" />
              <StatCard label="In Recovery" value={s.inRecovery ?? '—'} icon={MdPeople} bg="#f0fdf4" iconColor="#059669" />
              <StatCard label="Ready for Transfer" value={s.readyForTransfer ?? '—'} icon={MdArrowForward} bg="#f0fdfa" iconColor="#0d9488" />
              <StatCard label="Completed Today" value={s.completedToday ?? '—'} icon={MdCheckCircle} bg="#f0fdf4" iconColor="#059669" />
              <StatCard label="Delayed" value={s.delayed ?? '—'} icon={MdWarning} bg="#fef2f2" iconColor="#dc2626" sub={delayed.length > 0 ? `${delayed.length} alerts` : ''} />
              <StatCard label="Pending Scheduling" value={s.pendingScheduling ?? '—'} icon={MdHourglassEmpty} bg="#fff7ed" iconColor="#ea580c" />
              <StatCard label="Upcoming" value={s.upcoming ?? '—'} icon={MdTrendingUp} bg="#eef2ff" iconColor="#4f46e5" />
              <StatCard label="OT Rooms" value={`${s.roomsOccupied ?? 0}/${s.roomsTotal ?? 0}`} icon={MdMeetingRoom} bg="#eff6ff" iconColor="#2563eb" sub={`${s.roomsAvailable ?? 0} available`} />
              <StatCard label="Cleaning" value={s.roomsCleaning ?? '—'} icon={MdCleaningServices} bg="#fefce8" iconColor="#ca8a04" />
              <StatCard label="Alerts" value={s.unreadNotifications ?? '—'} icon={MdNotificationsActive} bg="#fef2f2" iconColor="#dc2626" />
              <StatCard label="Pending OT Requests" value={s.pendingOtRequests ?? '—'} icon={MdAssignment} bg="#fff7ed" iconColor="#ea580c" />
            </div>

            {/* Pipeline */}
            {pipeline.length > 0 && <div className="mb-6"><PipelineBar items={pipeline} /></div>}

            {/* Quick Links */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 mb-6">
              <QuickLink label="Today's Surgeries" icon={MdLocalHospital} onClick={() => navigate('/dashboard/ot/today')} color="#2563eb" bg="#eff6ff" />
              <QuickLink label="In Progress" icon={MdPlayArrow} onClick={() => navigate('/dashboard/ot/surgery/in-progress')} color="#d97706" bg="#fffbeb" />
              <QuickLink label="Schedule" icon={MdSchedule} onClick={() => navigate('/dashboard/ot/surgery/schedule')} color="#9333ea" bg="#faf5ff" />
              <QuickLink label="Recovery Room" icon={MdPeople} onClick={() => navigate('/dashboard/ot/recovery')} color="#059669" bg="#ecfdf5" />
              <QuickLink label="OT Rooms" icon={MdMeetingRoom} onClick={() => navigate('/dashboard/ot/rooms')} color="#2563eb" bg="#eff6ff" />
              <QuickLink label="Requests" icon={MdAssignment} onClick={() => navigate('/dashboard/ot/requests')} color="#ea580c" bg="#fff7ed" />
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Today's Schedule */}
              <Section title="Today's Schedule" icon={MdSchedule}>
                {todayList.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {todayList.map((s) => (
                      <div key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{s.patientName}</p>
                          <p className="text-[11px] text-gray-500">{s.requestNumber} | {s.uhid}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-gray-700">{s.startTime ? formatTime(s.startTime) : '—'}</p>
                          <p className="text-[10px] text-gray-400">{s.otRoom}</p>
                        </div>
                        <Badge variant={s.priority === 'Urgent' ? 'red' : 'blue'}>{s.priority}</Badge>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{s.status}</span>
                      </div>
                    ))}
                  </div>
                ) : <Empty />}
              </Section>

              {/* In Progress */}
              <Section title="In Progress" icon={MdPlayArrow}>
                {inProgress.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {inProgress.map((s) => (
                      <div key={s.sessionId} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{s.patientName}</p>
                          <p className="text-[11px] text-gray-500">{s.uhid} | {s.otRoom}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-mono font-bold text-amber-600 flex items-center gap-1">
                            <MdTimer className="w-3 h-3" /> {formatDuration(s.elapsedMinutes)}
                          </p>
                          <p className="text-[10px] text-gray-400">{s.surgeonName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <Empty />}
              </Section>
            </div>

            {/* Delayed + Room + Recovery */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Delayed Alerts */}
              <Section title="Delayed Alerts" icon={MdWarning}>
                {delayed.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {delayed.map((d) => (
                      <div key={d.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-900 truncate">{d.patientName}</p>
                          <p className="text-[10px] text-gray-400">{d.uhid}</p>
                        </div>
                        <span className="text-[10px] font-semibold text-red-600 whitespace-nowrap">{d.scheduledTime}</span>
                      </div>
                    ))}
                  </div>
                ) : <Empty />}
              </Section>

              {/* Room Status */}
              <Section title="OT Rooms" icon={MdMeetingRoom}>
                <div className="space-y-2.5">
                  <RoomRow label="Available" value={rooms.available} total={rooms.total} color="#059669" />
                  <RoomRow label="Occupied" value={rooms.occupied} total={rooms.total} color="#d97706" />
                  <RoomRow label="Cleaning" value={rooms.cleaning} total={rooms.total} color="#ca8a04" />
                  <RoomRow label="Maintenance" value={rooms.maintenance} total={rooms.total} color="#6b7280" />
                  <div className="pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                    <span>Total Rooms</span>
                    <span className="font-bold text-gray-900">{rooms.total}</span>
                  </div>
                </div>
              </Section>

              {/* Recovery Summary */}
              <Section title="Recovery" icon={MdPeople}>
                <div className="space-y-2.5">
                  <RoomRow label="Under Observation" value={recovery.underObservation} total={recovery.total} color="#3b82f6" />
                  <RoomRow label="Stable" value={recovery.stable} total={recovery.total} color="#059669" />
                  <RoomRow label="Critical" value={recovery.critical} total={recovery.total} color="#dc2626" />
                  {recovery.readyForTransfer > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-600 font-medium flex items-center gap-1"><MdArrowForward className="w-3 h-3" /> Ready for Transfer</span>
                        <span className="font-bold text-emerald-600">{recovery.readyForTransfer}</span>
                      </div>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                    <span>Total in Recovery</span>
                    <span className="font-bold text-gray-900">{recovery.total}</span>
                  </div>
                </div>
              </Section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-blue-600" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

function QuickLink({ label, icon: Icon, onClick, color, bg }) {
  return (
    <button onClick={onClick} className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-3 flex items-center gap-2.5 transition hover:shadow-md hover:ring-blue-200 text-left w-full">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </button>
  );
}

function RoomRow({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-900">{value}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-gray-400 py-6 text-center">No data</p>;
}

function formatTime(t) {
  if (!t) return '—';
  const p = t.split(':');
  let h = parseInt(p[0], 10);
  const m = p[1] || '00';
  const am = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${am}`;
}

function formatDuration(min) {
  if (min == null || min < 0) return '00:00';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
