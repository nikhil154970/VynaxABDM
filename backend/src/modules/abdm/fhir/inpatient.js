const { prisma } = require('../../../config/prisma');
const {
  toIsoDateTime,
  stableUuid,
  urnUuid,
  bundleEntry,
  createDocumentBundle,
  textOrNull,
  buildSharedPatientResource,
} = require('./bundle');

function buildInpatientBundle({ patient, careContext, admission, treatmentPlan, nursingNotes } = {}) {
  const careContextReference = textOrNull(careContext?.careContextId);
  if (!careContextReference) throw new Error('careContext.careContextId is required.');
  if (!patient?.id) throw new Error('patient.id is required.');
  if (!admission?.id) throw new Error('admission.id is required.');

  const start = toIsoDateTime(admission.admissionDate) || new Date().toISOString();
  const seed = `IPD:${admission.id}:${careContextReference}`;
  const patientId = stableUuid(`${seed}:patient`);
  const encounterId = stableUuid(`${seed}:encounter`);
  const compositionId = stableUuid(`${seed}:composition`);

  const encounter = {
    resourceType: 'Encounter',
    id: encounterId,
    status: admission.dischargeDate ? 'finished' : 'in-progress',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'IMP',
      display: 'inpatient encounter',
    },
    subject: { reference: urnUuid(patientId) },
    period: { start },
    identifier: [{ system: 'https://abdm.gov.in/care-context', value: careContextReference }],
  };
  if (admission.dischargeDate) {
    encounter.period.end = toIsoDateTime(admission.dischargeDate);
  }

  const resources = [
    buildSharedPatientResource({ patient, patientId }),
    encounter,
  ];
  const sectionEntries = [{ reference: urnUuid(encounterId) }];

  const treatmentText = [
    textOrNull(treatmentPlan?.description),
    textOrNull(treatmentPlan?.instructions),
  ].filter(Boolean).join('\n');
  if (treatmentText) {
    const id = stableUuid(`${seed}:treatment`);
    resources.push({
      resourceType: 'ClinicalImpression',
      id,
      status: 'completed',
      subject: { reference: urnUuid(patientId) },
      encounter: { reference: urnUuid(encounterId) },
      description: treatmentText,
    });
    sectionEntries.push({ reference: urnUuid(id) });
  }

  const noteText = Array.isArray(nursingNotes)
    ? nursingNotes.map((row) => textOrNull(row?.note || row?.text || row?.content)).filter(Boolean).join('\n')
    : textOrNull(admission.notesText);
  if (noteText) {
    const id = stableUuid(`${seed}:notes`);
    resources.push({
      resourceType: 'DocumentReference',
      id,
      status: 'current',
      subject: { reference: urnUuid(patientId) },
      description: noteText,
      content: [{ attachment: { contentType: 'text/plain', title: 'Nursing / admission notes' } }],
    });
    sectionEntries.push({ reference: urnUuid(id) });
  }

  const composition = {
    resourceType: 'Composition',
    id: compositionId,
    status: 'final',
    type: {
      coding: [{ system: 'http://snomed.info/sct', code: '432102000', display: 'Administration of care' }],
      text: 'Inpatient record',
    },
    subject: { reference: urnUuid(patientId) },
    encounter: { reference: urnUuid(encounterId) },
    date: start,
    title: 'IPD Encounter',
    identifier: { system: 'https://abdm.gov.in/care-context', value: careContextReference },
    section: [{ title: 'Inpatient record', entry: sectionEntries }],
  };

  return createDocumentBundle({
    bundleId: stableUuid(`${seed}:bundle`),
    timestamp: start,
    identifier: { system: 'https://abdm.gov.in/care-context', value: careContextReference },
    entries: [bundleEntry(composition), ...resources.map(bundleEntry)],
  });
}

async function buildInpatientBundleFromAdmissionId(admissionId) {
  const admission = await prisma.admission.findUnique({
    where: { id: String(admissionId || '').trim() },
    include: {
      patient: true,
      treatmentPlan: true,
      nursingNotes: { take: 20, orderBy: { createdAt: 'desc' }, select: { notes: true, createdAt: true } },
    },
  });
  if (!admission) throw new Error(`Admission not found: ${admissionId}`);
  const careContext = await prisma.abdmCareContext.findUnique({
    where: { sourceType_sourceId: { sourceType: 'ADMISSION', sourceId: admission.id } },
  });
  const nursingNotes = (admission.nursingNotes || []).map((row) => ({
    note: row.notes,
  }));
  return buildInpatientBundle({
    patient: admission.patient,
    careContext,
    admission,
    treatmentPlan: admission.treatmentPlan,
    nursingNotes,
  });
}

module.exports = {
  buildInpatientBundle,
  buildInpatientBundleFromAdmissionId,
};
