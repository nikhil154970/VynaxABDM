import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import { admissionIdFromRow, isAdmissionUuid } from '../../../utils/admissionId';
import './AddNotes.css';

function nowHuman() {
  return new Date().toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapAssignedRow(row) {
  const admissionId = admissionIdFromRow(row);
  return {
    admissionId,
    patientId: row.patientId ?? null,
    name: row.name || '',
    uhid: row.uhid || '',
    ward: row.ward || '',
    bed: row.bed || '',
  };
}

export default function AddNotes() {
  const navigate = useNavigate();
  const location = useLocation();

  const [patients, setPatients] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [openResults, setOpenResults] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: nowHuman(),
    status: 'Stable',
    text: '',
    showInHistory: true,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/nurse/ipd/assigned');
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        if (!alive) return;
        setPatients(items.map(mapAssignedRow).filter((p) => p.admissionId));
        setLoadError('');
      } catch (e) {
        if (!alive) return;
        setPatients([]);
        setLoadError(e?.response?.data?.message || 'Could not load assigned patients');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const state = location?.state && typeof location.state === 'object' ? location.state : null;
    if (!state || patients.length === 0 || selectedPatient) return;

    const aid = state.admissionId != null ? String(state.admissionId).trim() : '';
    const pid = state.patientId != null ? String(state.patientId).trim() : '';
    const uhid = state.uhid != null ? String(state.uhid) : '';

    const match =
      (aid && isAdmissionUuid(aid) ? patients.find((p) => p.admissionId === aid) : null) ||
      (pid ? patients.find((p) => String(p.patientId) === pid) : null) ||
      (uhid ? patients.find((p) => String(p.uhid).toLowerCase() === uhid.toLowerCase()) : null) ||
      null;

    if (!match) return;

    setSelectedPatient(match);
    setSearch(match.uhid || match.name || '');
    setOpenResults(false);
    setSuccessMsg('');
    setForm((prev) => ({ ...prev, date: nowHuman() }));
  }, [location?.state, patients, selectedPatient]);

  const results = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) => String(p.name).toLowerCase().includes(q) || String(p.uhid).toLowerCase().includes(q),
    );
  }, [patients, search]);

  const handleSearch = (value) => {
    setSearch(value);
    setOpenResults(true);
  };

  const handleSelectPatient = (p) => {
    setSelectedPatient(p);
    setOpenResults(false);
    setSuccessMsg('');
    setForm((prev) => ({ ...prev, date: nowHuman() }));
  };

  const handleReset = () => {
    setSuccessMsg('');
    setForm({
      date: nowHuman(),
      status: 'Stable',
      text: '',
      showInHistory: true,
    });
  };

  const quickFill = (text) => setForm((f) => ({ ...f, text }));

  const handleAddNote = async () => {
    if (!selectedPatient?.admissionId) return;
    const text = String(form.text || '').trim();
    if (!text) return;

    const composed = `[Condition: ${form.status}]\n${text}`;
    setSaving(true);
    setSuccessMsg('');
    try {
      await api.post('/nurse/notes', {
        admissionId: selectedPatient.admissionId,
        notes: composed,
        showInHistory: form.showInHistory,
      });
      setSuccessMsg('Note saved successfully.');
      setForm((f) => ({ ...f, text: '', date: nowHuman(), showInHistory: true }));
      window.setTimeout(() => setSuccessMsg(''), 2000);
    } catch (e) {
      setSuccessMsg(e?.response?.data?.message || 'Could not save note');
      window.setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const disabled = !selectedPatient;

  return (
    <div className="add-notes-container">
      <div className="add-notes-card">
        <div className="add-notes-card-header" />
        <div className="add-notes-card-body">
          {loadError ? <div className="add-notes-success" style={{ background: '#fef2f2', color: '#991b1b' }}>{loadError}</div> : null}

          {selectedPatient ? (
            <div className="add-notes-patient-banner">
              <div className="add-notes-patient-name">{selectedPatient.name}</div>
              <div className="add-notes-patient-sub">
                <span className="add-notes-mono">{selectedPatient.uhid}</span> · {selectedPatient.ward} ·{' '}
                <span className="add-notes-mono">{selectedPatient.bed}</span>
              </div>
            </div>
          ) : null}

          <div className="add-notes-search">
            <label className="add-notes-label" htmlFor="add-notes-search">
              Search Patient
            </label>
            <div className="add-notes-search-wrap">
              <input
                id="add-notes-search"
                className="add-notes-input"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setOpenResults(true)}
                placeholder="Search by Patient Name / UHID"
                autoComplete="off"
              />

              {openResults ? (
                <div className="add-notes-dropdown" role="listbox">
                  {results.length === 0 ? (
                    <div className="add-notes-dropdown-empty">No assigned patients found.</div>
                  ) : (
                    results.map((p) => (
                      <button
                        type="button"
                        key={p.admissionId}
                        className="add-notes-dropdown-item"
                        onClick={() => handleSelectPatient(p)}
                      >
                        <div className="add-notes-dropdown-name">{p.name}</div>
                        <div className="add-notes-dropdown-sub">
                          <span className="add-notes-mono">{p.uhid}</span> · {p.ward} · <span className="add-notes-mono">{p.bed}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            {selectedPatient ? (
              <div className="add-notes-selected">
                <div className="add-notes-selected-row">
                  <div className="add-notes-selected-kv">
                    <span>Name</span>
                    <b>{selectedPatient.name}</b>
                  </div>
                  <div className="add-notes-selected-kv">
                    <span>UHID</span>
                    <b className="add-notes-mono">{selectedPatient.uhid}</b>
                  </div>
                  <div className="add-notes-selected-kv">
                    <span>Ward</span>
                    <b>{selectedPatient.ward}</b>
                  </div>
                  <div className="add-notes-selected-kv">
                    <span>Bed</span>
                    <b className="add-notes-mono">{selectedPatient.bed}</b>
                  </div>
                </div>
              </div>
            ) : (
              <div className="add-notes-empty-state" />
            )}
          </div>

          <div className={`add-notes-form ${disabled ? 'add-notes-form-disabled' : ''}`}>
            {successMsg ? <div className="add-notes-success">{successMsg}</div> : null}

            <div className="add-notes-grid">
              <div className="add-notes-field">
                <label className="add-notes-label" htmlFor="add-notes-datetime">
                  Date & Time
                </label>
                <input id="add-notes-datetime" className="add-notes-input add-notes-mono" value={form.date} readOnly />
              </div>

              <div className="add-notes-field">
                <label className="add-notes-label" htmlFor="add-notes-status">
                  Condition Status
                </label>
                <select
                  id="add-notes-status"
                  className="add-notes-input"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  disabled={disabled}
                >
                  <option value="Stable">Stable</option>
                  <option value="Critical">Critical</option>
                  <option value="Under Observation">Under Observation</option>
                </select>
              </div>
            </div>

            <div className="add-notes-field" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0 16px 0', cursor: 'pointer' }}>
              <input
                id="add-notes-showInHistory"
                type="checkbox"
                checked={form.showInHistory}
                onChange={(e) => setForm((f) => ({ ...f, showInHistory: e.target.checked }))}
                disabled={disabled}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="add-notes-showInHistory" style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                Show in Patient History Timeline
              </label>
            </div>

            <div className="add-notes-field">
              <label className="add-notes-label" htmlFor="add-notes-text">
                Notes
              </label>
              <textarea
                id="add-notes-text"
                className="add-notes-textarea"
                rows={5}
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                placeholder="Enter patient observation..."
                disabled={disabled}
              />
            </div>

            <div className="add-notes-quick">
              <button type="button" className="add-notes-btn add-notes-btn-secondary" disabled={disabled} onClick={() => quickFill('Stable')}>
                Stable
              </button>
              <button
                type="button"
                className="add-notes-btn add-notes-btn-secondary"
                disabled={disabled}
                onClick={() => quickFill('Needs Attention')}
              >
                Needs Attention
              </button>
              <button
                type="button"
                className="add-notes-btn add-notes-btn-secondary"
                disabled={disabled}
                onClick={() => quickFill('Vitals Normal')}
              >
                Vitals Normal
              </button>
            </div>

            <div className="add-notes-actions">
              <button type="button" className="add-notes-btn add-notes-btn-ghost" onClick={() => navigate(-1)}>
                Cancel
              </button>
              <button type="button" className="add-notes-btn add-notes-btn-secondary" onClick={handleReset} disabled={disabled}>
                Reset
              </button>
              <button
                type="button"
                className="add-notes-btn add-notes-btn-primary"
                onClick={handleAddNote}
                disabled={disabled || !String(form.text).trim() || saving}
              >
                {saving ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
