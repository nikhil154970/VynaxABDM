function trimEnv(value, fallback = '') {
  if (value == null) return fallback;
  const trimmed = String(value).trim();
  return trimmed === '' ? fallback : trimmed;
}

function toBoolean(value, fallback = false) {
  if (value == null || String(value).trim() === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

/**
 * ABDM env config — sandbox defaults only as fallbacks.
 * Controllers/services must use these values; do not hardcode hosts elsewhere.
 */
const abdmConfig = {
  enabled: toBoolean(process.env.ABDM_ENABLED, false),
  env: trimEnv(process.env.ABDM_ENV, 'sandbox'),
  cmId: trimEnv(process.env.ABDM_CM_ID, 'sbx'),
  clientId: trimEnv(process.env.ABDM_CLIENT_ID),
  clientSecret: trimEnv(process.env.ABDM_CLIENT_SECRET),
  bridgeId: trimEnv(process.env.ABDM_BRIDGE_ID),
  hipId: trimEnv(process.env.ABDM_HIP_ID),
  gatewayBase: trimEnv(process.env.ABDM_GATEWAY_BASE, 'https://dev.abdm.gov.in/api/hiecm'),
  abhaBase: trimEnv(process.env.ABDM_ABHA_BASE, 'https://abhasbx.abdm.gov.in'),
  hspBase: trimEnv(process.env.ABDM_HSP_BASE, 'https://apihspsbx.abdm.gov.in'),
  bridgeCallbackUrl: trimEnv(process.env.ABDM_BRIDGE_CALLBACK_URL),
  defaultHospitalCode: trimEnv(process.env.ABDM_DEFAULT_HOSPITAL_CODE, 'main'),
};

module.exports = { abdmConfig };
