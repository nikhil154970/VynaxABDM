import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import patientApi from '../../utils/patientApi';

const NOTIF_COLORS = {
  APPOINTMENT: 'from-blue-400 to-blue-500',
  LAB_REPORT: 'from-purple-400 to-purple-500',
  BILL: 'from-amber-400 to-amber-500',
  OT_SCHEDULED: 'from-cyan-400 to-cyan-500',
};

const NOTIF_BG = {
  APPOINTMENT: 'bg-blue-50',
  LAB_REPORT: 'bg-purple-50',
  BILL: 'bg-amber-50',
  OT_SCHEDULED: 'bg-cyan-50',
};

const NOTIF_LINKS = {
  APPOINTMENT: '/patient/portal/appointments',
  LAB_REPORT: '/patient/portal/lab-reports',
  BILL: '/patient/portal/bills',
  OT_SCHEDULED: '/patient/portal/ot-surgery',
};

const TYPE_LABELS = {
  APPOINTMENT: 'Appointments',
  LAB_REPORT: 'Lab Reports',
  BILL: 'Bills',
  OT_SCHEDULED: 'OT / Surgery',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'APPOINTMENT', label: 'Appointments' },
  { key: 'LAB_REPORT', label: 'Lab' },
  { key: 'BILL', label: 'Bills' },
  { key: 'OT_SCHEDULED', label: 'OT' },
];

function TypeIcon({ type, className = 'w-5 h-5' }) {
  const cls = `${className} text-white`;
  switch (type) {
    case 'APPOINTMENT':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    case 'LAB_REPORT':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;
    case 'BILL':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
    case 'OT_SCHEDULED':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
    default:
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
  }
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export default function PatientNotifications() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      setError(false);
      const r = await patientApi.get('/patient/portal/notifications');
      setData(r.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setLoading(true); fetchNotifications(); }, [fetchNotifications]);

  const notifications = useMemo(() => {
    const list = data?.notifications || [];
    if (filter === 'all') return list;
    return list.filter((n) => n.type === filter);
  }, [data, filter]);

  const stats = useMemo(() => {
    const list = data?.notifications || [];
    return {
      APPOINTMENT: list.filter((n) => n.type === 'APPOINTMENT').length,
      LAB_REPORT: list.filter((n) => n.type === 'LAB_REPORT').length,
      BILL: list.filter((n) => n.type === 'BILL').length,
      OT_SCHEDULED: list.filter((n) => n.type === 'OT_SCHEDULED').length,
    };
  }, [data]);

  const unreadCount = data?.unreadCount || 0;

  const grouped = useMemo(() => {
    const today = [];
    const earlier = [];
    notifications.forEach((n) => {
      if (isToday(n.date)) today.push(n);
      else earlier.push(n);
    });
    const groups = [];
    if (today.length) groups.push({ label: 'Today', items: today });
    if (earlier.length) groups.push({ label: 'Earlier', items: earlier });
    return groups;
  }, [notifications]);

  if (loading && !data) return <Skeleton />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          <p className="text-sm text-gray-400 mt-0.5">Stay updated on appointments, reports, bills and surgery</p>
        </div>
        {unreadCount > 0 && (
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 shrink-0">{unreadCount} unread</span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Appointments" value={stats.APPOINTMENT} color="blue" />
        <StatCard label="Lab Reports" value={stats.LAB_REPORT} color="purple" />
        <StatCard label="Bills" value={stats.BILL} color="amber" />
        <StatCard label="OT / Surgery" value={stats.OT_SCHEDULED} color="cyan" />
      </div>

      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              filter === f.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-500 font-medium">Something went wrong</p>
          <p className="text-xs text-gray-400 mt-1">Could not load notifications</p>
          <button onClick={fetchNotifications} className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm">Retry</button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-gray-400 font-medium">No notifications</p>
          <p className="text-xs text-gray-300 mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{group.label}</p>
              <div className="space-y-2">
                {group.items.map((n, i) => {
                  const unread = n.read === false;
                  const link = NOTIF_LINKS[n.type];
                  return (
                    <div
                      key={n.id || i}
                      onClick={() => link && navigate(link)}
                      className={`bg-white rounded-2xl border transition cursor-pointer ${
                        unread
                          ? 'border-blue-100 shadow-sm hover:shadow-md'
                          : 'border-gray-100 hover:shadow-sm'
                      } ${unread ? 'border-l-4 border-l-blue-500' : ''}`}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${NOTIF_COLORS[n.type] || 'from-gray-400 to-gray-500'} flex items-center justify-center shrink-0 shadow-sm`}>
                            <TypeIcon type={n.type} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="text-sm font-bold text-gray-800 truncate">{n.title || ''}</p>
                                {unread && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                              </div>
                              <span className="text-[10px] text-gray-400 shrink-0">
                                {n.date ? new Date(n.date).toLocaleString('en-IN') : ''}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{n.message || ''}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${NOTIF_BG[n.type] || 'bg-gray-100'} text-gray-600`}>
                                {TYPE_LABELS[n.type] || n.type}
                              </span>
                              {link && <span className="text-[10px] text-blue-500 font-medium">View →</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    purple: 'text-violet-600',
    amber: 'text-amber-600',
    cyan: 'text-cyan-600',
    gray: 'text-gray-500',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className={`text-2xl md:text-3xl font-extrabold ${colors[color] || 'text-blue-600'}`}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-1 font-medium">{label}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-gray-200 rounded-lg" />
      <div className="h-4 w-72 bg-gray-100 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 w-24 bg-gray-100 rounded-lg" />)}
      </div>
      <div className="h-20 bg-gray-100 rounded-2xl" />
      <div className="h-20 bg-gray-100 rounded-2xl" />
      <div className="h-20 bg-gray-100 rounded-2xl" />
    </div>
  );
}
