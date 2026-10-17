import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../../../utils/api';
import { printDischargeByType, dischargeTypeLabel } from '../../../utils/dischargePrint';
import LamaDischargeForm from './LamaDischargeForm';
import DeathCertificateForm from './DeathCertificateForm';
import {
  DISCHARGE_TYPES,
  CLINICAL_EXAM_FIELDS,
  TREATMENT_CHECKLIST_ITEMS,
  defaultTreatmentChecklist,
  defaultConditionFlags,
  defaultPastHistoryFlags,
  PAST_HISTORY_ITEMS,
  mergeSummary,
  ensureDischargeSubForms,
  toDateInputValue,
  resolveAdmissionDateTime,
} from './dischargeFormBuilders';
import './DischargeSummaryEditor.css';

function buildLineItemsFromClearances(clearances) {
  if (!clearances) return [];
  const cleared = Array.isArray(clearances.clearedBills) ? clearances.clearedBills : [];
  const blocking = Array.isArray(clearances.blockingBills) ? clearances.blockingBills : [];
  if (cleared.length === 0 && blocking.length === 0) return [];
  const lineItems = [];
  let n = 0;
  for (const bill of [...cleared, ...blocking]) {
    n += 1;
    const label =
      bill.billNumber != null && String(bill.billNumber).trim() !== ''
        ? String(bill.billNumber).trim()
        : `— (${n})`;
    lineItems.push({
      category: 'Bill',
      description: `Bill ${label}${bill.visitType ? ` · ${bill.visitType}` : ''}`,
      amount: Math.max(0, Number(bill.totalAmount) || 0),
    });
  }
  return lineItems;
}

function wardLineFromAdmission(ward) {
  if (!ward) return '—';
  const t = String(ward.type || '').toUpperCase();
  const cat = t === 'ICU' ? 'ICU' : t === 'PRIVATE' ? 'Private' : 'General';
  const name = String(ward.name || '').trim();
  return name ? `${name} (${cat})` : cat;
}

/** Discharged admissions cannot call discharge-clearances (API returns "already closed"). */
function buildClearancesForClosedAdmission(adm, historyMeta = {}) {
  const pending = Math.max(0, Number(historyMeta.billingSummary?.pending) || 0);
  const total = Math.max(0, Number(historyMeta.billingSummary?.total) || 0);
  const paid = Math.max(0, Number(historyMeta.billingSummary?.paid) || total - pending);
  return {
    admissionId: adm?.id,
    patient: adm?.patient,
    ward: historyMeta.ward || wardLineFromAdmission(adm?.ward),
    bed: historyMeta.bed || adm?.bed?.code || '—',
    doctor: historyMeta.doctor || adm?.doctor?.user?.name || '—',
    nursingClearance: true,
    billingClearance: pending === 0,
    labClearance: true,
    allClear: pending === 0,
    clearedBills: [],
    blockingBills: [],
    totalPatientBillingPending: pending,
    mayDischargeWithBillingDues: pending > 0,
    billingSnapshot: { total, paid, pending },
  };
}

function billingTotalsFromClearances(clearances) {
  if (clearances?.billingSnapshot) {
    const b = clearances.billingSnapshot;
    return { total: b.total, paid: b.paid, pending: b.pending };
  }
  if (!clearances) return { total: 0, paid: 0, pending: 0 };
  const pendingApi = Math.max(0, Number(clearances.totalPatientBillingPending) || 0);
  let total = 0;
  let paid = 0;
  const billRows = [
    ...(Array.isArray(clearances.clearedBills) ? clearances.clearedBills : []),
    ...(Array.isArray(clearances.blockingBills) ? clearances.blockingBills : []),
  ];
  const seen = new Set();
  for (const b of billRows) {
    const key = b?.id != null ? String(b.id) : String(b?.billNumber || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    total += Math.max(0, Number(b.totalAmount) || 0);
    paid += Math.max(0, Number(b.paidAmount) || 0);
  }
  const pending = pendingApi > 0 ? pendingApi : Math.max(0, total - paid);
  return { total: total > 0 ? total : paid + pending, paid, pending };
}

function safeText(v) {
  const s = v == null ? '' : String(v);
  return s;
}
function fmtDateTimeForInput(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  // datetime-local expects: YYYY-MM-DDTHH:mm
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fmtDateTimeLabel(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLines(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return [];
}

function loadCachedSummary(id) {
  try {
    const raw = sessionStorage.getItem(`dse:${encodeURIComponent(id)}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.summary && typeof parsed.summary === 'object' ? parsed.summary : null;
  } catch {
    return null;
  }
}

function persistSummaryCache(id, summary) {
  sessionStorage.setItem(
    `dse:${encodeURIComponent(id)}`,
    JSON.stringify({ id, savedAt: new Date().toISOString(), summary }),
  );
}

function mergePatientFromRegistration(admPatient, reg) {
  if (!reg || typeof reg !== 'object') return { ...(admPatient || {}) };
  const p = { ...(admPatient || {}) };
  p.name = p.name || reg.name || '';
  if (p.age == null || p.age === '') p.age = reg.age ?? p.age;
  p.gender = p.gender || reg.gender || '';
  p.mobile = p.mobile || reg.phone || reg.mobile || '';
  p.address = p.address || reg.address || '';
  p.bloodGroup = p.bloodGroup || reg.bloodGroup || '';
  p.allergies = p.allergies || reg.allergies || '';
  p.emergencyName = p.emergencyName || reg.emergencyName || '';
  return p;
}

function buildInitialSummary({
  admission,
  dischargeRequestedAt,
  patient,
  doctor,
  ward,
  bed,
  billing,
  labs,
  prescriptions,
  medicines,
  treatmentNotes,
  prescriptionsText,
  investigations,
  clearances,
}) {
  const p = patient || {};
  const resolvedAdmission = resolveAdmissionDateTime(admission);
  const admissionDateTime = resolvedAdmission || null;
  const dischargeDateTime = admission?.dischargeDate || admission?.dischargedAt || null;

  const medList = medicines || [];

  const labList = labs || [];
  const invList = investigations || [];

  const presText = prescriptionsText || prescriptions || '';

  const treatingDoctor = doctor?.name || admission?.doctor?.user?.name || '';
  const consultantDoctor = doctor?.name || admission?.doctor?.user?.name || '';

  const department = admission?.department || ward?.department || '';

  const wardLineFromClr =
    clearances && (clearances.ward || clearances.bed)
      ? `${safeText(clearances.ward)}${clearances.bed ? ` / ${safeText(clearances.bed)}` : ''}`
      : '';

  const wardBedLegacy =
    ward && bed && (ward.name || ward.code)
      ? `${safeText(ward.name || ward.code)} / ${safeText(bed.code || '')}`
      : ward && (ward.name || ward.code)
        ? safeText(ward.name || ward.code)
        : '';

  const wardBedNo =
    wardLineFromClr ||
    wardBedLegacy ||
    safeText(bed?.code || admission?.bed?.code || '');

  return {
    dischargeType: 'normal',
    uhidNo: safeText(p.uhid || ''),
    ipdNo: safeText(admission?.ipdNumber || admission?.ipd || admission?.id || ''),
    admissionDateTime: admissionDateTime ? fmtDateTimeForInput(admissionDateTime) : '',
    admissionDateTimeIso: admissionDateTime ? new Date(admissionDateTime).toISOString() : '',
    dischargeDateTime: dischargeDateTime ? fmtDateTimeForInput(dischargeDateTime) : '',

    department: safeText(department || ''),
    wardBedNo: safeText(wardBedNo || ''),

    consultantDoctor: safeText(consultantDoctor || ''),
    treatingTeam: safeText(admission?.treatingTeam || doctor?.team || admission?.doctor?.user?.name || ''),

    patientInformation: {
      patientName: safeText(p.name || ''),
      age: safeText(p.age ?? p.patientAge ?? ''),
      gender: safeText(p.gender ?? ''),
      mobile: safeText(p.mobile || ''),
      bloodGroup: safeText(p.bloodGroup || ''),
      allergies: safeText(p.allergies || ''),
      address: safeText(p.address || ''),
    },

    attendantName: safeText(p.emergencyName || admission?.emergencyName || ''),
    occupation: safeText(p.occupation || ''),
    maritalStatus: safeText(p.maritalStatus || ''),

    treatmentChecklist: defaultTreatmentChecklist(),
    conditionFlags: defaultConditionFlags(),

    followUpDate: safeText(''),
    followUpTime: safeText(''),
    followUpPlace: safeText(''),

    finalDiagnosis: safeText(admission?.finalDiagnosis || admission?.notesText || admission?.clinicalConditionText || ''),
    chiefComplaints: safeText(admission?.chiefComplaints || admission?.symptoms || ''),
    historyOfPresentIllness: safeText(admission?.hpi || admission?.historyOfPresentIllness || ''),
    pastHistory: safeText(admission?.pastHistory || ''),
    pastHistoryFlags: defaultPastHistoryFlags(),
    pastHistoryDetails: safeText(admission?.pastHistory || ''),
    clinicalExamination: '',
    clinicalExamAtAdmission: null,
    investigationRows: null,
    investigations: {
      investigationText: safeText(
        investigations?.map
          ? investigations
              .map((x) => `${x.name || x.testName || ''}: ${x.value || x.result || ''}`.trim())
              .filter(Boolean)
              .join('\n')
          : '',
      ),
    },

    courseDuringHospitalStay: safeText(treatmentNotes?.courseDuringHospitalStay || ''),

    treatmentGiven: safeText(treatmentNotes?.treatmentGiven || ''),

    surgicalProcedure: safeText(treatmentNotes?.surgicalProcedure || ''),
    surgicalProcedureName: safeText(''),
    dateOfSurgery: safeText(''),
    anaesthesiaType: safeText(''),
    operativeFindings: safeText(treatmentNotes?.surgicalProcedure || ''),

    conditionAtDischarge: safeText(admission?.conditionAtDischarge || 'Stable / As per clinical record'),

    dischargeMedications: Array.isArray(medList)
      ? medList.map((m) => ({
          medicine: safeText(m.medicine || m.name || ''),
          dosage: safeText(m.dosage || ''),
          duration: safeText(m.duration || ''),
          mode: safeText(m.mode || ''),
          frequency: safeText(m.frequency || ''),
        }))
      : [],

    dischargeAdvice: safeText(admission?.dischargeAdvice || ''),
    followUpDetails: safeText(admission?.followUpDetails || ''),

    declaration: {
      patientDeclaration: safeText(admission?.declaration?.patientDeclaration || ''),
      doctorDeclaration: safeText(admission?.declaration?.doctorDeclaration || ''),
      date: safeText(dischargeRequestedAt ? fmtDateTimeLabel(dischargeRequestedAt) : fmtDateTimeLabel(new Date().toISOString())),
    },

    signatures: {
      patientSignature: safeText(admission?.signatures?.patientSignature || ''),
      doctorSignature: safeText(admission?.signatures?.doctorSignature || ''),
      hospitalStamp: safeText(admission?.signatures?.hospitalStamp || ''),
    },

    rawPrescriptionText: safeText(presText || ''),
    rawInvestigationList: invList,
    rawLabList: labList,
    ipdSummaryNotesText: safeText(admission?.notesText || ''),
  };
}

function SectionTitle({ children }) {
  return <h3 className="dse-sectionTitle">{children}</h3>;
}

function ChecklistField({ label, checked, onChange }) {
  return (
    <label className="dse-checkItem">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Field({ label, children }) {
  return (
    <label className="dse-field">
      <div className="dse-label">{label}</div>
      {children}
    </label>
  );
}

function TextArea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      className="dse-textarea"
      value={value ?? ''}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      className="dse-input"
      value={value ?? ''}
      type={type}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function DischargeSummaryEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const editFromHistory = Boolean(location.state?.editSummary);
  const dischargeWithDuesFromState = Boolean(location.state?.dischargeWithDues);
  const historySummaryFromState = location.state?.dischargeSummary;
  const historyMetaFromState = location.state?.historyMeta;

  const [loading, setLoading] = useState(true);
  const [isAlreadyDischarged, setIsAlreadyDischarged] = useState(false);
  const [pendingFinalize, setPendingFinalize] = useState(false);
  const [err, setErr] = useState('');
  const [admissionData, setAdmissionData] = useState(null);
  const [summary, setSummary] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [saveOk, setSaveOk] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr('');
    setSaveErr('');
    setSaveOk('');
    try {
      const admRes = await api.get(`/receptionist/ipd/admissions/${encodeURIComponent(id)}`);
      const adm = admRes?.data?.admission;
      if (!adm) throw new Error('Could not load admission');

      const alreadyOut = Boolean(adm.dischargeDate);
      let clr = null;
      if (!alreadyOut) {
        const clrRes = await api.get(
          `/receptionist/ipd/admissions/${encodeURIComponent(id)}/discharge-clearances`,
        );
        clr = clrRes?.data;
        if (!clr) throw new Error('Could not load discharge clearances');
      } else {
        clr = buildClearancesForClosedAdmission(adm, historyMetaFromState || {});
      }

      let patient = adm.patient || {};
      const uhidForDetails = patient.uhid;
      if (uhidForDetails) {
        try {
          const dRes = await api.get(`/receptionist/patients/${encodeURIComponent(uhidForDetails)}/details`);
          patient = mergePatientFromRegistration(patient, dRes.data);
        } catch {
          /* registration details optional */
        }
      }

      const doctor = adm.doctor || {};
      const ward = adm.ward || {};
      const bed = adm.bed || {};
      const billing = adm.billing || {};

      setAdmissionData({ admission: adm, clearances: clr, patient, doctor, ward, bed, billing });

      const canFinalize =
        !alreadyOut && String(adm.status || '').toUpperCase() === 'DISCHARGE_REQUESTED';
      setIsAlreadyDischarged(alreadyOut);
      setPendingFinalize(canFinalize);

      let initial = buildInitialSummary({
        admission: adm,
        dischargeRequestedAt: adm.dischargeRequestedAt,
        patient,
        doctor: adm.doctor || {},
        ward: adm.ward || {},
        bed: adm.bed || {},
        billing,
        labs: [],
        prescriptions: [],
        medicines: Array.isArray(adm?.treatmentPlan?.medicines) ? adm.treatmentPlan.medicines : [],
        treatmentNotes: {
          courseDuringHospitalStay: '',
          treatmentGiven: '',
          surgicalProcedure: '',
        },
        prescriptionsText: '',
        investigations: [],
        clearances: clr,
      });

      const cached = loadCachedSummary(id);
      if (cached) initial = mergeSummary(initial, cached);
      if (adm.dischargeSummaryData && typeof adm.dischargeSummaryData === 'object') {
        initial = mergeSummary(initial, adm.dischargeSummaryData);
      }
      if (historySummaryFromState && typeof historySummaryFromState === 'object') {
        initial = mergeSummary(initial, historySummaryFromState);
      }
      let labReports = [];
      const patientUuid = patient.id || adm.patient?.id;
      if (patientUuid) {
        try {
          const lr = await api.get(`/patients/${encodeURIComponent(patientUuid)}/lab-reports`);
          labReports = Array.isArray(lr?.data?.items) ? lr.data.items : [];
        } catch {
          /* optional */
        }
      }

      initial = ensureDischargeSubForms(initial, {
        admission: adm,
        patient,
        clearances: clr,
        doctor: adm.doctor || {},
        summary: initial,
        vitals: adm.vitalsLatest || null,
        treatmentPlan: adm.treatmentPlan || null,
        labReports,
      });
      const admResolved = resolveAdmissionDateTime(adm);
      if (admResolved && !Number.isNaN(admResolved.getTime())) {
        initial = {
          ...initial,
          admissionDateTime: fmtDateTimeForInput(admResolved),
          admissionDateTimeIso: admResolved.toISOString(),
        };
      }
      setSummary(initial);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Could not load discharge summary editor');
      setAdmissionData(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [id, historySummaryFromState, historyMetaFromState]);

  useEffect(() => {
    load();
  }, [load]);

  const updateSummary = (patch) => {
    setSummary((prev) => ({ ...(prev || {}), ...(patch || {}) }));
  };

  const updatePatientInfo = (patch) => {
    setSummary((prev) => ({
      ...(prev || {}),
      patientInformation: {
        ...(prev?.patientInformation || {}),
        ...(patch || {}),
      },
    }));
  };

  const billingForPrint = useMemo(() => {
    const b = billingTotalsFromClearances(admissionData?.clearances);
    return { total: b.total, paid: b.paid, pending: b.pending };
  }, [admissionData?.clearances]);

  const runPrint = useCallback(
    async (opts = {}) => {
      if (!summary) return false;
      const type = String(summary.dischargeType || 'normal').toLowerCase();

      if (type === 'lama' || type === 'death') {
        return printDischargeByType({
          summary,
          billing: billingForPrint,
          admission: admissionData?.admission || null,
        });
      }

      let printWindow = opts.printWindow || null;
      if (printWindow && printWindow.closed) printWindow = null;

      let billing = billingForPrint;
      let admission = admissionData?.admission || null;
      if (id) {
        try {
          const [clrRes, admRes] = await Promise.all([
            api.get(`/receptionist/ipd/admissions/${encodeURIComponent(id)}/discharge-clearances`),
            api.get(`/receptionist/ipd/admissions/${encodeURIComponent(id)}`),
          ]);
          billing = billingTotalsFromClearances(clrRes?.data);
          admission = admRes?.data?.admission || admission;
        } catch {
          /* use cached data */
        }
      }

      return printDischargeByType({ summary, billing, admission, printWindow });
    },
    [summary, billingForPrint, id, admissionData?.admission],
  );

  const setDischargeType = (type) => {
    if (!summary || !admissionData) return;
    const ctx = {
      admission: admissionData.admission,
      patient: admissionData.patient,
      clearances: admissionData.clearances,
      doctor: admissionData.doctor,
      vitals: admissionData.admission?.vitalsLatest || null,
      treatmentPlan: admissionData.admission?.treatmentPlan || null,
      summary,
    };
    setSummary((prev) => ensureDischargeSubForms({ ...prev, dischargeType: type }, { ...ctx, summary: prev }));
  };

  const dischargeType = summary?.dischargeType || 'normal';

  const completeDischarge = useCallback(
    async (withPrint) => {
      if (!summary || !id) return;
      const dischargeWithDues = dischargeWithDuesFromState;
      await api.post(`/receptionist/ipd/discharge/${encodeURIComponent(id)}`, {
        dischargeWithDues,
        dischargeSummary: summary,
      });
      persistSummaryCache(id, summary);
      if (withPrint) {
        window.setTimeout(() => runPrint(), 200);
      }
      navigate('/dashboard/reception/ipd/discharge/history', {
        replace: true,
        state: { message: 'Patient discharged successfully.' },
      });
    },
    [summary, id, dischargeWithDuesFromState, navigate, runPrint],
  );

  const onSave = async () => {
    setSaveErr('');
    setSaveOk('');
    if (!summary || !id || !admissionData) return;

    try {
      setSaving(true);
      persistSummaryCache(id, summary);

      if (pendingFinalize) {
        await completeDischarge(false);
        return;
      }

      if (isAlreadyDischarged) {
        await api.put(`/receptionist/ipd/admissions/${encodeURIComponent(id)}/discharge-summary`, {
          dischargeSummary: summary,
        });
        setSaveOk('Summary updated.');
        return;
      }

      setSaveOk('Summary saved.');
      navigate(`/dashboard/reception/ipd/discharge/process/${encodeURIComponent(id)}`, {
        state: {
          patient: {
            id,
            patientId: admissionData?.patient?.id || '',
            name: admissionData?.patient?.name || summary?.patientInformation?.patientName || '',
            uhid: summary?.uhidNo || admissionData?.patient?.uhid || '',
            ward: admissionData?.clearances?.ward || admissionData?.ward?.name || '',
            bed: admissionData?.clearances?.bed || admissionData?.bed?.code || '',
            doctor: admissionData?.doctor?.user?.name || admissionData?.doctor?.name || '',
          },
        },
      });
    } catch (e) {
      setSaveErr(e?.response?.data?.message || e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onPrint = async () => {
    setSaveErr('');
    setSaveOk('');
    if (!summary || !id) return;

    const type = String(summary.dischargeType || 'normal').toLowerCase();
    const printWindow =
      type === 'normal' ? window.open('', '_blank', 'width=1100,height=1100') : null;
    if (type === 'normal' && !printWindow) {
      setSaveErr('Print nahi khuli — browser popups allow karein (site settings).');
      return;
    }
    try {
      setSaving(true);
      persistSummaryCache(id, summary);

      if (pendingFinalize) {
        const ok = await runPrint({ printWindow });
        if (!ok) throw new Error('Print window could not open.');
        setSaveOk('Sent to print. Discharge ke liye Save button use karein.');
        return;
      }

      const ok = await runPrint({ printWindow });
      if (!ok) throw new Error('Print window could not open.');

      if (isAlreadyDischarged) {
        await api.put(`/receptionist/ipd/admissions/${encodeURIComponent(id)}/discharge-summary`, {
          dischargeSummary: summary,
        });
        setSaveOk('Printed & summary saved.');
        return;
      }

      setSaveOk('Sent to print.');
    } catch (e) {
      if (printWindow && !printWindow.closed) {
        try {
          printWindow.close();
        } catch {
          /* ignore */
        }
      }
      setSaveErr(e?.response?.data?.message || e?.message || 'Print failed');
    } finally {
      setSaving(false);
    }
  };

  const billTotals = useMemo(() => {
    const clr = admissionData?.clearances;
    if (!clr) return { total: 0, paid: 0, pending: 0 };
    const pendingApi = Math.max(0, Number(clr.totalPatientBillingPending) || 0);
    let total = 0;
    let paid = 0;
    const billRows = [
      ...(Array.isArray(clr.clearedBills) ? clr.clearedBills : []),
      ...(Array.isArray(clr.blockingBills) ? clr.blockingBills : []),
    ];
    const seen = new Set();
    for (const b of billRows) {
      const key = b?.id != null ? String(b.id) : String(b?.billNumber || '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      total += Math.max(0, Number(b.totalAmount) || 0);
      paid += Math.max(0, Number(b.paidAmount) || 0);
    }
    const pending = pendingApi > 0 ? pendingApi : Math.max(0, total - paid);
    return {
      total: total > 0 ? total : paid + pending,
      paid,
      pending,
    };
  }, [admissionData?.clearances]);

  const { total: billTotal, paid: billPaid, pending: billPending } = billTotals;

  if (loading) {
    return (
      <div className="dse-root">
        <div className="dse-shell">
          <p className="dse-muted" style={{ padding: 24 }}>Loading discharge summary editor…</p>
        </div>
      </div>
    );
  }

  if (err || !summary || !admissionData) {
    return (
      <div className="dse-root">
        <div className="dse-shell">
          <button type="button" className="dse-back" onClick={() => navigate(-1)}>← Back</button>
          <div className="dse-alert" role="alert">{err || 'Unable to open editor.'}</div>
        </div>
      </div>
    );
  }

  const meds = Array.isArray(summary?.dischargeMedications) ? summary.dischargeMedications : [];

  return (
    <div className="dse-root">
      <div className="dse-shell">
        <button
          type="button"
          className="dse-back"
          onClick={() =>
            navigate(
              editFromHistory
                ? '/dashboard/reception/ipd/discharge/history'
                : `/dashboard/reception/ipd/discharge/process/${encodeURIComponent(id)}`,
            )
          }
        >
          {editFromHistory ? '← Back to discharge history' : '← Back to discharge review'}
        </button>

        <header className="dse-hero">
          <div>
            <p className="dse-stepHint">Step 3 of 3 · Discharge summary form</p>
            <h1 className="dse-heroTitle">Discharge form</h1>
            <p className="dse-heroSub">
              {isAlreadyDischarged ? (
                <>
                  Editing saved discharge summary — <strong>{dischargeTypeLabel(dischargeType)}</strong>. Save to
                  update record.
                </>
              ) : (
                <>
                  Type: <strong>{dischargeTypeLabel(dischargeType)}</strong> — saved with this discharge record.
                </>
              )}
            </p>
            <div className="dse-row" style={{ marginTop: 8 }}>
              <span className="dse-pill"><strong>{summary?.patientInformation?.patientName || '—'}</strong></span>
              <span className="dse-pill dse-pill-mono">UHID: {summary?.uhidNo || '—'}</span>
              <span className="dse-pill">IPD: {summary?.ipdNo || '—'}</span>
            </div>
          </div>
          <div className="dse-actions dse-actions--withFilters">
            <div className="dse-typeFilters" role="group" aria-label="Discharge type">
              {DISCHARGE_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`dse-typeBtn ${dischargeType === t.id ? 'dse-typeBtn--active' : ''}`}
                  disabled={saving}
                  onClick={() => setDischargeType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button type="button" className="dse-btn" disabled={saving} onClick={onPrint}>
              Print
            </button>
          </div>
        </header>

        {saveOk ? <div className="dse-ok">{saveOk}</div> : null}
        {saveErr ? <div className="dse-alert" role="alert">{saveErr}</div> : null}

        {dischargeType === 'lama' ? (
          <LamaDischargeForm
            lama={summary.lamaForm}
            onChange={(lamaForm) => updateSummary({ lamaForm })}
          />
        ) : null}

        {dischargeType === 'death' ? (
          <DeathCertificateForm
            deathForm={summary.deathForm}
            onChange={(deathForm) => updateSummary({ deathForm })}
          />
        ) : null}

        {dischargeType === 'normal' ? (
        <div className="dse-grid">
          <section className="dse-card">
            <SectionTitle>Basic Details</SectionTitle>
            <div className="dse-twoCol">
              <Field label="UHID No.">
                <Input value={summary.uhidNo} onChange={(v) => updateSummary({ uhidNo: v })} />
              </Field>
              <Field label="IPD No.">
                <Input value={summary.ipdNo} onChange={(v) => updateSummary({ ipdNo: v })} />
              </Field>

              <Field label="Admission Date & Time">
                <Input
                  type="datetime-local"
                  value={summary.admissionDateTime}
                  onChange={(v) =>
                    updateSummary({
                      admissionDateTime: v,
                      admissionDateTimeIso: v ? new Date(v).toISOString() : '',
                    })
                  }
                />
              
              </Field>
              <Field label="Discharge Date & Time (form record)">
                <Input
                  type="datetime-local"
                  value={summary.dischargeDateTime}
                  onChange={(v) => updateSummary({ dischargeDateTime: v })}
                />
             
              </Field>

              <Field label="Department">
                <Input value={summary.department} onChange={(v) => updateSummary({ department: v })} />
              </Field>
              <Field label="Ward/Bed No.">
                <Input value={summary.wardBedNo} onChange={(v) => updateSummary({ wardBedNo: v })} />
              </Field>

              <Field label="Consultant Doctor">
                <Input value={summary.consultantDoctor} onChange={(v) => updateSummary({ consultantDoctor: v })} />
              </Field>
              <Field label="Treating Team">
                <Input value={summary.treatingTeam} onChange={(v) => updateSummary({ treatingTeam: v })} />
              </Field>
            </div>
          </section>

          <section className="dse-card">
            <SectionTitle>Patient Information</SectionTitle>
            <div className="dse-twoCol">
              <Field label="Patient Name">
                <Input
                  value={summary.patientInformation.patientName}
                  onChange={(v) => updatePatientInfo({ patientName: v })}
                />
              </Field>
              <Field label="Age">
                <Input value={summary.patientInformation.age} onChange={(v) => updatePatientInfo({ age: v })} />
              </Field>

              <Field label="Gender">
                <Input value={summary.patientInformation.gender} onChange={(v) => updatePatientInfo({ gender: v })} />
              </Field>
              <Field label="Mobile">
                <Input value={summary.patientInformation.mobile} onChange={(v) => updatePatientInfo({ mobile: v })} />
              </Field>

              <Field label="Blood Group">
                <Input
                  value={summary.patientInformation.bloodGroup}
                  onChange={(v) => updatePatientInfo({ bloodGroup: v })}
                />
              </Field>
              <Field label="Allergies">
                <Input
                  value={summary.patientInformation.allergies}
                  onChange={(v) => updatePatientInfo({ allergies: v })}
                />
              </Field>

              <Field label="Address / Notes">
                <Input value={summary.patientInformation.address} onChange={(v) => updatePatientInfo({ address: v })} />
              </Field>

              <Field label="Relative / Attendant Name">
                <Input value={summary.attendantName} onChange={(v) => updateSummary({ attendantName: v })} />
              </Field>

              <Field label="Occupation">
                <Input value={summary.occupation} onChange={(v) => updateSummary({ occupation: v })} />
              </Field>

              <Field label="Marital Status">
                <Input value={summary.maritalStatus} onChange={(v) => updateSummary({ maritalStatus: v })} />
              </Field>
            </div>
          </section>

          <section className="dse-card dse-card--full">
            <SectionTitle>Diagnosis & Clinical History</SectionTitle>
            <div className="dse-twoCol">
              <Field label="Final Diagnosis">
                <TextArea value={summary.finalDiagnosis} onChange={(v) => updateSummary({ finalDiagnosis: v })} rows={4} />
              </Field>
              <Field label="Chief Complaints">
                <TextArea value={summary.chiefComplaints} onChange={(v) => updateSummary({ chiefComplaints: v })} rows={4} />
              </Field>
              <Field label="History of Present Illness">
                <TextArea
                  value={summary.historyOfPresentIllness}
                  onChange={(v) => updateSummary({ historyOfPresentIllness: v })}
                  rows={4}
                />
              </Field>
              <div className="dse-field">
                <div className="dse-label">Past history</div>
                <div className="dse-pastHistory">
                  {PAST_HISTORY_ITEMS.map((item) => {
                    const val = summary.pastHistoryFlags?.[item.key];
                    return (
                      <div key={item.key} className="dse-pastRow">
                        <span className="dse-pastLabel">{item.label}</span>
                        <label className="dse-pastChoice">
                          <input
                            type="checkbox"
                            checked={val === true}
                            onChange={() =>
                              setSummary((prev) => ({
                                ...(prev || {}),
                                pastHistoryFlags: {
                                  ...(prev?.pastHistoryFlags || defaultPastHistoryFlags()),
                                  [item.key]: true,
                                },
                              }))
                            }
                          />
                        </label>
                        <label className="dse-pastChoice dse-pastChoice--no">
                          <input
                            type="checkbox"
                            checked={val === false}
                            onChange={() =>
                              setSummary((prev) => ({
                                ...(prev || {}),
                                pastHistoryFlags: {
                                  ...(prev?.pastHistoryFlags || defaultPastHistoryFlags()),
                                  [item.key]: false,
                                },
                              }))
                            }
                          />
                          <span>No</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
                <Field label="Details (if any)">
                  <Input
                    value={summary.pastHistoryDetails ?? ''}
                    onChange={(v) => updateSummary({ pastHistoryDetails: v })}
                    placeholder="Extra details…"
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="dse-card dse-card--pair">
            <div className="dse-pairGrid">
              <div>
                <SectionTitle>Clinical examination at admission</SectionTitle>
                {admissionData?.admission?.vitalsLatest ? (
                  <p className="dse-printHint" style={{ margin: '0 0 8px' }}>
                    Auto-filled from nurse&apos;s last saved vitals (BP, pulse, temp, SpO₂). You can edit below.
                  </p>
                ) : null}
                <div className="dse-labeledGrid">
                  {CLINICAL_EXAM_FIELDS.map((f) => (
                    <div key={f.key} className="dse-labeledRow">
                      <span className="dse-labeledRowLabel">{f.label}</span>
                      <input
                        className="dse-labeledRowInput"
                        value={summary.clinicalExamAtAdmission?.[f.key] ?? ''}
                        placeholder="Enter value"
                        onChange={(e) =>
                          setSummary((prev) => ({
                            ...(prev || {}),
                            clinicalExamAtAdmission: {
                              ...(prev?.clinicalExamAtAdmission || {}),
                              [f.key]: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <SectionTitle>Investigations</SectionTitle>
                <p className="dse-printHint" style={{ margin: '0 0 8px' }}>
                  Form mein saari list dikhegi; print slip par sirf jahan Finding bhari ho wahi row aayegi.
                </p>
                <div className="dse-invTable">
                  <div className="dse-invHead">
                    <div>Investigation</div>
                    <div>Finding</div>
                  </div>
                  {(Array.isArray(summary.investigationRows) ? summary.investigationRows : []).map((row, idx) => (
                    <div key={row.name || idx} className="dse-invRow">
                      <div className="dse-invName">{row.name}</div>
                      <input
                        className="dse-invFinding"
                        value={row.finding ?? ''}
                        placeholder="Finding / result"
                        onChange={(e) => {
                          const rows = [...(summary.investigationRows || [])];
                          rows[idx] = { ...rows[idx], finding: e.target.value };
                          updateSummary({ investigationRows: rows });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="dse-card dse-card--pair">
            <div className="dse-pairGrid">
              <div className="dse-printSection">
                <SectionTitle>Course during hospital stay</SectionTitle>
                <TextArea
                  value={summary.courseDuringHospitalStay}
                  onChange={(v) => updateSummary({ courseDuringHospitalStay: v })}
                  rows={6}
                />
              </div>
              <div className="dse-printSection">
                <SectionTitle>Treatment given</SectionTitle>
                <p className="dse-printHint">Print slip par yahi options checkbox ke saath dikhenge.</p>
                <div className="dse-checkGrid">
                  {TREATMENT_CHECKLIST_ITEMS.map((item) => (
                    <ChecklistField
                      key={item.key}
                      label={item.label}
                      checked={summary.treatmentChecklist?.[item.key]}
                      onChange={(checked) =>
                        setSummary((prev) => ({
                          ...(prev || {}),
                          treatmentChecklist: {
                            ...(prev?.treatmentChecklist || {}),
                            [item.key]: checked,
                          },
                        }))
                      }
                    />
                  ))}
                </div>
                <Field label="Additional treatment notes (print ke neeche)">
                  <TextArea
                    value={summary.treatmentGiven}
                    onChange={(v) => updateSummary({ treatmentGiven: v })}
                    rows={3}
                    placeholder="Extra medicines / details…"
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="dse-card dse-card--pair">
            <div className="dse-pairGrid">
              <div className="dse-printSection">
                <SectionTitle>Surgical procedure / operation (if any)</SectionTitle>
                <div className="dse-twoCol">
                  <Field label="Procedure name">
                    <Input
                      value={summary.surgicalProcedureName || ''}
                      onChange={(v) => updateSummary({ surgicalProcedureName: v })}
                    />
                  </Field>
                  <Field label="Date of surgery">
                    <Input
                      type="date"
                      value={toDateInputValue(summary.dateOfSurgery)}
                      onChange={(v) => updateSummary({ dateOfSurgery: v })}
                    />
                  </Field>
                  <Field label="Type of anaesthesia">
                    <Input
                      value={summary.anaesthesiaType || ''}
                      onChange={(v) => updateSummary({ anaesthesiaType: v })}
                    />
                  </Field>
                  <Field label="Operative findings">
                    <TextArea
                      value={summary.operativeFindings || summary.surgicalProcedure || ''}
                      onChange={(v) => updateSummary({ operativeFindings: v, surgicalProcedure: v })}
                      rows={3}
                    />
                  </Field>
                </div>
              </div>
              <div className="dse-printSection">
                <SectionTitle>Condition at discharge</SectionTitle>
                <Field label="Condition at discharge (type karein — print slip par yahi dikhega)">
                  <TextArea
                    value={summary.conditionAtDischarge}
                    onChange={(v) => updateSummary({ conditionAtDischarge: v })}
                    rows={5}
                    placeholder="e.g. Conscious, oriented, hemodynamically stable, afebrile…"
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="dse-card dse-card--full">
            <SectionTitle>Discharge Medications</SectionTitle>
            <p className="dse-printHint" style={{ margin: '0 0 10px' }}>
              Last treatment-plan medicines auto-fill here. Add or edit rows manually before save/print.
            </p>
            <div className="dse-medTable">
              <div className="dse-medHead">
                <div>#</div>
                <div>Medicine</div>
                <div>Dosage</div>
                <div>Frequency</div>
                <div>Duration</div>
                <div>Mode</div>
                <div />
              </div>
              {meds.length === 0 ? (
                <div className="dse-muted">No medicines auto-filled yet. Add/edit medicines below.</div>
              ) : null}
              {meds.map((m, idx) => (
                <div key={idx} className="dse-medRow">
                  <div className="dse-medIdx">{idx + 1}</div>
                  <input
                    className="dse-medInput"
                    value={m.medicine}
                    placeholder="Medicine"
                    onChange={(e) => {
                      const next = meds.map((x, i) => (i === idx ? { ...x, medicine: e.target.value } : x));
                      updateSummary({ dischargeMedications: next });
                    }}
                  />
                  <input
                    className="dse-medInput"
                    value={m.dosage}
                    placeholder="Dosage"
                    onChange={(e) => {
                      const next = meds.map((x, i) => (i === idx ? { ...x, dosage: e.target.value } : x));
                      updateSummary({ dischargeMedications: next });
                    }}
                  />
                  <input
                    className="dse-medInput"
                    value={m.frequency}
                    placeholder="Frequency"
                    onChange={(e) => {
                      const next = meds.map((x, i) => (i === idx ? { ...x, frequency: e.target.value } : x));
                      updateSummary({ dischargeMedications: next });
                    }}
                  />
                  <input
                    className="dse-medInput"
                    value={m.duration}
                    placeholder="Duration"
                    onChange={(e) => {
                      const next = meds.map((x, i) => (i === idx ? { ...x, duration: e.target.value } : x));
                      updateSummary({ dischargeMedications: next });
                    }}
                  />
                  <input
                    className="dse-medInput"
                    value={m.mode}
                    placeholder="Mode"
                    onChange={(e) => {
                      const next = meds.map((x, i) => (i === idx ? { ...x, mode: e.target.value } : x));
                      updateSummary({ dischargeMedications: next });
                    }}
                  />
                  <button
                    type="button"
                    className="dse-medRemove"
                    onClick={() => {
                      const next = meds.filter((_, i) => i !== idx);
                      updateSummary({ dischargeMedications: next });
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="dse-btn"
              style={{ marginTop: 10 }}
              onClick={() =>
                updateSummary({
                  dischargeMedications: [
                    ...meds,
                    { medicine: '', dosage: '', frequency: '', duration: '', mode: '' },
                  ],
                })
              }
            >
              + Add medicine
            </button>
          </section>

          <section className="dse-card dse-card--full">
            <SectionTitle>Discharge Advice & Declaration</SectionTitle>
            <Field label="Discharge Advice">
              <TextArea
                value={summary.dischargeAdvice}
                onChange={(v) => updateSummary({ dischargeAdvice: v })}
                rows={4}
              />
            </Field>
            <Field label="Follow-up Details">
              <TextArea
                value={summary.followUpDetails}
                onChange={(v) => updateSummary({ followUpDetails: v })}
                rows={3}
              />
            </Field>

            <div className="dse-twoCol">
              <Field label="Follow-up Date">
                <Input
                  type="date"
                  value={toDateInputValue(summary.followUpDate)}
                  onChange={(v) => updateSummary({ followUpDate: v })}
                />
              </Field>
              <Field label="Follow-up Time">
                <Input type="time" value={summary.followUpTime || ''} onChange={(v) => updateSummary({ followUpTime: v })} />
              </Field>
              <Field label="Follow-up Place">
                <Input value={summary.followUpPlace || ''} onChange={(v) => updateSummary({ followUpPlace: v })} placeholder="OPD / Hospital" />
              </Field>
              <div />
            </div>

            <div className="dse-twoCol">
              <Field label="Patient Declaration">
                <TextArea
                  value={summary.declaration.patientDeclaration}
                  onChange={(v) =>
                    setSummary((prev) => ({
                      ...(prev || {}),
                      declaration: {
                        ...(prev?.declaration || {}),
                        patientDeclaration: v,
                      },
                    }))
                  }
                  rows={4}
                />
              </Field>
              <Field label="Doctor Declaration">
                <TextArea
                  value={summary.declaration.doctorDeclaration}
                  onChange={(v) =>
                    setSummary((prev) => ({
                      ...(prev || {}),
                      declaration: {
                        ...(prev?.declaration || {}),
                        doctorDeclaration: v,
                      },
                    }))
                  }
                  rows={4}
                />
              </Field>
            </div>

            <Field label="Date">
              <Input value={summary.declaration.date} onChange={() => {}} type="text" placeholder="" />
            </Field>
          </section>

          <section className="dse-card dse-card--full">
            <SectionTitle>Signatures</SectionTitle>
  
            <div className="dse-twoCol">
              <Field label="Patient Signature ">
                <Input
                  value={summary.signatures.patientSignature}
                  onChange={(v) =>
                    setSummary((prev) => ({
                      ...(prev || {}),
                      signatures: { ...(prev?.signatures || {}), patientSignature: v },
                    }))
                  }
                />
              </Field>
              <Field label="Doctor Signature">
                <Input
                  value={summary.signatures.doctorSignature}
                  onChange={(v) =>
                    setSummary((prev) => ({
                      ...(prev || {}),
                      signatures: { ...(prev?.signatures || {}), doctorSignature: v },
                    }))
                  }
                />
              </Field>
            </div>
            <Field label="Hospital Stamp ">
              <Input
                value={summary.signatures.hospitalStamp}
                onChange={(v) =>
                  setSummary((prev) => ({
                    ...(prev || {}),
                    signatures: { ...(prev?.signatures || {}), hospitalStamp: v },
                  }))
                }
              />
            </Field>
          </section>

        </div>
        ) : null}

        <section className="dse-actions dse-actions--footer">
          <button
            type="button"
            className="dse-btn dse-btn-primary"
            disabled={saving}
            onClick={onSave}
          >
            {saving
              ? 'Saving…'
              : pendingFinalize
                ? `Save ${dischargeTypeLabel(dischargeType)} & discharge`
                : isAlreadyDischarged
                  ? `Update ${dischargeTypeLabel(dischargeType)}`
                  : 'Save summary'}
          </button>
          <button type="button" className="dse-btn" disabled={saving} onClick={onPrint}>
            {saving ? 'Please wait…' : 'Print'}
          </button>
        </section>
      </div>
    </div>
  );
}