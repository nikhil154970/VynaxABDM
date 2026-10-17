import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdPerson, MdSearch, MdVisibility, MdEdit, MdLocalHospital, MdClose, MdCheckCircle, MdTimer, MdArrowBack, MdArrowForward, MdHistory, MdBed, MdMedicalServices, MdWarning, MdRefresh, MdNoteAlt } from 'react-icons/md';
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

const CONSCIOUSNESS_OPTIONS = ['Alert', 'Drowsy', 'Confused', 'Unconscious'];
const WARD_TYPES = [
  { value: 'ICU', label: 'ICU' },
  { value: 'PRIVATE', label: 'Private Ward' },
  { value: 'GENERAL', label: 'General Ward' },
];
const SEVERITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];
const COMPLICATION_TYPES = ['Bleeding', 'Infection', 'Fever', 'Breathing Issues', 'Pain'];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatVital(v, unit) {
  return v != null && v !== '' ? v + (unit || '') : '—';
}

function elapsedSince(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h + 'h ' + m + 'm';
}

export default function RecoveryRoom() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detailSessionId, setDetailSessionId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [activeTab, setActiveTab] = useState('info');

  const fetchItems = useCallback(() => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.recoveryStatus = statusFilter;
    api.get('/ot/recovery/patients', { params })
      .then((res) => setItems(Array.isArray(res.data?.items) ? res.data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) =>
      (s.surgerySchedule?.otRequest?.patient?.name || '').toLowerCase().includes(q) ||
      (s.surgerySchedule?.otRequest?.patient?.uhid || '').toLowerCase().includes(q) ||
      (s.surgerySchedule?.otRequest?.admission?.ipdNumber || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  // ─── Detail View ───

  const openDetail = async (sessionId) => {
    setDetailSessionId(sessionId);
    setDetailLoading(true);
    setDetailData(null);
    setAssessments([]);
    setTransfers([]);
    setActiveTab('info');
    try {
      const [detailRes, assessRes, transferRes] = await Promise.all([
        api.get('/ot/recovery/details/' + sessionId),
        api.get('/ot/recovery/assessments/' + sessionId),
        api.get('/ot/recovery/transfers/' + sessionId),
      ]);
      setDetailData(detailRes.data?.session || null);
      setAssessments(Array.isArray(assessRes.data?.assessments) ? assessRes.data.assessments : []);
      setTransfers(Array.isArray(transferRes.data?.transfers) ? transferRes.data.transfers : []);
    } catch {
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailSessionId(null);
    setDetailData(null);
    setAssessments([]);
    setTransfers([]);
  };

  const refreshDetail = () => {
    if (detailSessionId) openDetail(detailSessionId);
  };

  // ─── Assessment ───

  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [assessmentForm, setAssessmentForm] = useState({
    bpSystolic: '', bpDiastolic: '', pulse: '', temperature: '', spo2: '', respiratoryRate: '',
    painScore: 0, consciousnessLevel: '', recoveryNotes: '', status: '',
  });
  const [assessmentSaving, setAssessmentSaving] = useState(false);
  const [assessmentMsg, setAssessmentMsg] = useState('');

  const openAssessment = () => {
    const rr = detailData?.recoveryRecord || {};
    const last = assessments[0] || {};
    setAssessmentForm({
      bpSystolic: last.bpSystolic ?? rr.bpSystolic ?? '',
      bpDiastolic: last.bpDiastolic ?? rr.bpDiastolic ?? '',
      pulse: last.pulse ?? rr.pulse ?? '',
      temperature: last.temperature ?? rr.temperature ?? '',
      spo2: last.spo2 ?? rr.spo2 ?? '',
      respiratoryRate: last.respiratoryRate ?? rr.respiratoryRate ?? '',
      painScore: last.painScore ?? rr.painScore ?? 0,
      consciousnessLevel: last.consciousnessLevel || rr.consciousnessLevel || '',
      recoveryNotes: last.recoveryNotes || rr.recoveryNotes || '',
      status: rr.status || 'UNDER_OBSERVATION',
    });
    setAssessmentMsg('');
    setAssessmentOpen(true);
  };

  const handleSaveAssessment = async () => {
    if (!detailSessionId) return;
    setAssessmentSaving(true);
    setAssessmentMsg('');
    try {
      await api.put('/ot/recovery/assessment/' + detailSessionId, assessmentForm);
      setAssessmentMsg('Assessment saved successfully.');
      refreshDetail();
    } catch (err) {
      setAssessmentMsg(err?.response?.data?.message || 'Failed to save assessment');
    } finally {
      setAssessmentSaving(false);
    }
  };

  // ─── Request Reception Transfer ───

  const [transferOpen, setTransferOpen] = useState(false);
  const [preferredWardType, setPreferredWardType] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferMsg, setTransferMsg] = useState('');

  const openTransfer = () => {
    setPreferredWardType('');
    setTransferMsg('');
    setTransferOpen(true);
  };

  const handleRequestReceptionTransfer = async () => {
    if (!rr?.id) return;
    setTransferring(true);
    setTransferMsg('');
    try {
      await api.post('/ot/recovery/request-reception-transfer', {
        recoveryRecordId: rr.id,
        preferredWardType: preferredWardType || undefined,
      });
      setTransferMsg('Transfer request sent to Reception successfully.');
      refreshDetail();
      setTimeout(() => setTransferOpen(false), 1500);
    } catch (err) {
      setTransferMsg(getApiErrorMessage(err, 'Failed to request transfer'));
    } finally {
      setTransferring(false);
    }
  };

  // ─── Complication ───

  const [complicationOpen, setComplicationOpen] = useState(false);
  const [complicationForm, setComplicationForm] = useState({ complicationType: '', severity: '', description: '', actionTaken: '' });
  const [complicationSaving, setComplicationSaving] = useState(false);
  const [complicationMsg, setComplicationMsg] = useState('');

  const openComplication = () => {
    setComplicationForm({ complicationType: '', severity: '', description: '', actionTaken: '' });
    setComplicationMsg('');
    setComplicationOpen(true);
  };

  const handleAddComplication = async () => {
    if (!detailSessionId) return;
    setComplicationSaving(true);
    setComplicationMsg('');
    try {
      const res = await api.post('/ot/post-surgery/complication/' + detailSessionId, complicationForm);
      if (res.data?.ok) {
        setComplicationMsg('Complication recorded.');
        refreshDetail();
        setTimeout(() => setComplicationOpen(false), 1000);
      }
    } catch (err) {
      setComplicationMsg(err?.response?.data?.message || 'Failed to record complication');
    } finally {
      setComplicationSaving(false);
    }
  };

  const rr = detailData?.recoveryRecord;
  const pt = detailData?.surgerySchedule?.otRequest?.patient || {};
  const admission = detailData?.surgerySchedule?.otRequest?.admission || {};
  const surgery = detailData?.surgerySchedule?.otRequest || {};

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
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient, UHID, IPD..." className="ss-search-input" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, background: '#fff' }}>
              <option value="">All Status</option>
              <option value="UNDER_OBSERVATION">Under Observation</option>
              <option value="STABLE">Stable</option>
              <option value="CRITICAL">Critical</option>
              <option value="READY_FOR_TRANSFER">Ready For Transfer</option>
              <option value="TRANSFERRED">Transferred</option>
            </select>
          </div>

          {loading ? <div className="ss-loading">Loading...</div> : (
            <div className="ss-table-wrapper">
              <table className="ss-table">
                <thead><tr>
                  <th className="ss-th">Patient</th>
                  <th className="ss-th">UHID</th>
                  <th className="ss-th">Admission No</th>
                  <th className="ss-th">Surgery</th>
                  <th className="ss-th">Surgeon</th>
                  <th className="ss-th">OT Room</th>
                  <th className="ss-th">Recovery Start</th>
                  <th className="ss-th">Duration</th>
                  <th className="ss-th">Status</th>
                  <th className="ss-th">Actions</th>
                </tr></thead>
                <tbody>
                  {filtered.map((s) => {
                    const p = s.surgerySchedule?.otRequest?.patient || {};
                    const r = s.recoveryRecord;
                    return (
                      <tr key={s.id} className="ss-tr" style={{ cursor: 'pointer' }}>
                        <td className="ss-td" onClick={() => navigate('/dashboard/ot/post-surgery?sessionId=' + s.id)}>
                          <div className="ss-patient-cell">
                            <div className="ss-avatar"><MdPerson /></div>
                            <span className="ss-patient-name">{p.name || '—'}</span>
                          </div>
                        </td>
                        <td className="ss-td" onClick={() => navigate('/dashboard/ot/post-surgery?sessionId=' + s.id)}><span className="ss-uhid">{p.uhid || '—'}</span></td>
                        <td className="ss-td" onClick={() => navigate('/dashboard/ot/post-surgery?sessionId=' + s.id)} style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.surgerySchedule?.otRequest?.admission?.ipdNumber || '—'}</td>
                        <td className="ss-td" onClick={() => navigate('/dashboard/ot/post-surgery?sessionId=' + s.id)} style={{ fontSize: 12 }}>{s.surgerySchedule?.otRequest?.surgeryRecommendation || '—'}</td>
                        <td className="ss-td" onClick={() => navigate('/dashboard/ot/post-surgery?sessionId=' + s.id)} style={{ fontSize: 12 }}>{s.surgerySchedule?.surgeon?.user?.name || '—'}</td>
                        <td className="ss-td" onClick={() => navigate('/dashboard/ot/post-surgery?sessionId=' + s.id)}>{s.surgerySchedule?.otRoom?.roomName || '—'}</td>
                        <td className="ss-td" onClick={() => navigate('/dashboard/ot/post-surgery?sessionId=' + s.id)} style={{ fontSize: 12 }}>{r ? formatTime(r.admittedAt) : '—'}</td>
                        <td className="ss-td" onClick={() => navigate('/dashboard/ot/post-surgery?sessionId=' + s.id)} style={{ fontSize: 12, fontFamily: 'monospace' }}>{elapsedSince(r?.admittedAt)}</td>
                        <td className="ss-td" onClick={() => navigate('/dashboard/ot/post-surgery?sessionId=' + s.id)}>
                          <Badge variant={STATUS_BADGE[r?.status] || 'gray'}>{(r?.status || '—').replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="ss-td">
                          <button type="button" onClick={() => navigate('/dashboard/ot/post-surgery?sessionId=' + s.id)} title="Post Surgery Notes"
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#7c3aed', fontSize: 14, display: 'flex', alignItems: 'center' }}>
                            <MdNoteAlt />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={10} className="ss-empty">No patients in recovery room</td></tr>
                  )}
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
              <MdArrowBack /> Back to List
            </button>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdLocalHospital style={{ color: '#2563eb' }} /> Recovery Details
            </h2>
            <button type="button" onClick={refreshDetail} title="Refresh"
              style={{ padding: '6px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b' }}>
              <MdRefresh />
            </button>
          </div>

          {detailLoading ? <div className="ss-loading">Loading...</div> : !detailData ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Failed to load details</div>
          ) : (
            <>
              {/* Patient & Surgery Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="pl-modalCard">
                  <p className="pl-modalCardTitle">Patient Information</p>
                  <div className="pl-kv" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div><p className="k">Name</p><p className="v">{pt.name || '—'}</p></div>
                    <div><p className="k">UHID</p><p className="v" style={{ fontFamily: 'monospace' }}>{pt.uhid || '—'}</p></div>
                    <div><p className="k">Age / Gender</p><p className="v">{pt.age || '—'} / {pt.gender || '—'}</p></div>
                    <div><p className="k">Admission No</p><p className="v" style={{ fontFamily: 'monospace' }}>{admission.ipdNumber || '—'}</p></div>
                    <div><p className="k">Ward / Bed</p><p className="v">{admission.ward?.name || '—'} / {admission.bed?.code || '—'}</p></div>
                    <div><p className="k">Phone</p><p className="v">{pt.phone || '—'}</p></div>
                  </div>
                </div>
                <div className="pl-modalCard">
                  <p className="pl-modalCardTitle">Surgery Information</p>
                  <div className="pl-kv" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div><p className="k">Surgery</p><p className="v">{surgery.surgeryRecommendation || '—'}</p></div>
                    <div><p className="k">Surgeon</p><p className="v">{detailData.surgerySchedule?.surgeon?.user?.name || '—'}</p></div>
                    <div><p className="k">OT Room</p><p className="v">{detailData.surgerySchedule?.otRoom?.roomName || '—'}</p></div>
                    <div><p className="k">Start → End</p><p className="v">{formatTime(detailData.startTime)} → {formatTime(detailData.endTime)}</p></div>
                    <div><p className="k">Duration</p><p className="v">{detailData.duration || '—'}</p></div>
                  </div>
                </div>
              </div>

              {/* Recovery Summary */}
              <div className="pl-modalCard" style={{ marginBottom: 16 }}>
                <p className="pl-modalCardTitle">Recovery Summary</p>
                <div className="pl-kv" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                  <div><p className="k">Start Time</p><p className="v" style={{ fontWeight: 600 }}>{rr ? formatDateTime(rr.admittedAt) : '—'}</p></div>
                  <div><p className="k">Duration</p><p className="v" style={{ fontWeight: 600 }}>{elapsedSince(rr?.admittedAt)}</p></div>
                  <div><p className="k">Current Status</p><p className="v"><Badge variant={STATUS_BADGE[rr?.status] || 'gray'}>{(rr?.status || '—').replace(/_/g, ' ')}</Badge></p></div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={openAssessment} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MdEdit /> New Assessment
                    </button>
                    {rr?.status === 'READY_FOR_TRANSFER' && rr?.status !== 'TRANSFERRED' && rr?.transferRequestStatus !== 'PENDING' && (
                      <button type="button" onClick={openTransfer} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#15803d', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MdArrowForward /> Request Transfer
                      </button>
                    )}
                    {rr?.transferRequestStatus === 'PENDING' && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fffbeb', padding: '6px 10px', borderRadius: 6 }}>
                        Pending Reception
                      </span>
                    )}
                    <button type="button" onClick={openComplication} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MdWarning /> Complication
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs: Vitals History | Timeline | Transfer History */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {['info', 'vitals', 'timeline', 'transfers'].map((tab) => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={tabStyle(tab)}>
                    {tab === 'info' ? <MdPerson /> : tab === 'vitals' ? <MdMedicalServices /> : tab === 'timeline' ? <MdHistory /> : <MdBed />}
                    {tab === 'info' ? 'Current Vitals' : tab === 'vitals' ? 'Vitals History' : tab === 'timeline' ? 'Timeline' : 'Transfer History'}
                  </button>
                ))}
              </div>

              {activeTab === 'info' && (
                <div className="pl-modalCard pl-modalCardWide">
                  <p className="pl-modalCardTitle">Current Vitals</p>
                  {rr ? (
                    <div className="pl-kv" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                      <div><p className="k">BP</p><p className="v">{formatVital(rr.bpSystolic)}/{formatVital(rr.bpDiastolic)}</p></div>
                      <div><p className="k">Pulse</p><p className="v">{formatVital(rr.pulse, ' bpm')}</p></div>
                      <div><p className="k">Temp</p><p className="v">{formatVital(rr.temperature, '°C')}</p></div>
                      <div><p className="k">SpO₂</p><p className="v">{formatVital(rr.spo2, '%')}</p></div>
                      <div><p className="k">RR</p><p className="v">{formatVital(rr.respiratoryRate, '/min')}</p></div>
                      <div><p className="k">Pain Score</p><p className="v">{rr.painScore != null ? rr.painScore + '/10' : '—'}</p></div>
                      {rr.consciousnessLevel ? <div><p className="k">Consciousness</p><p className="v">{rr.consciousnessLevel}</p></div> : null}
                      {rr.recoveryNotes ? <div style={{ gridColumn: '1 / -1' }}><p className="k">Notes</p><p className="v">{rr.recoveryNotes}</p></div> : null}
                    </div>
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0' }}>No vitals recorded yet</div>
                  )}
                </div>
              )}

              {activeTab === 'vitals' && (
                <div className="ss-table-wrapper">
                  <table className="ss-table">
                    <thead><tr>
                      <th className="ss-th">Date & Time</th>
                      <th className="ss-th">BP</th>
                      <th className="ss-th">Pulse</th>
                      <th className="ss-th">Temp</th>
                      <th className="ss-th">RR</th>
                      <th className="ss-th">SpO₂</th>
                      <th className="ss-th">Pain</th>
                      <th className="ss-th">Consciousness</th>
                      <th className="ss-th">Status</th>
                    </tr></thead>
                    <tbody>
                      {assessments.map((a) => (
                        <tr key={a.id}>
                          <td className="ss-td" style={{ fontSize: 11 }}>{formatDateTime(a.createdAt)}</td>
                          <td className="ss-td">{formatVital(a.bpSystolic)}/{formatVital(a.bpDiastolic)}</td>
                          <td className="ss-td">{formatVital(a.pulse, ' bpm')}</td>
                          <td className="ss-td">{formatVital(a.temperature, '°C')}</td>
                          <td className="ss-td">{formatVital(a.respiratoryRate, '/min')}</td>
                          <td className="ss-td">{formatVital(a.spo2, '%')}</td>
                          <td className="ss-td">{a.painScore != null ? a.painScore + '/10' : '—'}</td>
                          <td className="ss-td">{a.consciousnessLevel || '—'}</td>
                          <td className="ss-td">
                            {a.status ? <Badge variant={STATUS_BADGE[a.status] || 'gray'}>{a.status.replace(/_/g, ' ')}</Badge> : '—'}
                          </td>
                        </tr>
                      ))}
                      {assessments.length === 0 && (
                        <tr><td colSpan={9} className="ss-empty">No vitals history</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="pl-modalCard pl-modalCardWide">
                  <p className="pl-modalCardTitle"><MdHistory /> Recovery Timeline</p>
                  {detailData.recoveryRecord?.timeline?.length > 0 ? (
                    <div style={{ position: 'relative', paddingLeft: 24 }}>
                      {detailData.recoveryRecord.timeline.map((t, i) => {
                        const items = detailData.recoveryRecord.timeline;
                        const isLast = i === items.length - 1;
                        return (
                          <div key={t.id} style={{ position: 'relative', paddingBottom: 14, paddingLeft: 20, borderLeft: isLast ? 'none' : '2px solid #e2e8f0' }}>
                            <div style={{
                              position: 'absolute', left: -7, top: 2, width: 12, height: 12, borderRadius: '50%',
                              background: t.eventType === 'TRANSFERRED' ? '#15803d' : t.eventType === 'COMPLICATION' ? '#dc2626' : '#2563eb',
                              border: '2px solid #fff', boxShadow: '0 0 0 2px ' + (t.eventType === 'TRANSFERRED' ? '#15803d' : t.eventType === 'COMPLICATION' ? '#dc2626' : '#2563eb'),
                            }} />
                            <div style={{ fontSize: 11, color: '#64748b' }}>{formatDateTime(t.createdAt)}</div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{t.eventDescription || t.eventType.replace(/_/g, ' ')}</div>
                            {t.createdBy && <div style={{ fontSize: 11, color: '#94a3b8' }}>By: {t.createdBy}</div>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ color: '#94a3b8', padding: '16px 0', textAlign: 'center', fontSize: 13 }}>No timeline events</div>
                  )}
                </div>
              )}

              {activeTab === 'transfers' && (
                <div className="ss-table-wrapper">
                  <table className="ss-table">
                    <thead><tr>
                      <th className="ss-th">Date & Time</th>
                      <th className="ss-th">Transfer Type</th>
                      <th className="ss-th">From</th>
                      <th className="ss-th">To</th>
                      <th className="ss-th">Assigned Bed</th>
                      <th className="ss-th">Reason</th>
                    </tr></thead>
                    <tbody>
                      {transfers.map((t) => (
                        <tr key={t.id}>
                          <td className="ss-td" style={{ fontSize: 11 }}>{formatDateTime(t.createdAt)}</td>
                          <td className="ss-td"><Badge variant={t.transferType === 'ICU' ? 'red' : t.transferType === 'PRIVATE' ? 'green' : 'blue'}>{t.transferType}</Badge></td>
                          <td className="ss-td">{t.fromLocation || '—'}</td>
                          <td className="ss-td">{t.toLocation || '—'}</td>
                          <td className="ss-td" style={{ fontFamily: 'monospace' }}>{t.assignedBedCode || '—'}</td>
                          <td className="ss-td" style={{ fontSize: 12 }}>{t.reason || '—'}</td>
                        </tr>
                      ))}
                      {transfers.length === 0 && (
                        <tr><td colSpan={6} className="ss-empty">No transfer history</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Equipment Used */}
              {detailData.equipmentAllocations?.length > 0 && (
                <div className="pl-modalCard" style={{ marginTop: 12 }}>
                  <p className="pl-modalCardTitle"><MdMedicalServices /> Equipment Used</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {detailData.equipmentAllocations.map((ea) => (
                      <span key={ea.id} style={{ padding: '4px 10px', borderRadius: 6, background: '#f1f5f9', fontSize: 12, border: '1px solid #e2e8f0' }}>
                        {ea.equipment?.equipmentName} <span style={{ color: '#64748b' }}>x{ea.quantityAllocated}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Assessment Modal ─── */}
      {assessmentOpen && createPortal(
        <div className="pl-modalOverlay" onClick={() => { if (!assessmentSaving) setAssessmentOpen(false); }}>
          <div className="pl-modal pl-modalAnimate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="pl-modalHeader">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}><MdEdit /> Recovery Assessment</h3>
              <button type="button" onClick={() => setAssessmentOpen(false)} className="pl-modalClose"><MdClose /></button>
            </div>
            <div className="pl-modalBody">
              <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13 }}>
                <strong>{pt.name || '—'}</strong> <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>UHID: {pt.uhid || '—'}</span>
              </div>
              {assessmentMsg && (
                <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 10,
                  background: assessmentMsg.includes('success') ? '#f0fdf4' : '#fef2f2',
                  color: assessmentMsg.includes('success') ? '#15803d' : '#dc2626',
                  border: '1px solid ' + (assessmentMsg.includes('success') ? '#bbf7d0' : '#fecaca') }}>
                  {assessmentMsg}
                </div>
              )}
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#1e40af' }}>Vital Signs</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 13, marginBottom: 10 }}>
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
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#1e40af' }}>Pain Assessment</p>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Pain Score (0-10)</label>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="range" min="0" max="10" value={assessmentForm.painScore} onChange={(e) => setAssessmentForm((f) => ({ ...f, painScore: e.target.value }))} style={{ flex: 1 }} />
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#2563eb', minWidth: 30, textAlign: 'center' }}>{assessmentForm.painScore || 0}</span>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Consciousness Level</label>
                <select value={assessmentForm.consciousnessLevel} onChange={(e) => setAssessmentForm((f) => ({ ...f, consciousnessLevel: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, background: '#fff' }}>
                  <option value="">Select</option>
                  {CONSCIOUSNESS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Recovery Notes</label>
                <textarea value={assessmentForm.recoveryNotes} onChange={(e) => setAssessmentForm((f) => ({ ...f, recoveryNotes: e.target.value }))} rows={3}
                  placeholder="Enter observations..." style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Recovery Status</label>
                <select value={assessmentForm.status} onChange={(e) => setAssessmentForm((f) => ({ ...f, status: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, background: '#fff' }}>
                  <option value="UNDER_OBSERVATION">Under Observation</option>
                  <option value="STABLE">Stable</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="READY_FOR_TRANSFER">Ready For Transfer</option>
                </select>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setAssessmentOpen(false)} disabled={assessmentSaving}
                  style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleSaveAssessment} disabled={assessmentSaving}
                  style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, cursor: assessmentSaving ? 'not-allowed' : 'pointer', opacity: assessmentSaving ? 0.6 : 1 }}>
                  {assessmentSaving ? 'Saving...' : 'Save Assessment'}
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
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
                Reception will assign ward, room and bed. You may suggest a preferred ward type.
              </p>
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

      {/* ─── Complication Modal ─── */}
      {complicationOpen && createPortal(
        <div className="pl-modalOverlay" onClick={() => { if (!complicationSaving) setComplicationOpen(false); }}>
          <div className="pl-modal pl-modalAnimate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="pl-modalHeader">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}><MdWarning /> Record Complication</h3>
              <button type="button" onClick={() => setComplicationOpen(false)} className="pl-modalClose"><MdClose /></button>
            </div>
            <div className="pl-modalBody">
              <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13 }}>
                <strong>{pt.name || '—'}</strong> <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>UHID: {pt.uhid || '—'}</span>
              </div>
              {complicationMsg && (
                <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 10,
                  background: complicationMsg.includes('recorded') ? '#f0fdf4' : '#fef2f2',
                  color: complicationMsg.includes('recorded') ? '#15803d' : '#dc2626',
                  border: '1px solid ' + (complicationMsg.includes('recorded') ? '#bbf7d0' : '#fecaca') }}>
                  {complicationMsg}
                </div>
              )}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Complication Type</label>
                <select value={complicationForm.complicationType} onChange={(e) => setComplicationForm((f) => ({ ...f, complicationType: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, background: '#fff' }}>
                  <option value="">Select</option>
                  {COMPLICATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Severity</label>
                <select value={complicationForm.severity} onChange={(e) => setComplicationForm((f) => ({ ...f, severity: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, background: '#fff' }}>
                  <option value="">Select</option>
                  {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Description</label>
                <textarea value={complicationForm.description} onChange={(e) => setComplicationForm((f) => ({ ...f, description: e.target.value }))} rows={2}
                  placeholder="Describe complication..." style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Action Taken</label>
                <textarea value={complicationForm.actionTaken} onChange={(e) => setComplicationForm((f) => ({ ...f, actionTaken: e.target.value }))} rows={2}
                  placeholder="What action was taken?" style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setComplicationOpen(false)} disabled={complicationSaving}
                  style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleAddComplication} disabled={complicationSaving || !complicationForm.complicationType || !complicationForm.severity}
                  style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, cursor: 'pointer', opacity: complicationSaving || !complicationForm.complicationType || !complicationForm.severity ? 0.6 : 1 }}>
                  {complicationSaving ? 'Saving...' : 'Record Complication'}
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
