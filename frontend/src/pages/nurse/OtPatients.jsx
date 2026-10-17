import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MdPerson, MdSearch, MdLocalHospital, MdEdit, MdClose, MdCheckCircle, MdMedicalServices, MdHistory, MdSend } from 'react-icons/md';
import api, { getApiErrorMessage } from '../../utils/api';
import Badge from '../../components/Badge';
import '../ot/SurgeryScheduling.css';

const WARD_LABELS = {
  GENERAL: 'General Ward',
  PRIVATE: 'Private Ward',
  RECOVERY: 'Recovery Room',
};

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OtPatients() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [assessmentForm, setAssessmentForm] = useState({
    bpSystolic: '', bpDiastolic: '', pulse: '', temperature: '', spo2: '', respiratoryRate: '',
    painScore: 0, consciousnessLevel: '', surgicalSiteAssessment: '', postAnaesthesiaMonitoring: '',
    status: '', recoveryNotes: '',
  });
  const [assessmentSaving, setAssessmentSaving] = useState(false);
  const [assessmentMsg, setAssessmentMsg] = useState('');

  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Transfer
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferWard, setTransferWard] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferMsg, setTransferMsg] = useState('');

  useEffect(() => {
    api.get('/nurse/ot-patients')
      .then((res) => setItems(Array.isArray(res.data?.items) ? res.data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const [loadError, setLoadError] = useState('');
  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true);
    setLoadError('');
    try {
      const res = await api.get('/nurse/ot-patients/' + id);
      setDetail(res.data?.record || null);
      if (!res.data?.record) setLoadError('Record not found in response');
    } catch (err) {
      const status = err?.response?.status || 'network';
      const msg = err?.response?.data?.message || err.message || 'Unknown error';
      setLoadError('HTTP ' + status + ': ' + msg);
      console.error('loadDetail error:', status, msg);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = (id) => {
    setSelectedId(id);
    setAssessmentMsg('');
    resetForm();
    loadDetail(id);
  };
  const closeDetail = () => { setSelectedId(null); setDetail(null); setAssessmentMsg(''); setHistoryOpen(false); setTransferOpen(false); };

  const resetForm = () => {
    setAssessmentForm({
      bpSystolic: '', bpDiastolic: '', pulse: '', temperature: '', spo2: '', respiratoryRate: '',
      painScore: 0, consciousnessLevel: '', surgicalSiteAssessment: '', postAnaesthesiaMonitoring: '',
      status: '', recoveryNotes: '',
    });
  };

  const handleSaveAssessment = async () => {
    const sessionId = detail?.surgerySession?.id;
    if (!sessionId) return;
    setAssessmentSaving(true);
    setAssessmentMsg('');
    try {
      await api.put('/ot/recovery/assessment/' + sessionId, assessmentForm);
      setAssessmentMsg('Assessment saved successfully.');
      resetForm();
      loadDetail(selectedId);
    } catch (err) {
      setAssessmentMsg(err?.response?.data?.message || 'Failed to save assessment');
    } finally {
      setAssessmentSaving(false);
    }
  };

  const loadHistory = async () => {
    const sessionId = detail?.surgerySession?.id;
    if (!sessionId) return;
    setHistoryLoading(true);
    setHistoryOpen(true);
    try {
      const res = await api.get('/ot/recovery/assessments/' + sessionId);
      setHistoryData(Array.isArray(res.data?.assessments) ? res.data.assessments : []);
    } catch (err) {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRequestTransfer = async () => {
    if (!selectedId || !transferWard) return;
    setTransferSaving(true);
    setTransferMsg('');
    try {
      await api.post('/ot/recovery/request-reception-transfer', {
        recoveryRecordId: selectedId,
        preferredWardType: transferWard || undefined,
      });
      setTransferMsg('Transfer request sent to Reception.');
      setTimeout(() => { setTransferOpen(false); setTransferMsg(''); }, 2000);
    } catch (err) {
      setTransferMsg(getApiErrorMessage(err, 'Failed to request transfer'));
    } finally {
      setTransferSaving(false);
    }
  };

  const filtered = items.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const p = s.surgerySession?.surgerySchedule?.otRequest?.patient || {};
    return (p.name || '').toLowerCase().includes(q) || (p.uhid || '').toLowerCase().includes(q);
  });

  const surgeries = detail?.surgerySession?.surgerySchedule?.otRequest?.patient || {};
  const surgeryInfo = detail?.surgerySession?.surgerySchedule?.otRequest || {};
  const admission = surgeryInfo.admission || {};
  const otDone = detail?.surgerySession?.status === 'COMPLETED';
  const wardLabel = WARD_LABELS[detail?.transferredTo] || detail?.transferredTo || '—';

  return (
    <div className="ss-container">
      <div className="ss-header">
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}><MdLocalHospital /> Assigned Patients</h2>
      </div>
      <div className="ss-toolbar">
        <div className="ss-search-box">
          <MdSearch className="ss-search-icon" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient..." className="ss-search-input" />
        </div>
      </div>
      {loading ? <div className="ss-loading">Loading...</div> : (
        <div className="ss-table-wrapper">
          <table className="ss-table">
            <thead><tr>
              <th className="ss-th">Patient</th>
              <th className="ss-th">UHID</th>
              <th className="ss-th">Surgery</th>
              <th className="ss-th">Surgeon</th>
              <th className="ss-th">Ward</th>
              <th className="ss-th">Transferred At</th>
              <th className="ss-th">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((r) => {
                const ss = r.surgerySession?.surgerySchedule || {};
                const p = ss.otRequest?.patient || {};
                const wLabel = WARD_LABELS[r.transferredTo] || r.transferredTo || '—';
                return (
                  <tr key={r.id} className="ss-tr" style={{ cursor: 'pointer' }} onClick={() => openDetail(r.id)}>
                    <td className="ss-td">
                      <div className="ss-patient-cell">
                        <div className="ss-avatar"><MdPerson /></div>
                        <span className="ss-patient-name">{p.name || '—'}</span>
                      </div>
                    </td>
                    <td className="ss-td"><span className="ss-uhid">{p.uhid || '—'}</span></td>
                    <td className="ss-td" style={{ fontSize: 12 }}>{ss.otRequest?.surgeryRecommendation || '—'}</td>
                    <td className="ss-td" style={{ fontSize: 12 }}>{ss.surgeon?.user?.name || '—'}</td>
                    <td className="ss-td">
                      <Badge variant={r.transferredTo === 'RECOVERY' ? 'blue' : 'green'}>{wLabel}</Badge>
                    </td>
                    <td className="ss-td" style={{ fontSize: 11 }}>{formatDateTime(r.transferredAt || r.createdAt)}</td>
                    <td className="ss-td">
                      <button type="button" onClick={(e) => { e.stopPropagation(); openDetail(r.id); }}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#2563eb', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MdEdit /> <span style={{ fontSize: 12 }}>Post Assessment</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="ss-empty">No patients assigned</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedId && createPortal(
        <div className="pl-modalOverlay" onClick={closeDetail}>
          <div className="pl-modal pl-modalAnimate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="pl-modalHeader">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MdMedicalServices /> Patient Details
              </h3>
              <button type="button" onClick={closeDetail} className="pl-modalClose"><MdClose /></button>
            </div>
            <div className="pl-modalBody">
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Loading...</div>
              ) : detail ? (
                <>
                  {/* OT Status */}
                  <div style={{ marginBottom: 12, padding: 10, borderRadius: 6, background: otDone ? '#f0fdf4' : '#fef9c3', border: '1px solid ' + (otDone ? '#bbf7d0' : '#fde68a') }}>
                    <strong style={{ fontSize: 14, color: otDone ? '#15803d' : '#a16207' }}>
                      <MdCheckCircle style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      {otDone ? 'OT Completed' : 'Surgery In Progress'}
                    </strong>
                    {otDone && detail?.surgerySession?.endTime && (
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Completed at {formatDateTime(detail.surgerySession.endTime)}</p>
                    )}
                  </div>

                  {/* Patient Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div style={{ padding: 8, borderRadius: 6, background: '#f8fafc' }}>
                      <p style={{ margin: '0 0 2px', fontSize: 10, color: '#94a3b8' }}>Name</p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{surgeries.name || '—'}</p>
                    </div>
                    <div style={{ padding: 8, borderRadius: 6, background: '#f8fafc' }}>
                      <p style={{ margin: '0 0 2px', fontSize: 10, color: '#94a3b8' }}>UHID</p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{surgeries.uhid || '—'}</p>
                    </div>
                    <div style={{ padding: 8, borderRadius: 6, background: '#f8fafc' }}>
                      <p style={{ margin: '0 0 2px', fontSize: 10, color: '#94a3b8' }}>Age / Gender</p>
                      <p style={{ margin: 0, fontSize: 13 }}>{surgeries.age || '—'} / {surgeries.gender || '—'}</p>
                    </div>
                    <div style={{ padding: 8, borderRadius: 6, background: '#f8fafc' }}>
                      <p style={{ margin: '0 0 2px', fontSize: 10, color: '#94a3b8' }}>Surgery</p>
                      <p style={{ margin: 0, fontSize: 13 }}>{surgeryInfo.surgeryRecommendation || '—'}</p>
                    </div>
                  </div>

                  {/* Room & Ward + Surgery Details + Reschedule + Procedure (combined brief) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div style={{ padding: 8, borderRadius: 6, background: '#f8fafc' }}>
                      <p style={{ margin: '0 0 2px', fontSize: 10, color: '#94a3b8' }}>OT Room</p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{detail?.surgerySession?.surgerySchedule?.otRoom?.roomName || '—'}</p>
                    </div>
                    <div style={{ padding: 8, borderRadius: 6, background: '#f8fafc' }}>
                      <p style={{ margin: '0 0 2px', fontSize: 10, color: '#94a3b8' }}>Ward</p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                        <Badge variant={detail?.transferredTo === 'RECOVERY' ? 'blue' : 'green'}>{wardLabel}</Badge>
                      </p>
                    </div>
                    <div style={{ padding: 8, borderRadius: 6, background: '#f8fafc' }}>
                      <p style={{ margin: '0 0 2px', fontSize: 10, color: '#94a3b8' }}>Surgery Date</p>
                      <p style={{ margin: 0, fontSize: 13 }}>{formatDate(detail?.surgerySession?.surgerySchedule?.surgeryDate)}</p>
                    </div>
                    <div style={{ padding: 8, borderRadius: 6, background: '#f8fafc' }}>
                      <p style={{ margin: '0 0 2px', fontSize: 10, color: '#94a3b8' }}>Surgery Time</p>
                      <p style={{ margin: 0, fontSize: 13 }}>{detail?.surgerySession?.surgerySchedule?.startTime || '—'}</p>
                    </div>
                  </div>
                  {detail?.surgerySession?.surgerySchedule?.rescheduledAt && (
                    <div style={{ marginBottom: 12, padding: 8, borderRadius: 6, background: '#fef9c3', border: '1px solid #fde68a', fontSize: 12 }}>
                      <strong style={{ color: '#a16207' }}>Rescheduled</strong>
                      <p style={{ margin: '2px 0 0', color: '#64748b' }}>
                        {formatDateTime(detail.surgerySession.surgerySchedule.rescheduledAt)}
                        {detail.surgerySession.surgerySchedule.rescheduleReason ? ' — ' + detail.surgerySession.surgerySchedule.rescheduleReason : ''}
                      </p>
                    </div>
                  )}

                  {/* Post Assessment Form */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 4 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}><MdEdit style={{ verticalAlign: 'middle' }} /> Post Assessment Form</p>
                    {assessmentMsg && (
                      <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 8,
                        background: assessmentMsg.includes('success') ? '#f0fdf4' : '#fef2f2',
                        color: assessmentMsg.includes('success') ? '#15803d' : '#dc2626',
                        border: '1px solid ' + (assessmentMsg.includes('success') ? '#bbf7d0' : '#fecaca') }}>
                        {assessmentMsg}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                      {[
                        ['bpSystolic', 'BP Systolic', 'number'],
                        ['bpDiastolic', 'BP Diastolic', 'number'],
                        ['pulse', 'Pulse (bpm)', 'number'],
                        ['temperature', 'Temp (°C)', 'number'],
                        ['spo2', 'SpO₂ (%)', 'number'],
                        ['respiratoryRate', 'RR (/min)', 'number'],
                      ].map(([key, label, type]) => (
                        <div key={key}>
                          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 2 }}>{label}</label>
                          <input type={type} step="any" value={assessmentForm[key]} onChange={(e) => setAssessmentForm((f) => ({ ...f, [key]: e.target.value }))}
                            style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, boxSizing: 'border-box' }} />
                        </div>
                      ))}
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Pain Score</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="range" min="0" max="10" value={assessmentForm.painScore} onChange={(e) => setAssessmentForm((f) => ({ ...f, painScore: e.target.value }))} style={{ flex: 1 }} />
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#2563eb', minWidth: 30 }}>{assessmentForm.painScore || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Consciousness Level</label>
                        <select value={assessmentForm.consciousnessLevel} onChange={(e) => setAssessmentForm((f) => ({ ...f, consciousnessLevel: e.target.value }))}
                          style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, background: '#fff' }}>
                          <option value="">Select</option>
                          <option value="Alert">Alert</option>
                          <option value="Drowsy">Drowsy</option>
                          <option value="Confused">Confused</option>
                          <option value="Unconscious">Unconscious</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Surgical Site</label>
                        <select value={assessmentForm.surgicalSiteAssessment} onChange={(e) => setAssessmentForm((f) => ({ ...f, surgicalSiteAssessment: e.target.value }))}
                          style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, background: '#fff' }}>
                          <option value="">Select</option>
                          <option value="Normal">Normal</option>
                          <option value="Bleeding">Bleeding</option>
                          <option value="Swelling">Swelling</option>
                          <option value="Infection Signs">Infection Signs</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Post Anaesthesia</label>
                        <select value={assessmentForm.postAnaesthesiaMonitoring} onChange={(e) => setAssessmentForm((f) => ({ ...f, postAnaesthesiaMonitoring: e.target.value }))}
                          style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, background: '#fff' }}>
                          <option value="">Select</option>
                          <option value="Nausea">Nausea</option>
                          <option value="Vomiting">Vomiting</option>
                          <option value="Dizziness">Dizziness</option>
                          <option value="Breathing Difficulty">Breathing Difficulty</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Recovery Status</label>
                        <select value={assessmentForm.status} onChange={(e) => setAssessmentForm((f) => ({ ...f, status: e.target.value }))}
                          style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, background: '#fff' }}>
                          <option value="">Select</option>
                          <option value="UNDER_OBSERVATION">Under Observation</option>
                          <option value="STABLE">Stable</option>
                          <option value="CRITICAL">Critical</option>
                          <option value="READY_FOR_TRANSFER">Ready For Transfer</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Recovery Notes</label>
                        <textarea value={assessmentForm.recoveryNotes} onChange={(e) => setAssessmentForm((f) => ({ ...f, recoveryNotes: e.target.value }))} rows={2}
                          placeholder="Enter observations..." style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, resize: 'vertical', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" onClick={loadHistory}
                          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MdHistory /> Assessment History
                        </button>
                        {detail?.status === 'READY_FOR_TRANSFER' && detail?.transferRequestStatus !== 'PENDING' && (
                        <button type="button" onClick={() => { setTransferWard(''); setTransferMsg(''); setTransferOpen(true); }}
                          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MdSend /> Request Transfer
                        </button>
                        )}
                        {detail?.transferRequestStatus === 'PENDING' && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', padding: '6px 10px' }}>Pending Reception</span>
                        )}
                      </div>
                      <button type="button" onClick={handleSaveAssessment} disabled={assessmentSaving}
                        style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, cursor: assessmentSaving ? 'not-allowed' : 'pointer', opacity: assessmentSaving ? 0.6 : 1, fontWeight: 600 }}>
                        {assessmentSaving ? 'Saving...' : 'Save Assessment'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 20, color: '#dc2626' }}>
                  Failed to load details
                  {loadError && <div style={{ fontSize: 11, marginTop: 4, color: '#94a3b8' }}>{loadError}</div>}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Assessment History Modal */}
      {historyOpen && createPortal(
        <div className="pl-modalOverlay" onClick={() => setHistoryOpen(false)}>
          <div className="pl-modal pl-modalAnimate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="pl-modalHeader">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MdHistory /> Assessment History
              </h3>
              <button type="button" onClick={() => setHistoryOpen(false)} className="pl-modalClose"><MdClose /></button>
            </div>
            <div className="pl-modalBody">
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Loading...</div>
              ) : historyData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No assessments recorded yet</div>
              ) : (
                <div className="ss-table-wrapper">
                  <table className="ss-table">
                    <thead><tr>
                      <th className="ss-th">Date & Time</th>
                      <th className="ss-th">Updated By</th>
                      <th className="ss-th">BP</th>
                      <th className="ss-th">Pulse</th>
                      <th className="ss-th">Temp</th>
                      <th className="ss-th">RR</th>
                      <th className="ss-th">SpO₂</th>
                      <th className="ss-th">Pain</th>
                      <th className="ss-th">Status</th>
                      <th className="ss-th">Notes</th>
                    </tr></thead>
                    <tbody>
                      {historyData.map((a) => (
                        <tr key={a.id}>
                          <td className="ss-td" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{formatDateTime(a.createdAt)}</td>
                          <td className="ss-td" style={{ fontSize: 12 }}>{a.assessedBy?.name || '—'}</td>
                          <td className="ss-td">{a.bpSystolic != null ? a.bpSystolic + '/' + (a.bpDiastolic || '—') : '—'}</td>
                          <td className="ss-td">{a.pulse != null ? a.pulse : '—'}</td>
                          <td className="ss-td">{a.temperature != null ? a.temperature : '—'}</td>
                          <td className="ss-td">{a.respiratoryRate != null ? a.respiratoryRate : '—'}</td>
                          <td className="ss-td">{a.spo2 != null ? a.spo2 : '—'}</td>
                          <td className="ss-td">{a.painScore != null ? a.painScore + '/10' : '—'}</td>
                          <td className="ss-td">
                            {a.status ? <Badge variant={a.status === 'STABLE' ? 'green' : a.status === 'CRITICAL' ? 'red' : a.status === 'READY_FOR_TRANSFER' ? 'amber' : 'blue'}>{a.status.replace(/_/g, ' ')}</Badge> : '—'}
                          </td>
                          <td className="ss-td" style={{ fontSize: 12, maxWidth: 150 }}>{a.recoveryNotes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Transfer Request Modal */}
      {transferOpen && createPortal(
        <div className="pl-modalOverlay" onClick={() => { if (!transferSaving) setTransferOpen(false); }}>
          <div className="pl-modal pl-modalAnimate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="pl-modalHeader">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MdSend /> Request Transfer
              </h3>
              <button type="button" onClick={() => setTransferOpen(false)} className="pl-modalClose"><MdClose /></button>
            </div>
            <div className="pl-modalBody">
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                A transfer request will be sent to HR. After HR approval, the patient will be moved using bed management.
              </p>
              {transferMsg && (
                <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 8,
                  background: transferMsg.includes('success') ? '#f0fdf4' : '#fef2f2',
                  color: transferMsg.includes('success') ? '#15803d' : '#dc2626',
                  border: '1px solid ' + (transferMsg.includes('success') ? '#bbf7d0' : '#fecaca') }}>
                  {transferMsg}
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Transfer to Ward</label>
                <select value={transferWard} onChange={(e) => setTransferWard(e.target.value)}
                  style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, background: '#fff' }}>
                  <option value="">Select ward</option>
                  <option value="ICU">ICU</option>
                  <option value="GENERAL">General Ward</option>
                  <option value="PRIVATE">Private Ward</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setTransferOpen(false)} disabled={transferSaving}
                  style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={handleRequestTransfer} disabled={!transferWard || transferSaving}
                  style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, cursor: !transferWard || transferSaving ? 'not-allowed' : 'pointer', opacity: !transferWard || transferSaving ? 0.6 : 1 }}>
                  {transferSaving ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
