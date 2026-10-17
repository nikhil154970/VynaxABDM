const crypto = require('crypto');
const elliptic = require('elliptic');
const hash = require('hash.js');

/** BouncyCastle CustomNamedCurves.curve25519 (Weierstrass), not Montgomery X25519. */
const BC_CURVE25519 = {
  p: '7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed',
  a: '2aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa984914a144',
  b: '7b425ed097b425ed097b425ed097b425ed097b425ed097b4260b5e9c7710c864',
  n: '1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed',
  h: '8',
  g: [
    '2aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaad245a',
    '20ae19a1b8a086b4e01edd2c7748d14c923d4d7e6d7c61b229e9c5a27eced3d9',
  ],
};

let curve25519 = null;

function getCurve() {
  if (curve25519) return curve25519;
  const preset = new elliptic.curves.PresetCurve({
    type: 'short',
    p: BC_CURVE25519.p,
    a: BC_CURVE25519.a,
    b: BC_CURVE25519.b,
    n: BC_CURVE25519.n,
    hash: hash.sha256,
    gRed: false,
    g: BC_CURVE25519.g,
  });
  curve25519 = new elliptic.ec(preset);
  return curve25519;
}

function decodeBase64(value, label) {
  const raw = String(value || '').trim();
  if (!raw) {
    throw new Error(`${label} is required.`);
  }
  const buf = Buffer.from(raw, 'base64');
  if (!buf.length) {
    throw new Error(`${label} is not valid Base64.`);
  }
  return buf;
}

function encodeBase64(buf) {
  return Buffer.from(buf).toString('base64');
}

function xorBytes(a, b) {
  if (a.length !== b.length) {
    throw new Error('HIP and HIU nonces must be the same length.');
  }
  const out = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i += 1) {
    out[i] = a[i] ^ b[i];
  }
  return out;
}

function toUncompressedPoint(publicKeyBytes) {
  if (publicKeyBytes.length === 65 && publicKeyBytes[0] === 0x04) {
    return publicKeyBytes;
  }
  if (publicKeyBytes.length > 65 && publicKeyBytes[publicKeyBytes.length - 65] === 0x04) {
    return publicKeyBytes.subarray(publicKeyBytes.length - 65);
  }
  throw new Error('HIU public key must be an uncompressed Curve25519 point (0x04 || X || Y).');
}

function derLength(byteLength) {
  if (byteLength < 0x80) return Buffer.from([byteLength]);
  if (byteLength < 0x100) return Buffer.from([0x81, byteLength]);
  return Buffer.from([0x82, (byteLength >> 8) & 0xff, byteLength & 0xff]);
}

function derTlv(tag, content) {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

function derInteger(bytes) {
  let value = Buffer.from(bytes);
  while (value.length > 1 && value[0] === 0x00 && (value[1] & 0x80) === 0) {
    value = value.subarray(1);
  }
  if (value[0] & 0x80) {
    value = Buffer.concat([Buffer.from([0x00]), value]);
  }
  return derTlv(0x02, value);
}

function encodePublicKeyToSpki(uncompressedPoint) {
  const point = Buffer.from(uncompressedPoint);
  if (point.length !== 65 || point[0] !== 0x04) {
    throw new Error('HIP public key must be an uncompressed 65-byte point.');
  }

  const p = Buffer.from(BC_CURVE25519.p, 'hex');
  const a = Buffer.from(BC_CURVE25519.a, 'hex');
  const b = Buffer.from(BC_CURVE25519.b, 'hex');
  const n = Buffer.from(BC_CURVE25519.n, 'hex');
  const generator = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(BC_CURVE25519.g[0], 'hex'),
    Buffer.from(BC_CURVE25519.g[1], 'hex'),
  ]);

  const fieldId = derTlv(0x30, Buffer.concat([
    Buffer.from('06072a8648ce3d0101', 'hex'),
    derInteger(p),
  ]));
  const curve = derTlv(0x30, Buffer.concat([
    derTlv(0x04, a),
    derTlv(0x04, b),
  ]));
  const specifiedCurve = derTlv(0x30, Buffer.concat([
    derInteger(Buffer.from([0x01])),
    fieldId,
    curve,
    derTlv(0x04, generator),
    derInteger(n),
    derInteger(Buffer.from([Number(BC_CURVE25519.h)])),
  ]));
  const algorithm = derTlv(0x30, Buffer.concat([
    Buffer.from('06072a8648ce3d0201', 'hex'),
    specifiedCurve,
  ]));
  return derTlv(0x30, Buffer.concat([
    algorithm,
    derTlv(0x03, Buffer.concat([Buffer.from([0x00]), point])),
  ]));
}

function generateHipKeyMaterial() {
  const ec = getCurve();
  const pair = ec.genKeyPair();
  const publicKey = Buffer.from(pair.getPublic(false, 'hex'), 'hex');
  const privateKey = Buffer.from(pair.getPrivate().toArray('be'));
  const nonce = crypto.randomBytes(32);
  return { publicKey, privateKey, nonce };
}

function computeSharedSecret(privateKeyBytes, publicKeyBytes) {
  const ec = getCurve();
  const priv = ec.keyFromPrivate(privateKeyBytes);
  const pub = ec.keyFromPublic(toUncompressedPoint(publicKeyBytes));
  const shared = priv.derive(pub.getPublic());
  return Buffer.from(shared.toArray('be', 32));
}

function deriveAesGcmParams(sharedSecret, hipNonce, hiuNonce) {
  const xorOfNonces = xorBytes(hipNonce, hiuNonce);
  const salt = xorOfNonces.subarray(0, 20);
  const iv = xorOfNonces.subarray(xorOfNonces.length - 12);
  const aesKey = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, salt, Buffer.alloc(0), 32));
  return { aesKey, iv };
}

function aesGcmEncrypt(plaintextUtf8, aesKey, iv) {
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plaintextUtf8, 'utf8')),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return encodeBase64(encrypted);
}

function aesGcmDecrypt(contentBase64, aesKey, iv) {
  const packed = decodeBase64(contentBase64, 'content');
  if (packed.length < 17) {
    throw new Error('Encrypted content is too short.');
  }
  const ciphertext = packed.subarray(0, packed.length - 16);
  const tag = packed.subarray(packed.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function validateKeyMaterial(keyMaterial) {
  if (!keyMaterial || typeof keyMaterial !== 'object') {
    throw new Error('keyMaterial is required.');
  }
  const cryptoAlg = String(keyMaterial.cryptoAlg || '').trim().toUpperCase();
  const curve = String(keyMaterial.curve || '').trim().toLowerCase();
  if (cryptoAlg !== 'ECDH') {
    throw new Error('keyMaterial.cryptoAlg must be ECDH.');
  }
  if (curve !== 'curve25519') {
    throw new Error('keyMaterial.curve must be Curve25519.');
  }

  const dhPublicKey = keyMaterial.dhPublicKey && typeof keyMaterial.dhPublicKey === 'object'
    ? keyMaterial.dhPublicKey
    : null;
  if (!dhPublicKey) {
    throw new Error('keyMaterial.dhPublicKey is required.');
  }

  const expiry = String(dhPublicKey.expiry || '').trim();
  if (expiry) {
    const expiryDate = new Date(expiry);
    if (Number.isNaN(expiryDate.getTime())) {
      throw new Error('keyMaterial.dhPublicKey.expiry is invalid.');
    }
    if (expiryDate.getTime() <= Date.now()) {
      throw new Error('keyMaterial.dhPublicKey.expiry has passed.');
    }
  }

  const publicKeyBytes = toUncompressedPoint(decodeBase64(dhPublicKey.keyValue, 'dhPublicKey.keyValue'));
  const nonce = decodeBase64(keyMaterial.nonce, 'keyMaterial.nonce');
  if (nonce.length !== 32) {
    throw new Error('keyMaterial.nonce must decode to 32 bytes.');
  }

  return { publicKeyBytes, nonce, expiry };
}

function serializeFhirBundle(fhirBundle) {
  if (fhirBundle == null) {
    throw new Error('fhirBundle is required.');
  }
  if (typeof fhirBundle === 'string') {
    const text = fhirBundle.trim();
    if (!text) throw new Error('fhirBundle is required.');
    return text;
  }
  return JSON.stringify(fhirBundle);
}

function buildReturnedKeyMaterial({ publicKey, nonce, expiry }) {
  const dhPublicKey = {
    parameters: 'Curve25519/32byte random key',
    keyValue: encodeBase64(encodePublicKeyToSpki(publicKey)),
  };
  if (expiry) {
    dhPublicKey.expiry = expiry;
  }
  return {
    cryptoAlg: 'ECDH',
    curve: 'Curve25519',
    dhPublicKey,
    nonce: encodeBase64(nonce),
  };
}

/**
 * ABDM data-push entries[].checksum:
 * Base64(MD5(original plaintext FHIR JSON)), not ciphertext.
 */
function checksumHealthInformation(plaintextFhirJson) {
  const plaintext = String(plaintextFhirJson ?? '');
  if (!plaintext) {
    throw new Error('plaintext FHIR JSON is required for checksum.');
  }
  return crypto.createHash('md5').update(plaintext, 'utf8').digest('base64');
}

/**
 * Encrypt a FHIR document for ABDM Fidelius / BouncyCastle Curve25519 data flow.
 * Does not mutate fhirBundle.
 */
function encryptHealthInformation({ fhirBundle, keyMaterial } = {}) {
  const hiu = validateKeyMaterial(keyMaterial);
  const plaintext = serializeFhirBundle(fhirBundle);
  const checksum = checksumHealthInformation(plaintext);
  const hip = generateHipKeyMaterial();
  const sharedSecret = computeSharedSecret(hip.privateKey, hiu.publicKeyBytes);
  const { aesKey, iv } = deriveAesGcmParams(sharedSecret, hip.nonce, hiu.nonce);
  const content = aesGcmEncrypt(plaintext, aesKey, iv);

  hip.privateKey.fill(0);
  sharedSecret.fill(0);
  aesKey.fill(0);

  return {
    content,
    checksum,
    keyMaterial: buildReturnedKeyMaterial({
      publicKey: hip.publicKey,
      nonce: hip.nonce,
      expiry: hiu.expiry || null,
    }),
  };
}

/** Test/helper: decrypt with HIU private key + HIP returned keyMaterial. */
function decryptHealthInformation({ content, hipKeyMaterial, hiuPrivateKey, hiuNonce } = {}) {
  const hip = validateKeyMaterial(hipKeyMaterial);
  const privateKeyBytes = Buffer.isBuffer(hiuPrivateKey)
    ? hiuPrivateKey
    : decodeBase64(hiuPrivateKey, 'hiuPrivateKey');
  const hiuNonceBytes = Buffer.isBuffer(hiuNonce)
    ? hiuNonce
    : decodeBase64(hiuNonce, 'hiuNonce');
  const sharedSecret = computeSharedSecret(privateKeyBytes, hip.publicKeyBytes);
  const { aesKey, iv } = deriveAesGcmParams(sharedSecret, hip.nonce, hiuNonceBytes);
  const plaintext = aesGcmDecrypt(content, aesKey, iv);

  sharedSecret.fill(0);
  aesKey.fill(0);

  return plaintext;
}

function generateFideliusKeyMaterial() {
  const generated = generateHipKeyMaterial();
  return {
    privateKey: encodeBase64(generated.privateKey),
    publicKey: encodeBase64(generated.publicKey),
    nonce: encodeBase64(generated.nonce),
    keyMaterial: buildReturnedKeyMaterial({
      publicKey: generated.publicKey,
      nonce: generated.nonce,
      expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),
  };
}

module.exports = {
  encryptHealthInformation,
  decryptHealthInformation,
  generateFideliusKeyMaterial,
  checksumHealthInformation,
};
