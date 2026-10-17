import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import '../nurse/notifications/Notifications.css';

function toTimeLabel(value) {
  if (!value) return '—';
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function mapNotification(n) {
  return {
    id: n.id,
    type: n.title || n.type || 'Alert',
    severity: n.severity || 'INFO',
    message: n.message || '',
    time: n.createdAt,
    status: n.readAt ? 'read' : 'unread',
  };
}

export default function OtNotifications() {
  const [filter, setFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loadError, setLoadError] = useState('');

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/ot/notifications');
      const items = Array.isArray(res.data?.notifications) ? res.data.notifications : [];
      setNotifications(items.map(mapNotification));
      setLoadError('');
    } catch (e) {
      console.error('Failed to fetch OT notifications:', e);
      setLoadError('Could not load notifications');
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)));
    try {
      await api.patch('/ot/notifications/' + id + '/read');
    } catch (e) {
      console.error('Mark notification as read error:', e);
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' })));
    try {
      await api.patch('/ot/notifications/read-all');
    } catch (e) {
      console.error('Mark all as read error:', e);
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((n) => n.status !== 'read');
    if (filter === 'critical') return notifications.filter((n) => n.severity === 'CRITICAL');
    if (filter === 'warning') return notifications.filter((n) => n.severity === 'WARNING');
    return notifications;
  }, [filter, notifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => n.status !== 'read').length, [notifications]);

  return (
    <div className="notifications-container">
      <div className="notifications-shell">
        <div className="notifications-filters">
          {[
            { key: 'all', label: 'All' },
            { key: 'unread', label: `Unread (${unreadCount})` },
            { key: 'critical', label: 'Critical' },
            { key: 'warning', label: 'Warning' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              className={['notifications-filter', filter === f.key ? 'notifications-filter-active' : ''].join(' ')}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}

          <div className="notifications-count">
            Showing <b>{filtered.length}</b> / {notifications.length}
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              className="notifications-filter"
              onClick={handleMarkAllAsRead}
            >
              Mark All Read
            </button>
          )}
        </div>

        {loadError && (
          <div className="notifications-empty" style={{ color: '#dc2626' }}>{loadError}</div>
        )}

        {filtered.length === 0 ? (
          <div className="notifications-empty">No notifications</div>
        ) : (
          <div className="notifications-list">
            {filtered.map((n) => (
              <div
                key={n.id}
                className={[
                  'notifications-card',
                  n.status !== 'read' ? 'notifications-card-unread' : '',
                  n.severity === 'CRITICAL' ? 'notifications-card-critical' : '',
                  n.severity === 'WARNING' ? 'notifications-card-medicine' : '',
                ].join(' ')}
              >
                <div className="notifications-card-top">
                  <div className="notifications-card-left">
                    <div className="notifications-titleRow">
                      <div className="notifications-title">{n.type}</div>
                      <span
                        className={[
                          'notifications-badge',
                          n.severity === 'CRITICAL' ? 'notifications-badge-critical' : '',
                          n.severity === 'WARNING' ? 'notifications-badge-medicine' : '',
                          n.severity === 'INFO' ? 'notifications-badge-info' : '',
                        ].join(' ')}
                      >
                        {n.severity}
                      </span>
                      {n.status !== 'read' ? <span className="notifications-dot" title="Unread" /> : null}
                    </div>
                    <div className="notifications-meta">
                      <span className="notifications-time">{toTimeLabel(n.time)}</span>
                    </div>
                  </div>
                </div>

                <div className="notifications-message">{n.message}</div>

                <div className="notifications-actions">
                  <button
                    type="button"
                    className="notifications-btn notifications-btn-primary"
                    onClick={() => handleMarkAsRead(n.id)}
                    disabled={n.status === 'read'}
                  >
                    {n.status === 'read' ? 'Read' : 'Mark as Read'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
