export const DISCHARGE_TYPES = [
  { id: 'normal', label: 'Normal discharge' },
  { id: 'lama', label: 'LAMA' },
  { id: 'death', label: 'Death certificate' },
];

/** Fixed labels — user only fills values (matches hospital discharge summary). */
export const CLINICAL_EXAM_FIELDS = [
  { key: 'pulseRate', label: 'Pulse Rate' },
  { key: 'bloodPressure', label: 'Blood Pressure' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'respiratoryRate', label: 'Respiratory Rate' },
  { key: 'spo2', label: 'SpO2' },
  { key: 'cvs', label: 'CVS' },
  { key: 'rs', label: 'RS' },
  { key: 'cns', label: 'CNS' },
  { key: 'pa', label: 'P/A' },
];

/** Matches print slip — TREATMENT GIVEN checkboxes (page 2). */
export const TREATMENT_CHECKLIST_ITEMS = [
  { key: 'ivFluids', label: 'IV Fluids' },
  { key: 'antibiotics', label: 'Antibiotics' },
  { key: 'analgesics', label: 'Analgesics / Antipyretics' },
  { key: 'nebulization', label: 'Nebulization / Oxygen Support' },
  { key: 'monitoring', label: 'Monitoring of Vitals' },
  { key: 'surgicalManagement', label: 'Surgical / Conservative Management' },
];

/** Matches print slip — CONDITION AT DISCHARGE checkboxes (page 2). */
export const CONDITION_FLAG_ITEMS = [
  { key: 'conscious', label: 'Conscious' },
  { key: 'oriented', label: 'Oriented' },
  { key: 'hemodynamicallyStable', label: 'Hemodynamically Stable' },
  { key: 'afebrile', label: 'Afebrile' },
  { key: 'ambulatory', label: 'Ambulatory' },
  { key: 'others', label: 'Others' },
];

export function defaultTreatmentChecklist() {
  return {
    ivFluids: false,
    antibiotics: false,
    analgesics: false,
    nebulization: false,
    monitoring: false,
    surgicalManagement: false,
  };
}

export function defaultConditionFlags() {
  return {
    conscious: false,
    oriented: false,
    hemodynamicallyStable: false,
    afebrile: false,
    ambulatory: false,
    others: false,
  };
}

/** Matches print slip — PAST HISTORY (Yes / No per row). */
export const PAST_HISTORY_ITEMS = [
  { key: 'diabetes', label: 'Diabetes Mellitus' },
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'asthma', label: 'Asthma' },
  { key: 'tuberculosis', label: 'Tuberculosis' },
  { key: 'previousSurgery', label: 'Previous Surgery' },
  { key: 'drugAllergy', label: 'Drug Allergy' },
];

export function defaultPastHistoryFlags() {
  return {
    diabetes: null,
    hypertension: null,
    asthma: null,
    tuberculosis: null,
    previousSurgery: null,
    drugAllergy: null,
  };
}

export const INVESTIGATION_ROW_NAMES = [
  'CBC',
  'Blood Sugar',
  'RFT',
  'LFT',
  'Urine Routine',
  'ECG',
  'X-Ray Chest',
  'USG / CT / MRI',
  'Other',
];

function safeText(v) {
  return v == null ? '' : String(v);
}

const pad2 = (n) => String(n).padStart(2, '0');

function fmtDateInput(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtTimeInput(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtDateTimeLocal(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toIsoDateOnly(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

/** yyyy-mm-dd for &lt;input type="date" /&gt; */
export function toDateInputValue(v) {
  return toIsoDateOnly(v);
}

/**
 * Real admission date+time for print: uses admissionDate (calendar day) and
 * createdAt clock time when admission was saved as date-only (midnight UTC).
 */
export function resolveAdmissionDateTime(admission) {
  if (!admission || typeof admission !== 'object') return null;
  const rawAdm = admission.admissionDate;
  const rawCreated = admission.createdAt;
  if (!rawAdm && !rawCreated) return null;

  const created = rawCreated ? new Date(rawCreated) : null;
  const adm = rawAdm ? new Date(rawAdm) : null;

  if (adm && !Number.isNaN(adm.getTime()) && created && !Number.isNaN(created.getTime())) {
    const isUtcMidnight =
      adm.getUTCHours() === 0 &&
      adm.getUTCMinutes() === 0 &&
      adm.getUTCSeconds() === 0 &&
      adm.getUTCMilliseconds() === 0;
    if (isUtcMidnight) {
      const datePart = /^\d{4}-\d{2}-\d{2}/.test(String(rawAdm))
        ? String(rawAdm).slice(0, 10)
        : `${adm.getFullYear()}-${pad2(adm.getMonth() + 1)}-${pad2(adm.getDate())}`;
      const [y, m, d] = datePart.split('-').map((x) => parseInt(x, 10));
      if (y && m && d) {
        return new Date(y, m - 1, d, created.getHours(), created.getMinutes(), created.getSeconds());
      }
    }
    return adm;
  }
  if (adm && !Number.isNaN(adm.getTime())) return adm;
  if (created && !Number.isNaN(created.getTime())) return created;
  return null;
}

/** Parse summary admission field (datetime-local or ISO) for print. */
export function parseAdmissionDateTimeForPrint(summary, admissionFallback) {
  const fromAdmission = resolveAdmissionDateTime(admissionFallback);
  if (fromAdmission && !Number.isNaN(fromAdmission.getTime())) return fromAdmission;

  const raw = summary?.admissionDateTimeIso || summary?.admissionDateTime;
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** HH:mm for &lt;input type="time" /&gt; */
export function toTimeInputValue(v) {
  if (!v) return '';
  const s = String(v).trim();
  const t = s.match(/(\d{1,2}):(\d{2})/);
  if (t) return `${pad2(t[1])}:${t[2]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return fmtTimeInput(d);
  return '';
}

/** value for &lt;input type="datetime-local" /&gt; */
export function toDateTimeLocalValue(v) {
  if (!v) return '';
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}T${pad2(m[4])}:${m[5]}`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return fmtDateTimeLocal(d);
  return '';
}

/** Store as DD/MM/YYYY HH:mm for print compatibility */
export function fromDateTimeLocalValue(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${fmtDateInput(d)} ${fmtTimeInput(d)}`;
}

export function buildInitialLama({ admission, patient, clearances, doctor, summary }) {
  const p = patient || {};
  const g = safeText(p.gender || summary?.patientInformation?.gender || '');
  const age = p.age ?? summary?.patientInformation?.age ?? '';
  const now = new Date();
  return {
    patientName: safeText(p.name || summary?.patientInformation?.patientName || ''),
    age: safeText(p.age ?? summary?.patientInformation?.age ?? ''),
    sex: (() => {
      const g = safeText(p.gender || summary?.patientInformation?.gender || '');
      if (/female/i.test(g)) return 'Female';
      if (/male/i.test(g)) return 'Male';
      if (g) return 'Other';
      return '';
    })(),
    ageSex: (() => {
      const age = safeText(p.age ?? summary?.patientInformation?.age ?? '');
      const g = safeText(p.gender || summary?.patientInformation?.gender || '');
      return [age, g].filter(Boolean).join(' / ');
    })(),
    address: safeText(p.address || summary?.patientInformation?.address || ''),
    phone: safeText(p.mobile || summary?.patientInformation?.mobile || ''),
    admittedOn: admission?.admissionDate
      ? new Date(admission.admissionDate).toISOString().slice(0, 10)
      : '',
    wardBed: clearances ? `${safeText(clearances.ward)} / ${safeText(clearances.bed)}` : safeText(summary?.wardBedNo || ''),
    consultant: safeText(doctor?.user?.name || summary?.consultantDoctor || ''),
    diagnosis: safeText(admission?.notesText || summary?.finalDiagnosis || ''),
    illnessSummary: safeText(summary?.historyOfPresentIllness || ''),
    investigations: {
      cbc: false,
      rbs: false,
      kft: false,
      lft: false,
      ecg: false,
      xray: false,
      usg: false,
      others: false,
      othersText: '',
    },
    investigationFindings: safeText(summary?.investigations?.investigationText || ''),
    treatmentGiven: safeText(summary?.treatmentGiven || ''),
    declarationName: '',
    declarationRelationName: safeText(p.emergencyName || ''),
    reasonForLeaving: '',
    sigPatient: '',
    sigPatientDate: fmtDateInput(now) + ' ' + fmtTimeInput(now),
    sigAttendantName: '',
    sigAttendantDate: '',
    sigDoctor: safeText(doctor?.user?.name || ''),
    sigDoctorDate: fmtDateInput(now) + ' ' + fmtTimeInput(now),
    sigWitness: '',
    sigWitnessDate: '',
    followUpReportIf: 'fever, vomiting, pain, breathing difficulty or any emergency',
    followUpOn: '',
    followUpAt: 'OPD — New H.T. Hospital',
    followUpContact: safeText(p.mobile || ''),
  };
}

export function buildInitialDeath({ admission, patient, clearances, doctor, summary }) {
  const p = patient || {};
  const g = String(p.gender || summary?.patientInformation?.gender || '').toLowerCase();
  const now = new Date();
  const adm = admission?.admissionDate ? new Date(admission.admissionDate) : now;
  return {
    certificateNo: '',
    dateOfIssue: toIsoDateOnly(now),
    hospitalRegNo: '',
    patientName: safeText(p.name || summary?.patientInformation?.patientName || ''),
    ageSex: [p.age ?? summary?.patientInformation?.age, p.gender || summary?.patientInformation?.gender]
      .filter(Boolean)
      .join(' / '),
    sexMale: g.includes('male') && !g.includes('female'),
    sexFemale: g.includes('female'),
    sexOther: g.includes('other') || (!g.includes('male') && !g.includes('female') && g !== ''),
    uhidNo: safeText(p.uhid || summary?.uhidNo || ''),
    ipdNo: safeText(admission?.ipdNumber || summary?.ipdNo || ''),
    address: safeText(p.address || summary?.patientInformation?.address || ''),
    admissionDate: toIsoDateOnly(adm),
    admissionTime: fmtTimeInput(adm),
    deathDate: toIsoDateOnly(now),
    deathTime: fmtTimeInput(now),
    placeOfDeath: { inHospital: true, icu: false, other: false, otherText: '' },
    wardUnit: clearances ? `${safeText(clearances.ward)} / ${safeText(clearances.bed)}` : safeText(summary?.wardBedNo || ''),
    causeImmediate: '',
    causeAntecedent: '',
    causeOther: '',
    clinicalSummary: safeText(admission?.notesText || summary?.finalDiagnosis || ''),
    doctorName: safeText(doctor?.user?.name || summary?.consultantDoctor || ''),
    doctorDesignation: 'Consultant',
    doctorRegNo: '',
    certDateTime: fmtDateInput(now) + ' ' + fmtTimeInput(now),
  };
}

function matchInvestigationRowName(testName) {
  const n = String(testName || '').toLowerCase();
  if (/cbc|complete blood|hemogram/i.test(n)) return 'CBC';
  if (/blood sugar|glucose|rbs|fbs|sugar/i.test(n)) return 'Blood Sugar';
  if (/rft|renal function|kidney function|kft/i.test(n)) return 'RFT';
  if (/lft|liver function|sgot|sgpt/i.test(n)) return 'LFT';
  if (/urine|urinalysis/i.test(n)) return 'Urine Routine';
  if (/ecg|ekg|electrocardiogram/i.test(n)) return 'ECG';
  if (/x-?ray|chest pa|cxr/i.test(n)) return 'X-Ray Chest';
  if (/usg|ultrasound|ct |ct\/|mri/i.test(n)) return 'USG / CT / MRI';
  return 'Other';
}

export function buildClinicalExamAtAdmission({ vitals } = {}) {
  const v = vitals || {};
  return {
    pulseRate: v.pulse != null && v.pulse !== '' ? String(v.pulse) : '',
    bloodPressure: safeText(v.bp),
    temperature: v.temp != null && v.temp !== '' ? String(v.temp) : '',
    respiratoryRate: safeText(v.respiratoryRate),
    spo2:
      v.spo2 != null && v.spo2 !== ''
        ? `${v.spo2}%`
        : safeText(v.oxygenTherapy || v.spo2Text),
    cvs: safeText(v.cvs),
    rs: safeText(v.rs),
    cns: safeText(v.cns),
    pa: safeText(v.pa),
  };
}

export function normalizeMedicineRows(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((m) => ({
      medicine: safeText(m?.medicine || m?.name || ''),
      dosage: safeText(m?.dosage || ''),
      frequency: safeText(m?.frequency || ''),
      duration: safeText(m?.duration || ''),
      mode: safeText(m?.mode || ''),
    }))
    .filter((m) => m.medicine || m.dosage || m.frequency || m.duration || m.mode);
}

export function buildDischargeMedicationsFromTreatmentPlan(treatmentPlan) {
  return normalizeMedicineRows(treatmentPlan?.medicines);
}

export function mergeDischargeMedications(fromPlan, saved) {
  const savedList = normalizeMedicineRows(saved);
  const planList = normalizeMedicineRows(fromPlan);
  if (savedList.length > 0) return savedList;
  return planList;
}

export function buildInvestigationRows(labReportItems = []) {
  const rows = INVESTIGATION_ROW_NAMES.map((name) => ({ name, finding: '' }));
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));

  for (const item of labReportItems) {
    if (!item || typeof item !== 'object') continue;
    const testName = item.testName || item.panelName || item.orderName || item.orderNumber || '';
    const finding =
      safeText(item.summary) ||
      safeText(item.resultSummary) ||
      safeText(item.remarks) ||
      (item.status ? String(item.status) : 'Report on file');
    const rowName = matchInvestigationRowName(testName);
    const row = byName[rowName] || byName.Other;
    const line = testName ? `${testName}: ${finding}`.trim() : finding;
    if (!line) continue;
    row.finding = row.finding ? `${row.finding}; ${line}` : line;
  }

  return rows;
}

export function mergeInvestigationRows(baseRows, savedRows) {
  if (!Array.isArray(savedRows) || savedRows.length === 0) return baseRows;
  return INVESTIGATION_ROW_NAMES.map((name) => {
    const saved = savedRows.find((r) => r.name === name);
    const base = baseRows.find((r) => r.name === name);
    return {
      name,
      finding: saved?.finding != null && String(saved.finding).trim() !== ''
        ? String(saved.finding)
        : base?.finding || '',
    };
  });
}

export function mergeClinicalExam(base, saved) {
  const b = base && typeof base === 'object' ? base : buildClinicalExamAtAdmission();
  const s = saved && typeof saved === 'object' ? saved : {};
  const out = { ...b };
  for (const f of CLINICAL_EXAM_FIELDS) {
    if (s[f.key] != null && String(s[f.key]).trim() !== '') out[f.key] = String(s[f.key]);
  }
  return out;
}

export function ensureNormalDischargeFields(summary, ctx = {}) {
  if (!summary) return summary;
  const builtExam = buildClinicalExamAtAdmission({ vitals: ctx.vitals });
  const baseRows = buildInvestigationRows(ctx.labReports || []);
  const planMeds = buildDischargeMedicationsFromTreatmentPlan(ctx.treatmentPlan);
  return {
    ...summary,
    clinicalExamAtAdmission: mergeClinicalExam(
      builtExam,
      summary.clinicalExamAtAdmission || parseLegacyClinicalText(summary.clinicalExamination),
    ),
    investigationRows: mergeInvestigationRows(
      baseRows,
      Array.isArray(summary.investigationRows) ? summary.investigationRows : null,
    ),
    dischargeMedications: mergeDischargeMedications(planMeds, summary.dischargeMedications),
    pastHistoryFlags: {
      ...defaultPastHistoryFlags(),
      ...(summary.pastHistoryFlags && typeof summary.pastHistoryFlags === 'object'
        ? summary.pastHistoryFlags
        : {}),
    },
    pastHistoryDetails:
      summary.pastHistoryDetails != null && String(summary.pastHistoryDetails).trim() !== ''
        ? String(summary.pastHistoryDetails)
        : safeText(summary.pastHistory || ''),
  };
}

/** Back-compat: old saves used one textarea for clinical exam. */
function parseLegacyClinicalText(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  if (!t) return null;
  return { pa: t };
}

export function ensureDischargeSubForms(summary, ctx) {
  if (!summary) return summary;
  let next = { ...summary, dischargeType: summary.dischargeType || 'normal' };
  if (!next.lamaForm || typeof next.lamaForm !== 'object') {
    next.lamaForm = buildInitialLama(ctx);
  }
  if (!next.deathForm || typeof next.deathForm !== 'object') {
    next.deathForm = buildInitialDeath(ctx);
  }
  next = ensureNormalDischargeFields(next, ctx);
  return next;
}

export function mergeSummary(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base,
    ...saved,
    dischargeType: saved.dischargeType || base?.dischargeType || 'normal',
    patientInformation: {
      ...(base?.patientInformation || {}),
      ...(saved.patientInformation || {}),
    },
    investigations: {
      ...(base?.investigations || {}),
      ...(saved.investigations || {}),
    },
    clinicalExamAtAdmission: mergeClinicalExam(base?.clinicalExamAtAdmission, saved.clinicalExamAtAdmission),
    investigationRows: mergeInvestigationRows(
      base?.investigationRows || buildInvestigationRows(),
      saved.investigationRows,
    ),
    declaration: {
      ...(base?.declaration || {}),
      ...(saved.declaration || {}),
    },
    signatures: {
      ...(base?.signatures || {}),
      ...(saved.signatures || {}),
    },
    treatmentChecklist: {
      ...defaultTreatmentChecklist(),
      ...(base?.treatmentChecklist || {}),
      ...(saved.treatmentChecklist || {}),
    },
    conditionFlags: {
      ...defaultConditionFlags(),
      ...(base?.conditionFlags || {}),
      ...(saved.conditionFlags || {}),
    },
    pastHistoryFlags: {
      ...defaultPastHistoryFlags(),
      ...(base?.pastHistoryFlags || {}),
      ...(saved.pastHistoryFlags || {}),
    },
    pastHistoryDetails:
      saved.pastHistoryDetails != null && String(saved.pastHistoryDetails).trim() !== ''
        ? String(saved.pastHistoryDetails)
        : base?.pastHistoryDetails ?? base?.pastHistory ?? '',
    lamaForm: saved.lamaForm && typeof saved.lamaForm === 'object'
      ? { ...(base?.lamaForm || {}), ...saved.lamaForm }
      : base?.lamaForm,
    deathForm: saved.deathForm && typeof saved.deathForm === 'object'
      ? { ...(base?.deathForm || {}), ...saved.deathForm }
      : base?.deathForm,
    dischargeMedications: mergeDischargeMedications(
      base?.dischargeMedications,
      saved.dischargeMedications,
    ),
  };
}
