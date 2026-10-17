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

function buildObservation({ id, patientId, result, issued }) {
  const resource = {
    resourceType: 'Observation',
    id,
    status: 'final',
    code: { text: result.testName },
    subject: { reference: urnUuid(patientId) },
    issued,
    valueString: result.value,
  };
  if (result.unit) {
    resource.valueQuantity = {
      value: Number.isFinite(Number(result.value)) ? Number(result.value) : undefined,
      unit: result.unit,
    };
    if (!Number.isFinite(Number(result.value))) {
      delete resource.valueQuantity;
    } else {
      delete resource.valueString;
    }
  }
  if (result.referenceRange) {
    resource.referenceRange = [{ text: result.referenceRange }];
  }
  return resource;
}

function buildDiagnosticReportBundle({ patient, careContext, labOrder, results } = {}) {
  const careContextReference = textOrNull(careContext?.careContextId);
  if (!careContextReference) throw new Error('careContext.careContextId is required.');
  if (!patient?.id) throw new Error('patient.id is required.');
  if (!labOrder?.id) throw new Error('labOrder.id is required.');
  const rows = Array.isArray(results) ? results.filter((row) => textOrNull(row?.testName) && textOrNull(row?.value)) : [];
  if (!rows.length) throw new Error('Final lab results are required.');

  const issued = toIsoDateTime(labOrder.updatedAt || labOrder.createdAt) || new Date().toISOString();
  const seed = `LAB:${labOrder.id}:${careContextReference}`;
  const patientId = stableUuid(`${seed}:patient`);
  const reportId = stableUuid(`${seed}:report`);
  const compositionId = stableUuid(`${seed}:composition`);
  const patientResource = buildSharedPatientResource({ patient, patientId });
  const observations = rows.map((result, index) => buildObservation({
    id: stableUuid(`${seed}:obs:${index}`),
    patientId,
    result: {
      testName: textOrNull(result.testName),
      value: textOrNull(result.value),
      unit: textOrNull(result.unit),
      referenceRange: textOrNull(result.referenceRange),
    },
    issued,
  }));

  const report = {
    resourceType: 'DiagnosticReport',
    id: reportId,
    status: 'final',
    code: { text: textOrNull(labOrder.orderNumber) || 'Laboratory report' },
    subject: { reference: urnUuid(patientId) },
    issued,
    result: observations.map((obs) => ({ reference: urnUuid(obs.id) })),
  };

  const composition = {
    resourceType: 'Composition',
    id: compositionId,
    status: 'final',
    type: {
      coding: [{ system: 'http://snomed.info/sct', code: '721981007', display: 'Diagnostic studies report' }],
      text: 'DiagnosticReport',
    },
    subject: { reference: urnUuid(patientId) },
    date: issued,
    title: 'Diagnostic Report',
    identifier: { system: 'https://abdm.gov.in/care-context', value: careContextReference },
    section: [{
      title: 'Laboratory results',
      entry: [{ reference: urnUuid(reportId) }, ...observations.map((obs) => ({ reference: urnUuid(obs.id) }))],
    }],
  };

  return createDocumentBundle({
    bundleId: stableUuid(`${seed}:bundle`),
    timestamp: issued,
    identifier: { system: 'https://abdm.gov.in/care-context', value: careContextReference },
    entries: [
      bundleEntry(composition),
      bundleEntry(patientResource),
      bundleEntry(report),
      ...observations.map(bundleEntry),
    ],
  });
}

async function buildDiagnosticReportBundleFromLabOrderId(labOrderId) {
  const labOrder = await prisma.labOrder.findUnique({
    where: { id: String(labOrderId || '').trim() },
    include: { patient: true, results: { orderBy: { createdAt: 'asc' } } },
  });
  if (!labOrder) throw new Error(`Lab order not found: ${labOrderId}`);
  const careContext = await prisma.abdmCareContext.findUnique({
    where: { sourceType_sourceId: { sourceType: 'LAB_ORDER', sourceId: labOrder.id } },
  });
  return buildDiagnosticReportBundle({
    patient: labOrder.patient,
    careContext,
    labOrder,
    results: labOrder.results,
  });
}

module.exports = {
  buildDiagnosticReportBundle,
  buildDiagnosticReportBundleFromLabOrderId,
};
