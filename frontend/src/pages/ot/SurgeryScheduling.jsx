import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MdSearch, MdPerson, MdMedicalServices, MdWarning, MdSchedule, MdEditCalendar, MdMeetingRoom, MdPeople, MdLocalHospital, MdClose, MdExpandMore, MdExpandLess, MdCheckCircle, MdCancel } from 'react-icons/md';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import './SurgeryScheduling.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PRIORITY_STYLE = { Normal: { badge: 'gray' }, Urgent: { badge: 'rose' } };

function toInputDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

export default function SurgeryScheduling() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoSelected = useRef(false);
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('All');
  const [showDropdown, setShowDropdown] = useState(false);

  const [selected, setSelected] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [nurses, setNurses] = useState([]);

  const [form, setForm] = useState({
    surgeryDate: '', startTime: '09:00', estimatedDuration: '60',
    otRoomId: '', surgeonId: '', assistantSurgeonId: '',
    anaesthetistId: '', remarks: '',
  });
  const [scheduling, setScheduling] = useState(false);
  const [schedError, setSchedError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [assessmentData, setAssessmentData] = useState(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, pendRes, roomsRes, docsRes, nursesRes] = await Promise.all([
        api.get('/ot/surgery/stats').catch(() => ({ data: { pendingScheduling: 0, scheduledToday: 0, upcoming: 0, delayed: 0 } })),
        api.get('/ot/surgery/pending', { params: { limit: 100 } }).catch(() => ({ data: { items: [] } })),
        api.get('/ot/surgery/rooms').catch(() => ({ data: { items: [] } })),
        api.get('/ot/surgery/doctors').catch(() => ({ data: { items: [] } })),
        api.get('/ot/surgery/nurses').catch(() => ({ data: { items: [] } })),
      ]);
      setStats(statsRes.data);
      setPending(Array.isArray(pendRes.data?.items) ? pendRes.data.items : []);
      setRooms(Array.isArray(roomsRes.data?.items) ? roomsRes.data.items : []);
      setDoctors(Array.isArray(docsRes.data?.items) ? docsRes.data.items : []);
      setNurses(Array.isArray(nursesRes.data?.items) ? nursesRes.data.items : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-select patient from query param ?otRequestId=XX
  useEffect(() => {
    const reqId = searchParams.get('otRequestId');
    if (reqId && pending.length > 0 && !autoSelected.current) {
      const match = pending.find((r) => r.id === reqId);
      if (match) { selectPatient(match); autoSelected.current = true; }
    }
  }, [searchParams, pending]);

  // Fetch assessment when patient selected
  useEffect(() => {
    if (!selected) { setAssessmentData(null); setAssessmentOpen(false); return; }
    let alive = true;
    (async () => {
      setAssessmentLoading(true);
      try {
        const res = await api.get(`/assessment/ot-request/${selected.id}`);
        if (alive) setAssessmentData(res.data?.assessment ?? null);
      } catch {
        if (alive) setAssessmentData(null);
      } finally {
        if (alive) setAssessmentLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [selected]);

  const recommendations = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    if (!q) return [];
    return pending.filter((r) => {
      const name = r.patient?.name || '';
      const uhid = r.uhid || '';
      if (!name.toLowerCase().includes(q) && !uhid.toLowerCase().includes(q)) return false;
      if (priority !== 'All' && (r.priority || 'Normal') !== priority) return false;
      return true;
    });
  }, [pending, search, priority]);

  function selectPatient(req) {
    setSelected(req);
    setSearch(req.patient?.name || '');
    setShowDropdown(false);
    setForm({
      surgeryDate: toInputDate(req.expectedSurgeryDate || new Date()),
      startTime: '09:00',
      estimatedDuration: '60',
      otRoomId: '',
      surgeonId: req.doctor?.id || '',
      assistantSurgeonId: '',
      anaesthetistId: '',
      remarks: '',
    });
    setSchedError('');
    setSuccessMsg('');
  }

  function clearSelection() {
    setSelected(null);
    setSearch('');
    setSchedError('');
    setSuccessMsg('');
    autoSelected.current = false;
  }

  async function handleSchedule(e) {
    e.preventDefault();
    if (!selected) return;
    setScheduling(true);
    setSchedError('');
    setSuccessMsg('');
    try {
      const res = await api.post('/ot/surgery/schedule', {
        otRequestId: selected.id,
        surgeryDate: form.surgeryDate,
        startTime: form.startTime,
        estimatedDuration: parseInt(form.estimatedDuration, 10) || 60,
        otRoomId: form.otRoomId,
        surgeonId: form.surgeonId,
        assistantSurgeonId: form.assistantSurgeonId || undefined,
        anaesthetistId: form.anaesthetistId,
        remarks: form.remarks || undefined,
      });
      const route = res.data.routing === 'today' ? '/dashboard/ot/today' : '/dashboard/ot/upcoming';
      setSuccessMsg(`Surgery scheduled successfully! Redirecting to ${res.data.routing === 'today' ? "Today's" : 'Upcoming'} Surgeries...`);
      setSelected(null);
      setSearch('');
      setTimeout(() => { fetchAll(); navigate(route); }, 800);
    } catch (err) {
      setSchedError(err.response?.data?.message || 'Failed to schedule surgery');
    } finally {
      setScheduling(false);
    }
  }

  const surgeons = doctors.filter((d) => d.specialization !== 'Anaesthetist');
  const anaesthetists = doctors.filter((d) => d.specialization === 'Anaesthetist' || d.specialization?.toLowerCase().includes('anaest'));

  const statsCards = [
    { label: 'Pending Scheduling', value: stats?.pendingScheduling ?? pending.length, icon: MdSchedule, bg: '#0f2d5e', light: '#dbeafe' },
    { label: "Today's Surgeries", value: stats?.scheduledToday ?? 0, icon: MdMedicalServices, bg: '#059669', light: '#d1fae5' },
    { label: 'Upcoming', value: stats?.upcoming ?? 0, icon: MdEditCalendar, bg: '#1d4ed8', light: '#dbeafe' },
    { label: 'Delayed', value: stats?.delayed ?? 0, icon: MdWarning, bg: '#dc2626', light: '#fee2e2' },
  ];

  const checklistItems = [
    { label: 'Consent', key: 'consentObtained' },
    { label: 'Lab Reports', key: 'labReportsAvailable' },
    { label: 'Fasting', key: 'fastingCompleted' },
    { label: 'Blood', key: 'bloodAvailable' },
    { label: 'Site Verified', key: 'surgicalSiteVerified' },
    { label: 'Identity', key: 'patientIdentityVerified' },
  ];

  return (
    <div className="ss-container">
      <div className="ss-header">
      </div>

      {error && <div className="ss-error">{error}</div>}
      {successMsg && <div className="ss-success">{successMsg}</div>}

      {loading ? (
        <div className="ss-loading">Loading...</div>
      ) : (
        <>
          <div className="ss-stats">
            {statsCards.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="ss-stat-card">
                  <div className="ss-stat-icon" style={{ background: s.light }}>
                    <Icon className="w-5 h-5" style={{ color: s.bg }} />
                  </div>
                  <div>
                    <p className="ss-stat-value">{s.value}</p>
                    <p className="ss-stat-label">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ss-search-section">
            <div className="ss-search-row">
              <div className="ss-search-box-lg">
                <MdSearch className="ss-search-icon" />
                <input value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => { if (search.trim()) setShowDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="Type patient name or UHID to search..."
                  className="ss-search-input-lg" />
                {showDropdown && recommendations.length > 0 && (
                  <div className="ss-dropdown">
                    {recommendations.map((r) => (
                      <div key={r.id} className="ss-dropdown-item" onMouseDown={() => selectPatient(r)}>
                        <div className="ss-avatar"><MdPerson className="w-4 h-4" /></div>
                        <div className="ss-dropdown-info">
                          <span className="ss-dropdown-name">{r.patient?.name}</span>
                          <span className="ss-dropdown-meta">{r.uhid} · {r.surgeryRecommendation || '—'} · <Badge variant={PRIORITY_STYLE[r.priority]?.badge || 'gray'}>{r.priority || 'Normal'}</Badge></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {showDropdown && search.trim() && recommendations.length === 0 && (
                  <div className="ss-dropdown ss-dropdown-empty">No matching patients found</div>
                )}
              </div>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="ss-select">
                <option value="All">All Priority</option>
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          {selected && (
            <div className="ss-schedule-section">
              <div className="ss-schedule-header">
                <h2 className="ss-schedule-title">Schedule Surgery</h2>
                <button className="ss-btn ss-btn-cancel" onClick={clearSelection}>
                  <MdClose className="w-4 h-4" /> Clear
                </button>
              </div>

              <div className="ss-patient-details">
                <div className="ss-patient-detail-card">
                  <div className="ss-pd-header">
                    <div className="ss-avatar-lg"><MdPerson className="w-6 h-6" /></div>
                    <div>
                      <h3 className="ss-pd-name">{selected.patient?.name}</h3>
                      <p className="ss-pd-meta">UHID: {selected.uhid} | Request: {selected.requestNumber}</p>
                    </div>
                    <span className="ss-pd-badge"><Badge variant={PRIORITY_STYLE[selected.priority]?.badge || 'gray'}>{selected.priority || 'Normal'}</Badge></span>
                  </div>
                  <div className="ss-pd-grid">
                    <div><span className="ss-pd-label">Surgery</span><span className="ss-pd-value">{selected.surgeryRecommendation || '—'}</span></div>
                    <div><span className="ss-pd-label">Diagnosis</span><span className="ss-pd-value">{selected.diagnosis || '—'}</span></div>
                    <div><span className="ss-pd-label">Doctor</span><span className="ss-pd-value">{selected.doctor?.user?.name || '—'}</span></div>
                    <div><span className="ss-pd-label">Expected Date</span><span className="ss-pd-value">{formatDate(selected.expectedSurgeryDate)}</span></div>
                  </div>
                </div>
              </div>

              {assessmentLoading ? (
                <div className="ss-assessment-loading">Loading pre-operative assessment...</div>
              ) : (
                <div className="ss-assessment-section" style={{ marginBottom: 16 }}>
                  <button
                    onClick={() => setAssessmentOpen(!assessmentOpen)}
                    className="ss-assessment-toggle"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '12px 16px', borderRadius: 12,
                      border: `1px solid ${assessmentData ? '#bbf7d0' : '#f1f5f9'}`,
                      background: assessmentData ? '#f0fdf4' : '#fafafa',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      color: '#0f172a', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {assessmentData ? <MdCheckCircle size={18} color="#15803d" /> : <MdWarning size={18} color="#f59e0b" />}
                      Pre-Operative Assessment {assessmentData ? 'Completed' : 'Not Submitted'}
                    </span>
                    {assessmentOpen ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
                  </button>

                  {assessmentOpen && assessmentData && (
                    <div style={{ marginTop: 8, padding: '14px 16px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                      {/* Vitals */}
                      <div style={{ marginBottom: 12 }}>
                        <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>Vital Signs</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                          {[
                            ['BP', assessmentData.bpSystolic ? `${assessmentData.bpSystolic}/${assessmentData.bpDiastolic}` : null],
                            ['Pulse', assessmentData.pulse ? `${assessmentData.pulse} /min` : null],
                            ['Temp', assessmentData.temperature ? `${assessmentData.temperature}°C` : null],
                            ['SpO₂', assessmentData.spo2 != null ? `${assessmentData.spo2}%` : null],
                            ['RR', assessmentData.respiratoryRate ? `${assessmentData.respiratoryRate} /min` : null],
                            ['BMI', assessmentData.bmi ? assessmentData.bmi.toFixed(1) : null],
                          ].map(([label, val]) => (
                            <div key={label} style={{ padding: '3px 0' }}>
                              <span style={{ color: '#64748b', fontSize: 11, display: 'block' }}>{label}</span>
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{val ?? '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Readiness Checklist */}
                      <div>
                        <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>OT Readiness Checklist</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {checklistItems.map((item) => {
                            const done = assessmentData[item.key];
                            return (
                              <span key={item.key} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 10px', borderRadius: 999, fontSize: 12,
                                background: done ? '#dcfce7' : '#fef2f2',
                                color: done ? '#15803d' : '#dc2626',
                                border: `1px solid ${done ? '#bbf7d0' : '#fecaca'}`,
                              }}>
                                {done ? <MdCheckCircle size={13} /> : <MdCancel size={13} />}
                                {item.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Assessed by */}
                      <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>
                        Assessed by <strong>{assessmentData.assessedBy?.name || '—'}</strong> on {new Date(assessmentData.assessmentDate).toLocaleString('en-IN')}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="ss-form-wrapper">
                {schedError && <div className="ss-error ss-error-sm">{schedError}</div>}
                <form onSubmit={handleSchedule} className="ss-form">
                  <div className="ss-form-row">
                    <div className="ss-form-group">
                      <label className="ss-label">Surgery Date *</label>
                      <input type="date" className="ss-input" value={form.surgeryDate}
                        onChange={(e) => setForm({ ...form, surgeryDate: e.target.value })} required />
                    </div>
                    <div className="ss-form-group">
                      <label className="ss-label">Start Time *</label>
                      <input type="time" className="ss-input" value={form.startTime}
                        onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
                    </div>
                    <div className="ss-form-group">
                      <label className="ss-label">Duration (min) *</label>
                      <input type="number" min="1" className="ss-input" value={form.estimatedDuration}
                        onChange={(e) => setForm({ ...form, estimatedDuration: e.target.value })} required />
                    </div>
                  </div>

                  <div className="ss-form-row">
                    <div className="ss-form-group">
                      <label className="ss-label"><MdMeetingRoom className="w-3.5 h-3.5 inline mr-1" /> OT Room *</label>
                      <select className="ss-input" value={form.otRoomId}
                        onChange={(e) => setForm({ ...form, otRoomId: e.target.value })} required>
                        <option value="">— Select OT Room —</option>
                        {rooms.filter((rm) => rm.status === 'AVAILABLE').map((rm) => (
                          <option key={rm.id} value={rm.id}>{rm.roomNumber || rm.roomName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ss-form-group">
                      <label className="ss-label"><MdLocalHospital className="w-3.5 h-3.5 inline mr-1" /> Surgeon *</label>
                      <select className="ss-input" value={form.surgeonId}
                        onChange={(e) => setForm({ ...form, surgeonId: e.target.value })} required>
                        <option value="">— Select Surgeon —</option>
                        {surgeons.map((d) => (
                          <option key={d.id} value={d.id}>{d.user?.name} {d.specialization ? `(${d.specialization})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ss-form-group">
                      <label className="ss-label">Asst. Surgeon</label>
                      <select className="ss-input" value={form.assistantSurgeonId}
                        onChange={(e) => setForm({ ...form, assistantSurgeonId: e.target.value })}>
                        <option value="">— None —</option>
                        {surgeons.map((d) => (
                          <option key={d.id} value={d.id}>{d.user?.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="ss-form-row">
                    <div className="ss-form-group">
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-sm text-indigo-700 flex items-center gap-2">
                        <MdPeople className="w-4 h-4 shrink-0" />
                        <span>Nurse will be assigned via <strong>HR Allocation</strong> after scheduling</span>
                      </div>
                    </div>
                    <div className="ss-form-group">
                      <label className="ss-label"><MdLocalHospital className="w-3.5 h-3.5 inline mr-1" /> Anaesthetist *</label>
                      <select className="ss-input" value={form.anaesthetistId}
                        onChange={(e) => setForm({ ...form, anaesthetistId: e.target.value })} required>
                        <option value="">— Select Anaesthetist —</option>
                        {anaesthetists.length > 0 ? anaesthetists.map((d) => (
                          <option key={d.id} value={d.id}>{d.user?.name}</option>
                        )) : doctors.map((d) => (
                          <option key={d.id} value={d.id}>{d.user?.name} {d.specialization ? `(${d.specialization})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ss-form-group">
                      <label className="ss-label">Remarks</label>
                      <input type="text" className="ss-input" placeholder="Optional notes..." value={form.remarks}
                        onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
                    </div>
                  </div>

                  <div className="ss-form-actions">
                    <button type="button" className="ss-btn ss-btn-cancel" onClick={clearSelection}>Cancel</button>
                    <button type="submit" className="ss-btn ss-btn-primary" disabled={scheduling}>
                      <MdEditCalendar className="w-4 h-4" /> {scheduling ? 'Scheduling...' : 'Schedule Surgery'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {!selected && (
            <div className="ss-empty-state">
              <MdSearch className="ss-empty-icon" />
              <p className="ss-empty-text">Type a patient name or UHID above to search</p>
              <p className="ss-empty-hint">Matching OT requests will appear as suggestions</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
