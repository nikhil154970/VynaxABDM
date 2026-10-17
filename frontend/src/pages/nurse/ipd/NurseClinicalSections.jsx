import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../utils/api';
import './NurseClinicalSections.css';

function formatAdmissionTimestamp(admissionAtIso) {
  if (!admissionAtIso) return '—';
  const d = new Date(admissionAtIso);
  if (Number.isNaN(d.getTime())) return String(admissionAtIso);
  const datePart = d.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

function clinicalKey(patientId) {
  return `nurseClinical:${patientId}`;
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function mockDoctorOrders(patientId) {
  return [
    { id: `o-${patientId}-1`, type: 'Medication', name: 'Inj. Ceftriaxone 1g IV', priority: 'STAT', status: 'Active', orderedAt: 'Today 08:00' },
    { id: `o-${patientId}-2`, type: 'Investigation', name: 'ABG + lactate', priority: 'Urgent', status: 'Sample sent', orderedAt: 'Today 09:15' },
    { id: `o-${patientId}-3`, type: 'Medication', name: 'Inj. Pantoprazole 40mg IV', priority: 'Routine', status: 'Due 14:00', orderedAt: 'Yesterday' },
    { id: `o-${patientId}-4`, type: 'Investigation', name: 'Chest X-Ray portable', priority: 'Routine', status: 'Reported', orderedAt: '2 days ago' },
  ];
}

export function mockHourlyVitals() {
  const base = Date.now();
  return [0, 1, 2, 3].map((h) => {
    const t = new Date(base - h * 3600000);
    return {
      time: t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      bp: `${118 + h}/${76 + h}`,
      pulse: String(82 + h * 2),
      spo2: `${96 - h}%`,
      temp: `${(98.2 + h * 0.1).toFixed(1)}°F`,
    };
  });
}

export function NurseAdmissionPanel({ ward, doctorName, admissionAtIso, admissionDate }) {
  const isIcu = String(ward || '').toUpperCase().includes('ICU');
  const admissionStamp = admissionAtIso
    ? formatAdmissionTimestamp(admissionAtIso)
    : admissionDate && admissionDate !== '—'
      ? String(admissionDate)
      : '—';
  return (
    <section className="nurse-clinical-card">
      <header className="nurse-clinical-cardHeader">
        <h2 className="nurse-clinical-h2">Admission (IPD / ICU)</h2>
        <span className={isIcu ? 'nurse-clinical-chip nurse-clinical-chip--icu' : 'nurse-clinical-chip'}>{ward || '—'}</span>
      </header>
      <div className="nurse-clinical-cardBody">
        <p className="nurse-clinical-lead">
          Bed allocation at <strong>Reception</strong>. Quick handoff view for nursing.
        </p>
        <dl className="nurse-clinical-dl">
          <div>
            <dt>Ward / unit</dt>
            <dd>{ward}</dd>
          </div>
          <div>
            <dt>Admission timestamp</dt>
            <dd className="nurse-clinical-mono">{admissionStamp}</dd>
          </div>
          <div>
            <dt>Treating doctor</dt>
            <dd>{doctorName || '—'}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

const DEFAULT_ASSESSMENT = { gcsE: '', gcsV: '', gcsM: '', painScore: '', riskLevel: 'Medium' };

export function NurseAssessmentPanel({ patientId, admissionId, assessmentSeed, onPersistPatch }) {
  const [assessment, setAssessment] = useState(DEFAULT_ASSESSMENT);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const fromApi = assessmentSeed && typeof assessmentSeed === 'object' ? assessmentSeed : null;
    const raw = safeParse(localStorage.getItem(clinicalKey(patientId)) || '', null);
    const fromLs = raw?.assessment && typeof raw.assessment === 'object' ? raw.assessment : null;
    const merged = { ...DEFAULT_ASSESSMENT, ...(fromLs || {}), ...(fromApi || {}) };
    setAssessment(merged);
  }, [patientId, assessmentSeed]);

  const saveAssessment = useCallback(async () => {
    const prev = safeParse(localStorage.getItem(clinicalKey(patientId)) || '', {});
    localStorage.setItem(
      clinicalKey(patientId),
      JSON.stringify({ ...prev, assessment, updatedAt: new Date().toISOString() }),
    );
    if (admissionId && typeof onPersistPatch === 'function') {
      try {
        await onPersistPatch({ assessment });
        setMsg('Assessment saved.');
      } catch (e) {
        setMsg(e?.response?.data?.message || 'Could not sync to server');
      }
    } else {
      setMsg('Assessment saved.');
    }
    window.setTimeout(() => setMsg(''), 2400);
  }, [patientId, assessment, admissionId, onPersistPatch]);

  return (
    <section className="nurse-clinical-card nurse-clinical-card--flush">
      <header className="nurse-clinical-cardHeader">
        <h2 className="nurse-clinical-h2">Nursing assessment</h2>
        <span className="nurse-clinical-chip nurse-clinical-chip--muted">GCS · Pain · Risk</span>
      </header>
      <div className="nurse-clinical-cardBody">
        <div className="nurse-clinical-gcs">
          <p className="nurse-clinical-subtitle">Glasgow Coma Scale (ICU / neuro)</p>
          <div className="nurse-clinical-gcsRow">
            <label className="nurse-clinical-field">
              <span>E</span>
              <input type="number" min={1} max={4} className="nurse-clinical-input" value={assessment.gcsE} onChange={(e) => setAssessment((a) => ({ ...a, gcsE: e.target.value }))} placeholder="1–4" />
            </label>
            <label className="nurse-clinical-field">
              <span>V</span>
              <input type="number" min={1} max={5} className="nurse-clinical-input" value={assessment.gcsV} onChange={(e) => setAssessment((a) => ({ ...a, gcsV: e.target.value }))} placeholder="1–5" />
            </label>
            <label className="nurse-clinical-field">
              <span>M</span>
              <input type="number" min={1} max={6} className="nurse-clinical-input" value={assessment.gcsM} onChange={(e) => setAssessment((a) => ({ ...a, gcsM: e.target.value }))} placeholder="1–6" />
            </label>
          </div>
        </div>
        <div className="nurse-clinical-row2">
          <label className="nurse-clinical-field nurse-clinical-field--grow">
            <span>Pain (0–10)</span>
            <input type="number" min={0} max={10} className="nurse-clinical-input" value={assessment.painScore} onChange={(e) => setAssessment((a) => ({ ...a, painScore: e.target.value }))} placeholder="0" />
          </label>
          <label className="nurse-clinical-field nurse-clinical-field--grow">
            <span>Risk / care level</span>
            <select className="nurse-clinical-input" value={assessment.riskLevel} onChange={(e) => setAssessment((a) => ({ ...a, riskLevel: e.target.value }))}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </label>
        </div>
        <div className="nurse-clinical-actions">
          <button type="button" className="nurse-clinical-btn nurse-clinical-btn--primary" onClick={saveAssessment}>
            Save assessment
          </button>
          {msg ? <span className="nurse-clinical-msg">{msg}</span> : null}
        </div>
      </div>
    </section>
  );
}

function treatmentMedicinesToRows(medicines) {
  if (!Array.isArray(medicines)) return [];
  return medicines.map((m, idx) => {
    const name = String(m?.medicine || m?.name || '').trim() || '—';
    const dosage = String(m?.dosage || '').trim();
    const duration = String(m?.duration || '').trim();
    const mode = String(m?.mode || '').trim();
    const detail = [dosage, duration, mode ? `Mode: ${mode}` : ''].filter(Boolean).join(' · ') || '—';
    return {
      id: `tp-${idx}`,
      type: 'Medication',
      name,
      priority: 'Routine',
      status: detail,
      orderedAt: dosage || '—',
    };
  });
}

export function NurseDoctorOrdersPanel({ patientId, admissionId, treatmentPlan }) {
  const [orders, setOrders] = useState([]);
  const [orderText, setOrderText] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchOrders = useCallback(async () => {
    if (!admissionId) return;
    setLoading(true);
    try {
      const res = await api.get('/nurse/doctor-orders', { params: { admissionId } });
      setOrders(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [admissionId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleAdd = async () => {
    if (!orderText.trim() || adding) return;
    setAdding(true);
    try {
      const res = await api.post('/nurse/doctor-orders', {
        admissionId, patientId, orderText: orderText.trim(),
      });
      setOrders((prev) => [res.data.item, ...prev]);
      setOrderText('');
      setMsg('Order added');
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to add order');
    } finally {
      setAdding(false);
    }
    setTimeout(() => setMsg(''), 2000);
  };

  const handleComplete = async (id) => {
    try {
      const res = await api.patch(`/nurse/doctor-orders/${id}/complete`);
      setOrders((prev) => prev.map((o) => (o.id === id ? res.data.item : o)));
    } catch {
      setMsg('Failed to complete order');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this order?')) return;
    try {
      await api.delete(`/nurse/doctor-orders/${id}`);
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch {
      setMsg('Failed to delete order');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  const pending = orders.filter((o) => o.status === 'PENDING');
  const completed = orders.filter((o) => o.status === 'COMPLETED');

  return (
    <section className="nurse-clinical-card nurse-clinical-card--flush">
      <header className="nurse-clinical-cardHeader">
        <h2 className="nurse-clinical-h2">Doctor Orders</h2>
        <span className="nurse-clinical-chip nurse-clinical-chip--muted">
          {pending.length} pending
        </span>
      </header>
      <div className="nurse-clinical-cardBody">
        {admissionId ? (
          <div className="nurse-clinical-addRow">
            <input
              className="nurse-clinical-input nurse-clinical-input--grow"
              placeholder="Add doctor order..."
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button type="button" className="nurse-clinical-btn nurse-clinical-btn--primary" onClick={handleAdd} disabled={adding || !orderText.trim()}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        ) : null}
        {loading ? <p className="nurse-clinical-muted">Loading…</p> : null}
        {!loading && pending.length === 0 && completed.length === 0 ? (
          <p className="nurse-clinical-muted">
            {admissionId ? 'No orders yet. Add one above.' : 'Select a patient to see orders.'}
          </p>
        ) : null}
        {pending.length > 0 ? (
          <ul className="nurse-clinical-taskList">
            {pending.map((o) => (
              <li key={o.id} className="nurse-clinical-taskRow">
                <label className="nurse-clinical-taskLabel" style={{ cursor: 'pointer' }} onClick={() => handleComplete(o.id)}>
                  <input type="checkbox" checked={false} readOnly />
                  <span>{o.orderText}</span>
                </label>
                <button type="button" className="nurse-clinical-btn nurse-clinical-btn--danger" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => handleDelete(o.id)}>
                  &times;
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {completed.length > 0 ? (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>
              Completed Orders ({completed.length})
            </summary>
            <ul className="nurse-clinical-taskList" style={{ marginTop: 8 }}>
              {completed.map((o) => (
                <li key={o.id} className="nurse-clinical-taskRow">
                  <span className="nurse-clinical-taskDone" style={{ textDecoration: 'line-through', color: '#999' }}>
                    {o.orderText}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#999', marginLeft: 8 }}>
                    {o.completedAt ? new Date(o.completedAt).toLocaleString('en-IN') : ''}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {msg ? <p className="nurse-clinical-msg">{msg}</p> : null}
      </div>
    </section>
  );
}

export function NurseTasksPanel({ patientId, admissionId }) {
  const [tasks, setTasks] = useState([]);
  const [taskText, setTaskText] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchTasks = useCallback(async () => {
    if (!admissionId) return;
    setLoading(true);
    try {
      const res = await api.get('/nurse/my-tasks', { params: { admissionId } });
      setTasks(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [admissionId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleAdd = async () => {
    if (!taskText.trim() || adding) return;
    setAdding(true);
    try {
      const res = await api.post('/nurse/my-tasks', {
        admissionId, patientId, task: taskText.trim(),
      });
      setTasks((prev) => [res.data.item, ...prev]);
      setTaskText('');
      setMsg('Task added');
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to add task');
    } finally {
      setAdding(false);
    }
    setTimeout(() => setMsg(''), 2000);
  };

  const handleComplete = async (id) => {
    try {
      const res = await api.patch(`/nurse/my-tasks/${id}/complete`);
      setTasks((prev) => prev.map((t) => (t.id === id ? res.data.item : t)));
    } catch {
      setMsg('Failed to complete task');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this task?')) return;
    try {
      await api.delete(`/nurse/my-tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setMsg('Failed to delete task');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  const pending = tasks.filter((t) => t.status === 'PENDING');
  const completed = tasks.filter((t) => t.status === 'COMPLETED');

  return (
    <section className="nurse-clinical-card nurse-clinical-card--flush">
      <header className="nurse-clinical-cardHeader">
        <h2 className="nurse-clinical-h2">My Tasks</h2>
        <span className="nurse-clinical-chip nurse-clinical-chip--muted">
          {pending.length} pending
        </span>
      </header>
      <div className="nurse-clinical-cardBody">
        {admissionId ? (
          <div className="nurse-clinical-addRow">
            <input
              className="nurse-clinical-input nurse-clinical-input--grow"
              placeholder="Add a task..."
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button type="button" className="nurse-clinical-btn nurse-clinical-btn--primary" onClick={handleAdd} disabled={adding || !taskText.trim()}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        ) : null}
        {loading ? <p className="nurse-clinical-muted">Loading…</p> : null}
        {!loading && pending.length === 0 && completed.length === 0 ? (
          <p className="nurse-clinical-muted">
            {admissionId ? 'No tasks yet. Add one above.' : 'Select a patient to see tasks.'}
          </p>
        ) : null}
        {pending.length > 0 ? (
          <ul className="nurse-clinical-taskList">
            {pending.map((t) => (
              <li key={t.id} className="nurse-clinical-taskRow">
                <label className="nurse-clinical-taskLabel" style={{ cursor: 'pointer' }} onClick={() => handleComplete(t.id)}>
                  <input type="checkbox" checked={false} readOnly />
                  <span>{t.task}</span>
                </label>
                <button type="button" className="nurse-clinical-btn nurse-clinical-btn--danger" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => handleDelete(t.id)}>
                  &times;
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {completed.length > 0 ? (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>
              Completed Tasks ({completed.length})
            </summary>
            <ul className="nurse-clinical-taskList" style={{ marginTop: 8 }}>
              {completed.map((t) => (
                <li key={t.id} className="nurse-clinical-taskRow">
                  <span className="nurse-clinical-taskDone" style={{ textDecoration: 'line-through', color: '#999' }}>
                    {t.task}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#999', marginLeft: 8 }}>
                    {t.completedAt ? new Date(t.completedAt).toLocaleString('en-IN') : ''}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {msg ? <p className="nurse-clinical-msg">{msg}</p> : null}
      </div>
    </section>
  );
}

const DEFAULT_ICU_IO = { ioIn: '1850', ioOut: '1620', vent: 'Mode AC/VC · FiO₂ 40% · PEEP 6 · RR 16' };

export function NurseICUMonitoringPanel({ patientId, ward, admissionId, icuSeed, onPersistPatch }) {
  const isIcu = String(ward || '').toUpperCase().includes('ICU');
  const [rows, setRows] = useState([]);
  const [ioIn, setIoIn] = useState(DEFAULT_ICU_IO.ioIn);
  const [ioOut, setIoOut] = useState(DEFAULT_ICU_IO.ioOut);
  const [vent, setVent] = useState(DEFAULT_ICU_IO.vent);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const fromApi = icuSeed && typeof icuSeed === 'object' ? icuSeed : null;
    const raw = safeParse(localStorage.getItem(clinicalKey(patientId)) || '', null);
    const fromLs = raw?.icuMonitoring && typeof raw.icuMonitoring === 'object' ? raw.icuMonitoring : null;
    const src = fromApi || fromLs;
    if (src) {
      if (Array.isArray(src.rows) && src.rows.length) setRows(src.rows);
      else setRows([]);
      if (src.ioIn != null) setIoIn(String(src.ioIn));
      else setIoIn(DEFAULT_ICU_IO.ioIn);
      if (src.ioOut != null) setIoOut(String(src.ioOut));
      else setIoOut(DEFAULT_ICU_IO.ioOut);
      if (src.vent) setVent(String(src.vent));
      else setVent(DEFAULT_ICU_IO.vent);
    } else {
      setRows(mockHourlyVitals());
      setIoIn(DEFAULT_ICU_IO.ioIn);
      setIoOut(DEFAULT_ICU_IO.ioOut);
      setVent(DEFAULT_ICU_IO.vent);
    }
  }, [patientId, icuSeed]);

  const updateRow = (i, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const saveMonitoring = async () => {
    const prev = safeParse(localStorage.getItem(clinicalKey(patientId)) || '', {});
    const bundle = { rows, ioIn, ioOut, vent, updatedAt: new Date().toISOString() };
    localStorage.setItem(
      clinicalKey(patientId),
      JSON.stringify({
        ...prev,
        icuMonitoring: bundle,
      }),
    );
    if (admissionId && typeof onPersistPatch === 'function') {
      try {
        await onPersistPatch({ icuMonitoring: bundle });
        setMsg('ICU monitoring saved.');
      } catch (e) {
        setMsg(e?.response?.data?.message || 'Could not sync to server');
      }
    } else {
      setMsg('ICU monitoring saved.');
    }
    window.setTimeout(() => setMsg(''), 2400);
  };

  if (!isIcu) {
    return (
      <section className="nurse-clinical-card nurse-clinical-card--flush">
        <div className="nurse-clinical-cardBody">
          <p className="nurse-clinical-muted">ICU monitoring is available when patient is in ICU.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="nurse-clinical-card nurse-clinical-card--flush nurse-clinical-card--icu">
      <header className="nurse-clinical-cardHeader">
        <h2 className="nurse-clinical-h2">ICU monitoring</h2>
        <span className="nurse-clinical-chip nurse-clinical-chip--icu">Hourly chart</span>
      </header>
      <div className="nurse-clinical-cardBody nurse-clinical-pad0">
        <div className="nurse-clinical-tableWrap">
          <table className="nurse-clinical-table nurse-clinical-table--edit">
            <thead>
              <tr>
                <th>Time</th>
                <th>BP</th>
                <th>Pulse</th>
                <th>SpO₂</th>
                <th>Temp</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>
                    <input className="nurse-clinical-input nurse-clinical-input--table" value={row.time} onChange={(e) => updateRow(i, 'time', e.target.value)} />
                  </td>
                  <td>
                    <input className="nurse-clinical-input nurse-clinical-input--table" value={row.bp} onChange={(e) => updateRow(i, 'bp', e.target.value)} />
                  </td>
                  <td>
                    <input className="nurse-clinical-input nurse-clinical-input--table" value={row.pulse} onChange={(e) => updateRow(i, 'pulse', e.target.value)} />
                  </td>
                  <td>
                    <input className="nurse-clinical-input nurse-clinical-input--table" value={row.spo2} onChange={(e) => updateRow(i, 'spo2', e.target.value)} />
                  </td>
                  <td>
                    <input className="nurse-clinical-input nurse-clinical-input--table" value={row.temp} onChange={(e) => updateRow(i, 'temp', e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="nurse-clinical-ioGrid">
          <div className="nurse-clinical-ioBox">
            <h3 className="nurse-clinical-h3">Intake (ml)</h3>
            <input className="nurse-clinical-input" value={ioIn} onChange={(e) => setIoIn(e.target.value)} />
          </div>
          <div className="nurse-clinical-ioBox">
            <h3 className="nurse-clinical-h3">Output (ml)</h3>
            <input className="nurse-clinical-input" value={ioOut} onChange={(e) => setIoOut(e.target.value)} />
          </div>
        </div>
        <div className="nurse-clinical-cardBody" style={{ paddingTop: 0 }}>
          <label className="nurse-clinical-field nurse-clinical-field--block">
            <span>Ventilator / oxygen summary</span>
            <input className="nurse-clinical-input" value={vent} onChange={(e) => setVent(e.target.value)} />
          </label>
        </div>
        <div className="nurse-clinical-actions" style={{ padding: '0 16px 16px' }}>
          <button type="button" className="nurse-clinical-btn nurse-clinical-btn--primary" onClick={saveMonitoring}>
            Save ICU monitoring
          </button>
          {msg ? <span className="nurse-clinical-msg">{msg}</span> : null}
        </div>
      </div>
    </section>
  );
}

export function NurseAlertsPanel() {
  const [msg, setMsg] = useState('');
  const notifyDoctor = () => {
    setMsg('Doctor notified (mock).');
    window.setTimeout(() => setMsg(''), 3200);
  };
  const emergencyTrigger = () => {
    if (!window.confirm('Trigger emergency / crash call?')) return;
    setMsg('Emergency sent (mock).');
    window.setTimeout(() => setMsg(''), 4000);
  };
  return (
    <section className="nurse-clinical-card nurse-clinical-card--flush nurse-clinical-card--alert">
      <header className="nurse-clinical-cardHeader">
        <h2 className="nurse-clinical-h2">Alerts & escalation</h2>
      </header>
      <div className="nurse-clinical-cardBody">
        <div className="nurse-clinical-alertBanner">
          <strong>Critical vitals watch</strong> — protocol flags (mock).
        </div>
        <div className="nurse-clinical-escalation">
          <button type="button" className="nurse-clinical-btn nurse-clinical-btn--secondary" onClick={notifyDoctor}>
            Notify on-duty doctor
          </button>
          <button type="button" className="nurse-clinical-btn nurse-clinical-btn--danger" onClick={emergencyTrigger}>
            Emergency / crash call
          </button>
        </div>
        {msg ? <p className="nurse-clinical-msg">{msg}</p> : null}
      </div>
    </section>
  );
}

/** Legacy stacked view — not used by PatientDetails workspace. */
export default function NurseClinicalSections({ patientId, ward, doctorName, admissionDate, admissionAtIso }) {
  return (
    <div className="nurse-clinical-root">
      <NurseAdmissionPanel ward={ward} doctorName={doctorName} admissionAtIso={admissionAtIso} admissionDate={admissionDate} />
      <NurseAssessmentPanel patientId={patientId} />
      <NurseDoctorOrdersPanel patientId={patientId} />
      <NurseTasksPanel patientId={patientId} />
      <NurseICUMonitoringPanel patientId={patientId} ward={ward} />
      <NurseAlertsPanel />
    </div>
  );
}
