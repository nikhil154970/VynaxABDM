import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MdPerson, MdSearch, MdClose, MdCheckCircle, MdEdit, MdHistory, MdWarning, MdRefresh, MdArrowBack, MdLocalHospital, MdMedicalServices, MdArrowForward, MdBed } from 'react-icons/md';
import { createPortal } from 'react-dom';
import api, { getApiErrorMessage } from '../../utils/api';
import Badge from '../../components/Badge';
import './SurgeryScheduling.css';

const STATUS_BADGE = {
  UNDER_OBSERVATION: 'blue',
  STABLE: 'green',
  CRITICAL: 'red',
  READY_FOR_TRANSFER: 'amber',
  TRANSFERRED: 'gray',
};

const WARD_TYPES = [
  { value: 'ICU', label: 'ICU' },
  { value: 'PRIVATE', label: 'Private Ward' },
  { value: 'GENERAL', label: 'General Ward' },
];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

const SEVERITY_COLORS = { Low: 'blue', Medium: 'amber', High: 'orange', Critical: 'red' };

export default function PostSurgeryNotes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detailSessionId, setDetailSessionId] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [followUps, setFollowUps] = useState([]);
  const [complications, setComplications] = useState([]);
  const [auditTrails, setAuditTrails] = useState([]);
  const [activeTab, setActiveTab] = useState('notes');

  // Surgeon Notes Form
  const [notesForm, setNotesForm] = useState({
    procedureSummary: '', operationFindings: '', complications: '', bloodLoss: '',
    specialInstructions: '', surgeryOutcome: '', surgeonNotes: '', followUpInstructions: '',
  });
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesMsg, setNotesMsg] = useState('');

  // Follow-up Form
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [followUpMsg, setFollowUpMsg] = useState('');

  // Request Reception Transfer
  const [transferOpen, setTransferOpen] = useState(false);
  const [preferredWardType, setPreferredWardType] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferMsg, setTransferMsg] = useState('');

  // Recovery Assessment
  const [assessmentForm, setAssessmentForm] = useState({
    bpSystolic: '', bpDiastolic: '', pulse: '', temperature: '', spo2: '',
    respiratoryRate: '', painScore: 0, recoveryStatus: '', recoveryNotes: '',
  });
  const [assessmentHistory, setAssessmentHistory] = useState([]);
  const [assessmentSaving, setAssessmentSaving] = useState(false);
  const [assessmentMsg, setAssessmentMsg] = useState('');

  useEffect(() => {
    const params = { recoveryStatus: 'UNDER_OBSERVATION,STABLE,CRITICAL,READY_FOR_TRANSFER,TRANSFERRED' };
    api.get('/ot/recovery/patients', { params })
      .then((res) => setItems(Array.isArray(res.data?.items) ? res.data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // Handle sessionId from URL query param
  useEffect(() => {
    const sid = searchParams.get('sessionId');
    if (sid) {
      openDetail(sid);
    }
  }, [searchParams]);

  const filtered = items.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const p = s.surgerySchedule?.otRequest?.patient || {};
    return (p.name || '').toLowerCase().includes(q) || (p.uhid || '').toLowerCase().includes(q);
  });

  const openDetail = async (sessionId) => {
    setDetailSessionId(sessionId);
    setDetailLoading(true);
    setSessionData(null);
    setFollowUps([]);
    setComplications([]);
    setAuditTrails([]);
    setAssessmentHistory([]);
    setAssessmentMsg('');
    setActiveTab('notes');
    try {
      const [sessionRes, followRes, compRes, auditRes, assessRes] = await Promise.all([
        api.get('/ot/post-surgery/notes/' + sessionId),
        api.get('/ot/post-surgery/followups/' + sessionId),
        api.get('/ot/post-surgery/complications/' + sessionId),
        api.get('/ot/post-surgery/audit-trail/' + sessionId),
        api.get('/ot/recovery/assessments/' + sessionId),
      ]);
      const sd = sessionRes.data?.session || null;
      setSessionData(sd);
      setFollowUps(Array.isArray(followRes.data?.followUps) ? followRes.data.followUps : []);
      setComplications(Array.isArray(compRes.data?.complications) ? compRes.data.complications : []);
      setAuditTrails(Array.isArray(auditRes.data?.trails) ? auditRes.data.trails : []);
      const history = Array.isArray(assessRes.data?.assessments) ? assessRes.data.assessments : [];
      setAssessmentHistory(history);

      const note = sd?.postSurgeryNote || {};
      setNotesForm({
        procedureSummary: note.procedureSummary || '',
        operationFindings: note.operationFindings || '',
        complications: note.complications || '',
        bloodLoss: note.bloodLoss || '',
        specialInstructions: note.specialInstructions || '',
        surgeryOutcome: note.surgeryOutcome || '',
        surgeonNotes: note.surgeonNotes || '',
        followUpInstructions: note.followUpInstructions || '',
      });

      const rr = sd?.recoveryRecord || {};
      const last = history[0] || {};
      setAssessmentForm({
        bpSystolic: last.bpSystolic ?? rr.bpSystolic ?? '',
        bpDiastolic: last.bpDiastolic ?? rr.bpDiastolic ?? '',
        pulse: last.pulse ?? rr.pulse ?? '',
        temperature: last.temperature ?? rr.temperature ?? '',
        spo2: last.spo2 ?? rr.spo2 ?? '',
        respiratoryRate: last.respiratoryRate ?? rr.respiratoryRate ?? '',
        painScore: last.painScore ?? rr.painScore ?? 0,
        recoveryStatus: rr.status || 'UNDER_OBSERVATION',
        recoveryNotes: last.recoveryNotes || rr.recoveryNotes || '',
      });
    } catch {
      setSessionData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailSessionId(null);
    setSessionData(null);
    setFollowUps([]);
    setComplications([]);
    setAuditTrails([]);
    setAssessmentHistory([]);
    setSearchParams({});
  };

  const handleSaveNotes = async () => {
    if (!detailSessionId) return;
    setNotesSaving(true);
    setNotesMsg('');
    try {
      await api.put('/ot/post-surgery/notes/' + detailSessionId, notesForm);
      setNotesMsg('Notes saved successfully.');
      const res = await api.get('/ot/post-surgery/audit-trail/' + detailSessionId);
      setAuditTrails(Array.isArray(res.data?.trails) ? res.data.trails : []);
    } catch (err) {
      setNotesMsg(err?.response?.data?.message || 'Failed to save notes');
    } finally {
      setNotesSaving(false);
    }
  };

  const handleAddFollowUp = async () => {
    if (!detailSessionId || !followUpNotes.trim()) return;
    setFollowUpSaving(true);
    setFollowUpMsg('');
    try {
      await api.post('/ot/post-surgery/followup/' + detailSessionId, { doctorNotes: followUpNotes });
      setFollowUpMsg('Follow-up added.');
      const res = await api.get('/ot/post-surgery/followups/' + detailSessionId);
      setFollowUps(Array.isArray(res.data?.followUps) ? res.data.followUps : []);
      setFollowUpNotes('');
      setTimeout(() => { setFollowUpOpen(false); }, 1000);
    } catch (err) {
      setFollowUpMsg(err?.response?.data?.message || 'Failed');
    } finally {
      setFollowUpSaving(false);
    }
  };

  // ─── Recovery Assessment ───
  const handleSaveAssessment = async () => {
    if (!detailSessionId) return;
    setAssessmentSaving(true);
    setAssessmentMsg('');
    try {
      await api.put('/ot/recovery/assessment/' + detailSessionId, {
        ...assessmentForm,
        status: assessmentForm.recoveryStatus || assessmentForm.status,
      });
      setAssessmentMsg('Assessment saved successfully.');
      const res = await api.get('/ot/recovery/assessments/' + detailSessionId);
      setAssessmentHistory(Array.isArray(res.data?.assessments) ? res.data.assessments : []);
      const refreshed = await api.get('/ot/post-surgery/notes/' + detailSessionId);
      setSessionData(refreshed.data?.session || null);
    } catch (err) {
      setAssessmentMsg(err?.response?.data?.message || 'Failed to save assessment');
    } finally {
      setAssessmentSaving(false);
    }
  };

  // ─── Transfer ───
  const openTransfer = () => {
    setPreferredWardType('');
    setTransferMsg('');
    setTransferOpen(true);
  };

  const handleRequestReceptionTransfer = async () => {
    const rr = sessionData?.recoveryRecord;
    if (!rr?.id) return;
    setTransferring(true);
    setTransferMsg('');
    try {
      await api.post('/ot/recovery/request-reception-transfer', {
        recoveryRecordId: rr.id,
        preferredWardType: preferredWardType || undefined,
      });
      setTransferMsg('Transfer request sent to Reception successfully.');
      const refreshed = await api.get('/ot/post-surgery/notes/' + detailSessionId);
      setSessionData(refreshed.data?.session || null);
      setTimeout(() => setTransferOpen(false), 1500);
    } catch (err) {
      setTransferMsg(getApiErrorMessage(err, 'Failed to request transfer'));
    } finally {
      setTransferring(false);
    }
  };

  const pt = sessionData?.surgerySchedule?.otRequest?.patient || {};
  const admission = sessionData?.surgerySchedule?.otRequest?.admission || {};
  const surgery = sessionData?.surgerySchedule?.otRequest || {};
  const rr = sessionData?.recoveryRecord;
  const note = sessionData?.postSurgeryNote;
  const transfers = rr?.transfers || [];

  const tabStyle = (tab) => ({
    padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
    background: activeTab === tab ? '#2563eb' : '#f1f5f9',
    color: activeTab === tab ? '#fff' : '#475569',
    display: 'flex', alignItems: 'center', gap: 4,
  });

  return (
    <div className="ss-container">
      {!detailSessionId ? (
        <>
          <div className="ss-header">
       
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
                  <th className="ss-th">Recovery Status</th>
                  <th className="ss-th">Notes</th>
                  <th className="ss-th">Actions</th>
                </tr></thead>
                <tbody>
                  {filtered.map((s) => {
                    const p = s.surgerySchedule?.otRequest?.patient || {};
                    const r = s.recoveryRecord;
                    return (
                      <tr key={s.id} className="ss-tr">
                        <td className="ss-td">
                          <div className="ss-patient-cell">
                            <div className="ss-avatar"><MdPerson /></div>
                            <span className="ss-patient-name">{p.name || '—'}</span>
                          </div>
                        </td>
                        <td className="ss-td"><span className="ss-uhid">{p.uhid || '—'}</span></td>
                        <td className="ss-td" style={{ fontSize: 12 }}>{s.surgerySchedule?.otRequest?.surgeryRecommendation || '—'}</td>
                        <td className="ss-td" style={{ fontSize: 12 }}>{s.surgerySchedule?.surgeon?.user?.name || '—'}</td>
                        <td className="ss-td">
                          <Badge variant={STATUS_BADGE[r?.status] || 'gray'}>{(r?.status || '—').replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="ss-td" style={{ fontSize: 12, color: s.postSurgeryNote ? '#15803d' : '#94a3b8' }}>
                          {s.postSurgeryNote ? <MdCheckCircle style={{ verticalAlign: 'middle' }} /> : 'Pending'}
                        </td>
                        <td className="ss-td">
                          <button type="button" onClick={() => openDetail(s.id)}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#2563eb', fontSize: 14, display: 'flex', alignItems: 'center' }}>
                            <MdEdit /> <span style={{ fontSize: 12, marginLeft: 4 }}>Notes</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && <tr><td colSpan={7} className="ss-empty">No patients found</td></tr>}
                </tbody>
              </table>
                </div>
              )}
        </>
      ) : (
        /* ─── Detail View ─── */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button type="button" onClick={closeDetail}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MdArrowBack /> Back
            </button>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}><MdLocalHospital /> Post Surgery Notes</h2>
          </div>

          {detailLoading ? <div className="ss-loading">Loading...</div> : !sessionData ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Failed to load</div>
          ) : (
            <>
              {/* Patient & Surgery Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="pl-modalCard">
                  <p className="pl-modalCardTitle">Patient Information</p>
                  <div className="pl-kv" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div><p className="k">Name</p><p className="v">{pt.name || '—'}</p></div>
                    <div><p className="k">UHID</p><p className="v" style={{ fontFamily: 'monospace' }}>{pt.uhid || '—'}</p></div>
                    <div><p className="k">Age/Gender</p><p className="v">{pt.age || '—'} / {pt.gender || '—'}</p></div>
                    <div><p className="k">Admission</p><p className="v" style={{ fontFamily: 'monospace' }}>{admission.ipdNumber || '—'}</p></div>
                  </div>
                </div>
                <div className="pl-modalCard">
                  <p className="pl-modalCardTitle">Surgery Information</p>
                  <div className="pl-kv" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div><p className="k">Surgery</p><p className="v">{surgery.surgeryRecommendation || '—'}</p></div>
                    <div><p className="k">Surgeon</p><p className="v">{sessionData.surgerySchedule?.surgeon?.user?.name || '—'}</p></div>
                    <div><p className="k">OT Room</p><p className="v">{sessionData.surgerySchedule?.otRoom?.roomName || '—'}</p></div>
                    <div><p className="k">Duration</p><p className="v">{sessionData.duration || '—'}</p></div>
                  </div>
                </div>
              </div>

              {/* Recovery & Transfer Summary */}
              {(rr || transfers.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: rr && transfers.length > 0 ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 16 }}>
                  {rr && (
                    <div className="pl-modalCard">
                      <p className="pl-modalCardTitle">Recovery Summary</p>
                      <div className="pl-kv" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div><p className="k">Status</p><p className="v"><Badge variant={STATUS_BADGE[rr.status] || 'gray'}>{rr.status.replace(/_/g, ' ')}</Badge></p></div>
                        <div><p className="k">Start Time</p><p className="v">{formatDateTime(rr.admittedAt)}</p></div>
                        {rr.transferredTo && <div><p className="k">Transferred To</p><p className="v">{rr.transferredTo}</p></div>}
                        {rr.transferredAt && <div><p className="k">Transferred At</p><p className="v">{formatDateTime(rr.transferredAt)}</p></div>}
                      </div>
                      {rr.status === 'READY_FOR_TRANSFER' && rr.transferRequestStatus !== 'PENDING' && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                          <button type="button" onClick={openTransfer}
                            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#15803d', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MdArrowForward /> Request Transfer
                          </button>
                        </div>
                      )}
                      {rr.transferRequestStatus === 'PENDING' && (
                        <p style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#b45309' }}>Transfer pending with Reception</p>
                      )}
                    </div>
                  )}
                  {transfers.length > 0 && (
                    <div className="pl-modalCard">
                      <p className="pl-modalCardTitle">Transfer Summary</p>
                      {transfers.map((t) => (
                        <div key={t.id} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                          <span><strong>{t.transferType}</strong> → Bed {t.assignedBedCode}</span>
                          <span style={{ color: '#64748b' }}>{formatDateTime(t.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {['notes', 'followup', 'complications', 'history', 'audit'].map((tab) => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={tabStyle(tab)}>
                    {tab === 'notes' ? <MdEdit /> : tab === 'followup' ? <MdHistory /> : tab === 'complications' ? <MdWarning /> : tab === 'history' ? <MdMedicalServices /> : <MdLocalHospital />}
                    {tab === 'notes' ? 'Surgeon Notes' : tab === 'followup' ? 'Follow-Up' : tab === 'complications' ? 'Complications' : tab === 'history' ? 'History' : 'Audit Trail'}
                  </button>
                ))}
              </div>

              {activeTab === 'notes' && (<>
                <div className="pl-modalCard pl-modalCardWide">
                  <p className="pl-modalCardTitle"><MdEdit /> Surgeon Notes</p>
                  {notesMsg && (
                    <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 10,
                      background: notesMsg.includes('success') ? '#f0fdf4' : '#fef2f2',
                      color: notesMsg.includes('success') ? '#15803d' : '#dc2626',
                      border: '1px solid ' + (notesMsg.includes('success') ? '#bbf7d0' : '#fecaca') }}>
                      {notesMsg}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Procedure Summary</label>
                      <textarea value={notesForm.procedureSummary} onChange={(e) => setNotesForm((f) => ({ ...f, procedureSummary: e.target.value }))} rows={3}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Operation Findings</label>
                      <textarea value={notesForm.operationFindings} onChange={(e) => setNotesForm((f) => ({ ...f, operationFindings: e.target.value }))} rows={3}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Complications</label>
                      <textarea value={notesForm.complications} onChange={(e) => setNotesForm((f) => ({ ...f, complications: e.target.value }))} rows={2}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Blood Loss</label>
                      <input type="text" value={notesForm.bloodLoss} onChange={(e) => setNotesForm((f) => ({ ...f, bloodLoss: e.target.value }))} placeholder="e.g. 200ml"
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Special Instructions</label>
                      <textarea value={notesForm.specialInstructions} onChange={(e) => setNotesForm((f) => ({ ...f, specialInstructions: e.target.value }))} rows={2}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Outcome</label>
                      <select value={notesForm.surgeryOutcome} onChange={(e) => setNotesForm((f) => ({ ...f, surgeryOutcome: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, background: '#fff' }}>
                        <option value="">Select</option>
                        <option value="SUCCESSFUL">Successful</option>
                        <option value="STABLE">Stable</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="COMPLICATED">Complicated</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Surgeon Notes</label>
                      <textarea value={notesForm.surgeonNotes} onChange={(e) => setNotesForm((f) => ({ ...f, surgeonNotes: e.target.value }))} rows={3}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Follow-Up Instructions</label>
                      <textarea value={notesForm.followUpInstructions} onChange={(e) => setNotesForm((f) => ({ ...f, followUpInstructions: e.target.value }))} rows={2}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={handleSaveNotes} disabled={notesSaving}
                      style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, cursor: notesSaving ? 'not-allowed' : 'pointer', opacity: notesSaving ? 0.6 : 1 }}>
                      {notesSaving ? 'Saving...' : 'Save Notes'}
                    </button>
                  </div>
                </div>

                {/* Recovery Assessment */}
                <div className="pl-modalCard pl-modalCardWide" style={{ marginTop: 12 }}>
                  <p className="pl-modalCardTitle"><MdMedicalServices /> Recovery Assessment</p>
                  {assessmentMsg && (
                    <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 10,
                      background: assessmentMsg.includes('success') ? '#f0fdf4' : '#fef2f2',
                      color: assessmentMsg.includes('success') ? '#15803d' : '#dc2626',
                      border: '1px solid ' + (assessmentMsg.includes('success') ? '#bbf7d0' : '#fecaca') }}>
                      {assessmentMsg}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 13, marginBottom: 8 }}>
                    {[
                      ['bpSystolic', 'BP Systolic', 'number'],
                      ['bpDiastolic', 'BP Diastolic', 'number'],
                      ['pulse', 'Pulse (bpm)', 'number'],
                      ['temperature', 'Temperature (°C)', 'number'],
                      ['spo2', 'SpO₂ (%)', 'number'],
                      ['respiratoryRate', 'RR (/min)', 'number'],
                    ].map(([key, label, type]) => (
                      <div key={key}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>{label}</label>
                        <input type={type} step="any" value={assessmentForm[key]} onChange={(e) => setAssessmentForm((f) => ({ ...f, [key]: e.target.value }))}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Pain Score (0-10)</label>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input type="range" min="0" max="10" value={assessmentForm.painScore} onChange={(e) => setAssessmentForm((f) => ({ ...f, painScore: e.target.value }))} style={{ flex: 1 }} />
                        <span style={{ fontWeight: 700, fontSize: 16, color: '#2563eb', minWidth: 30, textAlign: 'center' }}>{assessmentForm.painScore || 0}</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Recovery Status</label>
                      <select value={assessmentForm.recoveryStatus} onChange={(e) => setAssessmentForm((f) => ({ ...f, recoveryStatus: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, background: '#fff' }}>
                        <option value="UNDER_OBSERVATION">Under Observation</option>
                        <option value="STABLE">Stable</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="READY_FOR_TRANSFER">Ready For Transfer</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Recovery Notes</label>
                    <textarea value={assessmentForm.recoveryNotes} onChange={(e) => setAssessmentForm((f) => ({ ...f, recoveryNotes: e.target.value }))} rows={2}
                      placeholder="Enter recovery observations..." style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={handleSaveAssessment} disabled={assessmentSaving}
                      style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, cursor: assessmentSaving ? 'not-allowed' : 'pointer', opacity: assessmentSaving ? 0.6 : 1 }}>
                      {assessmentSaving ? 'Saving...' : 'Save Assessment'}
                    </button>
                  </div>
                </div>
              </>)}

              {activeTab === 'followup' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}><MdHistory /> Follow-Up History</p>
                    <button type="button" onClick={() => { setFollowUpOpen(true); setFollowUpMsg(''); setFollowUpNotes(''); }}
                      style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      + Add Follow-Up
                    </button>
                  </div>
                  <div className="ss-table-wrapper">
                    <table className="ss-table">
                      <thead><tr>
                        <th className="ss-th">Date & Time</th>
                        <th className="ss-th">Doctor Notes</th>
                      </tr></thead>
                      <tbody>
                        {followUps.map((f) => (
                          <tr key={f.id}>
                            <td className="ss-td" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{formatDateTime(f.createdAt)}</td>
                            <td className="ss-td" style={{ fontSize: 12 }}>{f.doctorNotes || '—'}</td>
                          </tr>
                        ))}
                        {followUps.length === 0 && <tr><td colSpan={2} className="ss-empty">No follow-ups recorded</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'complications' && (
                <div className="ss-table-wrapper">
                  <table className="ss-table">
                    <thead><tr>
                      <th className="ss-th">Date & Time</th>
                      <th className="ss-th">Type</th>
                      <th className="ss-th">Severity</th>
                      <th className="ss-th">Description</th>
                      <th className="ss-th">Action Taken</th>
                    </tr></thead>
                    <tbody>
                      {complications.map((c) => (
                        <tr key={c.id}>
                          <td className="ss-td" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{formatDateTime(c.createdAt)}</td>
                          <td className="ss-td" style={{ fontWeight: 500 }}>{c.complicationType}</td>
                          <td className="ss-td"><Badge variant={SEVERITY_COLORS[c.severity] || 'gray'}>{c.severity}</Badge></td>
                          <td className="ss-td" style={{ fontSize: 12 }}>{c.description || '—'}</td>
                          <td className="ss-td" style={{ fontSize: 12 }}>{c.actionTaken || '—'}</td>
                        </tr>
                      ))}
                      {complications.length === 0 && <tr><td colSpan={5} className="ss-empty">No complications recorded</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="ss-table-wrapper">
                  <table className="ss-table">
                    <thead><tr>
                      <th className="ss-th">Date & Time</th>
                      <th className="ss-th">Updated By</th>
                      <th className="ss-th">BP</th>
                      <th className="ss-th">Pulse</th>
                      <th className="ss-th">Temp</th>
                      <th className="ss-th">SpO₂</th>
                      <th className="ss-th">RR</th>
                      <th className="ss-th">Pain</th>
                      <th className="ss-th">Status</th>
                      <th className="ss-th">Notes</th>
                    </tr></thead>
                    <tbody>
                      {[...assessmentHistory].reverse().map((a) => (
                        <tr key={a.id}>
                          <td className="ss-td" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{formatDateTime(a.createdAt)}</td>
                          <td className="ss-td" style={{ fontSize: 12 }}>{a.assessedBy?.name || '—'}</td>
                          <td className="ss-td">{a.bpSystolic != null ? a.bpSystolic + '/' + (a.bpDiastolic || '—') : '—'}</td>
                          <td className="ss-td">{a.pulse != null ? a.pulse : '—'}</td>
                          <td className="ss-td">{a.temperature != null ? a.temperature : '—'}</td>
                          <td className="ss-td">{a.spo2 != null ? a.spo2 : '—'}</td>
                          <td className="ss-td">{a.respiratoryRate != null ? a.respiratoryRate : '—'}</td>
                          <td className="ss-td">{a.painScore != null ? a.painScore + '/10' : '—'}</td>
                          <td className="ss-td">
                            {a.status ? <Badge variant={STATUS_BADGE[a.status] || 'gray'}>{a.status.replace(/_/g, ' ')}</Badge> : '—'}
                          </td>
                          <td className="ss-td" style={{ fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.recoveryNotes || '—'}</td>
                        </tr>
                      ))}
                      {assessmentHistory.length === 0 && (
                        <tr><td colSpan={10} className="ss-empty">No recovery assessment history</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'audit' && (
                <div className="ss-table-wrapper">
                  <table className="ss-table">
                    <thead><tr>
                      <th className="ss-th">Date & Time</th>
                      <th className="ss-th">Field Changed</th>
                      <th className="ss-th">Old Value</th>
                      <th className="ss-th">New Value</th>
                    </tr></thead>
                    <tbody>
                      {auditTrails.map((a) => (
                        <tr key={a.id}>
                          <td className="ss-td" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{formatDateTime(a.createdAt)}</td>
                          <td className="ss-td" style={{ fontSize: 12, fontWeight: 500 }}>{a.fieldChanged}</td>
                          <td className="ss-td" style={{ fontSize: 12, color: '#dc2626', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.oldValue || '—'}</td>
                          <td className="ss-td" style={{ fontSize: 12, color: '#15803d', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.newValue || '—'}</td>
                        </tr>
                      ))}
                      {auditTrails.length === 0 && <tr><td colSpan={4} className="ss-empty">No audit trail entries</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Follow-Up Modal ─── */}
      {followUpOpen && createPortal(
        <div className="pl-modalOverlay" onClick={() => { if (!followUpSaving) setFollowUpOpen(false); }}>
          <div className="pl-modal pl-modalAnimate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="pl-modalHeader">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}><MdHistory /> Add Follow-Up</h3>
              <button type="button" onClick={() => setFollowUpOpen(false)} className="pl-modalClose"><MdClose /></button>
            </div>
            <div className="pl-modalBody">
              <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13 }}>
                <strong>{pt.name || '—'}</strong> <span style={{ color: '#64748b', fontFamily: 'monospace' }}>UHID: {pt.uhid || '—'}</span>
              </div>
              {followUpMsg && (
                <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 10,
                  background: followUpMsg.includes('success') || followUpMsg.includes('added') ? '#f0fdf4' : '#fef2f2',
                  color: followUpMsg.includes('success') || followUpMsg.includes('added') ? '#15803d' : '#dc2626',
                  border: '1px solid ' + (followUpMsg.includes('success') || followUpMsg.includes('added') ? '#bbf7d0' : '#fecaca') }}>
                  {followUpMsg}
                </div>
              )}
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Doctor Notes</label>
              <textarea value={followUpNotes} onChange={(e) => setFollowUpNotes(e.target.value)} rows={4}
                placeholder="Enter follow-up notes..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              <div style={{ marginTop: 12, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setFollowUpOpen(false)} disabled={followUpSaving}
                  style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleAddFollowUp} disabled={followUpSaving || !followUpNotes.trim()}
                  style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, cursor: 'pointer', opacity: followUpSaving || !followUpNotes.trim() ? 0.6 : 1 }}>
                  {followUpSaving ? 'Saving...' : 'Add Follow-Up'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Transfer Modal ─── */}
      {transferOpen && createPortal(
        <div className="pl-modalOverlay" onClick={() => { if (!transferring) setTransferOpen(false); }}>
          <div className="pl-modal pl-modalAnimate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="pl-modalHeader">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}><MdArrowForward /> Request Ward Transfer</h3>
              <button type="button" onClick={() => setTransferOpen(false)} className="pl-modalClose"><MdClose /></button>
            </div>
            <div className="pl-modalBody">
              <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13 }}>
                <strong>{pt.name || '—'}</strong> <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>UHID: {pt.uhid || '—'}</span>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>Reception will assign ward, room and bed.</p>
              {transferMsg && (
                <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 10,
                  background: transferMsg.includes('success') ? '#f0fdf4' : '#fef2f2',
                  color: transferMsg.includes('success') ? '#15803d' : '#dc2626',
                  border: '1px solid ' + (transferMsg.includes('success') ? '#bbf7d0' : '#fecaca') }}>
                  {transferMsg}
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Preferred Ward Type (optional)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {WARD_TYPES.map((wt) => (
                    <button key={wt.value} type="button" onClick={() => setPreferredWardType(wt.value)}
                      style={{
                        flex: 1, padding: '10px 8px', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        background: preferredWardType === wt.value ? '#eff6ff' : '#fff',
                        borderColor: preferredWardType === wt.value ? '#2563eb' : '#e2e8f0',
                        color: preferredWardType === wt.value ? '#2563eb' : '#64748b',
                      }}>
                      {wt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setTransferOpen(false)} disabled={transferring}
                  style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleRequestReceptionTransfer} disabled={transferring}
                  style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#15803d', color: '#fff', fontSize: 12, cursor: transferring ? 'not-allowed' : 'pointer', opacity: transferring ? 0.6 : 1 }}>
                  {transferring ? 'Sending...' : 'Send to Reception'}
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
