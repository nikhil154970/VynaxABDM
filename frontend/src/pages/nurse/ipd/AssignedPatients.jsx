import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdPeople, MdWarning, MdCheckCircle, MdLocalHospital } from 'react-icons/md';
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

  const [otSubmitting, setOtSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [otAssessOpen, setOtAssessOpen] = useState(false);
  const [otAssessData, setOtAssessData] = useState(null);
  const [otAssessLoading, setOtAssessLoading] = useState(false);

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
        // Fetch OT schedules for patients with hasOtRequest
        if (items.some((p) => p.hasOtRequest)) {
          api.get('/nurse/ot-requests').then((res2) => {
            const otReqs = Array.isArray(res2?.data?.otRequests) ? res2.data.otRequests : [];
            const now = new Date();
            setPatients(items.map((p) => {
              if (!p.hasOtRequest) return { ...p, otTimeStarted: false };
              const ot = otReqs.find((r) => r.ipdId === p.admissionId);
              const sch = ot?.surgerySchedule;
              let started = false;
              if (sch?.surgeryDate) {
                const sDate = new Date(sch.surgeryDate);
                if (sch.startTime) {
                  const [h, m] = sch.startTime.split(':');
                  sDate.setHours(parseInt(h) || 0, parseInt(m) || 0, 0, 0);
                }
                started = now >= sDate;
              }
              return { ...p, otTimeStarted: started };
            }));
          }).catch(() => setPatients(items.map((p) => ({ ...p, otTimeStarted: true }))));
        } else {
          setPatients(items.map((p) => ({ ...p, otTimeStarted: false })));
        }
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
    setDetailsRecord({ ...merged, clinical: clinical || null, nurseTasks: tasksStored, preAssessment: null });
    setDetailsOpen(true);
    setTransferOpen(false);
    setTransferMsg('');

    api.get('/nurse/ot-request/by-admission/' + patient.admissionId)
      .then((res) => {
        const otReq = res?.data?.otRequest;
        if (otReq) {
          const surgerySession = otReq.surgerySchedule?.surgerySession;
          setDetailsRecord((prev) => ({
            ...prev,
            preAssessment: otReq.preOperativeAssessment || prev.preAssessment,
            otSchedule: otReq.surgerySchedule || null,
            postSurgery: surgerySession ? {
              sessionId: surgerySession.id,
              startTime: surgerySession.startTime,
              endTime: surgerySession.endTime,
              status: surgerySession.status,
              postSurgeryNote: surgerySession.postSurgeryNote || null,
              recoveryRecord: surgerySession.recoveryRecord || null,
              assessments: surgerySession.recoveryRecord?.assessments || [],
              transfers: surgerySession.recoveryRecord?.transfers || [],
              timeline: surgerySession.recoveryRecord?.timeline || [],
            } : null,
          }));
        }
      })
      .catch(() => {});

    api.get('/nurse/patient/' + patient.admissionId)
      .then((res) => {
        const apiNotes = res?.data?.notes;
        if (Array.isArray(apiNotes) && apiNotes.length) {
          setDetailsRecord((prev) => ({
            ...prev,
            notes: apiNotes,
          }));
        }
      })
      .catch(() => {});
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

  const completePatient = async (patient) => {
    if (!patient.admissionId) return;
    setCompleting(true);
    try {
      await api.put('/nurse/ipd/assigned/' + patient.admissionId + '/complete');
      const res = await api.get('/nurse/ipd/assigned');
      setPatients(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to complete patient care');
    } finally {
      setCompleting(false);
    }
  };

  const submitOtRequest = async (patient) => {
    if (patient.otPendingAssessment) {
      navigate('/dashboard/nurse/pre-assessment');
      return;
    }
    setOtSubmitting(true);
    try {
      const res = await api.post('/nurse/ot-request', {
        admissionId: patient.admissionId,
        diagnosis: patient.diagnosis || undefined,
      });
      const otRequestId = res?.data?.otRequest?.id;
      navigate('/dashboard/nurse/pre-assessment', { state: { otRequestId } });
      const listRes = await api.get('/nurse/ipd/assigned');
      setPatients(Array.isArray(listRes?.data?.items) ? listRes.data.items : []);
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to assign patient to OT');
    } finally {
      setOtSubmitting(false);
    }
  };

  const loadOtAssessments = async (patient) => {
    setOtAssessLoading(true);
    setOtAssessData(null);
    setOtAssessOpen(true);
    try {
      const res = await api.get(`/nurse/patient/${patient.admissionId}/ot-assessments`);
      setOtAssessData(res.data);
    } catch {
      setOtAssessData(null);
    } finally {
      setOtAssessLoading(false);
    }
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
            Showing <b>{filteredPatients.length}</b>
          </span>
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
                  <th className="assigned-patients-col-name">Patient Name</th>
                  <th className="assigned-patients-col-uhid">UHID</th>
                  <th className="assigned-patients-col-ward">Ward</th>
                  <th className="assigned-patients-col-bed">Bed</th>
                  <th className="assigned-patients-col-doctor">Doctor</th>
                  <th className="assigned-patients-col-date">Admission</th>
                  <th className="assigned-patients-col-status">Status</th>
                  <th className="assigned-patients-col-actions assigned-patients-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((p) => (
                  <React.Fragment key={p.admissionId ?? p.id}>
                  <tr
                    className={String(p.status || '').toLowerCase().includes('critical') ? 'assigned-patients-row-critical' : undefined}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleViewDetails(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleViewDetails(p);
                    }}
                  >
                    <td className="assigned-patients-td-strong assigned-patients-td-ellipsis" title={p.name}>{p.name}</td>
                    <td className="assigned-patients-td-mono">{p.uhid}</td>
                    <td className="assigned-patients-td-ellipsis" title={p.ward}>{p.ward}</td>
                    <td className="assigned-patients-td-mono">{p.bed}</td>
                    <td className="assigned-patients-td-ellipsis" title={p.doctor}>{p.doctor}</td>
                    <td className="assigned-patients-td-mono">
                      {p.admissionDate ? new Date(p.admissionDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td>
                      <div className="assigned-patients-status-stack">
                        {p.hasOtRequest ? null : (
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
                        )}
                        {p.otPendingAssessment ? (
                          <span className="assigned-patients-badge assigned-patients-badge-ot">
                            Pre Assessment Pending
                          </span>
                        ) : p.hasOtRequest ? (
                          <span className="assigned-patients-badge assigned-patients-badge-ot">
                            OT
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="assigned-patients-actions-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="assigned-patients-actions assigned-patients-actions-simple">
                        <button type="button" className="assigned-patients-btn assigned-patients-btn-primary"
                          onClick={() => handleViewDetails(p)}>
                          View Details
                        </button>
                        {p.hasOtRequest ? (
                          completing ? (
                            <span className="assigned-patients-actions-loading-inline">Completing…</span>
                          ) : (
                            <button type="button"
                              className="assigned-patients-btn assigned-patients-btn-primary"
                              disabled={!p.otTimeStarted}
                              title={!p.otTimeStarted ? 'OT has not started yet' : 'Complete patient care'}
                              onClick={() => completePatient(p)}>
                              Complete
                            </button>
                          )
                        ) : p.hasRecoveryRecord ? (
                          <span className="assigned-patients-badge assigned-patients-badge-ot" style={{ fontSize: '0.75rem', cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); loadOtAssessments(p); }}>
                            OT Done
                          </span>
                        ) : otSubmitting ? (
                          <span className="assigned-patients-actions-loading-inline">Assigning…</span>
                        ) : (
                          <button type="button"
                            className="assigned-patients-btn assigned-patients-btn-secondary"
                            onClick={() => (p.otPendingAssessment ? navigate('/dashboard/nurse/pre-assessment') : submitOtRequest(p))}>
                            Assign To OT
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
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

              {detailsRecord.otSchedule ? (
                <div className="assigned-patients-modal-card assigned-patients-modal-card-wide">
                  <p className="assigned-patients-modal-card-title">OT Schedule</p>
                  {detailsRecord.otSchedule.rescheduledAt && (
                    <div style={{ marginBottom: 8, padding: '4px 8px', borderRadius: 4, background: '#fef9c3', border: '1px solid #fde68a', fontSize: 12 }}>
                      <strong style={{ color: '#a16207' }}>Rescheduled</strong>
                      {detailsRecord.otSchedule.rescheduleReason ? <span> — {detailsRecord.otSchedule.rescheduleReason}</span> : null}
                    </div>
                  )}
                  <div className="assigned-patients-modal-kv" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <div><span>Date</span><b>{new Date(detailsRecord.otSchedule.surgeryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</b></div>
                    <div><span>Time</span><b>{detailsRecord.otSchedule.startTime || '—'}</b></div>
                    <div><span>Duration</span><b>{detailsRecord.otSchedule.estimatedDuration ? detailsRecord.otSchedule.estimatedDuration + ' min' : '—'}</b></div>
                    <div><span>OT Room</span><b>{detailsRecord.otSchedule.otRoom?.roomName || '—'}</b></div>
                    <div><span>Status</span><b>{detailsRecord.otSchedule.status || '—'}</b></div>
                  </div>
                </div>
              ) : null}

              {detailsRecord.preAssessment ? (
                <div className="assigned-patients-modal-card assigned-patients-modal-card-wide">
                  <p className="assigned-patients-modal-card-title">Pre-Operative Assessment</p>
                  <div className="assigned-patients-modal-kv" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <div><span>BP</span><b className="assigned-patients-mono">{detailsRecord.preAssessment.bpSystolic || '—'}/{detailsRecord.preAssessment.bpDiastolic || '—'}</b></div>
                    <div><span>Pulse</span><b className="assigned-patients-mono">{detailsRecord.preAssessment.pulse ?? '—'}</b></div>
                    <div><span>Temp</span><b className="assigned-patients-mono">{detailsRecord.preAssessment.temperature ?? '—'}</b></div>
                    <div><span>SpO₂</span><b className="assigned-patients-mono">{detailsRecord.preAssessment.spo2 ?? '—'}</b></div>
                    <div><span>RR</span><b className="assigned-patients-mono">{detailsRecord.preAssessment.respiratoryRate ?? '—'}</b></div>
                    <div><span>BMI</span><b className="assigned-patients-mono">{detailsRecord.preAssessment.bmi ?? '—'}</b></div>
                    <div><span>Height</span><b className="assigned-patients-mono">{detailsRecord.preAssessment.heightCm ?? '—'}</b></div>
                    <div><span>Weight</span><b className="assigned-patients-mono">{detailsRecord.preAssessment.weightKg ?? '—'}</b></div>
                    <div><span>Assessed By</span><b>{detailsRecord.preAssessment.assessedBy?.name || '—'}</b></div>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 13, color: '#374151' }}>
                    {detailsRecord.preAssessment.diabetes && <span>✓ Diabetes</span>}
                    {detailsRecord.preAssessment.hypertension && <span>✓ Hypertension</span>}
                    {detailsRecord.preAssessment.asthma && <span>✓ Asthma</span>}
                    {detailsRecord.preAssessment.heartDisease && <span>✓ Heart Disease</span>}
                    {detailsRecord.preAssessment.kidneyDisease && <span>✓ Kidney Disease</span>}
                    {detailsRecord.preAssessment.consentObtained && <span>✓ Consent</span>}
                    {detailsRecord.preAssessment.labReportsAvailable && <span>✓ Lab Reports</span>}
                    {detailsRecord.preAssessment.fastingCompleted && <span>✓ Fasting</span>}
                    {detailsRecord.preAssessment.bloodAvailable && <span>✓ Blood Available</span>}
                    {detailsRecord.preAssessment.surgicalSiteVerified && <span>✓ Site Verified</span>}
                    {detailsRecord.preAssessment.patientIdentityVerified && <span>✓ Identity Verified</span>}
                  </div>
                  {detailsRecord.preAssessment.knownAllergies && (
                    <div style={{ marginTop: 6, fontSize: 13 }}><span style={{ fontWeight: 600 }}>Allergies:</span> {detailsRecord.preAssessment.knownAllergies}</div>
                  )}
                  {detailsRecord.preAssessment.currentMedications && (
                    <div style={{ marginTop: 4, fontSize: 13 }}><span style={{ fontWeight: 600 }}>Medications:</span> {detailsRecord.preAssessment.currentMedications}</div>
                  )}
                  {detailsRecord.preAssessment.previousSurgeries && (
                    <div style={{ marginTop: 4, fontSize: 13 }}><span style={{ fontWeight: 600 }}>Surgeries:</span> {detailsRecord.preAssessment.previousSurgeries}</div>
                  )}
                  {detailsRecord.preAssessment.nurseNotes && (
                    <div style={{ marginTop: 4, fontSize: 13 }}><span style={{ fontWeight: 600 }}>Notes:</span> {detailsRecord.preAssessment.nurseNotes}</div>
                  )}
                </div>
              ) : null}

              {detailsRecord.postSurgery ? (
                <div className="assigned-patients-modal-card assigned-patients-modal-card-wide">
                  <p className="assigned-patients-modal-card-title">Post-Operative (Surgery Complete)</p>
                  <div className="assigned-patients-modal-kv" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div><span>Surgery Start</span><b className="assigned-patients-mono">{new Date(detailsRecord.postSurgery.startTime).toLocaleString('en-IN')}</b></div>
                    <div><span>Surgery End</span><b className="assigned-patients-mono">{detailsRecord.postSurgery.endTime ? new Date(detailsRecord.postSurgery.endTime).toLocaleString('en-IN') : '—'}</b></div>
                    <div><span>Session Status</span><b>{detailsRecord.postSurgery.status}</b></div>
                    <div><span>Recovery Status</span><b>{detailsRecord.postSurgery.recoveryRecord?.status || '—'}</b></div>
                  </div>

                  {detailsRecord.postSurgery.postSurgeryNote ? (
                    <div style={{ marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Post-Surgery Note</p>
                      <div style={{ fontSize: 13, color: '#374151' }}>
                        <div><span style={{ fontWeight: 500 }}>Outcome:</span> {detailsRecord.postSurgery.postSurgeryNote.surgeryOutcome || '—'}</div>
                        <div><span style={{ fontWeight: 500 }}>Procedure:</span> {detailsRecord.postSurgery.postSurgeryNote.procedureSummary || '—'}</div>
                        <div><span style={{ fontWeight: 500 }}>Findings:</span> {detailsRecord.postSurgery.postSurgeryNote.operationFindings || '—'}</div>
                        {detailsRecord.postSurgery.postSurgeryNote.complications && <div><span style={{ fontWeight: 500 }}>Complications:</span> {detailsRecord.postSurgery.postSurgeryNote.complications}</div>}
                        {detailsRecord.postSurgery.postSurgeryNote.surgeonNotes && <div><span style={{ fontWeight: 500 }}>Surgeon Notes:</span> {detailsRecord.postSurgery.postSurgeryNote.surgeonNotes}</div>}
                        {detailsRecord.postSurgery.postSurgeryNote.specialInstructions && <div><span style={{ fontWeight: 500 }}>Instructions:</span> {detailsRecord.postSurgery.postSurgeryNote.specialInstructions}</div>}
                      </div>
                    </div>
                  ) : null}

                  {detailsRecord.postSurgery.recoveryRecord ? (
                    <div style={{ marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Recovery Vitals</p>
                      <div className="assigned-patients-modal-kv" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <div><span>BP</span><b className="assigned-patients-mono">{detailsRecord.postSurgery.recoveryRecord.bpSystolic || '—'}/{detailsRecord.postSurgery.recoveryRecord.bpDiastolic || '—'}</b></div>
                        <div><span>Pulse</span><b className="assigned-patients-mono">{detailsRecord.postSurgery.recoveryRecord.pulse ?? '—'}</b></div>
                        <div><span>Temp</span><b className="assigned-patients-mono">{detailsRecord.postSurgery.recoveryRecord.temperature ?? '—'}</b></div>
                        <div><span>SpO₂</span><b className="assigned-patients-mono">{detailsRecord.postSurgery.recoveryRecord.spo2 ?? '—'}</b></div>
                        <div><span>RR</span><b className="assigned-patients-mono">{detailsRecord.postSurgery.recoveryRecord.respiratoryRate ?? '—'}</b></div>
                        <div><span>Pain</span><b className="assigned-patients-mono">{detailsRecord.postSurgery.recoveryRecord.painScore ?? '—'}/10</b></div>
                        <div><span>Consciousness</span><b>{detailsRecord.postSurgery.recoveryRecord.consciousnessLevel || '—'}</b></div>
                        <div><span>Surgical Site</span><b>{detailsRecord.postSurgery.recoveryRecord.surgicalSiteAssessment || '—'}</b></div>
                        <div><span>Post Anaesthesia</span><b>{detailsRecord.postSurgery.recoveryRecord.postAnaesthesiaMonitoring || '—'}</b></div>
                      </div>
                      {detailsRecord.postSurgery.recoveryRecord.recoveryNotes && (
                        <div style={{ marginTop: 6, fontSize: 13, color: '#374151' }}>
                          <span style={{ fontWeight: 500 }}>Notes:</span> {detailsRecord.postSurgery.recoveryRecord.recoveryNotes}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {detailsRecord.postSurgery.timeline?.length > 0 ? (
                    <div style={{ marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Recovery Timeline</p>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {detailsRecord.postSurgery.timeline.map((evt, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                            <span className="assigned-patients-mono" style={{ whiteSpace: 'nowrap', fontSize: 11 }}>
                              {new Date(evt.createdAt).toLocaleString('en-IN')}
                            </span>
                            <span>{evt.eventDescription || evt.eventType}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
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

      {/* OT Assessments Modal */}
      {otAssessOpen ? (
        <div className="assigned-patients-modal-overlay" onClick={() => setOtAssessOpen(false)}>
          <div className="assigned-patients-modal" onClick={(e) => e.stopPropagation()}>
            <div className="assigned-patients-modal-header">
              <div>
                <h2 className="assigned-patients-modal-title">OT Assessments</h2>
              </div>
              <button type="button" className="assigned-patients-btn assigned-patients-btn-secondary" onClick={() => setOtAssessOpen(false)}>
                Close
              </button>
            </div>
            <div className="assigned-patients-modal-body">
              {otAssessLoading ? (
                <p>Loading assessments…</p>
              ) : otAssessData ? (
                <>
                  {otAssessData.preAssessment ? (
                    <div className="assigned-patients-modal-card">
                      <p className="assigned-patients-modal-card-title">Pre-Operative Assessment</p>
                      <div className="assigned-patients-modal-kv">
                        <div><span>BP</span><b>{otAssessData.preAssessment.bpSystolic || '—'}/{otAssessData.preAssessment.bpDiastolic || '—'}</b></div>
                        <div><span>Pulse</span><b>{otAssessData.preAssessment.pulse || '—'}</b></div>
                        <div><span>Temp</span><b>{otAssessData.preAssessment.temperature ? otAssessData.preAssessment.temperature + '°F' : '—'}</b></div>
                        <div><span>SpO₂</span><b>{otAssessData.preAssessment.spo2 || '—'}%</b></div>
                        <div><span>RR</span><b>{otAssessData.preAssessment.respiratoryRate || '—'}</b></div>
                        <div><span>BMI</span><b>{otAssessData.preAssessment.bmi || '—'}</b></div>
                        <div><span>Allergies</span><b>{otAssessData.preAssessment.knownAllergies || 'None'}</b></div>
                        <div><span>Nurse Notes</span><b>{otAssessData.preAssessment.nurseNotes || '—'}</b></div>
                      </div>
                      {otAssessData.preAssessment.assessedBy ? (
                        <p style={{ fontSize: '0.8rem', color: '#666', marginTop: 8 }}>
                          Assessed by: {otAssessData.preAssessment.assessedBy.name} on {new Date(otAssessData.preAssessment.assessmentDate).toLocaleDateString('en-IN')}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {otAssessData.postSurgery ? (
                    <div className="assigned-patients-modal-card">
                      <p className="assigned-patients-modal-card-title">Post-Surgery Note</p>
                      <div className="assigned-patients-modal-kv">
                        <div><span>Outcome</span><b>{otAssessData.postSurgery.surgeryOutcome || '—'}</b></div>
                        <div><span>Procedure</span><b>{otAssessData.postSurgery.procedureSummary || '—'}</b></div>
                        <div><span>Findings</span><b>{otAssessData.postSurgery.operationFindings || '—'}</b></div>
                        <div><span>Surgeon Notes</span><b>{otAssessData.postSurgery.surgeonNotes || '—'}</b></div>
                        <div><span>Complications</span><b>{otAssessData.postSurgery.complications || 'None'}</b></div>
                        <div><span>Blood Loss</span><b>{otAssessData.postSurgery.bloodLoss || '—'}</b></div>
                        <div><span>Instructions</span><b>{otAssessData.postSurgery.specialInstructions || '—'}</b></div>
                        <div><span>Follow-up</span><b>{otAssessData.postSurgery.followUpInstructions || '—'}</b></div>
                      </div>
                    </div>
                  ) : null}
                  {otAssessData.recoveryAssessments?.length > 0 ? (
                    <div className="assigned-patients-modal-card">
                      <p className="assigned-patients-modal-card-title">Recovery Assessments ({otAssessData.recoveryAssessments.length})</p>
                      {otAssessData.recoveryAssessments.map((ra) => (
                        <div key={ra.id} style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}>
                          <div className="assigned-patients-modal-kv">
                            <div><span>BP</span><b>{ra.bpSystolic || '—'}/{ra.bpDiastolic || '—'}</b></div>
                            <div><span>Pulse</span><b>{ra.pulse || '—'}</b></div>
                            <div><span>Temp</span><b>{ra.temperature ? ra.temperature + '°F' : '—'}</b></div>
                            <div><span>SpO₂</span><b>{ra.spo2 || '—'}%</b></div>
                            <div><span>Pain</span><b>{ra.painScore != null ? ra.painScore + '/10' : '—'}</b></div>
                            <div><span>Status</span><b>{ra.status || '—'}</b></div>
                          </div>
                          {ra.recoveryNotes ? <p style={{ fontSize: '0.8rem', color: '#555', marginTop: 4 }}>{ra.recoveryNotes}</p> : null}
                          <p style={{ fontSize: '0.7rem', color: '#999' }}>
                            {new Date(ra.createdAt).toLocaleString('en-IN')}
                            {ra.assessedBy ? ` by ${ra.assessedBy.name}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {!otAssessData.preAssessment && !otAssessData.postSurgery && otAssessData.recoveryAssessments?.length === 0 ? (
                    <p>No assessment data found for this patient.</p>
                  ) : null}
                </>
              ) : (
                <p>Could not load assessment data.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

