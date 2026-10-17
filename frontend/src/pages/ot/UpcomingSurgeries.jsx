import { useEffect, useMemo, useState } from 'react';
import { MdPerson, MdClose, MdCheckCircle, MdEdit, MdSchedule, MdHistory } from 'react-icons/md';
import { createPortal } from 'react-dom';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import './SurgeryScheduling.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + m + ' ' + ampm;
}

function formatVital(v, unit) {
  return v != null && v !== '' ? v + (unit || '') : '—';
}

export default function UpcomingSurgeries() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [preAssessment, setPreAssessment] = useState(null);
  // reschedule
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({ surgeryDate: '', startTime: '', reason: '', otRoomId: '' });
  const [rescheduleRooms, setRescheduleRooms] = useState([]);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleMsg, setRescheduleMsg] = useState('');
  // update record
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    bpSystolic: '', bpDiastolic: '', pulse: '', temperature: '', spo2: '', respiratoryRate: '', heightCm: '', weightKg: '',
  });
  const [prevAssessment, setPrevAssessment] = useState(null);
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const fetchItems = () => {
    setLoading(true);
    api.get('/ot/surgery/upcoming')
      .then((res) => setItems(Array.isArray(res.data?.items) ? res.data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const fetchPreAssessment = (item) => {
    const pa = item?.otRequest?.preOperativeAssessment;
    if (pa) {
      setPreAssessment(pa);
      setPrevAssessment(JSON.parse(JSON.stringify(pa)));
      return;
    }
    if (!item?.otRequest?.id) { setPreAssessment(null); setPrevAssessment(null); return; }
    api.get('/assessment/ot-request/' + item.otRequest.id)
      .then((res) => {
        const a = res?.data?.assessment || null;
        setPreAssessment(a);
        setPrevAssessment(a ? JSON.parse(JSON.stringify(a)) : null);
      })
      .catch(() => { setPreAssessment(null); setPrevAssessment(null); });
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setPreAssessment(null);
    setPrevAssessment(null);
    setRescheduleOpen(false);
    setUpdateOpen(false);
    setUpdateSuccess(false);
    setRescheduleMsg('');
    setUpdateMsg('');
    fetchPreAssessment(item);
  };

  const closeModal = () => {
    setSelectedItem(null);
    setPreAssessment(null);
    setPrevAssessment(null);
    setRescheduleOpen(false);
    setUpdateOpen(false);
    setRescheduleMsg('');
    setUpdateMsg('');
    setUpdateSuccess(false);
  };

  // ─── Reschedule ───
  const handleOpenReschedule = () => {
    if (!selectedItem) return;
    const d = new Date(selectedItem.surgeryDate);
    setRescheduleForm({
      surgeryDate: d.toISOString().split('T')[0],
      startTime: selectedItem.startTime || '',
      reason: '',
      otRoomId: '',
    });
    api.get('/ot/surgery/rooms').then((res) => setRescheduleRooms(res.data?.items?.filter((r) => r.status === 'AVAILABLE') || [])).catch(() => setRescheduleRooms([]));
    setRescheduleOpen(true);
    setRescheduleMsg('');
  };

  const handleRescheduleSubmit = async () => {
    if (!rescheduleForm.surgeryDate || !rescheduleForm.startTime) return;
    setRescheduleSubmitting(true);
    setRescheduleMsg('');
    try {
      await api.put('/ot/surgery/reschedule', {
        scheduleId: selectedItem.id,
        surgeryDate: rescheduleForm.surgeryDate,
        startTime: rescheduleForm.startTime,
        reason: rescheduleForm.reason || undefined,
        otRoomId: rescheduleForm.otRoomId || undefined,
      });
      setRescheduleMsg('Surgery rescheduled successfully.');
      fetchItems();
    } catch (err) {
      setRescheduleMsg(err?.response?.data?.message || 'Failed to reschedule surgery');
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  // ─── Update Record ───
  const handleOpenUpdate = () => {
    if (!preAssessment) return;
    setPrevAssessment({ ...preAssessment });
    setUpdateForm({
      bpSystolic: preAssessment.bpSystolic ?? '',
      bpDiastolic: preAssessment.bpDiastolic ?? '',
      pulse: preAssessment.pulse ?? '',
      temperature: preAssessment.temperature ?? '',
      spo2: preAssessment.spo2 ?? '',
      respiratoryRate: preAssessment.respiratoryRate ?? '',
      heightCm: preAssessment.heightCm ?? '',
      weightKg: preAssessment.weightKg ?? '',
    });
    setUpdateOpen(true);
    setUpdateMsg('');
    setUpdateSuccess(false);
  };

  const handleUpdateSubmit = async () => {
    if (!selectedItem?.otRequest?.id) return;
    setUpdateSubmitting(true);
    setUpdateMsg('');
    try {
      const payload = {};
      for (const [key, val] of Object.entries(updateForm)) {
        if (val !== '' && val !== null && val !== undefined) payload[key] = val;
      }
      const res = await api.put('/assessment/ot-request/' + selectedItem.otRequest.id, payload);
      setUpdateMsg('Assessment updated successfully.');
      setUpdateSuccess(true);
      setPreAssessment(res?.data?.assessment || null);
    } catch (err) {
      setUpdateMsg(err?.response?.data?.message || 'Failed to update assessment');
    } finally {
      setUpdateSubmitting(false);
    }
  };

  const updateFormField = (field, value) => {
    setUpdateForm((f) => ({ ...f, [field]: value }));
  };

  // ─── History diff ───
  const historyDiff = useMemo(() => {
    if (!prevAssessment || !preAssessment) return [];
    const diffs = [];
    const fields = [
      { key: 'bpSystolic', label: 'BP Systolic', unit: '', fmt: (v) => v ?? '—' },
      { key: 'bpDiastolic', label: 'BP Diastolic', unit: '', fmt: (v) => v ?? '—' },
      { key: 'pulse', label: 'Pulse', unit: ' bpm', fmt: (v) => v ?? '—' },
      { key: 'temperature', label: 'Temperature', unit: '°C', fmt: (v) => v ?? '—' },
      { key: 'spo2', label: 'SpO₂', unit: '%', fmt: (v) => v ?? '—' },
      { key: 'respiratoryRate', label: 'RR', unit: '/min', fmt: (v) => v ?? '—' },
      { key: 'heightCm', label: 'Height', unit: ' cm', fmt: (v) => v ?? '—' },
      { key: 'weightKg', label: 'Weight', unit: ' kg', fmt: (v) => v ?? '—' },
    ];
    for (const f of fields) {
      const oldVal = String(prevAssessment[f.key] ?? '');
      const newVal = String(preAssessment[f.key] ?? '');
      if (oldVal !== newVal) {
        diffs.push({ label: f.label, old: f.fmt(prevAssessment[f.key]), new: f.fmt(preAssessment[f.key]) });
      }
    }
    return diffs;
  }, [prevAssessment, preAssessment]);

  return (
    <div className="ss-container" style={rescheduleOpen ? { marginRight: 380, transition: 'margin-right 0.3s' } : {}}>
      <div className="ss-header">
     
      </div>
      {loading ? <div className="ss-loading">Loading...</div> : (
        <div className="ss-table-wrapper">
          <table className="ss-table">
            <thead><tr>{['Date', 'Time', 'Patient', 'UHID', 'Room', 'Surgeon', 'OT Nurse', 'Anaesthetist', 'Status'].map((h) => <th key={h} className="ss-th">{h}</th>)}</tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="ss-tr" style={{ cursor: 'pointer' }} onClick={() => handleRowClick(s)}>
                  <td className="ss-td ss-date-cell">{formatDate(s.surgeryDate)}</td>
                  <td className="ss-td">                  <span className="ss-time">{formatTime(s.startTime)}</span></td>
                  <td className="ss-td">
                    <div className="ss-patient-cell">
                      <div className="ss-avatar"><MdPerson className="w-4 h-4" /></div>
                      <span className="ss-patient-name">{s.otRequest?.patient?.name || '—'}</span>
                    </div>
                  </td>
                  <td className="ss-td"><span className="ss-uhid">{s.otRequest?.patient?.uhid || '—'}</span></td>
                  <td className="ss-td">{s.otRoom?.roomNumber || s.otRoom?.roomName || '—'}</td>
                  <td className="ss-td">{s.surgeon?.user?.name || '—'}</td>
                  <td className="ss-td">{s.otNurse?.name || '—'}</td>
                  <td className="ss-td">{s.anaesthetist?.user?.name || '—'}</td>
                  <td className="ss-td">
                    {s.computedStatus === 'rescheduled'
                      ? <Badge variant="amber">RESCHEDULED</Badge>
                      : <Badge variant="blue">SCHEDULED</Badge>}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={9} className="ss-empty">No upcoming surgeries</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Detail Modal ─── */}
      {selectedItem && createPortal(
        <div className="pl-modalOverlay" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="pl-modal pl-modalAnimate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="pl-modalHeader">
              <div className="min-w-0 flex items-center gap-3">
                <div className="pl-avatar"><MdPerson className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900 truncate">{selectedItem.otRequest?.patient?.name || '—'}</p>
                  <div className="pl-headerMeta">
                    <span className="pl-chip">UHID <span className="pl-chipMono">{selectedItem.otRequest?.patient?.uhid || '—'}</span></span>
                    <span className="pl-chip">{formatDate(selectedItem.surgeryDate)} @ {formatTime(selectedItem.startTime)}</span>
                  </div>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="pl-modalClose" title="Close"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="pl-modalBody">
              <div className="pl-modalGrid">
                <div className="pl-modalCard">
                  <p className="pl-modalCardTitle">Patient Info</p>
                  <div className="pl-kv">
                    <div><p className="k">Name</p><p className="v">{selectedItem.otRequest?.patient?.name || '—'}</p></div>
                    <div><p className="k">UHID</p><p className="v">{selectedItem.otRequest?.patient?.uhid || '—'}</p></div>
                    <div><p className="k">Room</p><p className="v">{selectedItem.otRoom?.roomNumber || selectedItem.otRoom?.roomName || '—'}</p></div>
                    <div><p className="k">Surgeon</p><p className="v">{selectedItem.surgeon?.user?.name || '—'}</p></div>
                  </div>
                </div>

                {selectedItem.computedStatus === 'rescheduled' && selectedItem.rescheduleReason && (
                  <div className="pl-modalCard" style={{ border: '1px solid #fde68a', background: '#fffbeb' }}>
                    <p className="pl-modalCardTitle" style={{ color: '#92400e', fontSize: 12 }}>
                      <MdSchedule style={{ verticalAlign: 'middle', marginRight: 4 }} /> Rescheduled
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: '#78350f' }}>{selectedItem.rescheduleReason}</p>
                  </div>
                )}

                {/* ─── Pre-Assessment ─── */}
                <div className="pl-modalCard pl-modalCardWide">
                  <p className="pl-modalCardTitle">
                    Pre-Operative Assessment
                    {preAssessment ? <MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', marginLeft: 6 }} /> : null}
                  </p>
                  {preAssessment ? (
                    <>
                      <div className="pl-kv" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <div><p className="k">BP</p><p className="v">{formatVital(preAssessment.bpSystolic)}/{formatVital(preAssessment.bpDiastolic)}</p></div>
                        <div><p className="k">Pulse</p><p className="v">{formatVital(preAssessment.pulse, ' bpm')}</p></div>
                        <div><p className="k">Temp</p><p className="v">{formatVital(preAssessment.temperature, '°C')}</p></div>
                        <div><p className="k">SpO₂</p><p className="v">{formatVital(preAssessment.spo2, '%')}</p></div>
                        <div><p className="k">RR</p><p className="v">{formatVital(preAssessment.respiratoryRate, '/min')}</p></div>
                        <div><p className="k">BMI</p><p className="v">{formatVital(preAssessment.bmi)}</p></div>
                        <div><p className="k">Height</p><p className="v">{formatVital(preAssessment.heightCm, ' cm')}</p></div>
                        <div><p className="k">Weight</p><p className="v">{formatVital(preAssessment.weightKg, ' kg')}</p></div>
                        <div><p className="k">Assessed By</p><p className="v">{preAssessment.assessedBy?.name || '—'}</p></div>
                      </div>
                      {preAssessment.consentObtained || preAssessment.labReportsAvailable || preAssessment.fastingCompleted || preAssessment.bloodAvailable || preAssessment.surgicalSiteVerified || preAssessment.patientIdentityVerified ? (
                        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 12, color: '#374151' }}>
                          {preAssessment.consentObtained && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 13 }} /> Consent</span>}
                          {preAssessment.labReportsAvailable && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 13 }} /> Lab Reports</span>}
                          {preAssessment.fastingCompleted && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 13 }} /> Fasting</span>}
                          {preAssessment.bloodAvailable && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 13 }} /> Blood</span>}
                          {preAssessment.surgicalSiteVerified && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 13 }} /> Site Verified</span>}
                          {preAssessment.patientIdentityVerified && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 13 }} /> Identity</span>}
                        </div>
                      ) : null}
                      {preAssessment.knownAllergies && <div style={{ marginTop: 4, fontSize: 12 }}><strong>Allergies:</strong> {preAssessment.knownAllergies}</div>}
                      {preAssessment.currentMedications && <div style={{ marginTop: 2, fontSize: 12 }}><strong>Medications:</strong> {preAssessment.currentMedications}</div>}
                      {preAssessment.previousSurgeries && <div style={{ marginTop: 2, fontSize: 12 }}><strong>Surgeries:</strong> {preAssessment.previousSurgeries}</div>}
                      {preAssessment.nurseNotes && <div style={{ marginTop: 2, fontSize: 12 }}><strong>Nurse Notes:</strong> {preAssessment.nurseNotes}</div>}
                    </>
                  ) : (
                    <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>Loading pre-assessment data...</div>
                  )}
                </div>
              </div>

              {/* ─── Update Record Form ─── */}
              {preAssessment && updateOpen && (
                <div className="pl-modalCard pl-modalCardWide" style={{ border: '1px solid #3b82f6', marginTop: 8 }}>
                  <p className="pl-modalCardTitle"><MdEdit style={{ verticalAlign: 'middle', marginRight: 4 }} /> Update Vitals</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 13 }}>
                    {[
                      ['bpSystolic', 'BP Systolic', 'number'],
                      ['bpDiastolic', 'BP Diastolic', 'number'],
                      ['pulse', 'Pulse', 'number'],
                      ['temperature', 'Temperature', 'number'],
                      ['spo2', 'SpO₂', 'number'],
                      ['respiratoryRate', 'RR', 'number'],
                      ['heightCm', 'Height (cm)', 'number'],
                      ['weightKg', 'Weight (kg)', 'number'],
                    ].map(([key, label, type]) => (
                      <div key={key}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>{label}</label>
                        <input type={type} step="any" value={updateForm[key]} onChange={(e) => updateFormField(key, e.target.value)}
                          style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box' }} />
                      </div>
                    ))}
                  </div>
                  {updateMsg && (
                    <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, fontSize: 12, background: updateMsg.includes('success') ? '#f0fdf4' : '#fef2f2', color: updateMsg.includes('success') ? '#15803d' : '#dc2626', border: '1px solid ' + (updateMsg.includes('success') ? '#bbf7d0' : '#fecaca') }}>
                      {updateMsg}
                    </div>
                  )}

                  <div style={{ marginTop: 8, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => { setUpdateOpen(false); setUpdateMsg(''); setUpdateSuccess(false); }}
                      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                      Cancel
                    </button>
                    <button type="button" onClick={handleUpdateSubmit} disabled={updateSubmitting}
                      style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, cursor: updateSubmitting ? 'not-allowed' : 'pointer', opacity: updateSubmitting ? 0.6 : 1 }}>
                      {updateSubmitting ? 'Saving...' : 'Save Updates'}
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Vitals Update History ─── */}
              {historyDiff.length > 0 && (
                <div className="pl-modalCard pl-modalCardWide" style={{ marginTop: 8, border: '1px solid #e2e8f0', background: '#f8faff' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#1e40af' }}><MdHistory style={{ verticalAlign: 'middle', marginRight: 4 }} /> Vitals Update History</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    {historyDiff.map((d, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 3 }}>
                        <span style={{ fontWeight: 600, color: '#374151', minWidth: 80 }}>{d.label}</span>
                        <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>{d.old}</span>
                        <span style={{ color: '#94a3b8' }}>→</span>
                        <span style={{ color: '#15803d', fontWeight: 600 }}>{d.new}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Action Buttons ─── */}
              {preAssessment && (
                <div className="pl-modalActions" style={{ marginTop: 12 }}>
                  <button type="button" className="pl-actionBtn pl-actionBtnPrimary" onClick={handleOpenReschedule}
                    style={{ background: '#f59e0b', borderColor: '#f59e0b' }}>
                    <MdSchedule className="w-4 h-4" /> Reschedule
                  </button>
                  <button type="button" className="pl-actionBtn pl-actionBtnPrimary" onClick={handleOpenUpdate}
                    style={{ background: '#2563eb', borderColor: '#2563eb' }}>
                    <MdEdit className="w-4 h-4" /> Update Record
                  </button>
                  <button type="button" className="pl-actionBtn" onClick={closeModal}>
                    <MdClose className="w-4 h-4" /> Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Reschedule Sidebar ─── */}
      {rescheduleOpen && createPortal(
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, background: '#fff', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)', zIndex: 1060, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e2e8f0' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8faff' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdSchedule /> Reschedule OT
            </h3>
            <button type="button" onClick={() => setRescheduleOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><MdClose className="w-5 h-5" /></button>
          </div>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', fontSize: 13, background: '#f8fafc' }}>
            <strong>{selectedItem?.otRequest?.patient?.name || '—'}</strong>
            <span style={{ color: '#64748b', marginLeft: 8, fontFamily: 'monospace', fontSize: 12 }}>#{selectedItem?.otRequest?.patient?.uhid || '—'}</span>
          </div>
          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            {rescheduleMsg && (
              <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 12, background: rescheduleMsg.includes('success') ? '#f0fdf4' : '#fef2f2', color: rescheduleMsg.includes('success') ? '#15803d' : '#dc2626', border: '1px solid ' + (rescheduleMsg.includes('success') ? '#bbf7d0' : '#fecaca') }}>
                {rescheduleMsg}
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>New Surgery Date *</label>
              <input type="date" value={rescheduleForm.surgeryDate} onChange={(e) => setRescheduleForm((f) => ({ ...f, surgeryDate: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>New Time *</label>
              <input type="time" value={rescheduleForm.startTime} onChange={(e) => setRescheduleForm((f) => ({ ...f, startTime: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>OT Room</label>
              <select value={rescheduleForm.otRoomId} onChange={(e) => setRescheduleForm((f) => ({ ...f, otRoomId: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}>
                <option value="">— Keep current room —</option>
                {rescheduleRooms.map((rm) => (
                  <option key={rm.id} value={rm.id}>{rm.roomNumber || rm.roomName}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Reason for Reschedule</label>
              <textarea value={rescheduleForm.reason} onChange={(e) => setRescheduleForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Enter reason for rescheduling..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, minHeight: 70, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <button type="button" onClick={handleRescheduleSubmit} disabled={rescheduleSubmitting || !rescheduleForm.surgeryDate || !rescheduleForm.startTime}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 13, fontWeight: 600, cursor: rescheduleSubmitting ? 'not-allowed' : 'pointer', opacity: rescheduleSubmitting || !rescheduleForm.surgeryDate || !rescheduleForm.startTime ? 0.6 : 1 }}>
              {rescheduleSubmitting ? 'Rescheduling...' : 'Reschedule Surgery'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
