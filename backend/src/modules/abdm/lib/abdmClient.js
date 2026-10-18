const axios = require('axios');
const { abdmConfig } = require('./abdmConfig');
const { buildAbdmHeaders } = require('./abdmHeaders');
const { ensureAccessToken } = require('./abdmSession');
const { writeAbdmAudit } = require('./abdmAudit');

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

const client = axios.create({
  baseURL: stripTrailingSlash(abdmConfig.gatewayBase),
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

const hspClient = axios.create({
  baseURL: stripTrailingSlash(abdmConfig.hspBase),
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

/**
 * Centralized ABDM outbound request helper.
 * Always uses fresh REQUEST-ID/TIMESTAMP via buildAbdmHeaders + session token when auth=true.
 */
async function abdmRequest({
  method = 'GET',
  base = 'gateway', // gateway | hsp | absolute
  path,
  url: absoluteUrl,
  data,
  params,
  apiName,
  hospitalId = null,
  hipId,
  requestId: providedRequestId,
  auth = true,
  additionalHeaders,
  auditRequestBody,
} = {}) {
  if (!path && !absoluteUrl) {
    throw new Error('abdmRequest requires path or url.');
  }

  const started = Date.now();
  const accessToken = auth ? await ensureAccessToken({ hospitalId }) : undefined;
  const headers = buildAbdmHeaders({
    accessToken,
    hipId,
    requestId: providedRequestId,
    additionalHeaders,
  });
  const requestId = headers['REQUEST-ID'];

  let baseURL;
  let requestPath = path;
  if (base === 'hsp') {
    baseURL = stripTrailingSlash(abdmConfig.hspBase);
  } else if (base === 'absolute') {
    baseURL = '';
    requestPath = absoluteUrl;
  } else {
    baseURL = stripTrailingSlash(abdmConfig.gatewayBase);
  }

  const fullUrl = absoluteUrl || `${baseURL}${path.startsWith('/') ? path : `/${path}`}`;
  const label = apiName || 'ABDM';

  console.log(`[ABDM][${label}] Request started`);
  console.log(
    JSON.stringify({
      apiName: label,
      method: String(method).toUpperCase(),
      url: fullUrl,
      requestId,
      hospitalId: hospitalId || null,
      hipIdPresent: Boolean(hipId),
    })
  );

  if (label === 'BRIDGE_URL') {
    console.log('[ABDM][BRIDGE_URL] Calling ABDM Gateway');
  }

  const axiosInstance = base === 'hsp' ? hspClient : base === 'absolute' ? axios : client;

  try {
    const response = await axiosInstance.request({
      method,
      url: base === 'absolute' ? absoluteUrl : path,
      baseURL: base === 'absolute' ? undefined : baseURL,
      data,
      params,
      headers,
      timeout: 30000,
    });

    const statusCode = response.status;
    const durationMs = Date.now() - started;
    console.log(`[ABDM][${label}] Response: ${statusCode}`);
    console.log(
      JSON.stringify({
        apiName: label,
        method: String(method).toUpperCase(),
        url: fullUrl,
        requestId,
        statusCode,
        durationMs,
      })
    );

    await writeAbdmAudit({
      hospitalId,
      direction: 'OUT',
      apiName: label,
      requestId,
      statusCode,
      requestBody: auditRequestBody != null ? auditRequestBody : sanitizeForAudit(data),
      responseBody: sanitizeForAudit(response.data),
      error: null,
    });

    return {
      status: statusCode,
      data: response.data,
      headers: response.headers,
      requestId,
    };
  } catch (err) {
    const statusCode = err.response?.status || 500;
    const responseData = err.response?.data || { message: err.message };
    console.log('[ABDM][DEBUG] Gateway error response', {
      statusCode,
      responseData,
      responseHeaders: err.response?.headers || null,
    });
    const durationMs = Date.now() - started;
    const errorCode = responseData?.code || responseData?.error?.code || null;
    const errorMessage =
      responseData?.message ||
      responseData?.description ||
      responseData?.error?.message ||
      err.message;

    console.log(`[ABDM][${label}] Response: ${statusCode}`);
    console.log(
      JSON.stringify({
        apiName: label,
        method: String(method).toUpperCase(),
        url: fullUrl,
        requestId,
        statusCode,
        durationMs,
        errorCode,
        errorMessage,
      })
    );

    await writeAbdmAudit({
      hospitalId,
      direction: 'OUT',
      apiName: label,
      requestId,
      statusCode,
      requestBody: auditRequestBody != null ? auditRequestBody : sanitizeForAudit(data),
      responseBody: sanitizeForAudit(responseData),
      error: errorMessage,
    });

    const wrapped = new Error(errorMessage);
    wrapped.status = statusCode;
    wrapped.response = { status: statusCode, data: responseData };
    wrapped.requestId = requestId;
    throw wrapped;
  }
}

function sanitizeForAudit(value) {
  if (value == null) return null;
  if (typeof value !== 'object') return { type: typeof value };
  const clone = Array.isArray(value) ? [...value] : { ...value };
  const redactKeys = [
    'clientSecret',
    'accessToken',
    'access_token',
    'Authorization',
    'authorization',
    'otp',
    'otpValue',
    'aadhaar',
    'loginId',
    'password',
    'token',
    'linkToken',
    'xToken',
  ];
  for (const key of Object.keys(clone)) {
    if (redactKeys.some((k) => k.toLowerCase() === String(key).toLowerCase())) {
      clone[key] = '[REDACTED]';
    }
  }
  return clone;
}

module.exports = {
  client,
  hspClient,
  abdmRequest,
};
