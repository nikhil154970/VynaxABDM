const crypto = require('crypto');
const { abdmConfig } = require('./abdmConfig');

const MANDATORY_HEADER_KEYS = new Set([
  'Content-Type',
  'Accept',
  'REQUEST-ID',
  'TIMESTAMP',
  'X-CM-ID',
  'Authorization',
]);

/**
 * Build common ABDM outbound headers.
 * REQUEST-ID and TIMESTAMP are generated at request time unless explicitly provided.
 * Pass hipId (or additionalHeaders['X-HIP-ID']) for HIP operations.
 */
function buildAbdmHeaders(options = {}) {
  const {
    accessToken,
    requestId,
    timestamp,
    hipId,
    additionalHeaders,
  } = options;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'REQUEST-ID': requestId || crypto.randomUUID(),
    TIMESTAMP: timestamp || new Date().toISOString(),
    'X-CM-ID': abdmConfig.cmId || 'sbx',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const resolvedHipId =
    hipId ||
    (additionalHeaders && (additionalHeaders['X-HIP-ID'] || additionalHeaders['X_HIP_ID']));
  if (resolvedHipId) {
    headers['X-HIP-ID'] = String(resolvedHipId);
  }

  if (additionalHeaders && typeof additionalHeaders === 'object') {
    for (const [key, value] of Object.entries(additionalHeaders)) {
      if (value == null) continue;
      if (MANDATORY_HEADER_KEYS.has(key)) continue;
      if (key === 'X-HIP-ID' || key === 'X_HIP_ID') continue;
      headers[key] = value;
    }
  }

  return headers;
}

module.exports = { buildAbdmHeaders };
