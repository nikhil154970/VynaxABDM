import { useEffect, useState } from 'react';
import api from '../../utils/api';

const STATUS_LABELS = {
  OT_REQUEST_CREATED: 'Request Created',
  PAYMENT_PENDING: 'Payment Pending',
  PAYMENT_COMPLETED: 'Payment Completed',
  APPROVED_FOR_OT: 'Approved for OT',
  RECEIVED_BY_OT: 'Received by OT',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

const STATUS_ORDER = ['OT_REQUEST_CREATED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'APPROVED_FOR_OT', 'RECEIVED_BY_OT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'];

const STATUS_COLORS = {
  OT_REQUEST_CREATED: '#6366f1',
  PAYMENT_PENDING: '#f59e0b',
  PAYMENT_COMPLETED: '#10b981',
  APPROVED_FOR_OT: '#3b82f6',
  RECEIVED_BY_OT: '#8b5cf6',
  SCHEDULED: '#06b6d4',
  IN_PROGRESS: '#f97316',
  COMPLETED: '#22c55e',
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const thStyle = {
  padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e2e8f0',
  textAlign: 'left', whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '10px 12px', fontSize: 13, color: '#0f172a',
  borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle',
};

export default function OtRequestStatus() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  function fetchRequests() {
    let alive = true;
    (async () => {
      try {
        const params = { limit: 50 };
        if (filter) params.status = filter;
        const res = await api.get('/nurse/ot-requests', { params });
        if (alive) setRequests(Array.isArray(res?.data?.items) ? res.data.items : []);
      } catch {
        if (alive) setRequests([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }

  useEffect(() => { const c = fetchRequests(); return c; }, [filter]);

  return (
    <div style={{ padding: '18px 18px 26px', color: '#0f172a' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
    
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            height: 38, borderRadius: 12, border: '1px solid #cbd5e1',
            padding: '0 10px', fontSize: 13, background: '#fff', color: '#0f172a',
          }}
        >
          <option value="">All Statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading...</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
          <p style={{ fontWeight: 600, color: '#475569' }}>No OT requests found</p>
          <p style={{ fontSize: 13 }}>Assign patients to OT from the IPD patient list</p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Request No</th>
                <th style={thStyle}>Patient</th>
                <th style={thStyle}>UHID</th>
                <th style={thStyle}>Doctor</th>
                <th style={thStyle}>Priority</th>
                <th style={thStyle}>Diagnosis</th>
                <th style={thStyle}>Expected Date</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const bg = STATUS_COLORS[req.status] || '#64748b';
                return (
                  <tr key={req.id}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 500, fontSize: 12 }}>{req.requestNumber}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{req.patient?.name || 'Unknown'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#64748b' }}>#{req.uhid}</td>
                    <td style={tdStyle}>{req.doctor?.user?.name || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 500, color: req.priority === 'Urgent' ? '#e53935' : '#0f172a' }}>{req.priority}</td>
                    <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.diagnosis}>{req.diagnosis}</td>
                    <td style={tdStyle}>{formatDate(req.expectedSurgeryDate)}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                        background: `${bg}18`, color: bg, border: `1px solid ${bg}30`,
                        whiteSpace: 'nowrap',
                      }}>
                        {STATUS_LABELS[req.status] || req.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
