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

function extractMedicines(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      if (row.labTest && !row.medicine && !row.name && !row.drug) return null;
      const name = textOrNull(row.medicine || row.name || row.drug);
      if (!name) return null;
      return {
        name,
        dosage: textOrNull(row.dosage || row.dose),
        frequency: textOrNull(row.frequency),
        duration: textOrNull(row.duration),
        instructions: textOrNull(row.instructions || row.notes),
      };
    })
    .filter(Boolean);
}

function buildMedicationRequest({ id, patientId, authoredOn, medicine }) {
  const resource = {
    resourceType: 'MedicationRequest',
    id,
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: { text: medicine.name },
    subject: { reference: urnUuid(patientId) },
    authoredOn,
  };
  const doseText = [medicine.dosage, medicine.frequency, medicine.duration, medicine.instructions]
    .filter(Boolean)
    .join(', ');
  if (doseText) {
    resource.dosageInstruction = [{ text: doseText }];
  }
  return resource;
}

function buildPrescriptionBundle({
  patient,
  careContext,
  sourceId,
  authoredOn,
  medicines,
  title = 'Prescription',
} = {}) {
  const careContextReference = textOrNull(careContext?.careContextId);
  if (!careContextReference) throw new Error('careContext.careContextId is required.');
  if (!patient?.id) throw new Error('patient.id is required.');
  const meds = Array.isArray(medicines) ? medicines.filter((row) => row?.name) : [];
  if (!meds.length) throw new Error('At least one medicine is required.');

  const when = toIsoDateTime(authoredOn) || new Date().toISOString();
  const seed = `RX:${sourceId}:${careContextReference}`;
  const patientId = stableUuid(`${seed}:patient`);
  const compositionId = stableUuid(`${seed}:composition`);
  const sectionEntries = [];
  const resources = [buildSharedPatientResource({ patient, patientId })];

  meds.forEach((medicine, index) => {
    const id = stableUuid(`${seed}:med:${index}`);
    resources.push(buildMedicationRequest({ id, patientId, authoredOn: when, medicine }));
    sectionEntries.push({ reference: urnUuid(id) });
  });

  const composition = {
    resourceType: 'Composition',
    id: compositionId,
    status: 'final',
    type: {
      coding: [{ system: 'http://snomed.info/sct', code: '440545006', display: 'Prescription record' }],
      text: 'Prescription',
    },
    subject: { reference: urnUuid(patientId) },
    date: when,
    title,
    identifier: { system: 'https://abdm.gov.in/care-context', value: careContextReference },
    section: [{ title, entry: sectionEntries }],
  };

  return createDocumentBundle({
    bundleId: stableUuid(`${seed}:bundle`),
    timestamp: when,
    identifier: { system: 'https://abdm.gov.in/care-context', value: careContextReference },
    entries: [bundleEntry(composition), ...resources.map(bundleEntry)],
  });
}

async function buildPrescriptionBundleFromConsultationId(consultationId) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: String(consultationId || '').trim() },
    include: { patient: true },
  });
  if (!consultation) throw new Error(`Consultation not found: ${consultationId}`);
  const careContext = await prisma.abdmCareContext.findUnique({
    where: { sourceType_sourceId: { sourceType: 'PRESCRIPTION', sourceId: consultation.id } },
  });
  return buildPrescriptionBundle({
    patient: consultation.patient,
    careContext,
    sourceId: consultation.id,
    authoredOn: consultation.createdAt,
    medicines: extractMedicines(consultation.prescription),
  });
}

async function buildPrescriptionBundleFromTreatmentPlanId(treatmentPlanId) {
  const plan = await prisma.treatmentPlan.findUnique({
    where: { id: String(treatmentPlanId || '').trim() },
    include: { admission: { include: { patient: true } } },
  });
  if (!plan) throw new Error(`Treatment plan not found: ${treatmentPlanId}`);
  const careContext = await prisma.abdmCareContext.findUnique({
    where: { sourceType_sourceId: { sourceType: 'TREATMENT_PLAN', sourceId: plan.id } },
  });
  return buildPrescriptionBundle({
    patient: plan.admission.patient,
    careContext,
    sourceId: plan.id,
    authoredOn: plan.updatedAt || plan.createdAt,
    medicines: extractMedicines(plan.medicines),
    title: 'IPD Prescription',
  });
}

module.exports = {
  extractMedicines,
  buildPrescriptionBundle,
  buildPrescriptionBundleFromConsultationId,
  buildPrescriptionBundleFromTreatmentPlanId,
};
