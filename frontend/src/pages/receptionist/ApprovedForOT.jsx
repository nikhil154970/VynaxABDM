import { useEffect, useState, useCallback, useRef } from 'react';
import { MdCheckCircle, MdClose, MdVisibility, MdPerson, MdWarning } from 'react-icons/md';
import api from '../../utils/api';

function VitalRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ color: '#64748b', fontSize: 12 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{value ?? '—'}</span>
    </div>
  );
}

function CheckItem({ label, checked }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
      <span style={{ width: 18, height: 18, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', background: checked ? '#15803d' : '#94a3b8' }}>
        {checked ? '\u2713' : '\u2717'}
      </span>
      <span style={{ fontSize: 13, color: '#0f172a' }}>{label}</span>
    </div>
  );
}

function DetailModal({ item, onClose }) {
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item) return;
    let alive = true;
    (async () => {
      try {
        const res = await api.get(`/assessment/ot-request/${item.id}`);
        if (alive) setAssessment(res.data?.assessment ?? null);
      } catch {
        if (alive) setAssessment(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [item]);

  if (!item) return null;

  const p = item.patient || {};
  const a = item.admission || {};

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '90%', maxWidth: 860, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #e2e8f0', background: '#f8faff' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Pre-Operative Assessment Details</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8, color: '#64748b', fontSize: 22, lineHeight: 1 }}><MdClose /></button>
        </div>
        <div style={{ overflow: 'auto', padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Patient Information */}
          <div style={{ background: '#f8faff', borderRadius: 12, padding: 14, border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#1e40af' }}>Patient Information</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
              {[
                ['Patient Name', p.name || '—'],
                ['UHID', item.uhid || '—'],
                ['IPD Number', a.ipdNumber || '—'],
                ['Age', p.age != null ? `${p.age} yrs` : '—'],
                ['Gender', p.gender || '—'],
                ['Ward', a.ward?.name || '—'],
                ['Bed', a.bedNumber || '—'],
                ['Doctor', item.doctor?.user?.name || '—'],
                ['Diagnosis', item.diagnosis || '—'],
                ['Recommended Surgery', item.surgeryRecommendation || '—'],
                ['Priority', item.priority || 'Normal'],
                ['Request Number', item.requestNumber || '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', fontSize: 12 }}>{label}</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pre-Operative Assessment */}
          <div style={{ background: '#f8faff', borderRadius: 12, padding: 14, border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#1e40af' }}>Vital Signs</h4>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>Loading assessment data...</div>
            ) : !assessment ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: '#fff8e1', borderRadius: 10, border: '1px solid #ffe082' }}>
                <MdWarning size={18} color='#f59e0b' />
                <span style={{ fontSize: 13, color: '#92400e' }}>Pre-operative assessment not yet submitted</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <VitalRow label="BP Systolic" value={assessment.bpSystolic ? `${assessment.bpSystolic} mmHg` : null} />
                    <VitalRow label="BP Diastolic" value={assessment.bpDiastolic ? `${assessment.bpDiastolic} mmHg` : null} />
                    <VitalRow label="Pulse" value={assessment.pulse ? `${assessment.pulse} /min` : null} />
                    <VitalRow label="Temperature" value={assessment.temperature ? `${assessment.temperature} \u00b0C` : null} />
                    <VitalRow label="SpO\u2082" value={assessment.spo2 != null ? `${assessment.spo2}%` : null} />
                    <VitalRow label="Respiratory Rate" value={assessment.respiratoryRate ? `${assessment.respiratoryRate} /min` : null} />
                  </div>
                  <div>
                    <VitalRow label="Height" value={assessment.heightCm ? `${assessment.heightCm} cm` : null} />
                    <VitalRow label="Weight" value={assessment.weightKg ? `${assessment.weightKg} kg` : null} />
                    <VitalRow label="BMI" value={assessment.bmi ? assessment.bmi.toFixed(1) : null} />
                  </div>
                </div>

                <h5 style={{ margin: '14px 0 8px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>Medical History</h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px' }}>
                  <CheckItem label="Diabetes" checked={assessment.diabetes} />
                  <CheckItem label="Hypertension" checked={assessment.hypertension} />
                  <CheckItem label="Asthma" checked={assessment.asthma} />
                  <CheckItem label="Heart Disease" checked={assessment.heartDisease} />
                  <CheckItem label="Kidney Disease" checked={assessment.kidneyDisease} />
                </div>

                <h5 style={{ margin: '14px 0 8px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>Additional Information</h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><span style={{ fontSize: 12, color: '#64748b' }}>Known Allergies</span><p style={{ margin: '2px 0', fontSize: 13, fontWeight: 500 }}>{assessment.knownAllergies || 'None'}</p></div>
                  <div><span style={{ fontSize: 12, color: '#64748b' }}>Current Medications</span><p style={{ margin: '2px 0', fontSize: 13, fontWeight: 500 }}>{assessment.currentMedications || 'None'}</p></div>
                  <div><span style={{ fontSize: 12, color: '#64748b' }}>Previous Surgeries</span><p style={{ margin: '2px 0', fontSize: 13, fontWeight: 500 }}>{assessment.previousSurgeries || 'None'}</p></div>
                  <div><span style={{ fontSize: 12, color: '#64748b' }}>Nurse Notes</span><p style={{ margin: '2px 0', fontSize: 13, fontWeight: 500 }}>{assessment.nurseNotes || '—'}</p></div>
                </div>

                <h5 style={{ margin: '14px 0 8px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>OT Readiness Checklist</h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2px 24px' }}>
                  <CheckItem label="Consent Obtained" checked={assessment.consentObtained} />
                  <CheckItem label="Lab Reports Available" checked={assessment.labReportsAvailable} />
                  <CheckItem label="Fasting Completed" checked={assessment.fastingCompleted} />
                  <CheckItem label="Blood Available" checked={assessment.bloodAvailable} />
                  <CheckItem label="Surgical Site Verified" checked={assessment.surgicalSiteVerified} />
                  <CheckItem label="Patient Identity Verified" checked={assessment.patientIdentityVerified} />
                </div>

                <h5 style={{ margin: '14px 0 8px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>Assessment Metadata</h5>
                <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
                  <div><span style={{ color: '#64748b' }}>Assessed By: </span><span style={{ fontWeight: 500 }}>{assessment.assessedBy?.name || '—'}</span></div>
                  <div><span style={{ color: '#64748b' }}>Date: </span><span style={{ fontWeight: 500 }}>{new Date(assessment.assessmentDate).toLocaleString('en-IN')}</span></div>
                  <div><span style={{ color: '#64748b' }}>Status: </span><span style={{ fontWeight: 500 }}>{assessment.status}</span></div>
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid #e2e8f0', textAlign: 'right', background: '#f8faff' }}>
          <button onClick={onClose} style={{ padding: '8px 24px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#475569' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovedForOT() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [detailItem, setDetailItem] = useState(null);
  const aliveRef = useRef(true);

  const fetchApproved = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await api.get('/receptionist/ot/approved', { params: { limit: 100 } });
      if (aliveRef.current) setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (err) {
      if (aliveRef.current) {
        setItems([]);
        setFetchError(err?.response?.data?.message || 'Failed to load approved patients');
      }
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    fetchApproved();
    return () => { aliveRef.current = false; };
  }, [fetchApproved]);

  useEffect(() => {
    const onFocus = () => fetchApproved();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchApproved]);

  return (
    <div style={{ padding: '18px 18px 26px', color: '#0f172a' }}>
 

      {fetchError ? (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{fetchError}</span>
          <button onClick={fetchApproved} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading...</div>
      ) : items.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #94a3b8', borderRadius: 16, padding: '40px 20px', textAlign: 'center' }}>
          <MdCheckCircle size={40} color="#94a3b8" style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>No approved patients</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
            Patients move here automatically after OT bill is generated
          </p>
          <button onClick={fetchApproved} style={{ marginTop: 12, height: 36, padding: '0 16px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#475569' }}>Refresh</button>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8faff', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>UHID</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Patient Name</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Age/Gender</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Diagnosis</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Surgery Type</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Doctor</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Bill Number</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Date</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>Total (₹)</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>Paid (₹)</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>Pending (₹)</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: '#64748b' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((req) => {
                const total = req.bill?.totalAmount ?? 0;
                const paid = req.bill?.paidAmount ?? 0;
                const pending = Math.max(0, total - paid);
                const fullyPaid = pending === 0;
                return (
                <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 500 }}>{req.uhid}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>{req.patient?.name || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#475569' }}>
                    {req.patient?.age != null ? `${req.patient.age}y` : '—'}
                    {req.patient?.gender ? ` / ${req.patient.gender}` : ''}
                  </td>
                  <td style={{ padding: '12px 14px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{req.diagnosis || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12 }}>{req.surgeryRecommendation}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12 }}>{req.doctor?.user?.name || '—'}</td>
                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12 }}>
                    {req.bill?.billNumber || '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#64748b' }}>
                    {req.billDate ? new Date(req.billDate).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>{total}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#15803d', fontWeight: 600, fontSize: 13 }}>{paid}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: pending > 0 ? '#b45309' : '#64748b', fontWeight: 600, fontSize: 13 }}>{pending}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                      background: fullyPaid ? 'rgba(21,128,61,0.10)' : 'rgba(245,158,11,0.12)',
                      color: fullyPaid ? '#15803d' : '#b45309',
                      border: fullyPaid ? '1px solid rgba(21,128,61,0.22)' : '1px solid rgba(245,158,11,0.28)',
                    }}>
                      {fullyPaid ? 'Approved · Fully Paid' : 'Approved · Payment Pending'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <button
                      onClick={() => setDetailItem(req)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '6px 14px', borderRadius: 8, border: '1px solid #cbd5e1',
                        background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                        color: '#1e40af', transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#93c5fd'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                    >
                      <MdVisibility size={15} /> View Details
                    </button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}

      {detailItem && <DetailModal item={detailItem} onClose={() => setDetailItem(null)} />}
    </div>
  );
}
