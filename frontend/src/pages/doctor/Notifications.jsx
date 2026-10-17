import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import {
  MdNotifications,
  MdRefresh,
  MdAccessTime,
  MdInfo,
  MdWarning,
  MdError,
  MdCheck,
} from 'react-icons/md';

function SeverityPill({ severity }) {
  const s = String(severity || 'INFO').toUpperCase();
  const meta =
    s === 'CRITICAL'
      ? { bg: 'rgba(220,38,38,0.1)', fg: '#DC2626', label: 'Critical' }
      : s === 'WARNING'
        ? { bg: 'rgba(234,88,12,0.1)', fg: '#EA580C', label: 'Warning' }
        : { bg: 'rgba(71,85,105,0.1)', fg: '#475569', label: 'Info' };

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border"
      style={{
        background: meta.bg,
        color: meta.fg,
        borderColor: `${meta.fg}15`,
      }}
    >
      {meta.label}
    </span>
  );
}

function SeverityIcon({ severity }) {
  const s = String(severity || 'INFO').toUpperCase();
  if (s === 'CRITICAL') return <MdError className="w-5 h-5 text-red-600 shrink-0" />;
  if (s === 'WARNING') return <MdWarning className="w-5 h-5 text-orange-500 shrink-0" />;
  return <MdInfo className="w-5 h-5 text-slate-500 shrink-0" />;
}

export default function Notifications({ tab = 'alerts' }) {
  const title = tab === 'updates' ? 'Updates' : 'Alerts';
  const type = tab === 'updates' ? 'UPDATE' : 'ALERT';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/notifications?type=${type}${unreadOnly ? '&unread=1' : ''}`);
      setRows(res.data?.notifications || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      try {
        await load();
      } catch {
        if (!alive) return;
        setRows([]);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, unreadOnly]);

  const unreadCount = useMemo(() => rows.filter((r) => !r.read_at).length, [rows]);

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top bar header banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdNotifications className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">{title}</h1>
              <p className="text-sm font-semibold text-gray-500">
                View alert events, system announcements, and dispatch tasks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {/* Unread Counter Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-250 bg-white text-xs font-bold text-[#001B48]">
              <span>Unread alerts:</span>
              <span className="bg-[#0077B6] text-white px-2 py-0.5 rounded-lg font-extrabold">
                {unreadCount}
              </span>
            </div>

            {/* Toggle Button */}
            <button
              type="button"
              onClick={() => setUnreadOnly((v) => !v)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 duration-200 ${
                unreadOnly
                  ? 'bg-[#0077B6] text-white border-transparent shadow-sm'
                  : 'bg-white border-gray-250 text-gray-700 hover:bg-gray-50'
              }`}
              title="Toggle unread only"
            >
              Unread only
            </button>

            {/* Mark All Read Button */}
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.patch('/notifications/read-all');
                  setRows((prev) =>
                    prev.map((x) => ({ ...x, read_at: new Date().toISOString() }))
                  );
                } catch {
                  // Ignore
                }
              }}
              disabled={loading || !rows.some((r) => !r.read_at)}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-250 bg-white text-gray-700 hover:bg-gray-50 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Mark all notifications as read"
            >
              Mark All Read
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0077B6] hover:bg-[#005B8C] shadow-sm hover:shadow active:scale-95 transition-all duration-200"
            >
              <MdRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Content list block */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-500 font-semibold text-sm">
              <div className="w-8 h-8 border-3 border-[#0077B6] border-t-transparent rounded-full animate-spin"></div>
              Loading notifications...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-gray-500 font-semibold text-sm">
              No notifications to display.
            </div>
          ) : (
            <div className="space-y-3.5">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-2xl border p-5 transition-all duration-200 hover:shadow-sm ${
                    r.read_at
                      ? 'border-gray-100 bg-white'
                      : 'border-[#0077B6]/15 bg-[#0077B6]/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3 min-w-0">
                      <div className="mt-0.5">
                        <SeverityIcon severity={r.severity} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <p className="text-sm font-extrabold text-[#001B48] truncate">
                            {r.title}
                          </p>
                          <SeverityPill severity={r.severity} />
                        </div>
                        <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap font-medium leading-relaxed">
                          {r.message}
                        </p>
                        <div className="flex items-center gap-2 mt-3 text-xs font-bold text-gray-400">
                          <MdAccessTime className="w-3.5 h-3.5 text-gray-400" />
                          <span>
                            {r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '—'}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-gray-300 inline-block mx-1" />
                          <span className={r.read_at ? 'text-gray-450' : 'text-[#0077B6]'}>
                            {r.read_at ? 'Completed / Read' : 'Action Required'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {r.read_at ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-50 text-green-600">
                          <MdCheck className="w-5 h-5" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#0077B6] hover:bg-[#005B8C] transition-all shadow-sm active:scale-95 duration-200"
                          onClick={async () => {
                            try {
                              await api.patch(`/notifications/${r.id}/read`);
                              setRows((prev) =>
                                prev.map((x) =>
                                  x.id === r.id ? { ...x, read_at: new Date().toISOString() } : x
                                )
                              );
                            } catch {
                              // Ignore errors
                            }
                          }}
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
