import { useCallback, useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../../../utils/api';

const MIN_SEARCH = 2;

const STATUS_STYLE = {
  Pending: { bg: '#fef9c3', color: '#854d0e' },
  Accepted: { bg: '#dbeafe', color: '#1e40af' },
  Dispensed: { bg: '#dcfce7', color: '#166534' },
  Cancelled: { bg: '#fee2e2', color: '#991b1b' },
};

function mapSearchResults(data) {
  const meds = Array.isArray(data?.medicines) ? data.medicines : [];
  const seen = new Set();
  const out = [];
  for (const m of meds) {
    if (!m?.medicineId || seen.has(m.medicineId)) continue;
    seen.add(m.medicineId);
    out.push({ medicineId: m.medicineId, medicineName: m.medicineName });
  }
  return out;
}

export default function NurseMedicineRequestPanel({ admissionId }) {
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [medQuery, setMedQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addQtyByMedId, setAddQtyByMedId] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadRequests = useCallback(async () => {
    if (!admissionId) return;
    setReqLoading(true);
    try {
      const res = await api.get(`/nurse/medicine-request/${admissionId}`, { silent: true });
      setRequests(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      setRequests([]);
    } finally {
      setReqLoading(false);
    }
  }, [admissionId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const q = medQuery.trim();
    if (q.length < MIN_SEARCH) {
      setSearchResults([]);
      return undefined;
    }
    let active = true;
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get('/pharmacy/billing/inventory/search', { params: { q }, silent: true });
        if (active) setSearchResults(mapSearchResults(res.data));
      } catch {
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [medQuery]);

  const addMedicine = (row) => {
    if (!row?.medicineId) return;
    const qty = Math.max(1, Number(addQtyByMedId[row.medicineId]) || 1);
    setItems((prev) => {
      const existing = prev.find((i) => i.medicineId === row.medicineId);
      if (existing) {
        return prev.map((i) => (i.medicineId === row.medicineId ? { ...i, quantity: i.quantity + qty } : i));
      }
      return [
        ...prev,
        { key: `med-${row.medicineId}`, medicineId: row.medicineId, medicineName: row.medicineName, dosage: '', frequency: '', duration: '', quantity: qty },
      ];
    });
    setAddQtyByMedId((prev) => ({ ...prev, [row.medicineId]: 1 }));
    setError('');
  };

  const updateItem = (key, patch) => {
    setItems((prev) => prev.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  };

  const removeItem = (key) => setItems((prev) => prev.filter((x) => x.key !== key));

  const submit = async () => {
    if (!admissionId) {
      setError('Admission not loaded — refresh the page');
      return;
    }
    const payload = items
      .map((x) => ({
        medicineId: x.medicineId || undefined,
        medicineName: String(x.medicineName || '').trim(),
        dosage: String(x.dosage || '').trim() || undefined,
        frequency: String(x.frequency || '').trim() || undefined,
        duration: String(x.duration || '').trim() || undefined,
        quantity: Number(x.quantity) || 1,
      }))
      .filter((x) => x.medicineName);
    if (!payload.length) {
      setError('Add at least one medicine');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/nurse/medicine-request', { admissionId, items: payload });
      setItems([]);
      setMedQuery('');
      setSearchResults([]);
      setSuccess('Medicine request sent to Pharmacy');
      await loadRequests();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send medicine request'));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (id) => {
    setActingId(id);
    setError('');
    try {
      await api.post(`/nurse/medicine-request/${id}/cancel`);
      await loadRequests();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not cancel request'));
    } finally {
      setActingId(null);
    }
  };

  const qLen = medQuery.trim().length;

  return (
    <section className="patient-details-card patient-details-card--activeBlock" style={{ overflow: 'visible' }}>
      <header className="patient-details-cardHeader">
        <div className="patient-details-cardTitle">
          <span className="patient-details-cardIcon patient-details-cardIconAlt">
            <svg className="patient-details-cardIconSvg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M12 11v6M9 14h6"/></svg>
          </span>
          <div className="patient-details-cardTitleText">
            <h2 className="patient-details-cardH2">Medicine request</h2>
            <p className="patient-details-cardP">Search medicines, add to list, and send to Pharmacy for dispensing &amp; billing</p>
          </div>
        </div>
      </header>
      <div className="patient-details-cardBody">
        {error ? <p className="patient-details-error-text">{error}</p> : null}
        {success ? (
          <p style={{ fontSize: 13, fontWeight: 700, color: '#065f46', marginBottom: 10 }}>{success}</p>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          {/* Search */}
          <div className="patient-details-field" style={{ position: 'relative' }}>
            <label className="patient-details-field-label">Search medicine</label>
            <input
              className="patient-details-input"
              value={medQuery}
              onChange={(e) => setMedQuery(e.target.value)}
              placeholder="Type medicine name (min 2 letters)…"
              autoComplete="off"
            />
            {qLen >= MIN_SEARCH ? (
              <div
                style={{
                  marginTop: 6, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#fff',
                  maxHeight: 220, overflow: 'auto',
                }}
              >
                {searchLoading ? (
                  <p style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Searching…</p>
                ) : searchResults.length ? (
                  searchResults.map((r) => (
                    <div
                      key={r.medicineId}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}
                    >
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{r.medicineName}</span>
                      <input
                        type="number"
                        min={1}
                        value={addQtyByMedId[r.medicineId] ?? 1}
                        onChange={(e) => setAddQtyByMedId((prev) => ({ ...prev, [r.medicineId]: Math.max(1, Number(e.target.value || 1)) }))}
                        style={{ width: 56, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, textAlign: 'center' }}
                      />
                      <button type="button" className="patient-details-btn patient-details-btn-primary" style={{ padding: '4px 12px' }} onClick={() => addMedicine(r)}>
                        Add
                      </button>
                    </div>
                  ))
                ) : (
                  <p style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No medicine found</p>
                )}
              </div>
            ) : null}
          </div>

          {/* Selected items */}
          {items.length ? (
            <div className="patient-details-du-table-wrap patient-details-du-table-wrap--tight" style={{ overflowX: 'auto' }}>
              <table className="w-full" style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '6px 8px' }}>Medicine</th>
                    <th style={{ padding: '6px 8px', width: 70 }}>Qty</th>
                    <th style={{ padding: '6px 8px' }}>Dosage</th>
                    <th style={{ padding: '6px 8px' }}>Frequency</th>
                    <th style={{ padding: '6px 8px' }}>Duration</th>
                    <th style={{ padding: '6px 8px', width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.key} style={{ borderTop: '1px solid #eef2ff' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>{it.medicineName}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(it.key, { quantity: Math.max(1, Number(e.target.value || 1)) })} style={{ width: 56, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 8 }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={it.dosage} onChange={(e) => updateItem(it.key, { dosage: e.target.value })} placeholder="Optional" style={{ width: '100%', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 8 }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={it.frequency} onChange={(e) => updateItem(it.key, { frequency: e.target.value })} placeholder="Optional" style={{ width: '100%', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 8 }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={it.duration} onChange={(e) => updateItem(it.key, { duration: e.target.value })} placeholder="Optional" style={{ width: '100%', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 8 }} />
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        <button type="button" onClick={() => removeItem(it.key)} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="patient-details-muted" style={{ fontSize: 12 }}>Search a medicine above and click Add to build the request.</p>
          )}

          <button type="button" className="patient-details-btn patient-details-btn-primary" style={{ alignSelf: 'flex-start' }} disabled={submitting || !items.length} onClick={submit}>
            {submitting ? 'Sending…' : 'Send to Pharmacy'}
          </button>
        </div>

        {/* Previous requests */}
        <div style={{ marginTop: 18 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Requests for this admission</p>
          {reqLoading ? (
            <p className="patient-details-muted" style={{ fontSize: 12 }}>Loading…</p>
          ) : requests.length ? (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
              {requests.map((r) => {
                const st = STATUS_STYLE[r.statusLabel] || STATUS_STYLE.Pending;
                return (
                  <li key={r.id} style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: st.bg, color: st.color }}>
                        {r.statusLabel}
                      </span>
                      {r.statusLabel === 'Pending' ? (
                        <button type="button" onClick={() => cancelRequest(r.id)} disabled={actingId === r.id} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #fecaca', color: '#b91c1c', background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {actingId === r.id ? '…' : 'Cancel'}
                        </button>
                      ) : null}
                    </div>
                    <p style={{ fontSize: 12, color: '#334155', marginTop: 6 }}>
                      {(r.items || []).map((it) => `${it.medicineName}${it.quantity ? ` x${it.quantity}` : ''}`).join(', ') || '—'}
                    </p>
                    {r.sentAt ? (
                      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {new Date(r.sentAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="patient-details-muted" style={{ fontSize: 12 }}>No medicine requests yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
