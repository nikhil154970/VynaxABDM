import { useCallback, useEffect, useMemo, useState } from 'react';
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

export function NurseDoctorOrdersPanel({ patientId, treatmentPlan }) {
  const doctorOrders = useMemo(() => {
    const meds = treatmentPlan?.medicines;
    const rows = treatmentMedicinesToRows(meds);
    if (rows.length) return rows;
    return mockDoctorOrders(patientId);
  }, [patientId, treatmentPlan]);

  const hasLivePlan = Array.isArray(treatmentPlan?.medicines) && treatmentPlan.medicines.length > 0;

  return (
    <section className="nurse-clinical-card nurse-clinical-card--flush">
      <header className="nurse-clinical-cardHeader">
        <h2 className="nurse-clinical-h2">Doctor orders</h2>
        <span className={hasLivePlan ? 'nurse-clinical-chip nurse-clinical-chip--icu' : 'nurse-clinical-chip nurse-clinical-chip--live'}>
          {hasLivePlan ? 'Treatment plan' : 'Sample'}
        </span>
      </header>
      <div className="nurse-clinical-cardBody nurse-clinical-pad0">
        {hasLivePlan && treatmentPlan?.description ? (
          <div className="nurse-clinical-cardBody" style={{ paddingBottom: 0 }}>
            <p className="nurse-clinical-muted" style={{ margin: 0 }}>
              <strong>Plan:</strong> {treatmentPlan.description}
            </p>
            {treatmentPlan.instructions ? (
              <p className="nurse-clinical-muted" style={{ marginTop: 8 }}>
                <strong>Instructions:</strong> {treatmentPlan.instructions}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="nurse-clinical-tableWrap">
          <table className="nurse-clinical-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Order</th>
                <th>Priority</th>
                <th>Details</th>
                <th>Dosage</th>
              </tr>
            </thead>
            <tbody>
              {doctorOrders.map((o) => (
                <tr key={o.id}>
                  <td>{o.type}</td>
                  <td className="nurse-clinical-tdStrong">{o.name}</td>
                  <td>
                    <span
                      className={
                        o.priority === 'STAT'
                          ? 'nurse-clinical-pri nurse-clinical-pri--stat'
                          : o.priority === 'Urgent'
                            ? 'nurse-clinical-pri nurse-clinical-pri--urgent'
                            : 'nurse-clinical-pri'
                      }
                    >
                      {o.priority}
                    </span>
                  </td>
                  <td>{o.status}</td>
                  <td className="nurse-clinical-tdMuted">{o.orderedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="nurse-clinical-footnote">
          {hasLivePlan ? 'Medicines from the doctor treatment plan for this admission.' : 'No treatment plan on file yet — showing sample rows until doctor adds a plan.'}
        </p>
      </div>
    </section>
  );
}

const DEFAULT_TASKS = (pid) => [
  { id: `${pid}-t1`, label: '14:00 — IV antibiotic · verify line patency', done: false },
  { id: `${pid}-t2`, label: '15:30 — SpO₂ spot check (ICU protocol)', done: false },
  { id: `${pid}-t3`, label: '16:00 — Intake/output shift total', done: false },
];

function tasksKey(patientId) {
  return `nurseTasks:${patientId}`;
}

export function NurseTasksPanel({ patientId, admissionId, tasksSeed, onPersistPatch }) {
  const [tasks, setTasks] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (tasksSeed != null) {
      setTasks(Array.isArray(tasksSeed) ? tasksSeed : []);
      return;
    }
    const raw = safeParse(localStorage.getItem(tasksKey(patientId)) || '', null);
    if (Array.isArray(raw) && raw.length) setTasks(raw);
    else setTasks(DEFAULT_TASKS(patientId));
  }, [patientId, tasksSeed]);

  const toggle = (id) => {
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const saveTasks = async () => {
    localStorage.setItem(tasksKey(patientId), JSON.stringify(tasks));
    if (admissionId && typeof onPersistPatch === 'function') {
      try {
        await onPersistPatch({ nurseTasks: tasks });
        setMsg('Tasks saved.');
      } catch (e) {
        setMsg(e?.response?.data?.message || 'Could not sync to server');
      }
    } else {
      setMsg('Tasks saved.');
    }
    window.setTimeout(() => setMsg(''), 2000);
  };

  return (
    <section className="nurse-clinical-card nurse-clinical-card--flush">
      <header className="nurse-clinical-cardHeader">
        <h2 className="nurse-clinical-h2">My tasks</h2>
        <span className="nurse-clinical-chip nurse-clinical-chip--muted">Tick when done</span>
      </header>
      <div className="nurse-clinical-cardBody">
        <ul className="nurse-clinical-taskList">
          {tasks.map((t) => (
            <li key={t.id} className="nurse-clinical-taskRow">
              <label className="nurse-clinical-taskLabel">
                <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />
                <span className={t.done ? 'nurse-clinical-taskDone' : ''}>{t.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="nurse-clinical-actions">
          <button type="button" className="nurse-clinical-btn nurse-clinical-btn--primary" onClick={saveTasks}>
            Save tasks
          </button>
          {msg ? <span className="nurse-clinical-msg">{msg}</span> : null}
        </div>
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
