import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import { admissionIdFromRow } from '../../../utils/admissionId';
import './Notifications.css';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function nowHHmm() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toTimeLabel(value) {
  if (!value) return '—';
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function parseMinutes(hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map((x) => Number(x));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function inIcuWard(p) {
  return String(p.ward || '')
    .toUpperCase()
    .includes('ICU');
}

export default function Notifications() {
  const navigate = useNavigate();

  const [filter, setFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [wardPatients, setWardPatients] = useState([]);

  const medicineSchedule = useMemo(() => {
    const icu = wardPatients.filter(inIcuWard);
    const meds = ['Paracetamol 650mg', 'Antibiotic (as charted)', 'Nebulization'];
    const times = ['12:00', '14:00', '15:00'];
    return icu.slice(0, 3).map((p, i) => ({
      admissionId: admissionIdFromRow(p),
      patientName: p.name,
      bed: p.bed,
      medicineName: meds[i % meds.length],
      time: times[i % times.length],
    }));
  }, [wardPatients]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/nurse/ipd/assigned');
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        if (!alive) return;
        setWardPatients(items);
      } catch {
        if (!alive) return;
        setWardPatients([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const generateMedicineAlerts = (existing) => {
    const assignedIds = new Set(wardPatients.map((p) => admissionIdFromRow(p)).filter(Boolean));
    const current = parseMinutes(nowHHmm());
    if (current == null) return existing;

    const next = [...existing];

    medicineSchedule.forEach((m) => {
      if (!m.admissionId || !assignedIds.has(m.admissionId)) return;
      const due = parseMinutes(m.time);
      if (due == null) return;
      if (current < due) return;

      const id = `MED-${m.admissionId}-${m.medicineName}-${m.time}`;
      if (next.some((n) => n.id === id)) return;

      next.unshift({
        id,
        admissionId: m.admissionId,
        patientName: m.patientName,
        bed: m.bed,
        type: 'Medicine Due',
        message: `Give ${m.medicineName} to ${m.patientName} (Bed ${m.bed})`,
        time: m.time,
        status: 'unread',
        highlight: true,
      });
    });

    return next;
  };

  useEffect(() => {
    const icu = wardPatients.filter(inIcuWard);
    const critical = icu
      .filter((p) => String(p.status || '').toLowerCase().includes('critical'))
      .map((p) => {
        const admissionId = admissionIdFromRow(p);
        return {
          id: `CRIT-${admissionId}`,
          admissionId,
          patientName: p.name,
          bed: p.bed,
          type: 'Critical',
          message: `Critical patient needs monitoring (Bed ${p.bed})`,
          time: new Date().toISOString(),
          status: 'unread',
          highlight: true,
        };
      });

    const first = icu[0];
    const second = icu[1];
    const info = [];
    if (first) {
      info.push({
        id: 'INFO-1',
        admissionId: admissionIdFromRow(first),
        patientName: first.name,
        bed: first.bed,
        type: 'Info',
        message: 'Doctor rounds scheduled at 12:30 PM.',
        time: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        status: 'read',
        highlight: false,
      });
    }
    if (second) {
      info.push({
        id: 'INFO-2',
        admissionId: admissionIdFromRow(second),
        patientName: second.name,
        bed: second.bed,
        type: 'Info',
        message: 'Update nursing notes if patient condition changes.',
        time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'unread',
        highlight: false,
      });
    }

    setNotifications((prev) => {
      const base = prev.length ? prev : [...critical, ...info];
      return generateMedicineAlerts(base);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wardPatients, medicineSchedule]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setNotifications((prev) => generateMedicineAlerts(prev));
    }, 60 * 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkAsRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)));
  };

  const handleFilter = (key) => setFilter(key);

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((n) => n.status !== 'read');
    if (filter === 'critical') return notifications.filter((n) => n.type === 'Critical');
    if (filter === 'medicine') return notifications.filter((n) => n.type === 'Medicine Due');
    return notifications;
  }, [filter, notifications]);

  return (
    <div className="notifications-container">
      <div className="notifications-shell">
        <div className="notifications-filters">
          {[
            { key: 'all', label: 'All' },
            { key: 'unread', label: 'Unread' },
            { key: 'critical', label: 'Critical' },
            { key: 'medicine', label: 'Medicine Due' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              className={['notifications-filter', filter === f.key ? 'notifications-filter-active' : ''].join(' ')}
              onClick={() => handleFilter(f.key)}
            >
              {f.label}
            </button>
          ))}

          <div className="notifications-count">
            Showing <b>{filtered.length}</b> / {notifications.length}
          </div>
        </div>

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
                  n.type === 'Critical' ? 'notifications-card-critical' : '',
                  n.type === 'Medicine Due' ? 'notifications-card-medicine' : '',
                  n.type === 'Info' ? 'notifications-card-info' : '',
                ].join(' ')}
              >
                <div className="notifications-card-top">
                  <div className="notifications-card-left">
                    <div className="notifications-titleRow">
                      <div className="notifications-title">{n.type}</div>
                      <span
                        className={[
                          'notifications-badge',
                          `notifications-badge-${n.type === 'Medicine Due' ? 'medicine' : n.type.toLowerCase()}`,
                        ].join(' ')}
                      >
                        {n.type}
                      </span>
                      {n.status !== 'read' ? <span className="notifications-dot" title="Unread" /> : null}
                    </div>
                    <div className="notifications-meta">
                      <span className="notifications-patient">{n.patientName}</span>
                      <span className="notifications-sep">·</span>
                      <span className="notifications-bed">
                        Bed <b>{n.bed}</b>
                      </span>
                      <span className="notifications-sep">·</span>
                      <span className="notifications-time">{toTimeLabel(n.time)}</span>
                    </div>
                  </div>
                </div>

                <div className="notifications-message">{n.message}</div>

                <div className="notifications-actions">
                  <button
                    type="button"
                    className="notifications-btn notifications-btn-secondary"
                    disabled={!n.admissionId}
                    onClick={() => n.admissionId && navigate(`/dashboard/nurse/ipd/details/${n.admissionId}`)}
                  >
                    View Patient
                  </button>
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
