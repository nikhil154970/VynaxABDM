const crypto = require('crypto');
const { prisma } = require('../../../config/prisma');

function stableStringify(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function hashPayload(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

/**
 * Persist outbound/inbound ABDM traffic to AbdmAuditLog.
 * Stores hashes only — never raw secrets, tokens, Aadhaar, or OTP.
 */
async function writeAbdmAudit({
  hospitalId = null,
  direction = 'OUT',
  apiName,
  requestId,
  statusCode,
  requestBody = null,
  responseBody = null,
  error = null,
} = {}) {
  if (!apiName || !requestId) return null;

  try {
    return await prisma.abdmAuditLog.create({
      data: {
        hospitalId: hospitalId || null,
        direction: direction === 'IN' ? 'IN' : 'OUT',
        apiName: String(apiName),
        requestId: String(requestId),
        statusCode: Number.isFinite(Number(statusCode)) ? Number(statusCode) : 0,
        requestHash: hashPayload(requestBody),
        responseHash: hashPayload(responseBody),
        error: error ? String(error).slice(0, 2000) : null,
      },
    });
  } catch (err) {
    console.log('[ABDM][AUDIT] Failed to write AbdmAuditLog:', err.message || err);
    return null;
  }
}

module.exports = {
  writeAbdmAudit,
  hashPayload,
};
