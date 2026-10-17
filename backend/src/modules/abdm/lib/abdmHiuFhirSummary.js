function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function isEmptyValue(value) {
  if (value == null) return true;
  if (value === false) return true;
  if (typeof value === 'string' && !value.trim()) return true;
  if (Array.isArray(value) && !value.length) return true;
  if (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length) return true;
  return false;
}

function prettyLabel(key) {
  const map = {
    name: 'Name',
    patientName: 'Patient',
    uhid: 'UHID',
    gender: 'Gender',
    age: 'Age',
    ageSex: 'Age / Gender',
    dob: 'Date of Birth',
    birthDate: 'Date of Birth',
    doctor: 'Doctor',
    consultant: 'Consultant',
    attendingDoctor: 'Attending Doctor',
    practitioner: 'Doctor',
    visitDate: 'Visit Date',
    consultationDate: 'Consultation Date',
    authoredOn: 'Prescription Date',
    admissionDate: 'Admission Date',
    dischargeDate: 'Discharge Date',
    ward: 'Ward',
    bed: 'Bed',
    diagnosis: 'Diagnosis',
    symptoms: 'Chief Complaint',
    chiefComplaint: 'Chief Complaint',
    complaint: 'Chief Complaint',
    clinicalNotes: 'Clinical Notes',
    notes: 'Clinical Notes',
    notesText: 'Clinical Notes',
    examination: 'Examination',
    advice: 'Treatment / Advice',
    treatment: 'Treatment',
    treatmentSummary: 'Treatment Summary',
    treatmentGiven: 'Treatment Given',
    hospitalCourse: 'Hospital Course',
    investigations: 'Investigations',
    followUp: 'Follow-up',
    followup: 'Follow-up',
    followUpOn: 'Follow-up',
    dischargeType: 'Discharge Type',
    dischargeInstructions: 'Discharge Instructions',
    instructions: 'Instructions',
    medicineName: 'Medicine Name',
    medication: 'Medicine Name',
    dosage: 'Dosage',
    dose: 'Dosage',
    frequency: 'Frequency',
    route: 'Route',
    duration: 'Duration',
    testName: 'Test Name',
    parameter: 'Parameter',
    result: 'Result',
    value: 'Result',
    unit: 'Unit',
    referenceRange: 'Reference Range',
    reportDate: 'Report Date',
    issued: 'Report Date',
    pulseRate: 'Pulse Rate',
    bloodPressure: 'Blood Pressure',
    temperature: 'Temperature',
    respiratoryRate: 'Respiratory Rate',
    spo2: 'SpO2',
    reasonForLeaving: 'Reason for leaving',
    declarationName: 'Declared by',
    declarationRelationName: 'Relation',
    admittedOn: 'Admitted on',
  };
  if (map[key]) return map[key];
  return String(key || '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/^\s+/, '')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

const SKIP_KEYS = new Set([
  'id', 'resourceType', 'fullUrl', 'reference', 'system', 'coding', 'extension', 'meta',
  'url', 'uuid', 'identifier', 'careContextId', 'careContextReference', 'sourceHipId',
  'hipId', 'hiuId', 'transactionId', 'consentId', 'requestId', 'keyMaterial', 'nonce',
  'privateKey', 'publicKey', 'fhirPayload', 'schemaVersion', 'div', 'status', 'intent',
  'subject', 'encounter', 'category', 'clinicalStatus',
]);

function formatDisplayDate(value) {
  if (isEmptyValue(value)) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).trim();
  if (String(value).length <= 10) {
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text || (text[0] !== '{' && text[0] !== '[')) return value;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function flattenClinical(value, prefix = '', out = []) {
  const parsed = parseMaybeJson(value);
  if (isEmptyValue(parsed)) return out;
  if (typeof parsed === 'string' || typeof parsed === 'number' || parsed === true) {
    if (prefix) out.push({ label: prettyLabel(prefix), value: parsed === true ? 'Yes' : String(parsed) });
    return out;
  }
  if (Array.isArray(parsed)) {
    parsed.forEach((item, index) => {
      if (typeof item === 'object') flattenClinical(item, prefix, out);
      else if (!isEmptyValue(item)) out.push({ label: prettyLabel(prefix || `Item ${index + 1}`), value: String(item) });
    });
    return out;
  }
  if (typeof parsed === 'object') {
    for (const [key, child] of Object.entries(parsed)) {
      if (SKIP_KEYS.has(key) || (/Id$/.test(key) && key.toLowerCase() !== 'uhid')) continue;
      if (key === 'lamaForm') {
        flattenClinical(child, '', out);
        continue;
      }
      const next = prefix && !['text', 'div', 'value'].includes(key) ? `${prefix}.${key}` : key;
      const labelKey = prefix && !['text', 'display'].includes(key) ? key : next;
      flattenClinical(child, labelKey, out);
    }
  }
  return out;
}

function uniqueFields(fields) {
  const seen = new Set();
  return (fields || []).filter((row) => {
    if (!row || row.value == null) return false;
    const value = String(row.value).trim();
    if (!value || value === 'undefined' || value === 'null' || value === '[object Object]') return false;
    if (/[{[]/.test(value) && /[}\]]/.test(value) && value.length > 40) return false;
    const key = `${row.label}|${value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function textOf(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    if (value.text) return String(value.text).trim();
    if (value.display) return String(value.display).trim();
    if (Array.isArray(value.coding) && value.coding[0]) {
      return String(value.coding[0].display || '').trim();
    }
  }
  return '';
}

function bundleResources(bundle) {
  const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
  return entries.map((row) => row?.resource).filter((row) => row && row.resourceType);
}

function decodeAttachmentData(attachment) {
  const att = asObject(attachment);
  if (!att?.data) return '';
  const contentType = String(att.contentType || '').toLowerCase();
  if (contentType && !contentType.includes('text') && !contentType.includes('json') && !contentType.includes('xml')) {
    return '';
  }
  try {
    return Buffer.from(String(att.data), 'utf8').toString('utf8').trim();
  } catch {
    return '';
  }
}

function decodeAttachmentUtf8(attachment) {
  const att = asObject(attachment);
  if (!att?.data) return '';
  try {
    return Buffer.from(String(att.data), 'base64').toString('utf8').trim();
  } catch {
    return '';
  }
}

function classifyRecordType(bundle, resources) {
  const composition = resources.find((row) => row.resourceType === 'Composition');
  const typeText = String(composition?.type?.text || composition?.title || '').toLowerCase();
  if (typeText.includes('opconsultation') || typeText.includes('opd') || typeText.includes('consultation')) {
    return 'OPConsultation';
  }
  if (typeText.includes('prescription') || resources.some((row) => row.resourceType === 'MedicationRequest')) {
    return 'Prescription';
  }
  if (typeText.includes('discharge')) return 'DischargeSummary';
  if (typeText.includes('diagnostic') || resources.some((row) => row.resourceType === 'DiagnosticReport')) {
    return 'DiagnosticReport';
  }
  if (typeText.includes('inpatient') || typeText.includes('ipd') || typeText.includes('admission')) {
    return 'InpatientRecord';
  }
  const encounter = resources.find((row) => row.resourceType === 'Encounter');
  if (String(encounter?.class?.code || '').toUpperCase() === 'IMP') return 'InpatientRecord';
  if (String(encounter?.class?.code || '').toUpperCase() === 'AMB') return 'OPConsultation';
  return 'Additional';
}

function groupKey(recordType) {
  if (recordType === 'OPConsultation') return 'opConsultation';
  if (recordType === 'Prescription') return 'prescription';
  if (recordType === 'InpatientRecord') return 'ipd';
  if (recordType === 'DischargeSummary') return 'discharge';
  if (recordType === 'DiagnosticReport') return 'lab';
  return 'additional';
}

function groupTitle(recordType) {
  if (recordType === 'OPConsultation') return 'OP Consultation';
  if (recordType === 'Prescription') return 'Prescription';
  if (recordType === 'InpatientRecord') return 'IPD / Admission';
  if (recordType === 'DischargeSummary') return 'Discharge Summary';
  if (recordType === 'DiagnosticReport') return 'Lab / Diagnostic';
  return 'Additional Records';
}

function patientNameOf(patient) {
  return patient?.name?.[0]?.text
    || [patient?.name?.[0]?.given, patient?.name?.[0]?.family].flat().filter(Boolean).join(' ')
    || '';
}

function uhidOf(patient) {
  const ids = Array.isArray(patient?.identifier) ? patient.identifier : [];
  return String(ids[0]?.value || '').trim();
}

function practitionerName(resources) {
  const row = resources.find((item) => item.resourceType === 'Practitioner');
  return row?.name?.[0]?.text || row?.name?.[0]?.family || '';
}

function organizationName(resources) {
  const row = resources.find((item) => item.resourceType === 'Organization');
  return row?.name || '';
}

function field(label, value) {
  if (isEmptyValue(value) || value === false) return null;
  const text = typeof value === 'string' ? value.trim() : String(value);
  if (!text || text === 'undefined' || text === 'null' || text === '[object Object]') return null;
  if (/^\s*[{\[]/.test(text)) return null;
  return { label, value: text };
}

function pushField(list, label, value) {
  const row = field(label, value);
  if (row) list.push(row);
}

function conditionText(resources, prefer) {
  const conditions = resources.filter((row) => row.resourceType === 'Condition');
  if (prefer === 'complaint') {
    const hit = conditions.find((row) => String(textOf(row.category?.[0]) || '').toLowerCase().includes('complaint'));
    return textOf(hit?.code) || '';
  }
  const hit = conditions.find((row) => String(textOf(row.category?.[0]) || '').toLowerCase().includes('diagnosis'))
    || conditions[0];
  return textOf(hit?.code) || '';
}

function compositionNotes(composition) {
  return (composition?.section || []).map((sec) => {
    const html = String(sec?.text?.div || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return html;
  }).filter(Boolean).join('\n');
}

function medicationFields(resource) {
  const dose = resource.dosageInstruction?.[0] || {};
  const fields = [];
  pushField(fields, 'Medicine Name', textOf(resource.medicationCodeableConcept) || resource.medicationReference?.display);
  pushField(fields, 'Dosage', dose.doseAndRate?.[0]?.doseQuantity
    ? `${dose.doseAndRate[0].doseQuantity.value || ''} ${dose.doseAndRate[0].doseQuantity.unit || ''}`.trim()
    : dose.text);
  pushField(fields, 'Frequency', dose.timing?.code?.text || textOf(dose.timing?.repeat) || dose.timing?.repeat?.frequency);
  pushField(fields, 'Route', textOf(dose.route));
  pushField(fields, 'Duration', dose.timing?.repeat?.period
    ? `${dose.timing.repeat.period} ${dose.timing.repeat.periodUnit || ''}`.trim()
    : '');
  pushField(fields, 'Instructions', dose.patientInstruction || dose.additionalInstruction?.[0]?.text || dose.text);
  pushField(fields, 'Prescription Date', formatDisplayDate(resource.authoredOn));
  return fields;
}

function observationFields(resource) {
  const fields = [];
  pushField(fields, 'Test Name', textOf(resource.code));
  const qty = resource.valueQuantity;
  pushField(fields, 'Result', resource.valueString || (qty ? qty.value : ''));
  pushField(fields, 'Unit', qty?.unit);
  pushField(fields, 'Reference Range', resource.referenceRange?.[0]?.text);
  pushField(fields, 'Report Date', formatDisplayDate(resource.issued));
  return fields;
}

function parsedDocuments(resources) {
  const docs = resources.filter((row) => row.resourceType === 'DocumentReference');
  const objects = [];
  for (const doc of docs) {
    for (const content of doc.content || []) {
      const raw = decodeAttachmentUtf8(content.attachment) || decodeAttachmentData(content.attachment);
      const parsed = parseMaybeJson(raw);
      if (parsed && typeof parsed === 'object') objects.push(parsed);
    }
  }
  return objects;
}

function buildClinical(bundle, resources, recordType) {
  const patient = resources.find((row) => row.resourceType === 'Patient');
  const encounter = resources.find((row) => row.resourceType === 'Encounter');
  const composition = resources.find((row) => row.resourceType === 'Composition');
  const header = uniqueFields([
    field('Patient Name', patientNameOf(patient)),
    field('UHID', uhidOf(patient)),
    field('Record Type', groupTitle(recordType)),
    field('Record Date', formatDisplayDate(composition?.date || encounter?.period?.end || encounter?.period?.start || bundle?.timestamp)),
    field('Source Facility', organizationName(resources)),
    field('Age / Gender', [patient?.age, patient?.gender].filter(Boolean).join(' / ')),
  ].filter(Boolean));

  const blocks = [];
  const docs = parsedDocuments(resources);
  const mergedDoc = docs.reduce((acc, row) => ({ ...acc, ...row }), {});

  if (recordType === 'Prescription') {
    const meds = resources.filter((row) => row.resourceType === 'MedicationRequest');
    meds.forEach((med, index) => {
      const fields = uniqueFields([
        ...medicationFields(med),
        field('Prescribing Doctor', practitionerName(resources)),
      ]);
      if (fields.length) blocks.push({ heading: meds.length > 1 ? `Medicine ${index + 1}` : 'Prescription', fields });
    });
  } else if (recordType === 'DiagnosticReport') {
    resources.filter((row) => row.resourceType === 'Observation').forEach((obs) => {
      const fields = uniqueFields(observationFields(obs));
      if (fields.length) blocks.push({ heading: textOf(obs.code) || 'Lab Result', fields });
    });
    const report = resources.find((row) => row.resourceType === 'DiagnosticReport');
    if (report && !blocks.length) {
      blocks.push({ heading: 'Lab / Diagnostic', fields: uniqueFields(observationFields(report)) });
    }
  } else if (recordType === 'OPConsultation') {
    const fields = [];
    pushField(fields, 'Patient', patientNameOf(patient));
    pushField(fields, 'Doctor', practitionerName(resources));
    pushField(fields, 'Visit / Consultation Date', formatDisplayDate(composition?.date || encounter?.period?.start));
    pushField(fields, 'Chief Complaint', conditionText(resources, 'complaint'));
    pushField(fields, 'Diagnosis / Condition', conditionText(resources, 'diagnosis'));
    pushField(fields, 'Clinical Notes', compositionNotes(composition));
    flattenClinical(mergedDoc, '', fields);
    blocks.push({ heading: 'OP Consultation', fields: uniqueFields(fields) });
  } else if (recordType === 'InpatientRecord') {
    const fields = [];
    pushField(fields, 'Patient', patientNameOf(patient));
    pushField(fields, 'UHID', uhidOf(patient));
    pushField(fields, 'Admission Date', formatDisplayDate(encounter?.period?.start));
    pushField(fields, 'Attending Doctor', practitionerName(resources));
    pushField(fields, 'Diagnosis', conditionText(resources, 'diagnosis'));
    pushField(fields, 'Clinical Notes', compositionNotes(composition) || resources.find((r) => r.resourceType === 'ClinicalImpression')?.description);
    flattenClinical(mergedDoc, '', fields);
    blocks.push({ heading: 'IPD / Admission', fields: uniqueFields(fields) });
  } else if (recordType === 'DischargeSummary') {
    const fields = [];
    pushField(fields, 'Patient Information', patientNameOf(patient) || mergedDoc.patientName || mergedDoc.name);
    pushField(fields, 'UHID', uhidOf(patient) || mergedDoc.uhid);
    pushField(fields, 'Age / Gender', [mergedDoc.age, mergedDoc.gender, patient?.gender].filter(Boolean).join(' / ') || mergedDoc.ageSex);
    pushField(fields, 'Admission Date', formatDisplayDate(encounter?.period?.start || mergedDoc.admissionDate));
    pushField(fields, 'Discharge Date', formatDisplayDate(encounter?.period?.end || mergedDoc.dischargeDate));
    pushField(fields, 'Ward / Bed', [mergedDoc.ward, mergedDoc.bed].filter(Boolean).join(' / '));
    pushField(fields, 'Consultant / Doctor', practitionerName(resources) || mergedDoc.consultant || mergedDoc.doctor);
    flattenClinical(mergedDoc, '', fields);
    pushField(fields, 'Hospital Course', compositionNotes(composition));
    blocks.push({ heading: 'Discharge Summary', fields: uniqueFields(fields) });
  } else {
    const fields = [];
    flattenClinical(mergedDoc, '', fields);
    resources.forEach((resource) => {
      if (['Patient', 'Encounter', 'Composition'].includes(resource.resourceType)) return;
      flattenClinical({
        name: textOf(resource.code) || resource.resourceType,
        notes: resource.description || resource.valueString,
      }, '', fields);
    });
    blocks.push({ heading: 'Additional Records', fields: uniqueFields(fields) });
  }

  return {
    header,
    blocks: blocks.filter((block) => block.fields.length),
  };
}

function summarizeBundle(bundle, { careContextReference, sourceHipId } = {}) {
  const resources = bundleResources(bundle);
  const recordType = classifyRecordType(bundle, resources);
  const composition = resources.find((row) => row.resourceType === 'Composition');
  const encounter = resources.find((row) => row.resourceType === 'Encounter');
  const patient = resources.find((row) => row.resourceType === 'Patient');
  const date = composition?.date || encounter?.period?.end || encounter?.period?.start || bundle?.timestamp || null;
  return {
    recordType,
    group: groupKey(recordType),
    title: groupTitle(recordType),
    date,
    careContextReference: careContextReference || null,
    sourceHipId: sourceHipId || null,
    patientName: patientNameOf(patient) || null,
    uhid: uhidOf(patient) || null,
    facilityName: organizationName(resources) || null,
    clinical: buildClinical(bundle, resources, recordType),
  };
}

module.exports = {
  classifyRecordType,
  summarizeBundle,
  groupKey,
};
