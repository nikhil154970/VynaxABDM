import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MdNotifications, MdWarning, MdInfo, MdCheckCircle, MdClose, MdRefresh,
} from 'react-icons/md';
import api from '../../../utils/api';

const ALERT_STYLE = {
  critical: { bg: '#fee2e2', border: '#fca5a5', icon: '#dc2626', badge: '#991b1b', badgeBg: '#fee2e2', label: 'Critical' },
  warning: { bg: '#fef9c3', border: '#fde68a', icon: '#d97706', badge: '#854d0e', badgeBg: '#fef9c3', label: 'Warning' },
  info: { bg: '#dbeafe', border: '#93c5fd', icon: '#2563eb', badge: '#1e40af', badgeBg: '#dbeafe', label: 'Info' },
  success: { bg: '#dcfce7', border: '#86efac', icon: '#16a34a', badge: '#14532d', badgeBg: '#dcfce7', label: 'Success' },
};
const ALERT_ICON = {
  critical: MdWarning,
  warning: MdWarning,
  info: MdInfo,
  success: MdCheckCircle,
};

function toSeverity(severity) {
  const s = String(severity || '').trim().toUpperCase();
  if (s === 'CRITICAL') return 'critical';
  if (s === 'WARNING') return 'warning';
  if (s === 'INFO') return 'info';
  return 'success';
}

function timeAgo(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const sec = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day} day ago`;
}

export default function LabNotifications() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(false);

  const filters = ['All', 'critical', 'warning', 'info', 'success'];

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/lab/notifications', { params: { limit: 100 } });
      const rows = Array.isArray(res.data?.notifications) ? res.data.notifications : [];
      setAlerts(
        rows.map((n) => ({
          id: n.id,
          type: toSeverity(n.severity),
          title: n.title || 'Notification',
          desc: n.message || '',
          time: timeAgo(n.created_at),
          read: Boolean(n.read_at),
        })),
      );
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const filtered = alerts.filter((a) => filter === 'All' || a.type === filter);

  const unreadCount = useMemo(() => alerts.filter((a) => !a.read).length, [alerts]);

  const markRead = async (id) => {
    try {
      await api.patch(`/lab/notifications/${encodeURIComponent(id)}/read`);
    } catch {
      /* ignore */
    }
    setAlerts((a) => a.map((x) => (x.id === id ? { ...x, read: true } : x)));
  };

  const dismiss = async (id) => {
    await markRead(id);
  };

  const markAllRead = async () => {
    try {
      await api.patch('/lab/notifications/read-all');
    } catch {
      /* ignore */
    }
    setAlerts((a) => a.map((x) => ({ ...x, read: true })));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/60 to-gray-50">
      <div className="p-4 sm:p-6 space-y-4">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm px-5 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-wide font-extrabold text-blue-700/80">Lab Technician</p>
              <div className="flex items-center gap-2 mt-1">
                <h1 className="text-xl font-extrabold text-gray-900">Notifications</h1>
                {unreadCount > 0 ? (
                  <span className="rounded-full bg-red-500 text-white text-xs font-extrabold px-2 py-0.5">
                    {unreadCount}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => loadAlerts()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:bg-gray-50 transition disabled:opacity-60"
              >
                <MdRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-700 hover:bg-blue-100 transition"
                >
                  Mark all as read
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {filters.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className="px-3 py-1.5 rounded-lg text-xs font-extrabold capitalize transition"
                  style={{ background: filter === f ? '#1d4ed8' : '#f1f5f9', color: filter === f ? '#fff' : '#475569' }}
                >
                  {f === 'All' ? 'All' : ALERT_STYLE[f].label}
                  {f !== 'All' ? (
                    <span className="ml-1.5 rounded-full bg-white/70 px-1.5 text-[10px]">
                      {alerts.filter((a) => a.type === f).length}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            {loading ? <span className="text-xs font-semibold text-gray-500">Loading…</span> : null}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((a) => {
            const style = ALERT_STYLE[a.type];
            const Icon = ALERT_ICON[a.type] || MdInfo;
            return (
              <div
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={() => markRead(a.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    markRead(a.id);
                  }
                }}
                className={`bg-white rounded-2xl border shadow-sm p-4 sm:p-5 transition cursor-pointer hover:shadow-md ${
                  !a.read ? 'border-l-4' : 'border border-gray-100'
                }`}
                style={!a.read ? { borderLeftColor: style.icon } : {}}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: style.bg }}>
                    <Icon className="w-5 h-5" style={{ color: style.icon }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className={`font-extrabold text-gray-900 truncate ${!a.read ? '' : 'opacity-70'}`}>{a.title}</p>
                          {!a.read ? <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" /> : null}
                        </div>
                        <p className={`text-xs text-gray-500 leading-relaxed ${!a.read ? '' : 'opacity-60'}`}>{a.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss(a.id);
                        }}
                        className="text-gray-300 hover:text-gray-500 transition shrink-0"
                        title="Dismiss"
                      >
                        <MdClose className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded-full capitalize" style={{ background: style.badgeBg, color: style.badge }}>
                        {style.label}
                      </span>
                      <span className="text-xs text-gray-400">{a.time}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16">
            <MdNotifications className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="font-extrabold text-gray-600">No notifications</p>
            <p className="text-xs text-gray-400 mt-1">Naya lab order aane par yahan alert dikhega.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
