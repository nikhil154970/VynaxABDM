import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';

const COLORS = {
  sidebar: '#2D2A6E',
  active: '#00AEEF',
  cta: '#E53935',
  bg: '#F5F7FA',
  card: '#FFFFFF',
};

function SeverityPill({ severity }) {
  const s = String(severity || 'INFO').toUpperCase();
  const meta =
    s === 'CRITICAL'
      ? { bg: 'rgba(220,38,38,0.12)', fg: '#b91c1c', label: 'Critical' }
      : s === 'WARNING'
        ? { bg: 'rgba(234,88,12,0.12)', fg: '#c2410c', label: 'Warning' }
        : { bg: 'rgba(148,163,184,0.18)', fg: '#475569', label: 'Info' };

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold" style={{ background: meta.bg, color: meta.fg }}>
      {meta.label}
    </span>
  );
}

function SeverityDot({ severity }) {
  const s = String(severity || 'INFO').toUpperCase();
  const c =
    s === 'CRITICAL' ? '#b91c1c'
      : s === 'WARNING' ? '#c2410c'
        : '#475569';
  return <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: c }} />;
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
    <div className="p-6 space-y-4" style={{ background: COLORS.bg }}>
      <div className="rounded-2xl border px-5 py-4" style={{ background: COLORS.card, borderColor: 'rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <p className="text-xs font-extrabold tracking-wide" style={{ color: COLORS.sidebar }}>Notifications</p>
            <h2 className="text-lg font-extrabold text-gray-900 truncate">{title}</h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white" style={{ borderColor: 'rgba(0,0,0,0.10)' }}>
              <span className="text-xs font-extrabold text-gray-600">Unread</span>
              <span className="text-xs font-extrabold" style={{ color: COLORS.sidebar }}>{unreadCount}</span>
            </div>

            <button
              type="button"
              onClick={() => setUnreadOnly((v) => !v)}
              className="px-3 py-2 rounded-xl text-xs font-extrabold border bg-white transition"
              style={{
                borderColor: unreadOnly ? COLORS.active : 'rgba(0,0,0,0.10)',
                color: unreadOnly ? COLORS.active : '#374151',
              }}
              title="Toggle unread only"
            >
              Unread only
            </button>

            <button
              type="button"
              onClick={load}
              className="px-3 py-2 rounded-xl text-xs font-extrabold text-white"
              style={{ background: COLORS.cta }}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-3" style={{ background: COLORS.card, borderColor: 'rgba(0,0,0,0.06)' }}>
        {loading ? (
          <div className="px-3 py-6 text-sm text-gray-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-3 py-6 text-sm text-gray-500">No notifications.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border px-4 py-3"
                style={{
                  borderColor: 'rgba(0,0,0,0.08)',
                  background: r.read_at ? '#FFFFFF' : 'rgba(0,174,239,0.05)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <SeverityDot severity={r.severity} />
                      <p className="text-sm font-extrabold text-gray-900 truncate">{r.title}</p>
                      <SeverityPill severity={r.severity} />
                    </div>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{r.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs font-extrabold text-gray-500">
                      <span>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300 inline-block" />
                      <span>{r.read_at ? 'Read' : 'Unread'}</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {r.read_at ? (
                      <span className="text-xs font-extrabold text-gray-400">—</span>
                    ) : (
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl text-xs font-extrabold text-white"
                        style={{ background: COLORS.active }}
                        onClick={async () => {
                          await api.patch(`/notifications/${r.id}/read`);
                          setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, read_at: new Date().toISOString() } : x)));
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
  );
}

