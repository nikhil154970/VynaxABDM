import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MdCheckCircle, MdExpandLess, MdExpandMore, MdLocalHospital } from 'react-icons/md';
import api from '../../utils/api';
import './PreAssessment.css';

const EMPTY_FORM = {
  surgeryRecommendation: '',
  diagnosis: '',
  priority: 'Normal',
  expectedSurgeryDate: '',
  bpSystolic: '',
  bpDiastolic: '',
  pulse: '',
  temperature: '',
  spo2: '',
  respiratoryRate: '',
  heightCm: '',
  weightKg: '',
  diabetes: false,
  hypertension: false,
  asthma: false,
  heartDisease: false,
  kidneyDisease: false,
  knownAllergies: '',
  currentMedications: '',
  previousSurgeries: '',
  nurseNotes: '',
  consentObtained: false,
  labReportsAvailable: false,
  fastingCompleted: false,
  bloodAvailable: false,
  surgicalSiteVerified: false,
  patientIdentityVerified: false,
};

function formatSurgeryLabel(value) {
  if (!value || value === 'Pending pre-assessment') return 'Pending';
  return value;
}

function defaultExpectedDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function computeBMI(height, weight) {
  if (!height || !weight || height <= 0) return null;
  const hM = height / 100;
  return Math.round((weight / (hM * hM)) * 10) / 10;
}

function AssessmentField({ label, val, type = 'text', inputMode, form, setField, ...rest }) {
  return (
    <div className="pre-assessment-field">
      <label>{label}</label>
      {type === 'checkbox' ? (
        <input
          type="checkbox"
          checked={!!form[val]}
          onChange={(e) => setField(val, e.target.checked)}
        />
      ) : (
        <input
          type={type}
          inputMode={inputMode}
          value={form[val] ?? ''}
          onChange={(e) => setField(val, e.target.value)}
          {...rest}
        />
      )}
    </div>
  );
}

export default function PreOperativeAssessment() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const expandedItem = items.find((item) => item.id === expandedId) || null;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/nurse/ot-requests', {
        params: { pendingAssessment: true, limit: 100 },
      });
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const otRequestId = location.state?.otRequestId;
    if (!otRequestId || items.length === 0) return;
    const match = items.find((item) => item.id === otRequestId);
    if (match) handleExpand(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, location.state?.otRequestId]);

  function handleExpand(item) {
    if (expandedId === item.id) {
      setExpandedId(null);
      setError('');
      return;
    }
    setExpandedId(item.id);
    setError('');
    setSuccessMsg('');
    setForm({
      ...EMPTY_FORM,
      surgeryRecommendation:
        item.surgeryRecommendation === 'Pending pre-assessment' ? '' : item.surgeryRecommendation || '',
      diagnosis: item.diagnosis || '',
      priority: item.priority || 'Normal',
      expectedSurgeryDate: item.expectedSurgeryDate
        ? String(item.expectedSurgeryDate).slice(0, 10)
        : defaultExpectedDate(),
    });
  }

  async function handleSubmit(otRequestId) {
    if (!form.surgeryRecommendation.trim()) {
      setError('Please enter surgery recommendation');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        surgeryRecommendation: form.surgeryRecommendation.trim(),
        diagnosis: form.diagnosis.trim() || undefined,
        priority: form.priority,
        expectedSurgeryDate: form.expectedSurgeryDate || defaultExpectedDate(),
      };
      if (payload.bpSystolic) payload.bpSystolic = parseInt(payload.bpSystolic, 10);
      if (payload.bpDiastolic) payload.bpDiastolic = parseInt(payload.bpDiastolic, 10);
      if (payload.pulse) payload.pulse = parseInt(payload.pulse, 10);
      if (payload.temperature) payload.temperature = parseFloat(payload.temperature);
      if (payload.spo2) payload.spo2 = parseInt(payload.spo2, 10);
      if (payload.respiratoryRate) payload.respiratoryRate = parseInt(payload.respiratoryRate, 10);
      if (payload.heightCm) payload.heightCm = parseInt(payload.heightCm, 10);
      if (payload.weightKg) payload.weightKg = parseInt(payload.weightKg, 10);
      const bmi = computeBMI(parseInt(payload.heightCm, 10), parseInt(payload.weightKg, 10));
      if (bmi) payload.bmi = bmi;

      const res = await api.post(`/assessment/ot-request/${otRequestId}`, payload);
      setSuccessMsg(res?.data?.message || 'Pre-assessment submitted. Patient sent to reception for OT billing.');
      setExpandedId(null);
      setForm(EMPTY_FORM);
      await fetchItems();
    } catch (err) {
      const apiErrors = err.response?.data?.errors;
      if (Array.isArray(apiErrors) && apiErrors.length > 0) {
        const fieldLabels = {
          bpSystolic: 'BP Systolic',
          bpDiastolic: 'BP Diastolic',
          pulse: 'Pulse',
          temperature: 'Temperature (°C)',
          spo2: 'SpO₂',
          respiratoryRate: 'Respiratory Rate',
          heightCm: 'Height',
          weightKg: 'Weight',
          bmi: 'BMI',
        };
        const detail = apiErrors
          .map((e) => `${fieldLabels[e.field] || e.field}: invalid value`)
          .join(' · ');
        setError(`Validation failed — ${detail}. Check ranges below.`);
      } else {
        setError(err.response?.data?.message || 'Failed to save assessment');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="pre-assessment-container">Loading...</div>;
  }

  return (
    <div className="pre-assessment-container">
  

      {successMsg && (
        <div className="pre-assessment-alert pre-assessment-alert-success" role="status">
          <MdCheckCircle size={16} />
          {successMsg}
        </div>
      )}

      {items.length === 0 ? (
        <div className="pre-assessment-empty">
          <MdLocalHospital size={40} color="#94a3b8" />
          <p className="pre-assessment-empty-title">No patients pending pre-assessment</p>
          <p className="pre-assessment-empty-sub">
            Assign a patient to OT from IPD → Assigned Patients. They will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="pre-assessment-table-wrap">
          <table className="pre-assessment-table">
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>UHID</th>
                <th>Ward / Bed</th>
                <th>Surgery</th>
                <th>Doctor</th>
                <th>Priority</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={[
                    'pre-assessment-row',
                    expandedId === item.id ? 'pre-assessment-row-active' : '',
                  ].join(' ')}
                  onClick={() => handleExpand(item)}
                >
                  <td className="pre-assessment-td-strong">{item.patient?.name || '—'}</td>
                  <td className="pre-assessment-td-mono">{item.uhid}</td>
                  <td>
                    {item.admission?.ward?.name || '—'}
                    {item.admission?.bedNumber ? ` / ${item.admission.bedNumber}` : ''}
                  </td>
                  <td>{formatSurgeryLabel(item.surgeryRecommendation)}</td>
                  <td>{item.doctor?.user?.name || '—'}</td>
                  <td>
                    <span
                      className={[
                        'pre-assessment-badge',
                        item.priority === 'Urgent'
                          ? 'pre-assessment-badge-urgent'
                          : 'pre-assessment-badge-normal',
                      ].join(' ')}
                    >
                      {item.priority || 'Normal'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', color: '#1e40af', fontWeight: 500, fontSize: 12 }}>
                    {expandedId === item.id ? (
                      <>
                        <MdExpandLess size={18} style={{ verticalAlign: 'middle' }} /> Close
                      </>
                    ) : (
                      <>
                        <MdExpandMore size={18} style={{ verticalAlign: 'middle' }} /> Fill Assessment
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {expandedItem && (
            <div className="pre-assessment-form-panel pre-assessment-form-outside">
              {error && (
                <div className="pre-assessment-alert pre-assessment-alert-error">{error}</div>
              )}

              <div className="pre-assessment-form-title">
                <strong>{expandedItem.patient?.name || 'Patient'}</strong>
                <span className="pre-assessment-td-mono"> · {expandedItem.uhid}</span>
              </div>

              <div className="pre-assessment-basic-grid">
                {[
                  ['Patient', expandedItem.patient?.name || '—'],
                  ['UHID', expandedItem.uhid || '—'],
                  ['Age / Gender', `${expandedItem.patient?.age ?? '—'} / ${expandedItem.patient?.gender || '—'}`],
                  ['Ward', expandedItem.admission?.ward?.name || '—'],
                  ['Bed', expandedItem.admission?.bedNumber || '—'],
                  ['Doctor', expandedItem.doctor?.user?.name || '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <b>{value}</b>
                  </div>
                ))}
              </div>

              <h4 className="pre-assessment-section-title">OT Details</h4>
              <div className="pre-assessment-field-grid">
                <AssessmentField form={form} setField={setField} label="Surgery Recommendation *" val="surgeryRecommendation" placeholder="Enter recommended surgery" />
                <AssessmentField form={form} setField={setField} label="Diagnosis" val="diagnosis" placeholder="Patient diagnosis" />
                <div className="pre-assessment-field">
                  <label>Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setField('priority', e.target.value)}
                    className="pre-assessment-select"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <AssessmentField form={form} setField={setField} label="Expected Surgery Date" val="expectedSurgeryDate" type="date" />
              </div>

              <h4 className="pre-assessment-section-title">Vital Signs</h4>
              <p className="pre-assessment-vitals-hint">
                Temperature in °C (30–45). SpO₂ max 100%. Height realistic cm (e.g. 165) — wrong height breaks BMI.
              </p>
              <div className="pre-assessment-vitals-grid">
                <AssessmentField form={form} setField={setField} label="BP Systolic (mmHg)" val="bpSystolic" type="text" inputMode="numeric" placeholder="120" />
                <AssessmentField form={form} setField={setField} label="BP Diastolic (mmHg)" val="bpDiastolic" type="text" inputMode="numeric" placeholder="80" />
                <AssessmentField form={form} setField={setField} label="Pulse (/min)" val="pulse" type="text" inputMode="numeric" placeholder="72" />
                <AssessmentField form={form} setField={setField} label="Temperature (°C)" val="temperature" type="text" inputMode="decimal" placeholder="36.6" />
                <AssessmentField form={form} setField={setField} label="SpO₂ (%)" val="spo2" type="text" inputMode="numeric" placeholder="98" />
                <AssessmentField form={form} setField={setField} label="Respiratory Rate (/min)" val="respiratoryRate" type="text" inputMode="numeric" placeholder="18" />
                <AssessmentField form={form} setField={setField} label="Height (cm)" val="heightCm" type="text" inputMode="numeric" placeholder="170" />
                <AssessmentField form={form} setField={setField} label="Weight (kg)" val="weightKg" type="text" inputMode="numeric" placeholder="65" />
                <div className="pre-assessment-field">
                  <label>BMI</label>
                  <div className="pre-assessment-bmi-value">
                    {computeBMI(parseInt(form.heightCm, 10), parseInt(form.weightKg, 10)) || 'Auto'}
                  </div>
                </div>
              </div>

              <h4 className="pre-assessment-section-title">Medical History</h4>
              <div className="pre-assessment-field-grid pre-assessment-field-grid-5">
                <AssessmentField form={form} setField={setField} label="Diabetes" val="diabetes" type="checkbox" />
                <AssessmentField form={form} setField={setField} label="Hypertension" val="hypertension" type="checkbox" />
                <AssessmentField form={form} setField={setField} label="Asthma" val="asthma" type="checkbox" />
                <AssessmentField form={form} setField={setField} label="Heart Disease" val="heartDisease" type="checkbox" />
                <AssessmentField form={form} setField={setField} label="Kidney Disease" val="kidneyDisease" type="checkbox" />
              </div>

              <h4 className="pre-assessment-section-title">Additional Information</h4>
              <div className="pre-assessment-field-grid pre-assessment-field-grid-2">
                <div className="pre-assessment-field">
                  <label>Known Allergies</label>
                  <textarea value={form.knownAllergies} onChange={(e) => setField('knownAllergies', e.target.value)} />
                </div>
                <div className="pre-assessment-field">
                  <label>Current Medications</label>
                  <textarea value={form.currentMedications} onChange={(e) => setField('currentMedications', e.target.value)} />
                </div>
                <div className="pre-assessment-field">
                  <label>Previous Surgeries</label>
                  <textarea value={form.previousSurgeries} onChange={(e) => setField('previousSurgeries', e.target.value)} />
                </div>
                <div className="pre-assessment-field">
                  <label>Nurse Notes</label>
                  <textarea value={form.nurseNotes} onChange={(e) => setField('nurseNotes', e.target.value)} />
                </div>
              </div>

              <h4 className="pre-assessment-section-title">OT Readiness Checklist</h4>
              <div className="pre-assessment-field-grid">
                <AssessmentField form={form} setField={setField} label="Consent Obtained" val="consentObtained" type="checkbox" />
                <AssessmentField form={form} setField={setField} label="Lab Reports Available" val="labReportsAvailable" type="checkbox" />
                <AssessmentField form={form} setField={setField} label="Fasting Completed" val="fastingCompleted" type="checkbox" />
                <AssessmentField form={form} setField={setField} label="Blood Available" val="bloodAvailable" type="checkbox" />
                <AssessmentField form={form} setField={setField} label="Surgical Site Verified" val="surgicalSiteVerified" type="checkbox" />
                <AssessmentField form={form} setField={setField} label="Patient Identity Verified" val="patientIdentityVerified" type="checkbox" />
              </div>

              <div className="pre-assessment-actions">
                <button type="button" className="pre-assessment-btn pre-assessment-btn-secondary" onClick={() => setExpandedId(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="pre-assessment-btn pre-assessment-btn-primary"
                  onClick={() => handleSubmit(expandedItem.id)}
                  disabled={saving}
                >
                  {saving ? 'Submitting...' : 'Submit & Send to Reception'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
