import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { getApiErrorMessage } from '../../../utils/api';

function money(n) {
  return `₹${Math.max(0, Number(n || 0)).toLocaleString('en-IN')}`;
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' });
  } catch {
    return '—';
  }
}

export default function NurseDailyExpensesPanel({ admissionId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!admissionId) return;
    setLoading(true);
    try {
      const res = await api.get(`/nurse/daily-expense/${admissionId}`, { silent: true });
      setRows(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [admissionId]);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);
  const previewAmount = useMemo(() => {
    const q = Math.max(1, parseInt(quantity, 10) || 1);
    const p = Math.max(0, parseInt(unitPrice, 10) || 0);
    return q * p;
  }, [quantity, unitPrice]);

  const submit = async () => {
    if (!admissionId) {
      setError('Admission not loaded — refresh the page');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/nurse/daily-expense', {
        admissionId,
        description: description.trim(),
        category: category.trim() || undefined,
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
        unitPrice: Math.max(0, parseInt(unitPrice, 10) || 0),
      });
      setDescription('');
      setCategory('');
      setQuantity('1');
      setUnitPrice('');
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add daily expense'));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    setActingId(id);
    setError('');
    try {
      await api.delete(`/nurse/daily-expense/${id}`);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete expense'));
    } finally {
      setActingId(null);
    }
  };

  return (
    <section className="patient-details-card patient-details-card--activeBlock" style={{ overflow: 'visible' }}>
      <header className="patient-details-cardHeader">
        <div className="patient-details-cardTitle">
          <span className="patient-details-cardIcon patient-details-cardIconAlt">
            <svg className="patient-details-cardIconSvg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </span>
          <div className="patient-details-cardTitleText">
            <h2 className="patient-details-cardH2">Daily expenses</h2>
            <p className="patient-details-cardP">Nursing consumables / service charges — added to the reception final bill</p>
          </div>
        </div>
      </header>
      <div className="patient-details-cardBody">
        {error ? <p className="patient-details-error-text">{error}</p> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <div className="patient-details-field">
            <label className="patient-details-field-label">Description</label>
            <input className="patient-details-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Gloves, syringe" />
          </div>
          <div className="patient-details-field">
            <label className="patient-details-field-label">Category (optional)</label>
            <input className="patient-details-input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Consumable" />
          </div>
          <div className="patient-details-field">
            <label className="patient-details-field-label">Qty</label>
            <input className="patient-details-input" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="patient-details-field">
            <label className="patient-details-field-label">Unit price (₹)</label>
            <input className="patient-details-input" type="number" min={0} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Amount: {money(previewAmount)}</span>
          <button type="button" className="patient-details-btn patient-details-btn-primary" disabled={submitting || !description.trim()} onClick={submit}>
            {submitting ? 'Adding…' : 'Add expense'}
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Expenses for this admission</p>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Total: {money(total)}</span>
          </div>
          {loading ? (
            <p className="patient-details-muted" style={{ fontSize: 12 }}>Loading…</p>
          ) : rows.length ? (
            <div className="patient-details-du-table-wrap patient-details-du-table-wrap--tight" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '6px 8px' }}>Date</th>
                    <th style={{ padding: '6px 8px' }}>Description</th>
                    <th style={{ padding: '6px 8px' }}>Category</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '6px 8px', width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid #eef2ff' }}>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>{formatDate(r.expenseDate || r.createdAt)}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>{r.description}</td>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>{r.category || '—'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.quantity}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{money(r.unitPrice)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{money(r.amount)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        <button type="button" onClick={() => remove(r.id)} disabled={actingId === r.id} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #fecaca', color: '#b91c1c', background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {actingId === r.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="patient-details-muted" style={{ fontSize: 12 }}>No daily expenses added yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
