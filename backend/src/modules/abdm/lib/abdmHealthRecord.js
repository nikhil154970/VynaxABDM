const { prisma } = require('../../../config/prisma');
const { requireHipId } = require('./hospitalResolver');
const { callContextNotify, linkEpisodeCareContext, hasPendingEpisodeLink } = require('./abdmHipLinking');
const {
  EPISODE,
  SOURCE,
  toAbdmDisplay,
  resolveEpisodeCareContext,
} = require('./abdmCareContextStore');
const { extractMedicines } = require('../fhir/prescription');

const EVENT = {
  OPD_CONSULTATION: 'OPD_CONSULTATION',
  PRESCRIPTION: 'PRESCRIPTION',
  IPD_PRESCRIPTION: 'IPD_PRESCRIPTION',
  LAB_REPORT: 'LAB_REPORT',
  IPD_ADMISSION: 'IPD_ADMISSION',
  DISCHARGE: 'DISCHARGE',
};

const inFlight = new Set();
const documentRetryInFlight = new Set();

function logHr(label, payload) {
  console.log(`[abdm-hr] ${label}`);
  if (payload !== undefined) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function flightKey(sourceType, sourceId) {
  return `${sourceType}:${sourceId}`;
}

function hasClinicalContent(consultation) {
  const symptoms = String(consultation?.symptoms || '').trim();
  const diagnosis = String(consultation?.diagnosis || '').trim();
  return Boolean(symptoms || diagnosis);
}

function isPatientHipReady(patient) {
  const abhaAddress = String(patient?.abhaAddress || '').trim();
  const linked = patient?.hipLinked === true && String(patient?.careContextStatus || '').toUpperCase() === 'LINKED';
  return Boolean(patient?.isAbhaVerified && abhaAddress && linked);
}

function buildOpdDocument({ patient, consultation, careContextId }) {
  return {
    resourceType: 'OPConsultation',
    hiType: 'OPConsultation',
    sourceType: SOURCE.CONSULTATION,
    sourceId: consultation.id,
    careContextId,
    authoredOn: consultation.createdAt || new Date().toISOString(),
    patient: {
      id: patient.id,
      uhid: patient.uhid || null,
      name: patient.name || null,
    },
    symptoms: String(consultation.symptoms || '').trim(),
    diagnosis: String(consultation.diagnosis || '').trim(),
  };
}

async function upsertHealthDocument({
  patientId,
  careContext,
  sourceType,
  sourceId,
  hiType,
  payload,
}) {
  const existing = await prisma.abdmHealthDocument.findUnique({
    where: { sourceType_sourceId: { sourceType, sourceId } },
  });

  if (existing) {
    return prisma.abdmHealthDocument.update({
      where: { id: existing.id },
      data: {
        payload,
        careContextId: careContext.careContextId,
        abdmCareContextId: careContext.id,
        hiType,
        errorCode: existing.syncStatus === 'SYNCED' ? existing.errorCode : null,
        errorMessage: existing.syncStatus === 'SYNCED' ? existing.errorMessage : null,
      },
    });
  }

  return prisma.abdmHealthDocument.create({
    data: {
      patientId,
      careContextId: careContext.careContextId,
      abdmCareContextId: careContext.id,
      sourceType,
      sourceId,
      hiType,
      payload,
      syncStatus: 'PENDING',
    },
  });
}

async function markDocument(documentId, data) {
  return prisma.abdmHealthDocument.update({
    where: { id: documentId },
    data,
  });
}

function notifyErrorMeta(notifyResult) {
  const data = notifyResult?.data || {};
  const err = data.error || data;
  return {
    errorCode: String(err?.code || err?.errorCode || notifyResult?.status || 'NOTIFY_FAILED'),
    errorMessage: String(err?.message || data.message || 'Context notify failed'),
  };
}

/**
 * Patient-level HIP link (generate-token / Patient.careContextId) is never called here.
 * A new episode CC is linked via linkEpisodeCareContext, then notified only after
 * on_carecontext confirms the episode reference.
 */
async function notifyEpisodeDocument({ patient, careContext, document, created }) {
  if (document.syncStatus === 'SYNCED') {
    logHr('Context notify skipped; document already SYNCED', {
      documentId: document.id,
      sourceId: document.sourceId,
      careContextId: careContext.careContextId,
    });
    return document;
  }

  const facility = await requireHipId(patient.hospitalId);
  logHr(created ? 'Context notify for new episode care context' : 'Context notify for existing episode care context', {
    documentId: document.id,
    sourceId: document.sourceId,
    careContextId: careContext.careContextId,
    hipId: facility.hipId,
  });

  const notifyResult = await callContextNotify({
    hipId: facility.hipId,
    patient,
    careContextId: careContext.careContextId,
    episodeDocumentId: document.id,
    hiTypes: document.hiType ? [document.hiType] : ['OPConsultation'],
  });

  if (!notifyResult) {
    return markDocument(document.id, {
      syncStatus: 'FAILED',
      errorCode: 'NO_ABHA_ADDRESS',
      errorMessage: 'Context notify skipped; patient has no ABHA address.',
    });
  }

  if (notifyResult.error) {
    const meta = notifyErrorMeta(notifyResult);
    return markDocument(document.id, {
      syncStatus: 'FAILED',
      requestId: notifyResult.requestId || null,
      lastNotifiedAt: new Date(),
      ...meta,
    });
  }

  const latest = await prisma.abdmHealthDocument.findUnique({
    where: { id: document.id },
    select: { syncStatus: true },
  });
  if (latest?.syncStatus === 'SYNCED') {
    return markDocument(document.id, {
      requestId: notifyResult.requestId || document.requestId,
      lastNotifiedAt: new Date(),
    });
  }

  return markDocument(document.id, {
    syncStatus: 'PENDING',
    requestId: notifyResult.requestId || null,
    lastNotifiedAt: new Date(),
    errorCode: null,
    errorMessage: null,
  });
}

async function processOpdConsultation({ sourceId, patientId }) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      patientId: true,
      symptoms: true,
      diagnosis: true,
      createdAt: true,
    },
  });
  if (!consultation || consultation.patientId !== patientId) {
    logHr('OPD skipped; consultation not found', { sourceId, patientId });
    return { skipped: true, reason: 'CONSULTATION_NOT_FOUND' };
  }

  if (!hasClinicalContent(consultation)) {
    logHr('OPD skipped; empty consultation', { sourceId, patientId });
    return { skipped: true, reason: 'INCOMPLETE' };
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      uhid: true,
      name: true,
      abhaAddress: true,
      abhaNumber: true,
      isAbhaVerified: true,
      hipLinked: true,
      careContextId: true,
      careContextStatus: true,
      syncStatus: true,
      hospitalId: true,
      gender: true,
      dob: true,
      age: true,
      healthIdNumber: true,
    },
  });
  if (!patient) {
    logHr('OPD skipped; patient not found', { sourceId, patientId });
    return { skipped: true, reason: 'PATIENT_NOT_FOUND' };
  }

  const { careContext, created } = await resolveEpisodeCareContext({
    patient,
    episodeType: EPISODE.OPD_CONSULTATION,
    sourceType: SOURCE.CONSULTATION,
    sourceId: consultation.id,
    hiType: 'OPConsultation',
    display: toAbdmDisplay(`${patient.name || 'Patient'} OPD`, `OPD Visit ${consultation.id}`),
  });

  const payload = buildOpdDocument({
    patient,
    consultation,
    careContextId: careContext.careContextId,
  });

  const document = await upsertHealthDocument({
    patientId: patient.id,
    careContext,
    sourceType: SOURCE.CONSULTATION,
    sourceId: consultation.id,
    hiType: 'OPConsultation',
    payload,
  });

  logHr('OPD document persisted', {
    documentId: document.id,
    sourceId: consultation.id,
    careContextId: careContext.careContextId,
    created,
    syncStatus: document.syncStatus,
  });

  if (!isPatientHipReady(patient)) {
    const updated = await markDocument(document.id, {
      syncStatus: document.syncStatus === 'SYNCED' ? 'SYNCED' : 'PENDING',
      errorCode: 'HIP_NOT_LINKED',
      errorMessage: 'Patient is not ABHA-verified and HIP-linked. Episode document stored; notify skipped.',
    });
    logHr('OPD notify skipped; patient not HIP linked', {
      documentId: document.id,
      sourceId: consultation.id,
      patientCareContextId: patient.careContextId || null,
      careContextStatus: patient.careContextStatus || null,
    });
    return { skipped: true, reason: 'HIP_NOT_LINKED', document: updated, careContext };
  }

  if (document.syncStatus === 'SYNCED') {
    logHr('OPD already SYNCED', {
      documentId: document.id,
      sourceId: consultation.id,
      careContextId: careContext.careContextId,
    });
    return { skipped: true, reason: 'ALREADY_SYNCED', document, careContext };
  }

  if (hasPendingEpisodeLink(document.id)) {
    logHr('OPD episode link already in flight', {
      documentId: document.id,
      careContextId: careContext.careContextId,
    });
    return { skipped: true, reason: 'IN_FLIGHT', document, careContext };
  }

  if (String(careContext.linkStatus || '').toUpperCase() === 'LINKED') {
    const notified = await notifyEpisodeDocument({
      patient,
      careContext,
      document,
      created,
    });
    return { skipped: false, document: notified, careContext, created };
  }

  if (String(document.errorCode || '').includes('1027')) {
    logHr('OPD generate-token skipped; ABDM-1027 block', {
      documentId: document.id,
      careContextId: careContext.careContextId,
    });
    return { skipped: true, reason: 'TOKEN_BLOCKED', document, careContext };
  }

  const facility = await requireHipId(patient.hospitalId);
  logHr('OPD episode care context linking started', {
    documentId: document.id,
    sourceId: consultation.id,
    careContextId: careContext.careContextId,
    patientCareContextId: patient.careContextId || null,
  });
  const linkResult = await linkEpisodeCareContext({
    patient,
    hipId: facility.hipId,
    careContext,
    document,
  });
  return { skipped: false, document, careContext, created, linkResult };
}

const PATIENT_SELECT = {
  id: true,
  uhid: true,
  name: true,
  abhaAddress: true,
  abhaNumber: true,
  isAbhaVerified: true,
  hipLinked: true,
  careContextId: true,
  careContextStatus: true,
  syncStatus: true,
  hospitalId: true,
  gender: true,
  dob: true,
  age: true,
  healthIdNumber: true,
};

async function processEpisodeDocument({
  patient,
  sourceType,
  sourceId,
  episodeType,
  hiType,
  display,
  payload,
  logPrefix,
  persistOnly = false,
}) {
  const { careContext, created } = await resolveEpisodeCareContext({
    patient,
    episodeType,
    sourceType,
    sourceId,
    hiType,
    display,
  });
  const document = await upsertHealthDocument({
    patientId: patient.id,
    careContext,
    sourceType,
    sourceId,
    hiType,
    payload,
  });
  logHr(`${logPrefix} document persisted`, {
    documentId: document.id,
    sourceId,
    careContextId: careContext.careContextId,
    created,
    syncStatus: document.syncStatus,
    persistOnly: Boolean(persistOnly),
  });

  if (persistOnly) {
    return { skipped: false, reason: 'PERSIST_ONLY', document, careContext, created };
  }

  if (!isPatientHipReady(patient)) {
    const updated = await markDocument(document.id, {
      syncStatus: document.syncStatus === 'SYNCED' ? 'SYNCED' : 'PENDING',
      errorCode: 'HIP_NOT_LINKED',
      errorMessage: 'Patient is not ABHA-verified and HIP-linked. Episode document stored; notify skipped.',
    });
    return { skipped: true, reason: 'HIP_NOT_LINKED', document: updated, careContext };
  }
  if (document.syncStatus === 'SYNCED') {
    return { skipped: true, reason: 'ALREADY_SYNCED', document, careContext };
  }
  if (hasPendingEpisodeLink(document.id)) {
    return { skipped: true, reason: 'IN_FLIGHT', document, careContext };
  }
  if (String(careContext.linkStatus || '').toUpperCase() === 'LINKED') {
    const notified = await notifyEpisodeDocument({ patient, careContext, document, created });
    return { skipped: false, document: notified, careContext, created };
  }
  const facility = await requireHipId(patient.hospitalId);
  const linkResult = await linkEpisodeCareContext({ patient, hipId: facility.hipId, careContext, document });
  return { skipped: false, document, careContext, created, linkResult };
}

async function processPrescription({ sourceId, patientId }) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: sourceId },
    select: { id: true, patientId: true, prescription: true, createdAt: true },
  });
  if (!consultation || consultation.patientId !== patientId) {
    return { skipped: true, reason: 'CONSULTATION_NOT_FOUND' };
  }
  const medicines = extractMedicines(consultation.prescription);
  if (!medicines.length) return { skipped: true, reason: 'INCOMPLETE' };
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: PATIENT_SELECT });
  if (!patient) return { skipped: true, reason: 'PATIENT_NOT_FOUND' };
  return processEpisodeDocument({
    patient,
    sourceType: SOURCE.PRESCRIPTION,
    sourceId: consultation.id,
    episodeType: EPISODE.PRESCRIPTION,
    hiType: 'Prescription',
    display: toAbdmDisplay(`${patient.name || 'Patient'} Prescription`, `RX ${consultation.id}`),
    payload: {
      resourceType: 'Prescription',
      hiType: 'Prescription',
      sourceType: SOURCE.PRESCRIPTION,
      sourceId: consultation.id,
      medicines,
      authoredOn: consultation.createdAt,
    },
    logPrefix: 'RX',
  });
}

async function processIpdPrescription({ sourceId, patientId }) {
  const plan = await prisma.treatmentPlan.findUnique({
    where: { id: sourceId },
    include: { admission: { select: { id: true, patientId: true } } },
  });
  if (!plan || plan.admission.patientId !== patientId) {
    return { skipped: true, reason: 'TREATMENT_NOT_FOUND' };
  }
  const medicines = extractMedicines(plan.medicines);
  if (!medicines.length) return { skipped: true, reason: 'INCOMPLETE' };
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: PATIENT_SELECT });
  if (!patient) return { skipped: true, reason: 'PATIENT_NOT_FOUND' };
  return processEpisodeDocument({
    patient,
    sourceType: SOURCE.TREATMENT_PLAN,
    sourceId: plan.id,
    episodeType: EPISODE.IPD_PRESCRIPTION,
    hiType: 'Prescription',
    display: toAbdmDisplay(`${patient.name || 'Patient'} IPD Rx`, `RXIPD ${plan.id}`),
    payload: {
      resourceType: 'Prescription',
      hiType: 'Prescription',
      sourceType: SOURCE.TREATMENT_PLAN,
      sourceId: plan.id,
      medicines,
      authoredOn: plan.updatedAt,
    },
    logPrefix: 'IPD-RX',
  });
}

async function processLabReport({ sourceId, patientId, persistOnly = false }) {
  const labOrder = await prisma.labOrder.findUnique({
    where: { id: sourceId },
    include: { results: true },
  });
  if (!labOrder || labOrder.patientId !== patientId) {
    return { skipped: true, reason: 'LAB_ORDER_NOT_FOUND' };
  }
  const reportStatus = String(labOrder.reportStatus || '').toUpperCase();
  const orderStatus = String(labOrder.status || '').toUpperCase();
  if (orderStatus !== 'COMPLETED' || (reportStatus !== 'COMPLETED' && reportStatus !== 'VERIFIED')) {
    return { skipped: true, reason: 'INCOMPLETE' };
  }
  const results = (labOrder.results || []).filter((row) => String(row.value || '').trim());
  if (!results.length) return { skipped: true, reason: 'INCOMPLETE' };
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: PATIENT_SELECT });
  if (!patient) return { skipped: true, reason: 'PATIENT_NOT_FOUND' };
  return processEpisodeDocument({
    patient,
    sourceType: SOURCE.LAB_ORDER,
    sourceId: labOrder.id,
    episodeType: EPISODE.LAB_REPORT,
    hiType: 'DiagnosticReport',
    display: toAbdmDisplay(`${patient.name || 'Patient'} Lab`, `LAB ${labOrder.orderNumber || labOrder.id}`),
    payload: {
      resourceType: 'DiagnosticReport',
      hiType: 'DiagnosticReport',
      sourceType: SOURCE.LAB_ORDER,
      sourceId: labOrder.id,
      results: results.map((row) => ({
        testName: row.testName,
        value: row.value,
        unit: row.unit,
        referenceRange: row.referenceRange,
      })),
    },
    logPrefix: 'LAB',
    persistOnly,
  });
}

async function processIpdAdmission({ sourceId, patientId }) {
  const admission = await prisma.admission.findUnique({
    where: { id: sourceId },
    select: { id: true, patientId: true, admissionDate: true, notesText: true, ipdNumber: true },
  });
  if (!admission || admission.patientId !== patientId) {
    return { skipped: true, reason: 'ADMISSION_NOT_FOUND' };
  }
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: PATIENT_SELECT });
  if (!patient) return { skipped: true, reason: 'PATIENT_NOT_FOUND' };
  return processEpisodeDocument({
    patient,
    sourceType: SOURCE.ADMISSION,
    sourceId: admission.id,
    episodeType: EPISODE.IPD_ADMISSION,
    hiType: 'HealthDocumentRecord',
    display: toAbdmDisplay(`${patient.name || 'Patient'} IPD`, `IPD ${admission.ipdNumber || admission.id}`),
    payload: {
      resourceType: 'InpatientRecord',
      hiType: 'HealthDocumentRecord',
      sourceType: SOURCE.ADMISSION,
      sourceId: admission.id,
      admissionDate: admission.admissionDate,
      notesText: admission.notesText || null,
    },
    logPrefix: 'IPD',
  });
}

async function processDischarge({ sourceId, patientId }) {
  const admission = await prisma.admission.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      patientId: true,
      dischargeDate: true,
      dischargeSummaryData: true,
      ipdNumber: true,
    },
  });
  if (!admission || admission.patientId !== patientId) {
    return { skipped: true, reason: 'ADMISSION_NOT_FOUND' };
  }
  if (!admission.dischargeDate || !admission.dischargeSummaryData) {
    return { skipped: true, reason: 'INCOMPLETE' };
  }
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: PATIENT_SELECT });
  if (!patient) return { skipped: true, reason: 'PATIENT_NOT_FOUND' };
  return processEpisodeDocument({
    patient,
    sourceType: SOURCE.DISCHARGE,
    sourceId: admission.id,
    episodeType: EPISODE.DISCHARGE,
    hiType: 'DischargeSummary',
    display: toAbdmDisplay(`${patient.name || 'Patient'} Discharge`, `DS ${admission.ipdNumber || admission.id}`),
    payload: {
      resourceType: 'DischargeSummary',
      hiType: 'DischargeSummary',
      sourceType: SOURCE.DISCHARGE,
      sourceId: admission.id,
      dischargeDate: admission.dischargeDate,
    },
    logPrefix: 'DS',
  });
}

/**
 * Central ABDM clinical-event entry. Never throws to the caller’s HTTP path.
 */
async function emitAbdmClinicalEvent({ type, sourceId, patientId, persistOnly = false } = {}) {
  const eventType = String(type || '').trim();
  const source = String(sourceId || '').trim();
  const pid = String(patientId || '').trim();
  const persistOnlyFlag = Boolean(persistOnly) && eventType === EVENT.LAB_REPORT;

  logHr('Clinical event received', { type: eventType, sourceId: source, patientId: pid, persistOnly: persistOnlyFlag });

  if (!eventType || !source || !pid) {
    logHr('Clinical event ignored; missing type, sourceId, or patientId', { type: eventType, sourceId: source, patientId: pid });
    return { skipped: true, reason: 'INVALID_EVENT' };
  }

  const processors = {
    [EVENT.OPD_CONSULTATION]: { fn: processOpdConsultation, sourceType: SOURCE.CONSULTATION },
    [EVENT.PRESCRIPTION]: { fn: processPrescription, sourceType: SOURCE.PRESCRIPTION },
    [EVENT.IPD_PRESCRIPTION]: { fn: processIpdPrescription, sourceType: SOURCE.TREATMENT_PLAN },
    [EVENT.LAB_REPORT]: { fn: processLabReport, sourceType: SOURCE.LAB_ORDER },
    [EVENT.IPD_ADMISSION]: { fn: processIpdAdmission, sourceType: SOURCE.ADMISSION },
    [EVENT.DISCHARGE]: { fn: processDischarge, sourceType: SOURCE.DISCHARGE },
  };
  const processor = processors[eventType];
  if (!processor) {
    logHr('Clinical event ignored; type not implemented', { type: eventType, sourceId: source });
    return { skipped: true, reason: 'TYPE_NOT_IMPLEMENTED' };
  }

  const key = flightKey(processor.sourceType, source);
  if (inFlight.has(key)) {
    logHr('Clinical event ignored; notify already in flight', { type: eventType, sourceId: source });
    return { skipped: true, reason: 'IN_FLIGHT' };
  }

  inFlight.add(key);
  try {
    return await processor.fn({ sourceId: source, patientId: pid, persistOnly: persistOnlyFlag });
  } catch (err) {
    logHr('Clinical event failed', {
      type: eventType,
      sourceId: source,
      patientId: pid,
      message: err.message,
    });
    return { skipped: true, reason: 'ERROR', error: err.message };
  } finally {
    inFlight.delete(key);
  }
}

function serializeHealthDocument(document, careContext) {
  if (!document) return null;
  const syncStatus = String(document.syncStatus || '').toUpperCase();
  return {
    id: document.id,
    patientId: document.patientId,
    careContextId: document.careContextId,
    sourceType: document.sourceType,
    sourceId: document.sourceId,
    hiType: document.hiType,
    syncStatus,
    errorCode: document.errorCode || null,
    errorMessage: document.errorMessage || null,
    requestId: document.requestId || null,
    lastNotifiedAt: document.lastNotifiedAt || null,
    linkStatus: careContext?.linkStatus || null,
    pendingCallback: syncStatus === 'PENDING',
  };
}

function isRetryableDocument(document) {
  const sync = String(document?.syncStatus || '').toUpperCase();
  if (sync === 'FAILED') return true;
  if (sync === 'PENDING' && (document.errorCode || document.errorMessage)) return true;
  return false;
}

async function loadHealthDocumentBundle({ documentId, sourceType, sourceId } = {}) {
  if (documentId) {
    return prisma.abdmHealthDocument.findUnique({
      where: { id: documentId },
      include: { careContext: true },
    });
  }
  if (sourceType && sourceId) {
    return prisma.abdmHealthDocument.findUnique({
      where: { sourceType_sourceId: { sourceType, sourceId } },
      include: { careContext: true },
    });
  }
  return null;
}

async function getAbdmHealthDocument({ documentId, sourceType, sourceId } = {}) {
  if (!documentId && !(sourceType && sourceId)) {
    return { status: 400, body: { success: false, message: 'documentId or sourceType+sourceId is required.' } };
  }
  const document = await loadHealthDocumentBundle({ documentId, sourceType, sourceId });
  if (!document) {
    return { status: 404, body: { success: false, message: 'ABDM health document not found.' } };
  }
  return {
    status: 200,
    body: {
      success: true,
      document: serializeHealthDocument(document, document.careContext),
      retryable: isRetryableDocument(document),
    },
  };
}

/**
 * Retry an existing episode document. Never creates a consultation, document, or care context.
 */
async function retryAbdmHealthDocument({ documentId } = {}) {
  if (!documentId) {
    return { status: 400, body: { success: false, message: 'documentId is required.' } };
  }

  const document = await loadHealthDocumentBundle({ documentId });
  if (!document) {
    return { status: 404, body: { success: false, message: 'ABDM health document not found.' } };
  }

  let careContext = document.careContext;
  if (!careContext && document.careContextId) {
    careContext = await prisma.abdmCareContext.findUnique({
      where: { careContextId: document.careContextId },
    });
  }
  if (!careContext) {
    return {
      status: 409,
      body: {
        success: false,
        message: 'Existing episode care context was not found. Retry will not create a new one.',
        document: serializeHealthDocument(document, null),
      },
    };
  }

  if (String(document.syncStatus || '').toUpperCase() === 'SYNCED') {
    return {
      status: 200,
      body: {
        success: true,
        duplicate: true,
        message: 'ABDM Sync Completed',
        document: serializeHealthDocument(document, careContext),
        retryable: false,
      },
    };
  }

  if (documentRetryInFlight.has(document.id) || hasPendingEpisodeLink(document.id)) {
    return {
      status: 200,
      body: {
        success: true,
        pendingCallback: true,
        message: 'ABDM sync retry is already in progress.',
        document: serializeHealthDocument(document, careContext),
        retryable: false,
      },
    };
  }

  const lastError = String(document.errorCode || '');
  const linkStatus = String(careContext.linkStatus || '').toUpperCase();
  const alreadyLinked = linkStatus === 'LINKED';
  const needsLink = !alreadyLinked;

  documentRetryInFlight.add(document.id);
  try {
    const pendingDoc = await markDocument(document.id, {
      syncStatus: 'PENDING',
      errorCode: null,
      errorMessage: null,
    });

    const patient = await prisma.patient.findUnique({
      where: { id: document.patientId },
      select: {
        id: true,
        uhid: true,
        name: true,
        abhaAddress: true,
        abhaNumber: true,
        isAbhaVerified: true,
        hipLinked: true,
        careContextId: true,
        careContextStatus: true,
        syncStatus: true,
        hospitalId: true,
        gender: true,
        dob: true,
        age: true,
        healthIdNumber: true,
      },
    });
    if (!patient || !isPatientHipReady(patient)) {
      const updated = await markDocument(document.id, {
        syncStatus: 'FAILED',
        errorCode: 'HIP_NOT_LINKED',
        errorMessage: 'Patient is not ABHA-verified and HIP-linked. Episode document was not changed.',
      });
      return {
        status: 409,
        body: {
          success: false,
          message: 'Patient is not HIP linked. Existing document was kept.',
          document: serializeHealthDocument(updated, careContext),
          retryable: true,
        },
      };
    }

    const facility = await requireHipId(patient.hospitalId);
    logHr('Health document retry started', {
      documentId: document.id,
      sourceId: document.sourceId,
      careContextId: careContext.careContextId,
      needsLink,
      alreadyLinked,
      linkStatus,
      lastError: lastError || null,
      patientCareContextId: patient.careContextId || null,
    });

    if (alreadyLinked) {
      const notified = await notifyEpisodeDocument({
        patient,
        careContext,
        document: pendingDoc,
        created: false,
      });
      return {
        status: notified.syncStatus === 'FAILED' ? 502 : notified.syncStatus === 'SYNCED' ? 200 : 202,
        body: {
          success: notified.syncStatus !== 'FAILED',
          pendingCallback: notified.syncStatus === 'PENDING',
          message: notified.syncStatus === 'SYNCED'
            ? 'ABDM Sync Completed'
            : 'Context notify requested. Waiting for ABDM confirmation.',
          document: serializeHealthDocument(notified, careContext),
          retryable: notified.syncStatus === 'FAILED',
        },
      };
    }

    if (needsLink) {
      const linkResult = await linkEpisodeCareContext({
        patient,
        hipId: facility.hipId,
        careContext,
        document: pendingDoc,
        allowGenerateToken: false,
      });
      if (linkResult?.alreadyLinked) {
        const notified = await notifyEpisodeDocument({
          patient,
          careContext: { ...careContext, linkStatus: 'LINKED' },
          document: pendingDoc,
          created: false,
        });
        return {
          status: notified.syncStatus === 'FAILED' ? 502 : notified.syncStatus === 'SYNCED' ? 200 : 202,
          body: {
            success: notified.syncStatus !== 'FAILED',
            pendingCallback: notified.syncStatus === 'PENDING',
            message: notified.syncStatus === 'SYNCED'
              ? 'ABDM Sync Completed'
              : 'Context notify requested. Waiting for ABDM confirmation.',
            document: serializeHealthDocument(notified, { ...careContext, linkStatus: 'LINKED' }),
            retryable: notified.syncStatus === 'FAILED',
          },
        };
      }
      const latest = await loadHealthDocumentBundle({ documentId: document.id });
      return {
        status: linkResult?.error ? 502 : 202,
        body: {
          success: !linkResult?.error,
          pendingCallback: !linkResult?.error,
          message: linkResult?.error
            ? latest?.errorMessage || 'Episode care context link failed.'
            : 'Care context link requested. Waiting for ABDM confirmation.',
          document: serializeHealthDocument(latest, latest?.careContext || careContext),
          retryable: Boolean(linkResult?.error),
          linkResult: linkResult || null,
        },
      };
    }

    const notified = await notifyEpisodeDocument({
      patient,
      careContext,
      document: pendingDoc,
      created: false,
    });
    return {
      status: notified.syncStatus === 'FAILED' ? 502 : notified.syncStatus === 'SYNCED' ? 200 : 202,
      body: {
        success: notified.syncStatus !== 'FAILED',
        pendingCallback: notified.syncStatus === 'PENDING',
        message: notified.syncStatus === 'SYNCED' ? 'ABDM Sync Completed' : 'Context notify requested. Waiting for ABDM confirmation.',
        document: serializeHealthDocument(notified, careContext),
        retryable: notified.syncStatus === 'FAILED',
      },
    };
  } catch (err) {
    logHr('Health document retry failed', {
      documentId: document.id,
      message: err.message,
    });
    const failed = await markDocument(document.id, {
      syncStatus: 'FAILED',
      errorCode: 'RETRY_FAILED',
      errorMessage: err.message,
    });
    return {
      status: 500,
      body: {
        success: false,
        message: err.message || 'ABDM health document retry failed.',
        document: serializeHealthDocument(failed, careContext),
        retryable: true,
      },
    };
  } finally {
    documentRetryInFlight.delete(document.id);
  }
}

function recordTypeLabel(sourceType, hiType) {
  const source = String(sourceType || '').toUpperCase();
  const hi = String(hiType || '').toUpperCase();
  if (source === 'CONSULTATION' || hi === 'OPCONSULTATION') return 'OPD';
  if (source === 'DISCHARGE' || hi === 'DISCHARGESUMMARY') return 'Discharge';
  if (source === 'LAB_ORDER' || hi === 'DIAGNOSTICREPORT') return 'Lab';
  if (source === 'ADMISSION' || hi === 'INPATIENTRECORD') return 'IPD';
  return source || hi || 'Record';
}

function toRecordRow({ sourceType, sourceId, recordType, recordDate, document, careContext, patientId }) {
  if (document) {
    const serialized = serializeHealthDocument(document, careContext || document.careContext);
    return {
      ...serialized,
      recordType,
      recordDate: recordDate || document.lastNotifiedAt || document.updatedAt || document.createdAt,
      retryCount: document.retryCount ?? null,
      retryable: isRetryableDocument(document),
    };
  }
  return {
    id: null,
    patientId: patientId || null,
    careContextId: null,
    sourceType,
    sourceId,
    hiType: null,
    syncStatus: 'NOT_SENT',
    errorCode: null,
    errorMessage: null,
    requestId: null,
    lastNotifiedAt: null,
    linkStatus: null,
    pendingCallback: false,
    recordType,
    recordDate,
    retryCount: null,
    retryable: false,
  };
}

/**
 * Persist-only LAB backfill. Does not call generate-token / link / notify / HI APIs.
 * Eligible: COMPLETED + reportStatus COMPLETED|VERIFIED + at least one LabResult
 * + no AbdmHealthDocument for LAB_ORDER:sourceId.
 */
async function backfillMissingLabAbdmDocuments({ patientId, labOrderId } = {}) {
  const pid = String(patientId || '').trim();
  const oid = String(labOrderId || '').trim();
  if (!pid && !oid) {
    return { skipped: true, reason: 'NO_SCOPE', count: 0 };
  }

  const orders = await prisma.labOrder.findMany({
    where: {
      ...(oid ? { id: oid } : {}),
      ...(pid ? { patientId: pid } : {}),
      status: 'COMPLETED',
      reportStatus: { in: ['COMPLETED', 'VERIFIED'] },
      results: { some: {} },
    },
    select: { id: true, patientId: true, orderNumber: true },
    take: 50,
  });
  if (!orders.length) {
    return { skipped: true, reason: 'NO_CANDIDATES', count: 0 };
  }

  const existing = await prisma.abdmHealthDocument.findMany({
    where: {
      sourceType: SOURCE.LAB_ORDER,
      sourceId: { in: orders.map((row) => row.id) },
    },
    select: { sourceId: true },
  });
  const haveDoc = new Set(existing.map((row) => row.sourceId));
  const missing = orders.filter((row) => !haveDoc.has(row.id));
  if (!missing.length) {
    return { skipped: true, reason: 'ALREADY_PRESENT', count: 0 };
  }

  logHr('LAB persist-only backfill', {
    patientId: pid || null,
    labOrderId: oid || null,
    count: missing.length,
    orderNumbers: missing.map((row) => row.orderNumber),
  });

  const results = [];
  for (const order of missing) {
    const result = await emitAbdmClinicalEvent({
      type: EVENT.LAB_REPORT,
      sourceId: order.id,
      patientId: order.patientId,
      persistOnly: true,
    });
    results.push({
      sourceId: order.id,
      orderNumber: order.orderNumber,
      skipped: result?.skipped,
      reason: result?.reason || null,
      careContextId: result?.careContext?.careContextId || null,
      documentId: result?.document?.id || null,
    });
  }
  return { skipped: false, count: missing.length, results };
}

/**
 * Patient-level OPD/IPD/Lab/Discharge sync visibility.
 * NOT_SENT is derived when no AbdmHealthDocument exists.
 */
async function listAbdmPatientHealthRecords(patientId) {
  const pid = String(patientId || '').trim();
  if (!pid) {
    return { status: 400, body: { success: false, message: 'patientId is required.' } };
  }

  try {
    await backfillMissingLabAbdmDocuments({ patientId: pid });
  } catch (err) {
    logHr('LAB persist-only backfill failed', { patientId: pid, message: err.message });
  }

  const [documents, consultations, admissions, labOrders] = await Promise.all([
    prisma.abdmHealthDocument.findMany({
      where: { patientId: pid },
      include: { careContext: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.consultation.findMany({
      where: { patientId: pid },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.admission.findMany({
      where: { patientId: pid },
      select: { id: true, admissionDate: true, dischargeDate: true, createdAt: true },
      orderBy: { admissionDate: 'desc' },
    }),
    prisma.labOrder.findMany({
      where: { patientId: pid },
      select: { id: true, createdAt: true, orderNumber: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const bySource = new Map();
  for (const document of documents) {
    bySource.set(`${document.sourceType}:${document.sourceId}`, document);
  }

  const records = [];
  const used = new Set();

  for (const row of consultations) {
    const key = `${SOURCE.CONSULTATION}:${row.id}`;
    used.add(key);
    records.push(toRecordRow({
      sourceType: SOURCE.CONSULTATION,
      sourceId: row.id,
      recordType: 'OPD',
      recordDate: row.createdAt,
      document: bySource.get(key),
      patientId: pid,
    }));
  }

  for (const row of admissions) {
    const ipdKey = `ADMISSION:${row.id}`;
    used.add(ipdKey);
    records.push(toRecordRow({
      sourceType: 'ADMISSION',
      sourceId: row.id,
      recordType: 'IPD',
      recordDate: row.admissionDate || row.createdAt,
      document: bySource.get(ipdKey),
      patientId: pid,
    }));
    if (row.dischargeDate) {
      const dKey = `DISCHARGE:${row.id}`;
      used.add(dKey);
      records.push(toRecordRow({
        sourceType: 'DISCHARGE',
        sourceId: row.id,
        recordType: 'Discharge',
        recordDate: row.dischargeDate,
        document: bySource.get(dKey),
        patientId: pid,
      }));
    }
  }

  for (const row of labOrders) {
    const key = `LAB_ORDER:${row.id}`;
    used.add(key);
    records.push(toRecordRow({
      sourceType: 'LAB_ORDER',
      sourceId: row.id,
      recordType: 'Lab',
      recordDate: row.createdAt,
      document: bySource.get(key),
      patientId: pid,
    }));
  }

  for (const document of documents) {
    const key = `${document.sourceType}:${document.sourceId}`;
    if (used.has(key)) continue;
    records.push(toRecordRow({
      sourceType: document.sourceType,
      sourceId: document.sourceId,
      recordType: recordTypeLabel(document.sourceType, document.hiType),
      recordDate: document.lastNotifiedAt || document.updatedAt,
      document,
    }));
  }

  records.sort((a, b) => new Date(b.recordDate || 0) - new Date(a.recordDate || 0));

  return {
    status: 200,
    body: {
      success: true,
      records,
    },
  };
}

module.exports = {
  emitAbdmClinicalEvent,
  retryAbdmHealthDocument,
  getAbdmHealthDocument,
  listAbdmPatientHealthRecords,
  backfillMissingLabAbdmDocuments,
  EVENT,
};
