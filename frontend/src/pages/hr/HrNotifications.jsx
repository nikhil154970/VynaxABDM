import { useEffect, useState, useCallback } from 'react';
import { MdNotifications, MdCheckCircle, MdInfo, MdWarning, MdDeleteSweep } from 'react-icons/md';
import api from '../../utils/api';

export default function HrNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'UNREAD', 'READ'

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      setNotifications(res.data?.notifications || []);
    } catch (err) {
      console.error('Failed to fetch HR notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.read_at;
    if (filter === 'READ') return !!n.read_at;
    return true;
  });

  const getIcon = (type, severity) => {
    if (severity === 'WARNING') return <MdWarning className="w-5 h-5 text-amber-500" />;
    if (severity === 'ERROR') return <MdWarning className="w-5 h-5 text-red-500" />;
    if (type === 'ALERT') return <MdCheckCircle className="w-5 h-5 text-green-500" />;
    return <MdInfo className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 pb-12">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdNotifications className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">System Notifications</h1>
              <p className="text-sm font-semibold text-gray-500">
                Reminders, duty updates, and administrative alerts
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={markAllAsRead}
              disabled={loading || !notifications.some((n) => !n.read_at)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <MdDeleteSweep className="w-4 h-4 text-gray-500" />
              Mark All Read
            </button>
            <button
              onClick={fetchNotifications}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0077B6] transition shadow-sm border border-blue-100"
            >
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
                    ? 'border-[#0077B6] text-[#0077B6]'
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
              <div className="py-20 text-center text-gray-500 font-semibold animate-pulse">
                Loading notifications...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center text-gray-400 font-medium">
                No notifications found.
              </div>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 p-5 transition ${
                    !n.read_at ? 'bg-blue-50/20' : 'bg-white'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{getIcon(n.type, n.severity)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <p className={`text-sm ${!n.read_at ? 'font-bold text-[#001B48]' : 'font-semibold text-gray-700'}`}>
                        {n.title}
                      </p>
                      <span className="text-[11px] font-semibold text-gray-400">
                        {new Date(n.created_at).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed font-semibold">{n.message}</p>
                  </div>
                  {!n.read_at && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="text-xs font-bold text-[#0077B6] hover:underline shrink-0"
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
