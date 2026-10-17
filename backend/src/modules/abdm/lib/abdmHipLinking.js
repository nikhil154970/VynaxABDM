const crypto = require('crypto');
const { prisma } = require('../../../config/prisma');
const { client } = require('./abdmClient');
const { buildAbdmHeaders } = require('./abdmHeaders');
const { ensureAccessToken } = require('./abdmCertificate');
const { abdmConfig } = require('./abdmConfig');
const { requireHipId } = require('./hospitalResolver');

/** Official Link Token + Care Context paths (ABDM V3 HIE-CM). */
const GENERATE_TOKEN_PATH = '/v3/token/generate-token';
const LINK_CARECONTEXT_PATH = '/hip/v3/link/carecontext';
const CONTEXT_NOTIFY_PATH = '/hip/v3/link/context/notify';

/** In-memory map: generate-token requestId → patientId (callback correlation). */
const pendingLinkByRequestId = new Map();
/** In-memory map: care-context link requestId → patient/HIP/care-context used for that request. */
const pendingCareContextByRequestId = new Map();
/** In-memory map: context-notify requestId → patientId (on-notify correlation). */
const pendingNotifyByRequestId = new Map();
/** Episode document notify: requestId → { documentId }. Does not update Patient.syncStatus. */
const pendingEpisodeNotifyByRequestId = new Map();
/** Episode generate-token requestId → episode link meta. Never uses finalizeHipLink. */
const pendingEpisodeTokenByRequestId = new Map();
/** Episode link/carecontext requestId → episode meta. Never writes Patient.careContextId. */
const pendingEpisodeCareContextByRequestId = new Map();
/** Patient ids whose context-notify retry is inside callContextNotify, before the map entry exists. */
const contextNotifyRetryInFlight = new Set();

function maskToken(value) {
  const s = String(value || '');
  if (s.length < 12) return s ? '***' : '';
  return `${s.slice(0, 6)}…${s.slice(-4)} (len=${s.length})`;
}

function maskAbhaNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 8) return digits || '';
  return `${digits.slice(0, 2)}****${digits.slice(-4)}`;
}

function toAbhaNumberDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function toAbdmGender(gender) {
  const g = String(gender || '').trim().toUpperCase();
  if (g === 'M' || g === 'MALE') return 'M';
  if (g === 'F' || g === 'FEMALE') return 'F';
  if (g === 'O' || g === 'OTHER' || g === 'TRANSGENDER') return 'O';
  return 'O';
}

function yearOfBirthFromPatient(patient) {
  if (patient?.dob) {
    const d = new Date(patient.dob);
    if (!Number.isNaN(d.getTime())) return d.getFullYear();
  }
  if (patient?.age != null && Number.isFinite(Number(patient.age))) {
    return new Date().getFullYear() - Number(patient.age);
  }
  return null;
}

function buildCareContextId(patient) {
  const uhid = String(patient.uhid || patient.id || 'UNK').replace(/\s+/g, '');
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `CC-${uhid}-${day}`;
}

/** ABDM display allows letters, digits, spaces, and hyphen only. */
function toAbdmDisplay(value, fallback) {
  const cleaned = String(value || fallback || '')
    .replace(/[—–]/g, '-')
    .replace(/[^A-Za-z0-9 -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'OPD Visit').slice(0, 50);
}

function buildPatientReference(patient) {
  return String(patient.uhid || patient.id);
}

function logMasked(label, payload) {
  console.log(`[abdm-hip] ${label}`);
  console.log(JSON.stringify(payload, null, 2));
}

function rememberPending(requestId, patientId, meta = {}) {
  if (!requestId || !patientId) return;
  pendingLinkByRequestId.set(requestId, {
    patientId,
    ...meta,
    createdAt: new Date().toISOString(),
  });
}

function takePending(requestId) {
  if (!requestId) return null;
  const row = pendingLinkByRequestId.get(requestId) || null;
  if (row) pendingLinkByRequestId.delete(requestId);
  return row;
}

async function updatePatientHip(patientId, data) {
  return prisma.patient.update({
    where: { id: patientId },
    data,
    select: {
      id: true,
      uhid: true,
      name: true,
      abhaNumber: true,
      abhaAddress: true,
      isAbhaVerified: true,
      hipLinked: true,
      careContextId: true,
      careContextStatus: true,
      linkedAt: true,
      syncStatus: true,
      hipLinkRequestId: true,
      hipReferenceNumber: true,
    },
  });
}

/**
 * Official generate-token body (HIECM-LinkTokenService.yml):
 * { abhaNumber?, abhaAddress?, name, gender, yearOfBirth }
 * Headers: Authorization, REQUEST-ID, TIMESTAMP, X-CM-ID, X-HIP-ID
 *
 * Note: Postman collection body { requestId, timestamp, patientId } is outdated vs official swagger.
 */
async function callGenerateLinkToken({ patient, hipId, requestId: providedRequestId }) {
  const accessToken = await ensureAccessToken();
  const requestId = providedRequestId || crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const abhaNumberDigits = toAbhaNumberDigits(patient.abhaNumber || patient.healthIdNumber);
  const abhaAddress = String(patient.abhaAddress || '').trim();
  const yob = yearOfBirthFromPatient(patient);

  if (!abhaNumberDigits && !abhaAddress) {
    const err = new Error('ABHA Number or ABHA Address is required for HIP linking.');
    err.status = 400;
    throw err;
  }
  if (!patient.name) {
    const err = new Error('Patient name is required for HIP link token generation.');
    err.status = 400;
    throw err;
  }
  if (!yob) {
    const err = new Error('Patient year of birth (from DOB/age) is required for HIP link token generation.');
    err.status = 400;
    throw err;
  }

  const payload = {
    name: String(patient.name).trim(),
    gender: toAbdmGender(patient.gender),
    yearOfBirth: Number(yob),
  };
  if (abhaAddress) payload.abhaAddress = abhaAddress;
  if (abhaNumberDigits) payload.abhaNumber = Number(abhaNumberDigits);

  const headers = buildAbdmHeaders({
    accessToken,
    requestId,
    timestamp,
    additionalHeaders: {
      'X-HIP-ID': hipId,
      'X_HIP_ID': hipId,
    },
  });

  const requestUrl = `${abdmConfig.gatewayBase}${GENERATE_TOKEN_PATH}`;
  logMasked('✓ Generate Link Token REQUEST', {
    endpoint: requestUrl,
    officialExpectedPath: GENERATE_TOKEN_PATH,
    headers: {
      'REQUEST-ID': headers['REQUEST-ID'],
      TIMESTAMP: headers.TIMESTAMP,
      'X-CM-ID': headers['X-CM-ID'],
      'X-HIP-ID': hipId,
      Authorization: headers.Authorization ? 'Bearer ***' : undefined,
    },
    body: {
      ...payload,
      abhaNumber: abhaNumberDigits ? Number(maskAbhaNumber(abhaNumberDigits).replace(/\D/g, '') || abhaNumberDigits) : undefined,
      abhaNumberMasked: abhaNumberDigits ? maskAbhaNumber(abhaNumberDigits) : null,
      abhaAddress: abhaAddress || null,
    },
    note: 'Using official swagger body (name/gender/yearOfBirth/abha*). Postman patientId-only body is outdated.',
  });

  try {
    const response = await client.post(GENERATE_TOKEN_PATH, payload, { headers });
    logMasked('✓ Generate Link Token RESPONSE', {
      status: response.status,
      body: response.data,
    });
    return { requestId, timestamp, status: response.status, data: response.data, headers };
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || { message: err.message };
    logMasked('✗ Generate Link Token ERROR', { status, body: data });
    return { requestId, timestamp, status, data, error: true, headers };
  }
}

/**
 * HIP-initiated care context link (ABDM M2, updated 07 Apr 2025):
 * POST /hip/v3/link/carecontext
 * Link token is the X-LINK-TOKEN header, not a body field.
 * Body: { abhaAddress, abhaNumber?, patient: [{ referenceNumber, display, careContexts[], hiType, count }] }
 */
async function callLinkCareContext({ hipId, linkToken, patient, careContextId, careContextDisplay, requestId: providedRequestId }) {
  const accessToken = await ensureAccessToken();
  const requestId = providedRequestId || crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const referenceNumber = buildPatientReference(patient);
  const display = toAbdmDisplay(patient.name, referenceNumber);
  const abhaAddress = String(patient.abhaAddress || '').trim();
  const abhaNumberDigits = toAbhaNumberDigits(patient.abhaNumber || patient.healthIdNumber);
  const careContext = {
    referenceNumber: careContextId,
    display: toAbdmDisplay(careContextDisplay, `OPD Visit ${careContextId}`),
  };

  const payload = {
    abhaAddress,
    patient: [
      {
        referenceNumber,
        display,
        careContexts: [careContext],
        hiType: 'OPConsultation',
        count: 1,
      },
    ],
  };
  if (abhaNumberDigits) payload.abhaNumber = Number(abhaNumberDigits);

  const headers = buildAbdmHeaders({
    accessToken,
    requestId,
    timestamp,
    additionalHeaders: {
      'X-HIP-ID': hipId,
      'X_HIP_ID': hipId,
      'X-LINK-TOKEN': linkToken,
    },
  });

  const requestUrl = `${abdmConfig.gatewayBase}${LINK_CARECONTEXT_PATH}`;
  logMasked('✓ Link Care Context REQUEST', {
    endpoint: requestUrl,
    headers: {
      'REQUEST-ID': headers['REQUEST-ID'],
      TIMESTAMP: headers.TIMESTAMP,
      'X-CM-ID': headers['X-CM-ID'],
      'X-HIP-ID': hipId,
      'X-LINK-TOKEN': maskToken(linkToken),
      Authorization: 'Bearer ***',
    },
    body: payload,
  });

  try {
    const response = await client.post(LINK_CARECONTEXT_PATH, payload, { headers });
    logMasked('✓ Link Care Context RESPONSE', {
      status: response.status,
      body: response.data,
    });
    return { requestId, status: response.status, data: response.data, error: false };
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || { message: err.message };
    logMasked('✗ Link Care Context ERROR', { status, body: data });
    return { requestId, status, data, error: true };
  }
}

async function callContextNotify({ hipId, patient, careContextId, episodeDocumentId, hiTypes }) {
  const accessToken = await ensureAccessToken();
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const abhaAddress = String(patient.abhaAddress || '').trim();
  if (!abhaAddress) return null;

  const payload = {
    notification: {
      patient: {
        id: abhaAddress,
      },
      careContext: {
        patientReference: buildPatientReference(patient),
        careContextReference: careContextId,
      },
      hiTypes: Array.isArray(hiTypes) && hiTypes.length ? hiTypes : ['OPConsultation'],
      date: timestamp,
      hip: {
        id: hipId,
      },
    },
  };

  const headers = buildAbdmHeaders({
    accessToken,
    requestId,
    timestamp,
    additionalHeaders: { 'X-HIP-ID': hipId },
  });

  logMasked('✓ Context Notify REQUEST', {
    endpoint: `${abdmConfig.gatewayBase}${CONTEXT_NOTIFY_PATH}`,
    body: payload,
  });

  if (episodeDocumentId) {
    pendingEpisodeNotifyByRequestId.set(requestId, { documentId: episodeDocumentId });
  } else if (patient?.id) {
    pendingNotifyByRequestId.set(requestId, { patientId: patient.id });
  }

  try {
    const response = await client.post(CONTEXT_NOTIFY_PATH, payload, { headers });
    logMasked('✓ Context Notify RESPONSE', { status: response.status, body: response.data });
    return { requestId, status: response.status, data: response.data, error: false };
  } catch (err) {
    if (episodeDocumentId) pendingEpisodeNotifyByRequestId.delete(requestId);
    else pendingNotifyByRequestId.delete(requestId);
    const status = err.response?.status || 500;
    const data = err.response?.data || { message: err.message };
    logMasked('✗ Context Notify ERROR', { status, body: data });
    return { requestId, status, data, error: true };
  }
}

function rememberCareContextLink(requestId, meta) {
  if (!requestId || !meta?.patientId) return;
  pendingCareContextByRequestId.set(requestId, {
    patientId: meta.patientId,
    hipId: meta.hipId,
    careContextId: meta.careContextId,
    notifyClaimed: false,
  });
}

function claimCareContextNotify(requestId) {
  if (!requestId) return null;
  const row = pendingCareContextByRequestId.get(requestId);
  if (!row || row.notifyClaimed) return null;
  row.notifyClaimed = true;
  return row;
}

function isCareContextLinkSuccess(body = {}) {
  const error = body?.error;
  if (error && (error.code || error.errorCode || error.message)) return false;
  return String(body?.status || '').trim().toLowerCase() === 'successfully linked care context';
}

function isEpisodeLinkAccepted(body = {}) {
  if (isCareContextLinkSuccess(body)) return true;
  return isDuplicateHipLink(body);
}

function isDuplicateHipLink(body = {}) {
  const code = String(body?.error?.code || body?.error?.errorCode || '');
  const message = String(body?.error?.message || body?.status || body?.message || '');
  return code.includes('1056') || /already linked|duplicate hip link/i.test(message);
}

function takeEpisodeTokenPending(requestId) {
  if (!requestId) return null;
  const row = pendingEpisodeTokenByRequestId.get(requestId) || null;
  if (row) pendingEpisodeTokenByRequestId.delete(requestId);
  return row;
}

function hasPendingEpisodeLink(documentId) {
  if (!documentId) return false;
  for (const row of pendingEpisodeTokenByRequestId.values()) {
    if (row?.documentId === documentId) return true;
  }
  for (const row of pendingEpisodeCareContextByRequestId.values()) {
    if (row?.documentId === documentId) return true;
  }
  return false;
}

function decodeLinkTokenExpiry(linkToken) {
  try {
    const part = String(linkToken || '').split('.')[1];
    if (!part) return null;
    const json = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    if (json?.exp) return new Date(Number(json.exp) * 1000);
  } catch (_) {
    /* use fallback */
  }
  return null;
}

async function saveLinkTokenCache(patientId, linkToken) {
  if (!patientId || !linkToken) return;
  const decoded = decodeLinkTokenExpiry(linkToken);
  const expiresAt = decoded && !Number.isNaN(decoded.getTime())
    ? decoded
    : new Date(Date.now() + 12 * 60 * 60 * 1000);
  const existing = await prisma.abdmTokenCache.findFirst({
    where: { tokenType: 'LINK_TOKEN', key: patientId },
    select: { id: true },
  });
  const data = {
    tokenType: 'LINK_TOKEN',
    key: patientId,
    accessToken: linkToken,
    expiresAt,
    meta: { cachedAt: new Date().toISOString() },
  };
  if (existing) {
    await prisma.abdmTokenCache.update({ where: { id: existing.id }, data });
  } else {
    await prisma.abdmTokenCache.create({ data });
  }
}

async function getValidLinkToken(patientId) {
  if (!patientId) return null;
  const row = await prisma.abdmTokenCache.findFirst({
    where: {
      tokenType: 'LINK_TOKEN',
      key: patientId,
      expiresAt: { gt: new Date(Date.now() + 60_000) },
    },
    orderBy: { expiresAt: 'desc' },
  });
  return row?.accessToken || null;
}

async function findFullyLinkedPatientByAbha(abhaAddress, excludePatientId) {
  const address = String(abhaAddress || '').trim();
  if (!address) return null;
  return prisma.patient.findFirst({
    where: {
      id: { not: excludePatientId },
      abhaAddress: { equals: address, mode: 'insensitive' },
      hipLinked: true,
      careContextStatus: 'LINKED',
      syncStatus: 'SYNCED',
    },
    select: {
      id: true,
      careContextId: true,
      careContextStatus: true,
      syncStatus: true,
      hipLinked: true,
      linkedAt: true,
      hipReferenceNumber: true,
    },
    orderBy: { linkedAt: 'desc' },
  });
}

async function markEpisodeLinkFailed(documentId, careContextRowId, meta = {}) {
  if (documentId) {
    await prisma.abdmHealthDocument.update({
      where: { id: documentId },
      data: {
        syncStatus: 'FAILED',
        errorCode: meta.errorCode || 'EPISODE_LINK_FAILED',
        errorMessage: meta.errorMessage || 'Episode care context link failed.',
        requestId: meta.requestId || undefined,
      },
    }).catch(() => {});
  }
  if (careContextRowId) {
    const current = await prisma.abdmCareContext.findUnique({
      where: { id: careContextRowId },
      select: { linkStatus: true },
    }).catch(() => null);
    if (String(current?.linkStatus || '').toUpperCase() === 'LINKED') {
      return;
    }
    await prisma.abdmCareContext.update({
      where: { id: careContextRowId },
      data: { linkStatus: 'FAILED' },
    }).catch(() => {});
  }
}

async function startEpisodeCareContextLink({
  requestId,
  hipId,
  linkToken,
  patient,
  careContextId,
  careContextDisplay,
  documentId,
  careContextRowId,
}) {
  pendingEpisodeCareContextByRequestId.set(requestId, {
    patientId: patient.id,
    hipId,
    careContextId,
    careContextDisplay,
    documentId,
    careContextRowId,
    notifyClaimed: false,
  });
  const linkResult = await callLinkCareContext({
    hipId,
    linkToken,
    patient,
    careContextId,
    careContextDisplay,
    requestId,
  });
  if (linkResult.error) {
    pendingEpisodeCareContextByRequestId.delete(requestId);
    if (isDuplicateHipLink(linkResult.data)) {
      if (careContextRowId) {
        await prisma.abdmCareContext.update({
          where: { id: careContextRowId },
          data: { linkStatus: 'LINKED' },
        }).catch(() => {});
      }
      logMasked('episode care context already linked at ABDM; notify next', {
        requestId,
        careContextId,
        documentId,
      });
      return { error: false, alreadyLinked: true, requestId, status: linkResult.status, data: linkResult.data };
    }
    await markEpisodeLinkFailed(documentId, careContextRowId, {
      requestId,
      errorCode: String(linkResult.data?.error?.code || linkResult.data?.error?.errorCode || linkResult.status || 'LINK_FAILED'),
      errorMessage: String(linkResult.data?.error?.message || linkResult.data?.message || 'Episode care context link failed.'),
    });
    return { error: true, requestId, status: linkResult.status, data: linkResult.data };
  }
  if (careContextRowId) {
    await prisma.abdmCareContext.update({
      where: { id: careContextRowId },
      data: { linkStatus: 'PENDING' },
    }).catch(() => {});
  }
  logMasked('episode care context link accepted; waiting on_carecontext', {
    requestId,
    careContextId,
    documentId,
  });
  return { error: false, pendingCallback: true, requestId, status: linkResult.status, data: linkResult.data };
}

/**
 * Link an episode care context at ABDM without touching Patient.careContextId.
 * Reuses a cached link token when still valid; otherwise generates a token on
 * a separate pending map so finalizeHipLink never runs.
 */
async function linkEpisodeCareContext({
  patient,
  hipId,
  careContext,
  document,
  allowGenerateToken = true,
} = {}) {
  if (!patient?.id || !hipId || !careContext?.careContextId || !document?.id) {
    return { error: true, message: 'patient, hipId, careContext, and document are required.' };
  }
  if (String(careContext.linkStatus || '').toUpperCase() === 'LINKED') {
    logMasked('episode link skipped; care context already LINKED', {
      documentId: document.id,
      careContextId: careContext.careContextId,
    });
    return { error: false, alreadyLinked: true, skipped: true, reason: 'ALREADY_LINKED' };
  }
  if (hasPendingEpisodeLink(document.id)) {
    logMasked('episode link skipped; already in flight', {
      documentId: document.id,
      careContextId: careContext.careContextId,
    });
    return { skipped: true, reason: 'IN_FLIGHT' };
  }

  const careContextId = careContext.careContextId;
  const careContextDisplay = careContext.display || `OPD Visit ${careContextId}`;
  const cached = await getValidLinkToken(patient.id);
  if (cached) {
    logMasked('episode link reusing cached link token', {
      patientId: patient.id,
      careContextId,
      documentId: document.id,
    });
    return startEpisodeCareContextLink({
      requestId: crypto.randomUUID(),
      hipId,
      linkToken: cached,
      patient,
      careContextId,
      careContextDisplay,
      documentId: document.id,
      careContextRowId: careContext.id,
    });
  }

  if (!allowGenerateToken) {
    logMasked('episode generate-token skipped on retry', {
      documentId: document.id,
      careContextId,
      linkStatus: careContext.linkStatus || null,
    });
    return {
      error: true,
      pendingToken: false,
      status: 409,
      data: {
        error: {
          code: 'TOKEN_NOT_GENERATED',
          message: 'Episode care context is not linked and no cached link token is available. Retry will not generate a new link token.',
        },
      },
    };
  }

  const requestId = crypto.randomUUID();
  pendingEpisodeTokenByRequestId.set(requestId, {
    patientId: patient.id,
    hipId,
    careContextId,
    careContextDisplay,
    documentId: document.id,
    careContextRowId: careContext.id,
  });
  const gen = await callGenerateLinkToken({ patient, hipId, requestId });
  if (gen.error) {
    pendingEpisodeTokenByRequestId.delete(requestId);
    await markEpisodeLinkFailed(document.id, careContext.id, {
      requestId,
      errorCode: String(gen.data?.error?.code || gen.data?.error?.errorCode || gen.status || 'TOKEN_FAILED'),
      errorMessage: String(gen.data?.error?.message || gen.data?.message || 'Episode link token generation failed.'),
    });
    return { error: true, pendingToken: false, requestId, status: gen.status, data: gen.data };
  }
  logMasked('episode link token requested; waiting on-generate-token', {
    requestId,
    careContextId,
    documentId: document.id,
  });
  return { error: false, pendingToken: true, requestId, status: gen.status, data: gen.data };
}

async function handleEpisodeOnCareContext(body, requestId) {
  const row = requestId ? pendingEpisodeCareContextByRequestId.get(requestId) : null;
  if (!isEpisodeLinkAccepted(body)) {
    if (row && !row.notifyClaimed) {
      row.notifyClaimed = true;
      pendingEpisodeCareContextByRequestId.delete(requestId);
      await markEpisodeLinkFailed(row.documentId, row.careContextRowId, {
        requestId,
        errorCode: String(body?.error?.code || body?.error?.errorCode || 'ON_CARECONTEXT_FAILED'),
        errorMessage: String(body?.error?.message || body?.status || 'Episode care context callback failed.'),
      });
    }
    logMasked('episode on_carecontext not successful; notify skipped', { requestId });
    return;
  }
  if (!row || row.notifyClaimed) {
    logMasked('episode on_carecontext notify skipped', {
      requestId,
      reason: row ? 'duplicate' : 'no matching episode link request',
    });
    return;
  }
  row.notifyClaimed = true;
  pendingEpisodeCareContextByRequestId.delete(requestId);

  if (row.careContextRowId) {
    await prisma.abdmCareContext.update({
      where: { id: row.careContextRowId },
      data: { linkStatus: 'LINKED' },
    }).catch(() => {});
  }

  const patient = await prisma.patient.findUnique({ where: { id: row.patientId } });
  if (!patient) {
    await markEpisodeLinkFailed(row.documentId, row.careContextRowId, {
      requestId,
      errorCode: 'PATIENT_NOT_FOUND',
      errorMessage: 'Patient missing during episode on_carecontext notify.',
    });
    return;
  }

  logMasked('episode care context linked; calling context notify', {
    requestId,
    careContextId: row.careContextId,
    documentId: row.documentId,
  });

  const notifyResult = await callContextNotify({
    hipId: row.hipId,
    patient,
    careContextId: row.careContextId,
    episodeDocumentId: row.documentId,
  });

  if (!notifyResult || notifyResult.error) {
    await markEpisodeLinkFailed(row.documentId, null, {
      requestId: notifyResult?.requestId || requestId,
      errorCode: String(notifyResult?.data?.error?.code || notifyResult?.status || 'NOTIFY_FAILED'),
      errorMessage: String(notifyResult?.data?.error?.message || notifyResult?.data?.message || 'Episode context notify failed.'),
    });
    return;
  }

  const latest = await prisma.abdmHealthDocument.findUnique({
    where: { id: row.documentId },
    select: { syncStatus: true },
  });
  if (latest?.syncStatus !== 'SYNCED') {
    await prisma.abdmHealthDocument.update({
      where: { id: row.documentId },
      data: {
        syncStatus: 'PENDING',
        requestId: notifyResult.requestId || null,
        lastNotifiedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    }).catch(() => {});
  }
}

async function finalizeHipLink({ patientId, linkToken, hipId }) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    return { status: 404, body: { success: false, message: 'Patient not found for HIP finalize.' } };
  }

  const careContextId = patient.careContextId || buildCareContextId(patient);
  const linkResult = await callLinkCareContext({
    hipId,
    linkToken,
    patient,
    careContextId,
  });

  if (linkResult.error) {
    const updated = await updatePatientHip(patientId, {
      careContextId,
      careContextStatus: 'FAILED',
      syncStatus: 'FAILED',
      hipReferenceNumber: buildPatientReference(patient),
    });
    return {
      status: linkResult.status,
      body: {
        success: false,
        message: 'HIP care context link failed (government response).',
        hipLinked: false,
        careContextId,
        careContextStatus: 'FAILED',
        syncStatus: 'FAILED',
        governmentResponse: linkResult.data,
        patient: updated,
      },
    };
  }

  rememberCareContextLink(linkResult.requestId, { patientId, hipId, careContextId });

  const updated = await updatePatientHip(patientId, {
    hipLinked: false,
    careContextId,
    careContextStatus: 'PENDING',
    syncStatus: 'PENDING',
    linkedAt: null,
    hipReferenceNumber: buildPatientReference(patient),
  });

  // HTTP 202 only means ABDM accepted the link request. LINKED/SYNCED come from callbacks.
  return {
    status: 200,
    body: {
      success: true,
      pendingCallback: true,
      message: 'Care context link request accepted. Waiting for ABDM callback /api/v3/link/on_carecontext.',
      hipLinked: false,
      careContextId,
      careContextStatus: 'PENDING',
      syncStatus: 'PENDING',
      linkedAt: null,
      governmentResponse: {
        linkCareContext: linkResult.data,
        contextNotify: null,
      },
      patient: updated,
    },
  };
}

/**
 * Start / complete HIP patient + care-context linking for a verified ABHA patient.
 */
async function linkHipPatient({ patientId, force = false, linkToken: providedLinkToken } = {}) {
  if (!patientId) {
    return { status: 400, body: { success: false, message: 'patientId is required.' } };
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    return { status: 404, body: { success: false, message: 'Patient not found.' } };
  }

  if (!patient.isAbhaVerified || !(patient.abhaNumber || patient.abhaAddress)) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Patient must have verified ABHA Number/Address before HIP linking.',
      },
    };
  }

  const fullyLinked = patient.hipLinked === true
    && patient.careContextStatus === 'LINKED'
    && patient.syncStatus === 'SYNCED';
  if (fullyLinked && !force) {
    return {
      status: 200,
      body: {
        success: true,
        duplicate: true,
        message: 'Patient is already HIP linked. Duplicate linking skipped.',
        hipLinked: true,
        careContextId: patient.careContextId,
        careContextStatus: patient.careContextStatus || 'LINKED',
        syncStatus: patient.syncStatus || 'SYNCED',
        linkedAt: patient.linkedAt,
        patient: {
          id: patient.id,
          uhid: patient.uhid,
          abhaNumber: patient.abhaNumber,
          abhaAddress: patient.abhaAddress,
          hipLinked: patient.hipLinked,
          careContextId: patient.careContextId,
          careContextStatus: patient.careContextStatus,
          linkedAt: patient.linkedAt,
          syncStatus: patient.syncStatus,
        },
      },
    };
  }

  let facility;
  try {
    facility = await requireHipId(patient.hospitalId);
  } catch (err) {
    return { status: err.status || 400, body: { success: false, message: err.message } };
  }

  const careContextId = buildCareContextId(patient);

  // If caller already has link token (e.g. from callback / prior generate), finalize immediately.
  if (providedLinkToken) {
    await updatePatientHip(patientId, {
      careContextId,
      careContextStatus: 'PENDING',
      syncStatus: 'PENDING',
      hipReferenceNumber: buildPatientReference(patient),
    });
    return finalizeHipLink({ patientId, linkToken: providedLinkToken, hipId: facility.hipId });
  }

  const linkedSibling = await findFullyLinkedPatientByAbha(patient.abhaAddress, patient.id);
  if (linkedSibling) {
    const reusedCareContextId = linkedSibling.careContextId || careContextId;
    const cachedToken = await getValidLinkToken(linkedSibling.id);
    if (cachedToken) {
      await saveLinkTokenCache(patient.id, cachedToken);
    }
    const updated = await updatePatientHip(patientId, {
      careContextId: reusedCareContextId,
      careContextStatus: 'LINKED',
      syncStatus: 'SYNCED',
      hipLinked: true,
      linkedAt: linkedSibling.linkedAt || new Date(),
      hipReferenceNumber: linkedSibling.hipReferenceNumber || buildPatientReference(patient),
    });
    logMasked('HIP generate-token skipped; ABHA already fully linked on another patient', {
      patientId,
      reusedFromPatientId: linkedSibling.id,
      careContextId: reusedCareContextId,
    });
    return {
      status: 200,
      body: {
        success: true,
        duplicate: true,
        reusedExistingAbhaLink: true,
        message: 'ABHA is already HIP linked. Generate token skipped.',
        hipLinked: true,
        careContextId: reusedCareContextId,
        careContextStatus: 'LINKED',
        syncStatus: 'SYNCED',
        linkedAt: updated?.linkedAt || linkedSibling.linkedAt,
        patient: {
          id: patient.id,
          uhid: patient.uhid,
          abhaNumber: patient.abhaNumber,
          abhaAddress: patient.abhaAddress,
          hipLinked: true,
          careContextId: reusedCareContextId,
          careContextStatus: 'LINKED',
          linkedAt: updated?.linkedAt || linkedSibling.linkedAt,
          syncStatus: 'SYNCED',
        },
      },
    };
  }

  const gen = await callGenerateLinkToken({ patient, hipId: facility.hipId });
  rememberPending(gen.requestId, patientId, {
    careContextId,
    hipId: facility.hipId,
    abhaAddress: patient.abhaAddress,
  });

  await updatePatientHip(patientId, {
    careContextId,
    careContextStatus: gen.error ? 'FAILED' : 'PENDING',
    syncStatus: gen.error ? 'FAILED' : 'PENDING',
    hipLinkRequestId: gen.requestId,
    hipReferenceNumber: buildPatientReference(patient),
    hipLinked: false,
    linkedAt: null,
  });

  // Some gateways may return linkToken inline (rare); handle if present.
  const inlineToken =
    gen.data?.linkToken ||
    gen.data?.token ||
    gen.data?.accessToken ||
    gen.data?.data?.linkToken ||
    '';

  if (!gen.error && inlineToken) {
    return finalizeHipLink({ patientId, linkToken: inlineToken, hipId: facility.hipId });
  }

  return {
    status: gen.error ? gen.status : 202,
    body: {
      success: !gen.error,
      pendingCallback: !gen.error,
      message: gen.error
        ? 'HIP link token generation failed (see governmentResponse).'
        : 'HIP link token requested. Waiting for ABDM callback /v3/hip/token/on-generate-token to complete care-context link.',
      hipLinked: false,
      careContextId,
      careContextStatus: gen.error ? 'FAILED' : 'PENDING',
      syncStatus: gen.error ? 'FAILED' : 'PENDING',
      hipLinkRequestId: gen.requestId,
      hipId: facility.hipId,
      governmentResponse: gen.data,
      callbackHint:
        'Ensure ABDM_BRIDGE_CALLBACK_URL points to a public URL that forwards POST /api/abdm/hip/token/on-generate-token',
    },
  };
}

/**
 * ABDM callback: POST /api/v3/link/on_carecontext
 * Acknowledges the care-context link result. Context notify runs only after a successful link.
 */
async function handleOnCareContextCallback(body = {}) {
  const requestId =
    body?.response?.requestId ||
    body?.response?.requestID ||
    body?.requestId ||
    '';

  logMasked('✓ on_carecontext CALLBACK received', {
    requestId,
    status: body?.status || null,
    abhaAddress: body?.abhaAddress || null,
    error: body?.error
      ? {
          code: body.error.code || body.error.errorCode || null,
          message: body.error.message || null,
        }
      : null,
  });

  try {
    if (requestId && pendingEpisodeCareContextByRequestId.has(requestId)) {
      await handleEpisodeOnCareContext(body, requestId);
    } else {
      await notifyAfterCareContextCallback(body, requestId);
    }
  } catch (err) {
    logMasked('✗ Context Notify after on_carecontext failed', {
      requestId,
      message: err.message,
    });
  }

  return {
    status: 202,
    body: { acknowledgement: 'ACCEPTED' },
  };
}

async function notifyAfterCareContextCallback(body, requestId) {
  if (!isCareContextLinkSuccess(body)) {
    const row = requestId ? pendingCareContextByRequestId.get(requestId) : null;
    if (row?.patientId && !row.notifyClaimed) {
      row.notifyClaimed = true;
      await updatePatientHip(row.patientId, {
        hipLinked: false,
        careContextStatus: 'FAILED',
      });
    }
    logMasked('on_carecontext not successful; context notify skipped', { requestId });
    return;
  }

  const pending = claimCareContextNotify(requestId);
  if (!pending) {
    logMasked('on_carecontext context notify skipped', {
      requestId,
      reason: pendingCareContextByRequestId.has(requestId) ? 'duplicate' : 'no matching link request',
    });
    return;
  }

  const patient = await prisma.patient.findUnique({ where: { id: pending.patientId } });
  const abhaAddress = String(patient?.abhaAddress || '').trim();
  const careContextId = pending.careContextId || '';
  const hipId = pending.hipId || '';
  if (!patient || !abhaAddress || !hipId || !careContextId || patient.careContextId !== careContextId) {
    logMasked('context notify skipped; stored patient, ABHA, HIP ID, or careContextId missing', {
      requestId,
      hasPatient: Boolean(patient),
      hasAbhaAddress: Boolean(abhaAddress),
      hasHipId: Boolean(hipId),
      hasCareContextId: Boolean(careContextId),
      careContextMatches: Boolean(patient && patient.careContextId === careContextId),
    });
    return;
  }

  await updatePatientHip(pending.patientId, {
    hipLinked: true,
    careContextStatus: 'LINKED',
    linkedAt: new Date(),
  });

  const notifyResult = await callContextNotify({
    hipId,
    patient,
    careContextId,
  });

  if (!notifyResult || notifyResult.error) {
    await updatePatientHip(pending.patientId, { syncStatus: 'FAILED' });
  }
}

function hasPendingContextNotify(patientId) {
  for (const row of pendingNotifyByRequestId.values()) {
    if (row?.patientId === patientId) return true;
  }
  return false;
}

/**
 * Retry context notify only. Does not generate a link token or link a care context.
 */
async function retryContextNotify({ patientId } = {}) {
  if (!patientId) {
    return { status: 400, body: { success: false, message: 'patientId is required.' } };
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    return { status: 404, body: { success: false, message: 'Patient not found.' } };
  }

  const careContextStatus = String(patient.careContextStatus || '').toUpperCase();
  const syncStatus = String(patient.syncStatus || '').toUpperCase();
  const careContextId = patient.careContextId || '';
  const base = {
    hipLinked: Boolean(patient.hipLinked),
    careContextId,
    careContextStatus: patient.careContextStatus || '',
    syncStatus: patient.syncStatus || '',
    linkedAt: patient.linkedAt || null,
  };

  if (careContextStatus !== 'LINKED' || !careContextId) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Care context is not linked. Context notify cannot be retried.',
        ...base,
      },
    };
  }

  if (syncStatus === 'SYNCED') {
    return {
      status: 200,
      body: {
        success: true,
        duplicate: true,
        message: 'Care context linked and ABDM sync completed.',
        ...base,
        patient,
      },
    };
  }

  if (syncStatus !== 'PENDING' && syncStatus !== 'FAILED') {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Context notify retry is only available while sync is pending or failed.',
        ...base,
      },
    };
  }

  if (!String(patient.abhaAddress || '').trim()) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'ABHA address is required to retry context notify.',
        ...base,
      },
    };
  }

  if (contextNotifyRetryInFlight.has(patient.id) || hasPendingContextNotify(patient.id)) {
    return {
      status: 200,
      body: {
        success: true,
        pendingCallback: true,
        message: 'Care context linked. Waiting for context notify confirmation.',
        ...base,
        syncStatus: 'PENDING',
        patient,
      },
    };
  }

  let facility;
  try {
    facility = await requireHipId(patient.hospitalId);
  } catch (err) {
    return { status: err.status || 400, body: { success: false, message: err.message, ...base } };
  }

  contextNotifyRetryInFlight.add(patient.id);
  let notifyResult;
  try {
    notifyResult = await callContextNotify({
      hipId: facility.hipId,
      patient,
      careContextId,
    });
  } finally {
    contextNotifyRetryInFlight.delete(patient.id);
  }

  if (!notifyResult || notifyResult.error) {
    const updated = await updatePatientHip(patientId, { syncStatus: 'FAILED' });
    return {
      status: notifyResult?.status || 502,
      body: {
        success: false,
        message: 'Care context linked, but context notification failed.',
        hipLinked: Boolean(updated.hipLinked),
        careContextId: updated.careContextId || careContextId,
        careContextStatus: updated.careContextStatus || 'LINKED',
        syncStatus: 'FAILED',
        patient: updated,
        governmentResponse: { contextNotify: notifyResult?.data || null },
      },
    };
  }

  const current = await prisma.patient.findUnique({ where: { id: patientId } });
  const updated = String(current?.syncStatus || '').toUpperCase() === 'SYNCED'
    ? current
    : await updatePatientHip(patientId, { syncStatus: 'PENDING' });

  const syncedNow = String(updated?.syncStatus || '').toUpperCase() === 'SYNCED';
  return {
    status: 202,
    body: {
      success: true,
      pendingCallback: !syncedNow,
      message: syncedNow
        ? 'Care context linked and ABDM sync completed.'
        : 'Care context linked. Waiting for context notify confirmation.',
      hipLinked: Boolean(updated?.hipLinked ?? patient.hipLinked),
      careContextId,
      careContextStatus: 'LINKED',
      syncStatus: updated?.syncStatus || 'PENDING',
      patient: updated,
      governmentResponse: { contextNotify: notifyResult.data },
    },
  };
}

/**
 * ABDM callback: POST /api/v3/links/context/on-notify
 * Acknowledges the context-notify result. syncStatus is updated only from this callback.
 */
async function handleOnContextNotifyCallback(body = {}) {
  const requestId = body?.requestId || body?.response?.requestId || body?.response?.requestID || '';

  const responseRequestId = body?.response?.requestId || body?.response?.requestID || '';
  const acknowledgementStatus = body?.acknowledgement?.status || null;
  const error = body?.error
    ? {
        code: body.error.code || body.error.errorCode || null,
        message: body.error.message || null,
      }
    : null;

  logMasked('✓ on-notify CALLBACK received', {
    requestId,
    timestamp: body?.timestamp || null,
    acknowledgementStatus,
    responseRequestId,
    error,
  });

  const pending = responseRequestId ? pendingNotifyByRequestId.get(responseRequestId) : null;
  if (pending?.patientId) {
    pendingNotifyByRequestId.delete(responseRequestId);
    const acknowledged = String(acknowledgementStatus || '').trim().toUpperCase() === 'SUCCESS' && !error;
    await updatePatientHip(pending.patientId, {
      syncStatus: acknowledged ? 'SYNCED' : 'FAILED',
    });
  } else {
    const episode = responseRequestId ? pendingEpisodeNotifyByRequestId.get(responseRequestId) : null;
    if (episode?.documentId) {
      pendingEpisodeNotifyByRequestId.delete(responseRequestId);
      const acknowledged = String(acknowledgementStatus || '').trim().toUpperCase() === 'SUCCESS' && !error;
      try {
        await prisma.abdmHealthDocument.update({
          where: { id: episode.documentId },
          data: {
            syncStatus: acknowledged ? 'SYNCED' : 'FAILED',
            errorCode: acknowledged ? null : error?.code || 'ON_NOTIFY_FAILED',
            errorMessage: acknowledged ? null : error?.message || 'Context notify callback failed.',
          },
        });
      } catch (err) {
        logMasked('on-notify episode document update skipped', {
          documentId: episode.documentId,
          message: err.message,
        });
      }
    }
  }

  return {
    status: 202,
    body: { acknowledgement: 'ACCEPTED' },
  };
}

/**
 * ABDM callback: POST .../v3/hip/token/on-generate-token
 * Body may contain linkToken + response.requestId
 */
async function handleOnGenerateTokenCallback(body = {}) {
  const requestId =
    body?.response?.requestId ||
    body?.response?.requestID ||
    body?.requestId ||
    body?.resp?.requestId ||
    '';
  const linkToken = body?.linkToken || body?.token || body?.accessToken || '';
  const error = body?.error || null;

  logMasked('✓ on-generate-token CALLBACK received', {
    requestId,
    hasLinkToken: Boolean(linkToken),
    linkToken: maskToken(linkToken),
    abhaAddress: body?.abhaAddress || null,
    error,
  });

  const episodeToken = takeEpisodeTokenPending(requestId);
  if (episodeToken) {
    if (error || !linkToken) {
      await markEpisodeLinkFailed(episodeToken.documentId, episodeToken.careContextRowId, {
        requestId,
        errorCode: error?.code || error?.errorCode || 'TOKEN_MISSING',
        errorMessage: error?.message || 'Link token missing in episode on-generate-token callback.',
      });
      return {
        status: 200,
        body: { success: false, episode: true, message: 'Episode link token missing.', requestId },
      };
    }
    try {
      await saveLinkTokenCache(episodeToken.patientId, linkToken);
    } catch (err) {
      logMasked('episode link token cache skipped', { message: err.message });
    }
    const patient = await prisma.patient.findUnique({ where: { id: episodeToken.patientId } });
    if (!patient) {
      await markEpisodeLinkFailed(episodeToken.documentId, episodeToken.careContextRowId, {
        requestId,
        errorCode: 'PATIENT_NOT_FOUND',
        errorMessage: 'Patient missing during episode token callback.',
      });
      return { status: 404, body: { success: false, episode: true, requestId } };
    }
    await startEpisodeCareContextLink({
      requestId: crypto.randomUUID(),
      hipId: episodeToken.hipId,
      linkToken,
      patient,
      careContextId: episodeToken.careContextId,
      careContextDisplay: episodeToken.careContextDisplay,
      documentId: episodeToken.documentId,
      careContextRowId: episodeToken.careContextRowId,
    });
    return {
      status: 200,
      body: { success: true, episode: true, pendingCallback: true, requestId },
    };
  }

  const pending = takePending(requestId);
  let patientId = pending?.patientId || null;

  if (!patientId && requestId) {
    const byReq = await prisma.patient.findFirst({
      where: { hipLinkRequestId: requestId },
      select: { id: true },
    });
    patientId = byReq?.id || null;
  }

  if (!patientId && body?.abhaAddress) {
    const byAbha = await prisma.patient.findFirst({
      where: {
        OR: [
          { abhaAddress: String(body.abhaAddress) },
          { healthIdNumber: String(body.abhaAddress) },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    patientId = byAbha?.id || null;
  }

  if (!patientId) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'No pending patient found for this on-generate-token callback.',
        requestId,
      },
    };
  }

  if (error || !linkToken) {
    await updatePatientHip(patientId, {
      careContextStatus: 'FAILED',
      syncStatus: 'FAILED',
    });
    return {
      status: 200,
      body: {
        success: false,
        message: error?.message || 'Link token missing in callback.',
        governmentResponse: body,
        patientId,
      },
    };
  }

  try {
    await saveLinkTokenCache(patientId, linkToken);
  } catch (err) {
    logMasked('patient link token cache skipped', { message: err.message });
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  const facility = await requireHipId(patient?.hospitalId);
  return finalizeHipLink({ patientId, linkToken, hipId: facility.hipId });
}

async function getHipPatientStatus(patientId) {
  if (!patientId) {
    return { status: 400, body: { success: false, message: 'patientId is required.' } };
  }
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      uhid: true,
      name: true,
      abhaNumber: true,
      abhaAddress: true,
      isAbhaVerified: true,
      hipLinked: true,
      careContextId: true,
      careContextStatus: true,
      linkedAt: true,
      syncStatus: true,
      hipLinkRequestId: true,
      hipReferenceNumber: true,
      abdmVerifiedAt: true,
    },
  });
  if (!patient) {
    return { status: 404, body: { success: false, message: 'Patient not found.' } };
  }
  return {
    status: 200,
    body: {
      success: true,
      hipLinked: Boolean(patient.hipLinked),
      careContextId: patient.careContextId || '',
      careContextStatus: patient.careContextStatus || '',
      syncStatus: patient.syncStatus || '',
      linkedAt: patient.linkedAt || null,
      syncTime: patient.linkedAt || null,
      patient,
    },
  };
}

module.exports = {
  linkHipPatient,
  retryContextNotify,
  handleOnGenerateTokenCallback,
  handleOnCareContextCallback,
  handleOnContextNotifyCallback,
  getHipPatientStatus,
  callContextNotify,
  linkEpisodeCareContext,
  hasPendingEpisodeLink,
  GENERATE_TOKEN_PATH,
  LINK_CARECONTEXT_PATH,
  pendingLinkByRequestId,
};
