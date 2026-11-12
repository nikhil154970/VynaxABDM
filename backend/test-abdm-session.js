/**
 * Temporary diagnostic: same Axios session POST as abdmSession.js.
 * Do not commit secrets. Do not print clientSecret or accessToken.
 */
require('dotenv').config();

const crypto = require('crypto');
const axios = require('axios');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function trimEnv(value, fallback = '') {
  if (value == null) return fallback;
  const trimmed = String(value).trim();
  return trimmed === '' ? fallback : trimmed;
}

function envFlag(name) {
  const raw = process.env[name];
  return Boolean(raw && String(raw).trim());
}

function sha256Fingerprint(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function headerNamesFrom(source) {
  if (!source || typeof source !== 'object') return [];
  return Object.keys(source);
}

function sanitizeResponseData(data) {
  if (data == null || typeof data !== 'object') return data;
  const clone = Array.isArray(data) ? [...data] : { ...data };
  for (const key of Object.keys(clone)) {
    const lower = String(key).toLowerCase();
    if (
      lower.includes('secret') ||
      lower.includes('token') ||
      lower === 'authorization' ||
      lower === 'cookie'
    ) {
      clone[key] = '[REDACTED]';
    }
  }
  return clone;
}

async function main() {
  const clientId = trimEnv(process.env.ABDM_CLIENT_ID);
  const clientSecret = trimEnv(process.env.ABDM_CLIENT_SECRET);
  const cmId = trimEnv(process.env.ABDM_CM_ID, 'sbx');
  const gatewayBase = trimEnv(
    process.env.ABDM_GATEWAY_BASE,
    'https://dev.abdm.gov.in/api/hiecm'
  ).replace(/\/+$/, '');
  const url = `${gatewayBase}/gateway/v3/sessions`;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'REQUEST-ID': crypto.randomUUID(),
    TIMESTAMP: new Date().toISOString(),
    'X-CM-ID': cmId || 'sbx',
  };

  console.log('[ABDM][DIAG] Session test request', {
    url,
    method: 'POST',
    clientId,
    clientIdLength: clientId.length,
    clientSecretPresent: Boolean(clientSecret),
    clientSecretLength: clientSecret.length,
    clientSecretSha256: clientSecret ? sha256Fingerprint(clientSecret) : null,
    'X-CM-ID': headers['X-CM-ID'],
    REQUEST_ID_valid_uuid: UUID_RE.test(String(headers['REQUEST-ID'])),
    TIMESTAMP_valid_iso: ISO_RE.test(String(headers.TIMESTAMP)),
    TIMESTAMP: headers.TIMESTAMP,
    axiosVersion: axios.VERSION || 'unknown',
    headerNames: headerNamesFrom(headers),
    HTTP_PROXY_present: envFlag('HTTP_PROXY') || envFlag('http_proxy'),
    HTTPS_PROXY_present: envFlag('HTTPS_PROXY') || envFlag('https_proxy'),
    matchesAbdmSessionJs:
      'axios.post(url, { clientId, clientSecret, grantType: "client_credentials" }, { headers, timeout: 30000 })',
  });

  try {
    const response = await axios.post(
      url,
      {
        clientId,
        clientSecret,
        grantType: 'client_credentials',
      },
      {
        headers,
        timeout: 30000,
      }
    );

    const data = response.data || {};
    const accessToken =
      data.accessToken ||
      data.access_token ||
      data.token ||
      data.authToken ||
      data.jwtToken ||
      data?.response?.accessToken ||
      data?.response?.access_token ||
      null;

    console.log('[ABDM][DIAG] Session test success', {
      httpStatus: response.status,
      accessTokenExists: Boolean(accessToken),
      accessTokenLength: accessToken ? String(accessToken).length : 0,
    });
  } catch (err) {
    const responseHeaders = err.response?.headers || {};
    console.log('[ABDM][DIAG] Session test failure', {
      httpStatus: err.response?.status || err.status || null,
      responseData: sanitizeResponseData(err.response?.data || { message: err.message }),
      responseHeaderNames: headerNamesFrom(responseHeaders),
    });
    process.exitCode = 1;
  }
}

main();
