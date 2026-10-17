const { prisma } = require('../../../config/prisma');

function logConsentRequest(label, payload) {
  console.log(`[abdm-hiu-consent] ${label}`);
  if (payload !== undefined) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function parseCallbackError(error) {
  if (error == null) return { errorCode: null, errorMessage: null };
  if (typeof error === 'string') {
    const text = error.trim();
    return { errorCode: text ? 'ON_INIT_ERROR' : null, errorMessage: text || null };
  }
  if (typeof error !== 'object') {
    return { errorCode: 'ON_INIT_ERROR', errorMessage: String(error) };
  }
  const code = String(error.code || error.errorCode || '').trim();
  const message = String(error.message || error.errorMessage || '').trim();
  if (!code && !message) return { errorCode: null, errorMessage: null };
  return {
    errorCode: (code || 'ON_INIT_ERROR').slice(0, 120),
    errorMessage: (message || code || 'Consent request on-init error').slice(0, 2000),
  };
}

function canonicalAbha(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  const at = text.indexOf('@');
  const local = (at >= 0 ? text.slice(0, at) : text).replace(/\D/g, '');
  const domain = at >= 0 ? text.slice(at) : '';
  return `${local}${domain}`;
}

function maskAbhaAddress(value) {
  const address = String(value || '').trim();
  if (!address) return null;
  const at = address.indexOf('@');
  if (at <= 2) return '****';
  return `${address.slice(0, 2)}****${address.slice(at)}`;
}

function normalizeStatus(value, fallback = 'PENDING') {
  const status = String(value || '').trim().toUpperCase();
  return status || fallback;
}

function serializeConsentRequest(row, { includeRaw = false } = {}) {
  if (!row) return null;
  const body = {
    consentRequestId: row.consentRequestId,
    consentId: row.consentId || null,
    artefactId: row.artefactId || row.consentId || null,
    patientAbha: maskAbhaAddress(row.abhaAddress),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  if (includeRaw) {
    body.requestId = row.requestId || null;
    body.errorCode = row.errorCode || null;
    body.errorMessage = row.errorMessage || null;
    body.rawPayload = row.rawPayload || null;
  }
  return body;
}

async function persistConsentRequestOnInit({
  consentRequestId,
  requestId,
  status,
  errorCode,
  errorMessage,
  rawPayload,
  consentId,
  artefactId,
  abhaAddress,
} = {}) {
  const crid = String(consentRequestId || '').trim();
  const rid = String(requestId || '').trim();
  const artefactKeys = [...new Set([
    String(consentId || '').trim(),
    String(artefactId || '').trim(),
  ].filter(Boolean))];
  if (!crid && !rid && !artefactKeys.length) {
    logConsentRequest('Consent request not persisted', { reason: 'consentRequest.id, artefact id and response.requestId missing' });
    return null;
  }

  const data = {
    status: normalizeStatus(status),
    errorCode: errorCode || null,
    errorMessage: errorMessage || null,
    rawPayload: rawPayload == null ? undefined : rawPayload,
  };
  if (rid) data.requestId = rid;
  if (crid) data.consentRequestId = crid;
  if (consentId !== undefined) data.consentId = String(consentId || '').trim() || null;
  if (artefactId !== undefined) data.artefactId = String(artefactId || '').trim() || null;
  if (abhaAddress !== undefined) data.abhaAddress = String(abhaAddress || '').trim() || null;

  if (crid) {
    const byConsent = await prisma.abdmConsentRequest.findUnique({
      where: { consentRequestId: crid },
    });
    if (byConsent) {
      const incomingAbha = canonicalAbha(data.abhaAddress);
      const storedAbha = canonicalAbha(byConsent.abhaAddress);
      if (incomingAbha && storedAbha && incomingAbha !== storedAbha) {
        logConsentRequest('ABHA mismatch; consent not reassigned', {
          consentRequestId: byConsent.consentRequestId,
        });
        delete data.abhaAddress;
        delete data.consentId;
        delete data.artefactId;
        if (data.status === 'GRANTED') data.status = byConsent.status;
      }
      const row = await prisma.abdmConsentRequest.update({
        where: { id: byConsent.id },
        data,
      });
      logConsentRequest('Consent request updated', {
        consentRequestId: row.consentRequestId,
        requestId: row.requestId || null,
        status: row.status,
      });
      return row;
    }
  }

  if (rid) {
    const byRequest = await prisma.abdmConsentRequest.findFirst({
      where: { requestId: rid },
      orderBy: { updatedAt: 'desc' },
    });
    if (byRequest) {
      const incomingAbha = canonicalAbha(data.abhaAddress);
      const storedAbha = canonicalAbha(byRequest.abhaAddress);
      if (incomingAbha && storedAbha && incomingAbha !== storedAbha) {
        logConsentRequest('ABHA mismatch; consent not reassigned', {
          consentRequestId: byRequest.consentRequestId,
        });
        delete data.abhaAddress;
        delete data.consentId;
        delete data.artefactId;
        if (data.status === 'GRANTED') data.status = byRequest.status;
      }
      const row = await prisma.abdmConsentRequest.update({
        where: { id: byRequest.id },
        data,
      });
      logConsentRequest('Consent request updated by requestId', {
        consentRequestId: row.consentRequestId,
        requestId: row.requestId || null,
        status: row.status,
      });
      return row;
    }
  }

  if (artefactKeys.length) {
    const byArtefact = await prisma.abdmConsentRequest.findFirst({
      where: {
        OR: artefactKeys.flatMap((key) => ([
          { consentId: key },
          { artefactId: key },
        ])),
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (byArtefact) {
      const row = await prisma.abdmConsentRequest.update({
        where: { id: byArtefact.id },
        data,
      });
      logConsentRequest('Consent request updated by artefact', {
        consentRequestId: row.consentRequestId,
        consentId: row.consentId || null,
        status: row.status,
      });
      return row;
    }
  }

  if (!crid) {
    logConsentRequest('Consent request not created', {
      requestId: rid || null,
      reason: 'consentRequest.id required to create AbdmConsentRequest',
    });
    return null;
  }

  const row = await prisma.abdmConsentRequest.create({
    data: {
      consentRequestId: crid,
      requestId: rid || null,
      consentId: data.consentId || null,
      artefactId: data.artefactId || null,
      abhaAddress: data.abhaAddress || null,
      status: data.status,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      rawPayload: rawPayload == null ? undefined : rawPayload,
    },
  });
  logConsentRequest('Consent request created', {
    consentRequestId: row.consentRequestId,
    requestId: row.requestId || null,
    status: row.status,
  });
  return row;
}

async function persistConsentOnFetch({
  consentRequestId,
  consentId,
  artefactId,
  requestId,
  status,
  abhaAddress,
  errorCode,
  errorMessage,
  rawPayload,
} = {}) {
  const crid = String(consentRequestId || '').trim();
  const cid = String(consentId || artefactId || '').trim();
  const aid = String(artefactId || consentId || '').trim();
  const rid = String(requestId || '').trim();
  const orFilters = [];
  if (crid) orFilters.push({ consentRequestId: crid });
  if (cid) {
    orFilters.push({ consentId: cid });
    orFilters.push({ artefactId: cid });
  }
  if (aid && aid !== cid) {
    orFilters.push({ consentId: aid });
    orFilters.push({ artefactId: aid });
  }
  if (rid) orFilters.push({ requestId: rid });

  let existing = null;
  if (orFilters.length) {
    existing = await prisma.abdmConsentRequest.findFirst({
      where: { OR: orFilters },
      orderBy: { updatedAt: 'desc' },
    });
  }

  const data = {
    status: normalizeStatus(status, existing?.status || 'GRANTED'),
    errorCode: errorCode || null,
    errorMessage: errorMessage || null,
    rawPayload: rawPayload == null ? undefined : rawPayload,
  };
  if (rid) data.requestId = rid;
  if (cid) data.consentId = cid;
  if (aid) data.artefactId = aid;
  if (abhaAddress !== undefined) data.abhaAddress = String(abhaAddress || '').trim() || null;

  if (existing) {
    const row = await prisma.abdmConsentRequest.update({
      where: { id: existing.id },
      data,
    });
    logConsentRequest('Consent fetch persisted', {
      consentRequestId: row.consentRequestId,
      consentId: row.consentId || null,
      status: row.status,
    });
    return row;
  }

  const uniqueId = crid || cid;
  if (!uniqueId) {
    logConsentRequest('Consent fetch not persisted', {
      reason: 'No matching AbdmConsentRequest and no consentId to create',
    });
    return null;
  }

  const row = await prisma.abdmConsentRequest.create({
    data: {
      consentRequestId: uniqueId,
      requestId: rid || null,
      consentId: cid || null,
      artefactId: aid || null,
      abhaAddress: String(abhaAddress || '').trim() || null,
      status: data.status,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      rawPayload: rawPayload == null ? undefined : rawPayload,
    },
  });
  logConsentRequest('Consent fetch created', {
    consentRequestId: row.consentRequestId,
    consentId: row.consentId || null,
    status: row.status,
  });
  return row;
}

async function createPendingConsentRequest({ requestId, abhaAddress, rawPayload } = {}) {
  const rid = String(requestId || '').trim();
  if (!rid) return null;
  return prisma.abdmConsentRequest.create({
    data: {
      consentRequestId: rid,
      requestId: rid,
      abhaAddress: String(abhaAddress || '').trim() || null,
      status: 'PENDING',
      rawPayload: rawPayload == null ? undefined : rawPayload,
    },
  });
}

async function listHiuConsentRequests({ take = 50 } = {}) {
  const rows = await prisma.abdmConsentRequest.findMany({
    orderBy: { updatedAt: 'desc' },
    take: Math.min(Number(take) || 50, 100),
  });
  return rows.map((row) => serializeConsentRequest(row));
}

async function getHiuConsentRequest(consentRequestId) {
  const id = String(consentRequestId || '').trim();
  if (!id) return null;
  const row = await prisma.abdmConsentRequest.findUnique({
    where: { consentRequestId: id },
  });
  return serializeConsentRequest(row, { includeRaw: true });
}

module.exports = {
  persistConsentRequestOnInit,
  persistConsentOnFetch,
  parseCallbackError,
  listHiuConsentRequests,
  getHiuConsentRequest,
  createPendingConsentRequest,
  serializeConsentRequest,
  maskAbhaAddress,
  canonicalAbha,
};
