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

function summaryToText(dischargeSummaryData) {
  if (!dischargeSummaryData) return null;
  if (typeof dischargeSummaryData === 'string') return textOrNull(dischargeSummaryData);
  if (typeof dischargeSummaryData !== 'object') return null;
  const parts = [];
  for (const [key, value] of Object.entries(dischargeSummaryData)) {
    if (value == null || value === '') continue;
    if (typeof value === 'object') {
      parts.push(`${key}: ${JSON.stringify(value)}`);
    } else {
      parts.push(`${key}: ${value}`);
    }
  }
  return parts.join('\n') || null;
}

function buildDischargeSummaryBundle({ patient, careContext, admission } = {}) {
  const careContextReference = textOrNull(careContext?.careContextId);
  if (!careContextReference) throw new Error('careContext.careContextId is required.');
  if (!patient?.id) throw new Error('patient.id is required.');
  if (!admission?.id) throw new Error('admission.id is required.');
  if (!admission.dischargeDate) throw new Error('dischargeDate is required.');
  const summaryText = summaryToText(admission.dischargeSummaryData);
  if (!summaryText) throw new Error('dischargeSummaryData is required.');

  const authoredOn = toIsoDateTime(admission.dischargeDate);
  const seed = `DS:${admission.id}:${careContextReference}`;
  const patientId = stableUuid(`${seed}:patient`);
  const encounterId = stableUuid(`${seed}:encounter`);
  const compositionId = stableUuid(`${seed}:composition`);
  const summaryId = stableUuid(`${seed}:summary`);

  const encounter = {
    resourceType: 'Encounter',
    id: encounterId,
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'IMP',
      display: 'inpatient encounter',
    },
    subject: { reference: urnUuid(patientId) },
    period: {
      start: toIsoDateTime(admission.admissionDate) || authoredOn,
      end: authoredOn,
    },
    identifier: [{ system: 'https://abdm.gov.in/care-context', value: careContextReference }],
  };

  const composition = {
    resourceType: 'Composition',
    id: compositionId,
    status: 'final',
    type: {
      coding: [{ system: 'http://snomed.info/sct', code: '373942005', display: 'Discharge summary' }],
      text: 'DischargeSummary',
    },
    subject: { reference: urnUuid(patientId) },
    encounter: { reference: urnUuid(encounterId) },
    date: authoredOn,
    title: 'Discharge Summary',
    identifier: { system: 'https://abdm.gov.in/care-context', value: careContextReference },
    section: [{
      title: 'Discharge summary',
      text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${summaryText.replace(/</g, '')}</div>` },
      entry: [{ reference: urnUuid(summaryId) }],
    }],
  };

  const document = {
    resourceType: 'DocumentReference',
    id: summaryId,
    status: 'current',
    subject: { reference: urnUuid(patientId) },
    description: summaryText,
    content: [{
      attachment: {
        contentType: 'text/plain',
        title: 'Discharge summary',
        data: Buffer.from(summaryText, 'utf8').toString('base64'),
      },
    }],
  };

  return createDocumentBundle({
    bundleId: stableUuid(`${seed}:bundle`),
    timestamp: authoredOn,
    identifier: { system: 'https://abdm.gov.in/care-context', value: careContextReference },
    entries: [
      bundleEntry(composition),
      bundleEntry(buildSharedPatientResource({ patient, patientId })),
      bundleEntry(encounter),
      bundleEntry(document),
    ],
  });
}

async function buildDischargeSummaryBundleFromAdmissionId(admissionId) {
  const admission = await prisma.admission.findUnique({
    where: { id: String(admissionId || '').trim() },
    include: { patient: true },
  });
  if (!admission) throw new Error(`Admission not found: ${admissionId}`);
  const careContext = await prisma.abdmCareContext.findUnique({
    where: { sourceType_sourceId: { sourceType: 'DISCHARGE', sourceId: admission.id } },
  });
  return buildDischargeSummaryBundle({
    patient: admission.patient,
    careContext,
    admission,
  });
}

module.exports = {
  buildDischargeSummaryBundle,
  buildDischargeSummaryBundleFromAdmissionId,
};
