const crypto = require('crypto');
const { fetchCertificate } = require('./abdmCertificate');

const ABDM_RSA_PADDING = {
  padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
  oaepHash: 'sha1',
};

function normalizePublicKey(publicKey) {
  const raw = String(publicKey || '').trim();
  if (!raw) {
    throw new Error('Public key is required for encryption.');
  }

  if (raw.includes('BEGIN PUBLIC KEY')) {
    return raw;
  }

  return crypto.createPublicKey({
    key: Buffer.from(raw, 'base64'),
    format: 'der',
    type: 'spki',
  });
}

function encryptWithPublicKey(plaintext, publicKey) {
  const value = String(plaintext ?? '');
  if (!value) {
    throw new Error('Plaintext value is required for encryption.');
  }

  const key = normalizePublicKey(publicKey);
  const encrypted = crypto.publicEncrypt(
    {
      key,
      ...ABDM_RSA_PADDING,
    },
    Buffer.from(value, 'utf8'),
  );

  return encrypted.toString('base64');
}

async function encryptAadhaar(aadhaar, publicKey) {
  const value = String(aadhaar || '').replace(/\D/g, '');
  if (!/^\d{12}$/.test(value)) {
    throw new Error('Aadhaar must be a valid 12-digit number.');
  }
  const key = publicKey || (await getGovernmentPublicKey());
  return encryptWithPublicKey(value, key);
}

async function encryptOtp(otp, publicKey) {
  const value = String(otp || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(value)) {
    throw new Error('OTP must be a valid 6-digit number.');
  }
  const key = publicKey || (await getGovernmentPublicKey());
  return encryptWithPublicKey(value, key);
}

async function getGovernmentPublicKey() {
  const result = await fetchCertificate();
  if (!result.body?.success || !result.body?.publicKey) {
    const err = new Error('Unable to fetch ABDM public certificate.');
    err.details = result.body;
    throw err;
  }
  return result.body.publicKey;
}

module.exports = {
  encryptWithPublicKey,
  encryptAadhaar,
  encryptOtp,
  getGovernmentPublicKey,
};
