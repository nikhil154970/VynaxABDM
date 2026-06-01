import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../utils/api';
import { admissionIdFromRow } from '../../../utils/admissionId';
import './NurseDischarge.css';

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

function isStableRow(p) {
  const s = String(p.status || p.condition || '').trim().toLowerCase();
  return s === 'stable';
}

export default function NurseDischargeApproval() {
  const [patients, setPatients] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState(null);
  const [confirmRow, setConfirmRow] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/nurse/ipd/assigned');
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setPatients(
        items.map((row) => ({
          ...row,
          admissionId: admissionIdFromRow(row),
        })),
      );
      setLoadError('');
    } catch (e) {
      setPatients([]);
      setLoadError(e?.response?.data?.message || 'Could not load patients');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refresh]);

  const stableAssignedPatients = useMemo(() => patients.filter(isStableRow), [patients]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const openConfirm = (row) => {
    if (!row?.admissionId || row.dischargeApproved) return;
    setConfirmRow(row);
  };

  const closeConfirm = () => {
    if (submitting) return;
    setConfirmRow(null);
  };

  const handleConfirmApprove = useCallback(async () => {
    const row = confirmRow;
    if (!row?.admissionId) return;
    setSubmitting(true);
    try {
      await api.put('/nurse/discharge-approve', { admissionId: row.admissionId });
      setToast({ type: 'ok', message: 'Patient approved for discharge. Reception will see them in Today’s Discharge.' });
      setConfirmRow(null);
      await refresh();
    } catch (e) {
      setToast({ type: 'err', message: e?.response?.data?.message || 'Could not approve discharge' });
    } finally {
      setSubmitting(false);
    }
  }, [confirmRow, refresh]);

  return (
    <div className="nurse-discharge-container">
      <div className="nurse-discharge-shell">
        {loadError ? (
          <div className="nurse-discharge-empty" role="alert">
            {loadError}
          </div>
        ) : null}

        {toast ? (
          <div
            className={toast.type === 'err' ? 'nurse-discharge-toast nurse-discharge-toast--err' : 'nurse-discharge-toast'}
            role="status"
          >
            {toast.message}
          </div>
        ) : null}

        <section className="nurse-discharge-section nurse-discharge-card nurse-discharge-sectionCard">
          <header className="nurse-discharge-sectionHeader">
            <div>
              <h2 className="nurse-discharge-sectionTitle">Stable patients — discharge queue</h2>
              <p className="nurse-discharge-sectionSub">Table view; critical patients are not listed here.</p>
            </div>
          </header>

          {stableAssignedPatients.length === 0 ? (
            <div className="nurse-discharge-empty">
              No stable patients in this ward yet. When you set a patient&apos;s condition to <strong>Stable</strong> from IPD patient
              details, they will show in this table for discharge approval.
            </div>
          ) : (
            <div className="nurse-discharge-tableWrap">
              <table className="nurse-discharge-table">
                <thead>
                  <tr>
                    <th scope="col">Patient name</th>
                    <th scope="col">UHID</th>
                    <th scope="col">Ward</th>
                    <th scope="col">Bed</th>
                    <th scope="col">Status</th>
                    <th scope="col">Approved by</th>
                    <th scope="col">Approval time</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stableAssignedPatients.map((p) => {
                    const isApproved = Boolean(p.dischargeApproved);
                    return (
                      <tr key={p.admissionId} className={isApproved ? 'nurse-discharge-tr--approved' : undefined}>
                        <td className="nurse-discharge-tdStrong">{p.name}</td>
                        <td>
                          <span className="nurse-discharge-mono">{p.uhid}</span>
                        </td>
                        <td>{p.ward}</td>
                        <td>{p.bed}</td>
                        <td>
                          <span className="nurse-discharge-badge nurse-discharge-badge-stable">Stable</span>
                        </td>
                        <td className="nurse-discharge-tdMuted">
                          {isApproved ? String(p.nurseName || '').trim() || 'Recorded' : '—'}
                        </td>
                        <td className="nurse-discharge-tdNowrap">{formatApprovalTime(p.dischargeRequestedAt)}</td>
                        <td>
                          {isApproved ? (
                            <span className="nurse-discharge-badge nurse-discharge-badge-approved">Approved</span>
                          ) : (
                            <button
                              type="button"
                              className="nurse-discharge-btn nurse-discharge-btn-primary nurse-discharge-btn--table"
                              onClick={() => openConfirm(p)}
                            >
                              Approve for Discharge
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {confirmRow ? (
        <div className="nurse-discharge-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="nurse-discharge-confirm-title" onClick={closeConfirm}>
          <div className="nurse-discharge-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nurse-discharge-modal-header">
              <h2 id="nurse-discharge-confirm-title" className="nurse-discharge-modal-title">
                Approve discharge?
              </h2>
              <button type="button" className="nurse-discharge-btn nurse-discharge-btn-ghost" onClick={closeConfirm} disabled={submitting}>
                ✕
              </button>
            </div>
            <div className="nurse-discharge-modal-body">
              <p className="nurse-discharge-modal-lead">Please confirm you want to send this patient to reception for discharge processing.</p>
              <dl className="nurse-discharge-modal-dl">
                <div>
                  <dt>Patient</dt>
                  <dd>{confirmRow.name}</dd>
                </div>
                <div>
                  <dt>UHID</dt>
                  <dd className="nurse-discharge-mono">{confirmRow.uhid}</dd>
                </div>
                <div>
                  <dt>Ward</dt>
                  <dd>{confirmRow.ward}</dd>
                </div>
                <div>
                  <dt>Bed</dt>
                  <dd>{confirmRow.bed}</dd>
                </div>
                <div>
                  <dt>Doctor</dt>
                  <dd>{confirmRow.doctor || '—'}</dd>
                </div>
                <div>
                  <dt>Clinical status</dt>
                  <dd>Stable</dd>
                </div>
              </dl>
            </div>
            <div className="nurse-discharge-modal-actions">
              <button type="button" className="nurse-discharge-btn nurse-discharge-btn-secondary" onClick={closeConfirm} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                className="nurse-discharge-btn nurse-discharge-btn-primary"
                onClick={handleConfirmApprove}
                disabled={submitting}
              >
                {submitting ? 'Confirming…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
