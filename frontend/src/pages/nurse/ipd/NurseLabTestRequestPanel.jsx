import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api, { getApiErrorMessage } from '../../../utils/api';

function parseLabTests(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.tests) ? data.tests : [];
  return list
    .filter((x) => x && x.id != null && x.name)
    .map((x) => ({
      id: parseInt(String(x.id), 10),
      name: String(x.name),
      price: x.price != null && Number.isFinite(Number(x.price)) ? Number(x.price) : null,
    }))
    .filter((x) => Number.isFinite(x.id));
}

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '';
  return `₹${Math.max(0, x).toLocaleString('en-IN')}`;
}

function adviceStatusLabel(status) {
  const v = String(status || '').toUpperCase();
  if (v === 'PENDING_BILLING') return 'Waiting for billing';
  if (v === 'CONVERTED') return 'Billed';
  return status || '—';
}

export default function NurseLabTestRequestPanel({ admissionId }) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [clinicalNote, setClinicalNote] = useState('');
  const [query, setQuery] = useState('');
  const [sugOpen, setSugOpen] = useState(false);
  const [sugIndex, setSugIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');
  const blurTimer = useRef(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setCatalogError('');
    try {
      const res = await api.get('/lab/tests', { params: { forBilling: 1 }, silent: true });
      setCatalog(parseLabTests(res.data));
    } catch (err) {
      setCatalog([]);
      setCatalogError(getApiErrorMessage(err, 'Could not load lab tests — refresh or contact admin'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!admissionId) return;
    setHistoryLoading(true);
    try {
      const res = await api.get(`/lab/advice/nurse/${admissionId}`, { silent: true });
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [admissionId]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const selectedTests = useMemo(() => catalog.filter((t) => selectedIds.includes(t.id)), [catalog, selectedIds]);

  const visibleTests = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((t) => String(t.name || '').toLowerCase().includes(q));
  }, [catalog, query]);

  const suggestions = useMemo(() => {
    if (String(query || '').trim().length < 2) return [];
    return visibleTests.filter((t) => !selectedIds.includes(t.id)).slice(0, 10);
  }, [visibleTests, query, selectedIds]);

  const toggleTest = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setError('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!suggestions.length) return;
      setSugOpen(true);
      setSugIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSugOpen(true);
      setSugIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (e.key === 'Enter') {
      if (!suggestions.length) return;
      e.preventDefault();
      const pick = suggestions[sugIndex] || suggestions[0];
      toggleTest(pick.id);
      setQuery('');
      setSugOpen(false);
      return;
    }
    if (e.key === 'Escape') {
      setSugOpen(false);
    }
  };

  const handleSubmit = async () => {
    if (!admissionId) {
      setError('Admission not loaded — refresh the page');
      return;
    }
    if (!selectedIds.length) {
      setError('Select at least one test');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess(null);
    try {
      const res = await api.post('/lab/advice/nurse', {
        admissionId,
        testIds: selectedIds,
        clinicalNote: clinicalNote.trim() || undefined,
      });
      setSuccess(res?.data?.advice || { id: 'created' });
      setSelectedIds([]);
      setClinicalNote('');
      await loadHistory();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not submit lab request'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="patient-details-card patient-details-card--activeBlock" style={{ overflow: 'visible' }}>
      <header className="patient-details-cardHeader">
        <div className="patient-details-cardTitle">
          <span className="patient-details-cardIcon patient-details-cardIconAlt">
            <svg className="patient-details-cardIconSvg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16m-7 6h7"/></svg>
          </span>
          <div className="patient-details-cardTitleText">
            <h2 className="patient-details-cardH2">Lab test request</h2>
            <p className="patient-details-cardP">Select tests — Reception will bill on &quot;Advised Lab Tests&quot; page</p>
          </div>
        </div>
      </header>
      <div className="patient-details-cardBody">
        {history.length > 0 ? (
          <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Previous requests</p>
            {historyLoading ? (
              <p className="patient-details-muted" style={{ fontSize: 12 }}>Loading…</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                {history.slice(0, 5).map((row) => (
                  <li key={row.id} style={{ fontSize: 12, color: '#334155' }}>
                    <span style={{ fontWeight: 700 }}>{adviceStatusLabel(row.status)}</span>
                    {' · '}
                    {(row.tests || []).map((t) => t.name).filter(Boolean).join(', ') || '—'}
                    {row.createdAt ? (
                      <span style={{ display: 'block', color: '#94a3b8', marginTop: 2 }}>
                        {new Date(row.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {success ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#065f46', marginBottom: 4 }}>Request sent to Reception</p>
            <p className="patient-details-muted">Reception → Lab → Advised Lab Tests pe dikhega. Bill ke baad lab ko order jayega.</p>
            <button type="button" className="patient-details-btn patient-details-btn-primary" style={{ marginTop: 12 }} onClick={() => setSuccess(null)}>
              Request more tests
            </button>
          </div>
        ) : (
          <>
            {catalogError ? (
              <div style={{ marginBottom: 10 }}>
                <p className="patient-details-error-text">{catalogError}</p>
                <button type="button" className="patient-details-btn" style={{ marginTop: 6 }} onClick={loadCatalog}>
                  Retry load tests
                </button>
              </div>
            ) : null}
            {error ? <p className="patient-details-error-text">{error}</p> : null}

            <div className="patient-details-field" style={{ position: 'relative' }}>
              <label className="patient-details-field-label">Search tests</label>
              <input
                className="patient-details-input"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSugOpen(true); setSugIndex(0); }}
                onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); if (suggestions.length) setSugOpen(true); }}
                onBlur={() => { blurTimer.current = setTimeout(() => setSugOpen(false), 160); }}
                onKeyDown={handleKeyDown}
                placeholder="Type to filter tests..."
                autoComplete="off"
                disabled={!!catalogError}
              />
              {sugOpen && suggestions.length > 0 ? (
                <div
                  style={{
                    position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 2,
                    borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#fff',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 200, overflow: 'auto',
                  }}
                >
                  {suggestions.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { toggleTest(t.id); setQuery(''); setSugOpen(false); }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f1f5f9',
                        background: i === sugIndex ? '#f0f7ff' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1e293b',
                      }}
                    >
                      {t.name}
                      {t.price != null ? <span style={{ fontWeight: 500, color: '#64748b', marginLeft: 6 }}>{formatMoney(t.price)}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {loading ? (
              <p style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading tests...</p>
            ) : (
              <div className="patient-details-du-table-wrap patient-details-du-table-wrap--tight" style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8 }}>
                {visibleTests.length ? visibleTests.map((t) => (
                  <label
                    key={t.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(t.id)}
                      onChange={() => toggleTest(t.id)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{t.name}</span>
                    {t.price != null ? (
                      <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{formatMoney(t.price)}</span>
                    ) : null}
                  </label>
                )) : (
                  <p style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    {String(query || '').trim()
                      ? 'No matching tests'
                      : catalogError
                        ? 'Tests could not be loaded'
                        : 'No active tests — admin se lab catalog add karwayein'}
                  </p>
                )}
              </div>
            )}

            {!loading && catalog.length > 0 ? (
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{catalog.length} active test(s) from admin catalog</p>
            ) : null}

            {selectedTests.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Selected ({selectedTests.length})</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedTests.map((t) => (
                    <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dbeafe', color: '#1e40af', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8 }}>
                      {t.name}
                      <button type="button" onClick={() => toggleTest(t.id)} style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#1e40af', fontWeight: 800, fontSize: 14, lineHeight: 1, padding: 0 }}>x</button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="patient-details-field" style={{ marginTop: 14 }}>
              <label className="patient-details-field-label">Clinical note (optional)</label>
              <textarea className="patient-details-input" rows={2} value={clinicalNote} onChange={(e) => setClinicalNote(e.target.value)} placeholder="e.g. suspected infection" />
            </div>

            <button
              type="button"
              disabled={submitting || !selectedIds.length || !!catalogError || loading}
              className="patient-details-btn patient-details-btn-primary"
              style={{ marginTop: 12 }}
              onClick={handleSubmit}
            >
              {submitting ? 'Sending...' : 'Send to Reception for billing'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
