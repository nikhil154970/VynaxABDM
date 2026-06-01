import { useEffect, useMemo, useState } from 'react';
import {
  MdCheckCircle, MdWarning, MdReceiptLong, MdCalendarToday, MdClose, MdArrowForward
} from 'react-icons/md';
import { Link } from 'react-router-dom';
import api from '../../../utils/api';

const PRIORITY_STYLE = {
  high:   { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444', label: 'High' },
  medium: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308', label: 'Medium' },
  low:    { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6', label: 'Low' },
};

const TYPE_ICON = { billing: MdReceiptLong, appointment: MdCalendarToday };
const TYPE_COLOR = { billing: '#92400e', appointment: '#1d4ed8' };
const TYPE_BG = { billing: '#fef3c7', appointment: '#dbeafe' };

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

function toPriority(sev) {
  const s = String(sev || '').trim().toUpperCase();
  if (s === 'CRITICAL') return 'high';
  if (s === 'WARNING') return 'medium';
  return 'low';
}

function toType(title, message) {
  const t = `${title || ''} ${message || ''}`.toLowerCase();
  if (t.includes('bill') || t.includes('lab')) return 'billing';
  return 'appointment';
}

function toPath(type) {
  if (type === 'billing') return '/dashboard/reception/lab/pending-payment';
  return '/dashboard/reception/opd';
}

export default function PendingActions() {
  const [actions, setActions] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(false);

  const filters = ['All', 'High', 'Medium', 'Low'];

  const loadPending = async () => {
    setLoading(true);
    try {
      const res = await api.get('/receptionist/notifications', { params: { unread: 1, limit: 100 } });
      const rows = Array.isArray(res.data?.notifications) ? res.data.notifications : [];
      setActions(
        rows.map((n) => {
          const type = toType(n.title, n.message);
          return {
            id: n.id,
            type,
            title: n.title || 'Pending action',
            desc: n.message || '',
            priority: toPriority(n.severity),
            time: timeAgo(n.created_at),
            path: toPath(type),
          };
        })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const filtered = useMemo(
    () => actions.filter((a) => filter === 'All' || a.priority === filter.toLowerCase()),
    [actions, filter]
  );

  const dismiss = async (id) => {
    try {
      await api.patch(`/receptionist/notifications/${encodeURIComponent(id)}/read`);
    } catch {
      /* ignore */
    }
    setActions((a) => a.filter((x) => x.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pending Actions</h1>
            <p className="text-xs text-gray-500 mt-0.5">{actions.length} items need your attention</p>
          </div>
          <div className="flex items-center gap-2">
            {['High', 'Medium', 'Low'].map(p => {
              const count = actions.filter(a => a.priority === p.toLowerCase()).length;
              const s = PRIORITY_STYLE[p.toLowerCase()];
              return count > 0 ? (
                <span key={p} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: s.bg, color: s.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                  {count} {p}
                </span>
              ) : null;
            })}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {loading ? <p className="text-xs text-gray-500">Loading pending actions…</p> : null}
        {/* Filter */}
        <div className="flex items-center gap-2">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
              style={{ background: filter === f ? '#1d4ed8' : '#f1f5f9', color: filter === f ? '#fff' : '#64748b' }}>
              {f}
            </button>
          ))}
        </div>

        {/* Action items */}
        <div className="space-y-3">
          {filtered.map(a => {
            const Icon = TYPE_ICON[a.type];
            const priority = PRIORITY_STYLE[a.priority];
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: TYPE_BG[a.type] }}>
                    <Icon className="w-5 h-5" style={{ color: TYPE_COLOR[a.type] }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">{a.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{a.desc}</p>
                      </div>
                      <button onClick={() => dismiss(a.id)}
                        className="text-gray-300 hover:text-gray-500 transition shrink-0">
                        <MdClose className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: priority.bg, color: priority.text }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: priority.dot }} />
                        {priority.label}
                      </span>
                      <span className="text-xs text-gray-400">{a.time}</span>
                      <Link
                        to={a.path}
                        className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                      >
                        Take Action <MdArrowForward className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16">
            <MdCheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="font-semibold text-gray-600">All clear!</p>
            <p className="text-xs text-gray-400 mt-1">No pending actions at this time</p>
          </div>
        )}
      </div>
    </div>
  );
}
