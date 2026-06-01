import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdPeople, MdWarning, MdCheckCircle } from 'react-icons/md';
import './AssignedPatients.css';
import api from '../../../utils/api';
import { admissionIdFromRow } from '../../../utils/admissionId';

function recordKey(id) {
  return `nursePatient:${id}`;
}

function clinicalKey(patientId) {
  return `nurseClinical:${patientId}`;
}

function tasksKey(patientId) {
  return `nurseTasks:${patientId}`;
}

/** Admission UUID for routes/API; patient UUID for localStorage MAR keys. */
function nursePatientIdForStorage(p) {
  if (p == null) return null;
  const raw = p.patientId != null ? p.patientId : p.id;
  return raw;
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function defaultRecordFromPatient(p) {
  const pid = nursePatientIdForStorage(p);
  return {
    admissionId: admissionIdFromRow(p),
    patient: {
      id: pid,
      name: p.name,
      uhid: p.uhid,
      age: p.age ?? 0,
      gender: p.gender ?? '',
      ward: p.ward,
      bed: p.bed,
      doctor: p.doctor,
      admissionDate: p.admissionDate,
      status: p.status,
      diagnosis: p.diagnosis ?? '—',
    },
    vitals: { bp: '—', temperature: '—', pulse: '—', oxygen: '—' },
    medications: [],
    notes: [],
    updatedAt: null,
  };
}

export default function AssignedPatients() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRecord, setDetailsRecord] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({ toWard: '', sendToReception: true });
  const [transferMsg, setTransferMsg] = useState('');

  const TRANSFER_REQUESTS_KEY = 'hims_ipd_transfer_requests';

  const readTransferRequests = () => {
    const arr = safeParse(localStorage.getItem(TRANSFER_REQUESTS_KEY) || '', []);
    return Array.isArray(arr) ? arr : [];
  };

  const writeTransferRequests = (list) => {
    localStorage.setItem(TRANSFER_REQUESTS_KEY, JSON.stringify(list));
  };

  useEffect(() => {
    if (!detailsOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [detailsOpen]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/nurse/ipd/assigned');
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        if (!alive) return;
        setPatients(items);
      } catch {
        if (!alive) return;
        setPatients([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filterByWard = (list) => list;

  const handleSearch = (query, list) => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const name = String(p.name || '').toLowerCase();
      const uhid = String(p.uhid || '').toLowerCase();
      return name.includes(q) || uhid.includes(q);
    });
  };

  useEffect(() => {
    const wardPatients = filterByWard(patients);
    const searched = handleSearch(searchQuery, wardPatients);
    setFilteredPatients(searched);
  }, [patients, searchQuery]);

  const totals = useMemo(() => {
    const wardPatients = filterByWard(patients);
    const total = wardPatients.length;
    const critical = wardPatients.filter((p) => String(p.status || '').toLowerCase().includes('critical')).length;
    const stable = wardPatients.filter((p) => !String(p.status || '').toLowerCase().includes('critical')).length;
    return { total, critical, stable };
  }, [patients]);

  const handleOpenForm = (patient) => {
    const aid = admissionIdFromRow(patient);
    if (!aid) return;
    navigate(`/dashboard/nurse/ipd/details/${aid}`);
  };

  const handleViewDetails = (patient) => {
    const pid = nursePatientIdForStorage(patient);
    if (pid == null) return;
    const stored = safeParse(localStorage.getItem(recordKey(pid)) || '', null);
    const clinical = safeParse(localStorage.getItem(clinicalKey(pid)) || '', null);
    const tasksStored = safeParse(localStorage.getItem(tasksKey(pid)) || '', null);
    const base = defaultRecordFromPatient(patient);
    const merged = stored
      ? {
          ...base,
          ...stored,
          admissionId: base.admissionId || stored.admissionId,
          patient: { ...base.patient, ...(stored.patient || {}), id: pid },
          vitals: { ...base.vitals, ...(stored.vitals || {}) },
          medications: Array.isArray(stored.medications) ? stored.medications : base.medications,
          notes: Array.isArray(stored.notes) ? stored.notes : base.notes,
        }
      : base;
    setDetailsRecord({ ...merged, clinical: clinical || null, nurseTasks: tasksStored });
    setDetailsOpen(true);
    setTransferOpen(false);
    setTransferMsg('');
  };

  const handleAddNotes = (patient) => {
    const pid = nursePatientIdForStorage(patient);
    navigate('/dashboard/nurse/notes/add', {
      state: {
        admissionId: admissionIdFromRow(patient),
        patientId: pid,
        uhid: patient.uhid,
        name: patient.name,
      },
    });
  };

  const openTransfer = () => {
    setTransferMsg('');
    setTransferForm({ toWard: '', sendToReception: true });
    setTransferOpen(true);
  };

  const submitTransfer = () => {
    if (!detailsRecord?.patient?.id || !transferForm.toWard) return;
    const p = detailsRecord.patient;
    const row = {
      id: `TRREQ-${Date.now()}`,
      dateTime: new Date().toISOString(),
      patientId: p.id,
      patientName: p.name,
      uhid: p.uhid,
      fromWard: p.ward,
      fromBed: p.bed,
      toWard: transferForm.toWard,
      status: 'Pending',
      source: 'nurse',
      sendToReception: Boolean(transferForm.sendToReception),
    };

    const existing = readTransferRequests();
    writeTransferRequests([row, ...existing]);
    setTransferMsg('Transfer request sent.');
    window.setTimeout(() => setTransferMsg(''), 1600);
    setTransferOpen(false);
  };

  return (
    <div className="assigned-patients-container">
     

      <div className="assigned-patients-summary">
        <div className="assigned-patients-card">
          <div className="assigned-patients-card-row">
            <div className="assigned-patients-card-icon assigned-patients-card-icon-blue">
              <MdPeople className="assigned-patients-card-icon-svg" />
            </div>
            <div className="assigned-patients-card-meta">
              <p className="assigned-patients-card-value">{totals.total}</p>
              <p className="assigned-patients-card-label">Total Assigned Patients</p>
            </div>
          </div>
        </div>
        <div className="assigned-patients-card assigned-patients-card-critical">
          <div className="assigned-patients-card-row">
            <div className="assigned-patients-card-icon assigned-patients-card-icon-red">
              <MdWarning className="assigned-patients-card-icon-svg" />
            </div>
            <div className="assigned-patients-card-meta">
              <p className="assigned-patients-card-value">{totals.critical}</p>
              <p className="assigned-patients-card-label">Critical Patients</p>
            </div>
          </div>
        </div>
        <div className="assigned-patients-card assigned-patients-card-stable">
          <div className="assigned-patients-card-row">
            <div className="assigned-patients-card-icon assigned-patients-card-icon-green">
              <MdCheckCircle className="assigned-patients-card-icon-svg" />
            </div>
            <div className="assigned-patients-card-meta">
              <p className="assigned-patients-card-value">{totals.stable}</p>
              <p className="assigned-patients-card-label">Stable Patients</p>
            </div>
          </div>
        </div>
      </div>

      <div className="assigned-patients-toolbar">
        <div className="assigned-patients-search">
    
          <input
            id="assigned-patients-search-input"
            className="assigned-patients-search-input"
            placeholder="Search by Patient Name or UHID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="assigned-patients-toolbar-right">
          <span className="assigned-patients-count">
            Showing <b>{filteredPatients.length}</b> / {totals.total}
          </span>
          <button
            type="button"
            className="assigned-patients-btn assigned-patients-btn-secondary"
            onClick={() => setSearchQuery('')}
            disabled={!searchQuery}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="assigned-patients-content">
        {filteredPatients.length === 0 ? (
          <div className="assigned-patients-empty">
            <p className="assigned-patients-empty-title">No patients assigned</p>
            <p className="assigned-patients-empty-sub">
              No patients assigned to your login
              {searchQuery ? (
                <>
                  {' '}
                  with search “<b>{searchQuery}</b>”
                </>
              ) : null}
              .
            </p>
          </div>
        ) : (
          <div className="assigned-patients-table-wrap">
            <table className="assigned-patients-table">
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>UHID</th>
                  <th>Ward</th>
                  <th>Bed Number</th>
                  <th>Doctor</th>
                  <th>Admission Date</th>
                  <th>Status</th>
                  <th className="assigned-patients-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((p) => (
                  <tr
                    key={p.admissionId ?? p.id}
                    className={String(p.status || '').toLowerCase().includes('critical') ? 'assigned-patients-row-critical' : undefined}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleViewDetails(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleViewDetails(p);
                    }}
                  >
                    <td className="assigned-patients-td-strong">{p.name}</td>
                    <td className="assigned-patients-td-mono">{p.uhid}</td>
                    <td>{p.ward}</td>
                    <td className="assigned-patients-td-mono">{p.bed}</td>
                    <td>{p.doctor}</td>
                    <td className="assigned-patients-td-mono">{p.admissionDate ? new Date(p.admissionDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td>
                      <span
                        className={[
                          'assigned-patients-badge',
                          String(p.status || '').toLowerCase().includes('critical')
                            ? 'assigned-patients-badge-critical'
                            : 'assigned-patients-badge-stable',
                        ].join(' ')}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <div className="assigned-patients-actions">
                        <button
                          type="button"
                          className="assigned-patients-btn assigned-patients-btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(p);
                          }}
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          className="assigned-patients-btn assigned-patients-btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddNotes(p);
                          }}
                        >
                          Add Notes
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailsOpen && detailsRecord ? (
        <div
          className="assigned-patients-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailsOpen(false)}
        >
          <div className="assigned-patients-modal" onClick={(e) => e.stopPropagation()}>
            <div className="assigned-patients-modal-header">
              <div className="assigned-patients-modal-title-wrap">
                <p className="assigned-patients-modal-title">Patient Details</p>
                <p className="assigned-patients-modal-sub">
                  <span className="assigned-patients-mono">{detailsRecord.patient.uhid}</span> · {detailsRecord.patient.name}
                </p>
              </div>
              <button
                type="button"
                className="assigned-patients-btn assigned-patients-btn-secondary"
                onClick={() => setDetailsOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="assigned-patients-modal-body">
              <div className="assigned-patients-modal-grid">
                <div className="assigned-patients-modal-card">
                  <p className="assigned-patients-modal-card-title">Basic</p>
                  <div className="assigned-patients-modal-kv">
                    <div><span>Ward</span><b>{detailsRecord.patient.ward}</b></div>
                    <div><span>Bed</span><b className="assigned-patients-mono">{detailsRecord.patient.bed}</b></div>
                    <div><span>Doctor</span><b>{detailsRecord.patient.doctor}</b></div>
                    <div>
                      <span>Admission</span>
                      <b className="assigned-patients-mono">
                        {detailsRecord.patient.admissionDate
                          ? new Date(detailsRecord.patient.admissionDate).toLocaleDateString('en-IN')
                          : '—'}
                      </b>
                    </div>
                    <div>
                      <span>Status</span>
                      <b>
                        <span
                          className={[
                            'assigned-patients-badge',
                            String(detailsRecord.patient.status || '').toLowerCase().includes('critical')
                              ? 'assigned-patients-badge-critical'
                              : 'assigned-patients-badge-stable',
                          ].join(' ')}
                        >
                          {detailsRecord.patient.status}
                        </span>
                      </b>
                    </div>
                  </div>
                  <div className="assigned-patients-modal-diagnosis">
                    <span>Diagnosis:</span> {detailsRecord.patient.diagnosis || '—'}
                  </div>
                </div>

                <div className="assigned-patients-modal-card">
                  <p className="assigned-patients-modal-card-title">Vitals</p>
                  <div className="assigned-patients-modal-kv">
                    <div><span>BP</span><b className="assigned-patients-mono">{detailsRecord.vitals?.bp ?? '—'}</b></div>
                    <div><span>Temp</span><b className="assigned-patients-mono">{detailsRecord.vitals?.temperature ?? '—'}</b></div>
                    <div><span>Pulse</span><b className="assigned-patients-mono">{detailsRecord.vitals?.pulse ?? '—'}</b></div>
                    <div><span>Oxygen</span><b className="assigned-patients-mono">{detailsRecord.vitals?.oxygen ?? '—'}</b></div>
                  </div>
                </div>
              </div>

              <div className="assigned-patients-modal-card assigned-patients-modal-card-wide">
                <p className="assigned-patients-modal-card-title">Medications</p>
                {detailsRecord.medications?.length ? (
                  <div className="assigned-patients-modal-list">
                    {detailsRecord.medications.map((m, idx) => (
                      <div key={`${m.name}-${m.time}-${idx}`} className="assigned-patients-modal-list-row">
                        <div className="assigned-patients-modal-list-left">
                          <div className="assigned-patients-modal-list-name">{m.name}</div>
                          <div className="assigned-patients-modal-list-sub assigned-patients-mono">
                            {m.time}
                            {m.route ? ` · ${m.route}` : ''}
                          </div>
                        </div>
                        <span
                          className={[
                            'assigned-patients-badge',
                            m.status === 'Given' ? 'assigned-patients-badge-stable' : 'assigned-patients-badge-critical',
                          ].join(' ')}
                        >
                          {m.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="assigned-patients-modal-empty">No medications added</div>
                )}
              </div>

              {detailsRecord.updatedAt ? (
                <p className="assigned-patients-modal-updated">
                  Last saved on this device: <strong>{new Date(detailsRecord.updatedAt).toLocaleString('en-IN')}</strong>
                </p>
              ) : null}

              {detailsRecord.clinical?.assessment &&
              (detailsRecord.clinical.assessment.gcsE ||
                detailsRecord.clinical.assessment.gcsV ||
                detailsRecord.clinical.assessment.gcsM ||
                detailsRecord.clinical.assessment.painScore ||
                detailsRecord.clinical.assessment.riskLevel) ? (
                <div className="assigned-patients-modal-card assigned-patients-modal-card-wide">
                  <p className="assigned-patients-modal-card-title">Nursing assessment</p>
                  <div className="assigned-patients-modal-kv">
                    <div>
                      <span>GCS (E/V/M)</span>
                      <b className="assigned-patients-mono">
                        {[detailsRecord.clinical.assessment.gcsE, detailsRecord.clinical.assessment.gcsV, detailsRecord.clinical.assessment.gcsM]
                          .filter(Boolean)
                          .join('/') || '—'}
                      </b>
                    </div>
                    <div>
                      <span>Pain (0–10)</span>
                      <b>{detailsRecord.clinical.assessment.painScore || '—'}</b>
                    </div>
                    <div>
                      <span>Risk level</span>
                      <b>{detailsRecord.clinical.assessment.riskLevel || '—'}</b>
                    </div>
                  </div>
                </div>
              ) : null}

              {Array.isArray(detailsRecord.nurseTasks) && detailsRecord.nurseTasks.length > 0 ? (
                <div className="assigned-patients-modal-card assigned-patients-modal-card-wide">
                  <p className="assigned-patients-modal-card-title">My tasks</p>
                  <ul className="assigned-patients-task-preview">
                    {detailsRecord.nurseTasks.map((t) => (
                      <li key={t.id} className={t.done ? 'assigned-patients-task-preview-done' : ''}>
                        {t.done ? '✓ ' : '○ '}
                        {t.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {detailsRecord.clinical?.icuMonitoring?.rows?.length ? (
                <div className="assigned-patients-modal-card assigned-patients-modal-card-wide">
                  <p className="assigned-patients-modal-card-title">ICU monitoring (saved)</p>
                  <div className="assigned-patients-modal-kv">
                    <div>
                      <span>Intake (ml)</span>
                      <b className="assigned-patients-mono">{detailsRecord.clinical.icuMonitoring.ioIn ?? '—'}</b>
                    </div>
                    <div>
                      <span>Output (ml)</span>
                      <b className="assigned-patients-mono">{detailsRecord.clinical.icuMonitoring.ioOut ?? '—'}</b>
                    </div>
                  </div>
                  {detailsRecord.clinical.icuMonitoring.vent ? (
                    <div className="assigned-patients-modal-diagnosis assigned-patients-modal-vent-line">
                      <span>Vent / O₂:</span> {detailsRecord.clinical.icuMonitoring.vent}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="assigned-patients-modal-card assigned-patients-modal-card-wide">
                <p className="assigned-patients-modal-card-title">Nursing Notes</p>
                {detailsRecord.notes?.length ? (
                  <div className="assigned-patients-modal-list">
                    {detailsRecord.notes.slice(0, 5).map((n, idx) => (
                      <div key={`${n.date}-${idx}`} className="assigned-patients-modal-list-row">
                        <div className="assigned-patients-modal-list-left">
                          <div className="assigned-patients-modal-list-sub assigned-patients-mono">{n.date}</div>
                          <div className="assigned-patients-modal-list-name">{n.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="assigned-patients-modal-empty">No notes yet</div>
                )}
              </div>

              <div className="assigned-patients-modal-footer">
                <button
                  type="button"
                  className="assigned-patients-btn assigned-patients-btn-primary"
                  onClick={() => {
                    setDetailsOpen(false);
                    handleOpenForm({
                      ...detailsRecord.patient,
                      admissionId: detailsRecord.admissionId,
                      patientId: detailsRecord.patient?.id,
                    });
                  }}
                >
                  Edit / Update
                </button>
                <button
                  type="button"
                  className="assigned-patients-btn assigned-patients-btn-secondary"
                  onClick={() => {
                    setDetailsOpen(false);
                    navigate('/dashboard/nurse/notes/add', {
                      state: {
                        admissionId: detailsRecord.admissionId,
                        patientId: detailsRecord.patient.id,
                        uhid: detailsRecord.patient.uhid,
                        name: detailsRecord.patient.name,
                      },
                    });
                  }}
                >
                  Add Notes
                </button>
                <button
                  type="button"
                  className="assigned-patients-btn assigned-patients-btn-secondary"
                  onClick={openTransfer}
                  disabled={String(detailsRecord.patient.status || '').toLowerCase().includes('critical')}
                  title={
                    String(detailsRecord.patient.status || '').toLowerCase().includes('critical')
                      ? 'Transfer only for stable patients'
                      : 'Request transfer'
                  }
                >
                  Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {detailsOpen && detailsRecord && transferOpen ? (
        <div className="assigned-patients-modal-overlay" role="dialog" aria-modal="true" onClick={() => setTransferOpen(false)}>
          <div className="assigned-patients-modal assigned-patients-transfer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="assigned-patients-modal-header">
              <div className="assigned-patients-modal-title-wrap">
                <p className="assigned-patients-modal-title">Transfer Patient</p>
                <p className="assigned-patients-modal-sub">
                  <span className="assigned-patients-mono">{detailsRecord.patient.uhid}</span> · {detailsRecord.patient.name}
                </p>
              </div>
              <button type="button" className="assigned-patients-btn assigned-patients-btn-secondary" onClick={() => setTransferOpen(false)}>
                Close
              </button>
            </div>

            <div className="assigned-patients-modal-body">
              {transferMsg ? <div className="assigned-patients-transfer-msg">{transferMsg}</div> : null}

              <div className="assigned-patients-modal-card">
                <p className="assigned-patients-modal-card-title">Patient Info</p>
                <div className="assigned-patients-modal-kv">
                  <div><span>From Ward</span><b>{detailsRecord.patient.ward}</b></div>
                  <div><span>From Bed</span><b className="assigned-patients-mono">{detailsRecord.patient.bed}</b></div>
                  <div><span>Doctor</span><b>{detailsRecord.patient.doctor}</b></div>
                  <div><span>Status</span><b>{detailsRecord.patient.status}</b></div>
                </div>
              </div>

              <div className="assigned-patients-modal-card assigned-patients-modal-card-wide">
                <p className="assigned-patients-modal-card-title">Transfer Details</p>
                <div className="assigned-patients-transfer-grid">
                  <div className="assigned-patients-transfer-field">
                    <label className="assigned-patients-transfer-label">Transfer to Ward</label>
                    <select
                      className="assigned-patients-transfer-input"
                      value={transferForm.toWard}
                      onChange={(e) => setTransferForm((f) => ({ ...f, toWard: e.target.value }))}
                    >
                      <option value="">Select ward</option>
                      {['ICU', 'General', 'Private', 'Ward A', 'Ward B'].map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="assigned-patients-transfer-field assigned-patients-transfer-field-inline">
                    <label className="assigned-patients-transfer-check">
                      <input
                        type="checkbox"
                        checked={transferForm.sendToReception}
                        onChange={(e) => setTransferForm((f) => ({ ...f, sendToReception: e.target.checked }))}
                      />
                      <span>Send to Reception</span>
                    </label>
                    <div className="assigned-patients-transfer-hint">Reception will receive a transfer request notification.</div>
                  </div>
                </div>
              </div>

              <div className="assigned-patients-modal-footer">
                <button type="button" className="assigned-patients-btn assigned-patients-btn-secondary" onClick={() => setTransferOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="assigned-patients-btn assigned-patients-btn-primary"
                  onClick={submitTransfer}
                  disabled={!transferForm.toWard}
                >
                  Submit Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

