import { useEffect, useState, useCallback } from 'react';
import { MdWarning, MdError, MdRefresh, MdDoneAll, MdCheckCircle, MdNotifications, MdInfo } from 'react-icons/md';
import api from '../../../utils/api';

export default function CriticalAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'UNREAD', 'READ'

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/dashboard/alerts/critical');
      setAlerts(res.data?.alerts || []);
    } catch (err) {
      console.error('Failed to fetch critical alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/admin/dashboard/alerts/${id}/read`);
      setAlerts((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/admin/dashboard/alerts/read-all');
      setAlerts((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Failed to mark all alerts as read:', err);
    }
  };

  const filtered = alerts.filter((n) => {
    if (filter === 'UNREAD') return !n.readAt;
    if (filter === 'READ') return !!n.readAt;
    return true;
  });

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 pb-12">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 shadow-sm shrink-0">
              <MdError className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight font-sans">Critical Alerts</h1>
              <p className="text-sm font-semibold text-gray-500 font-sans">
                Emergency admissions, ICU recommendation alerts, and critical updates
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={markAllAsRead}
              disabled={loading || !alerts.some((n) => !n.readAt)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95 duration-200"
            >
              <MdDoneAll className="w-4 h-4 text-gray-500" />
              Mark All Read
            </button>
            <button
              onClick={fetchAlerts}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition shadow-sm border border-red-100 active:scale-95 duration-200"
            >
              <MdRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters and List */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-4 border-b border-gray-100 px-6 py-4 bg-gray-50/20">
            {['ALL', 'UNREAD', 'READ'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs font-bold pb-1.5 border-b-2 transition ${
                  filter === f
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {f === 'ALL' ? 'All Alerts' : f === 'UNREAD' ? 'Unread' : 'Archived'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="py-20 text-center text-gray-500 font-semibold animate-pulse font-sans">
                Loading alerts...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center text-gray-400 font-medium font-sans">
                No critical alerts found.
              </div>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 p-5 transition ${
                    !n.readAt ? 'bg-red-50/10' : 'bg-white'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <MdError className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm ${!n.readAt ? 'font-bold text-[#001B48]' : 'font-semibold text-gray-750'}`}>
                          {n.title}
                        </p>
                        {!n.readAt && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700">
                            NEW
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-gray-400">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }) : '—'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed font-semibold">{n.message}</p>
                  </div>
                  {!n.readAt && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline shrink-0"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
