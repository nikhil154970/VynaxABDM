import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdPerson, MdArrowBack, MdMedicalServices, MdHistory, MdEdit, MdCheckCircle, MdWarning, MdAdd, MdClose } from 'react-icons/md';
import { createPortal } from 'react-dom';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import '../ot/SurgeryScheduling.css';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

const WARD_LABELS = {
  GENERAL: 'General Ward',
  PRIVATE: 'Private Ward',
  RECOVERY: 'Recovery Room',
};

const STATUS_BADGE = {
  UNDER_OBSERVATION: 'blue',
  STABLE: 'green',
  CRITICAL: 'red',
  READY_FOR_TRANSFER: 'amber',
  TRANSFERRED: 'gray',
};

export default function OtPatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [nursingNotes, setNursingNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Assessment form
  const [assessmentForm, setAssessmentForm] = useState({
    bpSystolic: '', bpDiastolic: '', pulse: '', temperature: '', spo2: '',
    respiratoryRate: '', painScore: 0, recoveryStatus: 'UNDER_OBSERVATION', recoveryNotes: '',
  });
  const [assessmentSaving, setAssessmentSaving] = useState(false);
  const [assessmentMsg, setAssessmentMsg] = useState('');

  // Nursing note
  const [noteText, setNoteText] = useState('');
  const [noteCondition, setNoteCondition] = useState('Stable');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteMsg, setNoteMsg] = useState('');
  const [noteShowInHistory, setNoteShowInHistory] = useState(true);

  // Discharge
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [dischargeLoading, setDischargeLoading] = useState(false);
  const [dischargeMsg, setDischargeMsg] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/nurse/ot-patients/' + id);
      const r = res.data?.record;
      setRecord(r);
      setNursingNotes(Array.isArray(res.data?.nursingNotes) ? res.data.nursingNotes : []);

      const assessments = Array.isArray(r.assessments) ? r.assessments : [];
      const last = assessments.length > 0 ? assessments[0] : {};
      setAssessmentForm({
        bpSystolic: last.bpSystolic ?? r.bpSystolic ?? '',
        bpDiastolic: last.bpDiastolic ?? r.bpDiastolic ?? '',
        pulse: last.pulse ?? r.pulse ?? '',
        temperature: last.temperature ?? r.temperature ?? '',
        spo2: last.spo2 ?? r.spo2 ?? '',
        respiratoryRate: last.respiratoryRate ?? r.respiratoryRate ?? '',
        painScore: last.painScore ?? r.painScore ?? 0,
        recoveryStatus: r.status || 'UNDER_OBSERVATION',
        recoveryNotes: last.recoveryNotes || r.recoveryNotes || '',
      });
    } catch (err) {
      console.error('[DEBUG] fetchData error:', err?.response?.status, err?.response?.data);
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveAssessment = async () => {
    const sessionId = record?.surgerySession?.id;
    if (!sessionId) return;
    setAssessmentSaving(true);
    setAssessmentMsg('');
    try {
      await api.put('/ot/recovery/assessment/' + sessionId, assessmentForm);
      setAssessmentMsg('Assessment saved successfully.');
      fetchData();
    } catch (err) {
      setAssessmentMsg(err?.response?.data?.message || 'Failed to save assessment');
    } finally {
      setAssessmentSaving(false);
    }
  };

  const handleAddNote = async () => {
    const admissionId = record?.surgerySession?.surgerySchedule?.otRequest?.admission?.id;
    if (!admissionId || !noteText.trim()) return;
    setNoteSaving(true);
    setNoteMsg('');
    try {
      await api.post('/nurse/notes', {
        admissionId,
        notes: '[Condition: ' + noteCondition + ']\n' + noteText,
        showInHistory: noteShowInHistory,
      });
      setNoteMsg('Note added successfully.');
      setNoteText('');
      setNoteShowInHistory(true);
      fetchData();
    } catch (err) {
      setNoteMsg(err?.response?.data?.message || 'Failed to add note');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDischargeApprove = async () => {
    const admissionId = record?.surgerySession?.surgerySchedule?.otRequest?.admission?.id;
    if (!admissionId) return;
    setDischargeLoading(true);
    setDischargeMsg('');
    try {
      await api.put('/nurse/discharge-approve', { admissionId });
      setDischargeMsg('Discharge approved successfully.');
      fetchData();
      setTimeout(() => setDischargeOpen(false), 1500);
    } catch (err) {
      setDischargeMsg(err?.response?.data?.message || 'Failed');
    } finally {
      setDischargeLoading(false);
    }
  };

  if (loading) return <div className="ss-loading">Loading...</div>;
  if (!record) return <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Record not found</div>;

  const pt = record.surgerySession?.surgerySchedule?.otRequest?.patient || {};
  const surgery = record.surgerySession?.surgerySchedule?.otRequest || {};
  const preAssessment = surgery.preOperativeAssessment || {};
  const admission = surgery.admission || {};
  const assessments = Array.isArray(record.assessments) ? record.assessments : [];
  const postSurgeryNote = record.surgerySession?.postSurgeryNote || {};
  const isStable = assessmentForm.recoveryStatus === 'STABLE';
  const alreadyDischarged = admission.status === 'DISCHARGE_REQUESTED' || admission.dischargeDate;

  return (
    <div className="ss-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button type="button" onClick={() => navigate('/dashboard/nurse/ot-patients')}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
          <MdArrowBack /> Back
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}><MdMedicalServices /> Patient Detail</h2>
      </div>

      {/* Patient Basic Info */}
      <div className="pl-modalCard" style={{ marginBottom: 12 }}>
        <p className="pl-modalCardTitle"><MdPerson /> Patient Information</p>
        <div className="pl-kv" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div><p className="k">Name</p><p className="v">{pt.name || '—'}</p></div>
          <div><p className="k">UHID</p><p className="v" style={{ fontFamily: 'monospace' }}>{pt.uhid || '—'}</p></div>
          <div><p className="k">Age / Gender</p><p className="v">{pt.age || '—'} / {pt.gender || '—'}</p></div>
          <div><p className="k">Blood Group</p><p className="v">{pt.bloodGroup || '—'}</p></div>
          <div><p className="k">Phone</p><p className="v">{pt.phone || '—'}</p></div>
          <div><p className="k">Address</p><p className="v">{pt.address || '—'}</p></div>
        </div>
      </div>

      {/* Surgery Info */}
      <div className="pl-modalCard" style={{ marginBottom: 12 }}>
        <p className="pl-modalCardTitle"><MdMedicalServices /> Surgery Information</p>
        <div className="pl-kv" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div><p className="k">Surgery</p><p className="v">{surgery.surgeryRecommendation || '—'}</p></div>
          <div><p className="k">Surgeon</p><p className="v">{record.surgerySession?.surgerySchedule?.surgeon?.user?.name || '—'}</p></div>
          <div><p className="k">OT Room</p><p className="v">{record.surgerySession?.surgerySchedule?.otRoom?.roomName || '—'}</p></div>
          <div><p className="k">Ward</p><p className="v"><Badge variant={record.transferredTo === 'RECOVERY' ? 'blue' : 'green'}>{WARD_LABELS[record.transferredTo] || record.transferredTo || '—'}</Badge></p></div>
          <div><p className="k">IPD Number</p><p className="v">{admission.ipdNumber || '—'}</p></div>
          <div><p className="k">Status</p><p className="v"><Badge variant={STATUS_BADGE[record.status] || 'gray'}>{record.status?.replace(/_/g, ' ') || '—'}</Badge></p></div>
        </div>
        {postSurgeryNote?.procedureSummary && (
          <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: '#f8fafc', fontSize: 13 }}>
            <strong>Procedure Summary:</strong> {postSurgeryNote.procedureSummary}
          </div>
        )}
      </div>

      {/* Pre-Assessment Record */}
      {preAssessment?.id && (
        <div className="pl-modalCard" style={{ marginBottom: 12 }}>
          <p className="pl-modalCardTitle"><MdHistory /> Pre-Operative Assessment</p>
          <div className="pl-kv" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div><p className="k">BP</p><p className="v">{preAssessment.bpSystolic || '—'}/{preAssessment.bpDiastolic || '—'}</p></div>
            <div><p className="k">Pulse</p><p className="v">{preAssessment.pulse || '—'} bpm</p></div>
            <div><p className="k">Temp</p><p className="v">{preAssessment.temperature || '—'} °C</p></div>
            <div><p className="k">SpO₂</p><p className="v">{preAssessment.spo2 || '—'}%</p></div>
            <div><p className="k">RR</p><p className="v">{preAssessment.respiratoryRate || '—'} /min</p></div>
            <div><p className="k">BMI</p><p className="v">{preAssessment.bmi || '—'}</p></div>
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 12, flexWrap: 'wrap' }}>
            {preAssessment.diabetes && <Badge variant="amber">Diabetes</Badge>}
            {preAssessment.hypertension && <Badge variant="amber">Hypertension</Badge>}
            {preAssessment.asthma && <Badge variant="amber">Asthma</Badge>}
            {preAssessment.heartDisease && <Badge variant="amber">Heart Disease</Badge>}
            {preAssessment.knownAllergies && <span><strong>Allergies:</strong> {preAssessment.knownAllergies}</span>}
          </div>
        </div>
      )}

      {/* Post-Assessment History Table */}
      <div className="pl-modalCard" style={{ marginBottom: 16 }}>
        <p className="pl-modalCardTitle"><MdHistory /> Post-Assessment History (Day by Day)</p>
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
              {assessments.map((a) => (
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
                  <td className="ss-td" style={{ fontSize: 12, maxWidth: 150 }}>{a.recoveryNotes || '—'}</td>
                </tr>
              ))}
              {assessments.length === 0 && (
                <tr><td colSpan={10} className="ss-empty">No assessments recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Vitals Form */}
      <div className="pl-modalCard" style={{ marginBottom: 16 }}>
        <p className="pl-modalCardTitle"><MdEdit /> Update Vitals / Assessment</p>
        {assessmentMsg && (
          <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 10,
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
              <option value="READY_FOR_TRANSFER">Ready for Transfer</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Recovery Notes</label>
          <textarea value={assessmentForm.recoveryNotes} onChange={(e) => setAssessmentForm((f) => ({ ...f, recoveryNotes: e.target.value }))} rows={2}
            placeholder="Enter observations..." style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleSaveAssessment} disabled={assessmentSaving}
            style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, cursor: assessmentSaving ? 'not-allowed' : 'pointer', opacity: assessmentSaving ? 0.6 : 1 }}>
            {assessmentSaving ? 'Saving...' : 'Update Vitals & Assessment'}
          </button>
        </div>
      </div>

      {/* Daily Nursing Notes */}
      <div className="pl-modalCard" style={{ marginBottom: 16 }}>
        <p className="pl-modalCardTitle"><MdAdd /> Daily Nursing Notes</p>
        {noteMsg && (
          <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 10,
            background: noteMsg.includes('success') ? '#f0fdf4' : '#fef2f2',
            color: noteMsg.includes('success') ? '#15803d' : '#dc2626',
            border: '1px solid ' + (noteMsg.includes('success') ? '#bbf7d0' : '#fecaca') }}>
            {noteMsg}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select value={noteCondition} onChange={(e) => setNoteCondition(e.target.value)}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, background: '#fff' }}>
            <option value="Stable">Stable</option>
            <option value="Critical">Critical</option>
            <option value="Under Observation">Under Observation</option>
          </select>
          <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Enter daily nursing note..."
            style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }} />
          <button type="button" onClick={handleAddNote} disabled={noteSaving || !noteText.trim()}
            style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, cursor: noteSaving || !noteText.trim() ? 'not-allowed' : 'pointer', opacity: noteSaving || !noteText.trim() ? 0.6 : 1 }}>
            {noteSaving ? 'Adding...' : 'Add Note'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, cursor: 'pointer' }}>
          <input
            id="ot-note-showInHistory"
            type="checkbox"
            checked={noteShowInHistory}
            onChange={(e) => setNoteShowInHistory(e.target.checked)}
            style={{ cursor: 'pointer', width: 14, height: 14 }}
          />
          <label htmlFor="ot-note-showInHistory" style={{ fontSize: 11, fontWeight: 600, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
            Show in Patient History Timeline
          </label>
        </div>

        {/* Nursing Notes History */}
        {nursingNotes.length > 0 && (
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#64748b' }}>Notes History</p>
            {nursingNotes.map((n) => (
              <div key={n.id} style={{ fontSize: 11, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>{formatDateTime(n.createdAt)}</span>
                  <span>{n.nurse?.name || '—'}</span>
                </div>
                <div style={{ marginTop: 2, color: '#1e293b', whiteSpace: 'pre-wrap' }}>{n.notes}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discharge Section */}
      {isStable && !alreadyDischarged && (
        <div style={{ padding: 16, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <strong style={{ color: '#15803d', fontSize: 14 }}><MdCheckCircle style={{ verticalAlign: 'middle', marginRight: 4 }} /> Patient Status: Stable</strong>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>Patient is stable. You can approve for discharge.</p>
          </div>
          <button type="button" onClick={() => setDischargeOpen(true)}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#15803d', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Approve for Discharge
          </button>
        </div>
      )}

      {alreadyDischarged && (
        <div style={{ padding: 16, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 16 }}>
          <strong style={{ color: '#15803d' }}><MdCheckCircle style={{ verticalAlign: 'middle' }} /> Discharge {admission.dischargeDate ? 'Completed' : 'Requested'}</strong>
          {admission.dischargeRequestedAt && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
              Discharge requested on {formatDateTime(admission.dischargeRequestedAt)}
            </p>
          )}
        </div>
      )}

      {/* Discharge Confirm Modal */}
      {dischargeOpen && createPortal(
        <div className="pl-modalOverlay" onClick={() => { if (!dischargeLoading) setDischargeOpen(false); }}>
          <div className="pl-modal pl-modalAnimate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="pl-modalHeader">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MdWarning /> Confirm Discharge
              </h3>
              <button type="button" onClick={() => setDischargeOpen(false)} className="pl-modalClose"><MdClose /></button>
            </div>
            <div className="pl-modalBody">
              <p style={{ fontSize: 13, color: '#374151' }}>
                Are you sure you want to approve <strong>{pt.name}</strong> for discharge?
                Once approved, the discharge request will be sent for final processing.
              </p>
              {dischargeMsg && (
                <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 10,
                  background: dischargeMsg.includes('success') ? '#f0fdf4' : '#fef2f2',
                  color: dischargeMsg.includes('success') ? '#15803d' : '#dc2626',
                  border: '1px solid ' + (dischargeMsg.includes('success') ? '#bbf7d0' : '#fecaca') }}>
                  {dischargeMsg}
                </div>
              )}
              <div style={{ marginTop: 12, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setDischargeOpen(false)} disabled={dischargeLoading}
                  style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={handleDischargeApprove} disabled={dischargeLoading}
                  style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#15803d', color: '#fff', fontSize: 12, cursor: dischargeLoading ? 'not-allowed' : 'pointer', opacity: dischargeLoading ? 0.6 : 1 }}>
                  {dischargeLoading ? 'Processing...' : 'Confirm Discharge Approval'}
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
