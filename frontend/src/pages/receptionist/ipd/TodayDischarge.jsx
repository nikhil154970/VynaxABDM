import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import './TodayDischarge.css';

function formatApprovalTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TodayDischarge() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get('/receptionist/ipd/discharge-queue');
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setPatients(items);
    } catch (e) {
      setPatients([]);
      setLoadError(e?.response?.data?.message || e?.message || 'Could not load discharge queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openProcess = (patient) => {
    navigate(`/dashboard/reception/ipd/discharge/process/${encodeURIComponent(patient.id)}`, {
      state: { patient },
    });
  };

  return (
    <div className="today-discharge-container">
      <div className="today-discharge-shell">
        <section className="today-discharge-card">
          <div className="today-discharge-cardHeader today-discharge-cardHeader--row">
            <div>
              <h2 className="today-discharge-cardTitle">Nurse-approved queue</h2>
              <p className="today-discharge-cardSub">Billing, bed release, and paperwork can continue from the process screen.</p>
            </div>
            <button type="button" className="today-discharge-btn today-discharge-btn--ghost" onClick={load} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {loadError ? (
            <div className="today-discharge-empty today-discharge-empty--error" role="alert">
              {loadError}
            </div>
          ) : null}

          {!loading && !loadError && patients.length === 0 ? (
            <div className="today-discharge-empty">No patients awaiting discharge processing right now.</div>
          ) : null}

          {!loading && patients.length > 0 ? (
            <div className="today-discharge-tableWrap">
              <table className="today-discharge-table">
                <thead>
                  <tr>
                    <th scope="col">Patient name</th>
                    <th scope="col">UHID</th>
                    <th scope="col">Ward / bed</th>
                    <th scope="col">Nurse name</th>
                    <th scope="col">Approval time</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <tr key={p.id}>
                      <td className="today-discharge-td-strong">{p.name}</td>
                      <td>
                        <span className="today-discharge-mono">{p.uhid}</span>
                      </td>
                      <td>
                        {p.ward} <span className="today-discharge-sep">/</span> {p.bed}
                      </td>
                      <td>{p.approvedBy || '—'}</td>
                      <td className="today-discharge-td-muted">{formatApprovalTime(p.approvalTime)}</td>
                      <td>
                        <button type="button" className="today-discharge-btn" onClick={() => openProcess(p)}>
                          View / Process
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
