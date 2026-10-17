const crypto = require('crypto');
const {
  encryptHealthInformation,
  decryptHealthInformation,
  generateFideliusKeyMaterial,
  checksumHealthInformation,
} = require('./abdmHealthDataCrypto');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const fhirBundle = {
    resourceType: 'Bundle',
    type: 'document',
    id: 'fidelius-selftest',
  };
  const serialized = JSON.stringify(fhirBundle);
  assert(serialized.includes('"resourceType":"Bundle"'), 'FHIR Bundle must serialize');

  const hiu = generateFideliusKeyMaterial();
  const encrypted = encryptHealthInformation({
    fhirBundle,
    keyMaterial: hiu.keyMaterial,
  });

  assert(typeof encrypted.content === 'string' && encrypted.content.length > 0, 'content must be produced');
  assert(encrypted.keyMaterial?.cryptoAlg === 'ECDH', 'HIP keyMaterial.cryptoAlg');
  assert(encrypted.keyMaterial?.curve === 'Curve25519', 'HIP keyMaterial.curve');
  assert(encrypted.keyMaterial?.dhPublicKey?.keyValue, 'HIP public key must be returned');
  const hipSpki = Buffer.from(encrypted.keyMaterial.dhPublicKey.keyValue, 'base64');
  assert(hipSpki.length > 65 && hipSpki[0] === 0x30, 'HIP keyValue must be X.509 SPKI DER (ASN.1 SEQUENCE)');
  assert(encrypted.keyMaterial?.nonce, 'HIP nonce must be returned');
  const expectedChecksum = crypto.createHash('md5').update(serialized, 'utf8').digest('base64');
  const contentChecksum = crypto.createHash('md5').update(encrypted.content, 'utf8').digest('base64');
  assert(checksumHealthInformation(serialized) === expectedChecksum, 'plaintext MD5 Base64');
  assert(encrypted.checksum === expectedChecksum, 'encrypt must return plaintext checksum');
  assert(encrypted.checksum !== contentChecksum, 'checksum must not use encrypted/Base64 content');

  const decrypted = decryptHealthInformation({
    content: encrypted.content,
    hipKeyMaterial: encrypted.keyMaterial,
    hiuPrivateKey: hiu.privateKey,
    hiuNonce: hiu.nonce,
  });
  assert(decrypted === serialized, 'round-trip must restore UTF-8 FHIR JSON');

  console.log(JSON.stringify({
    ok: true,
    algorithm: 'Fidelius/BouncyCastle Curve25519 ECDH + XOR-nonce HKDF-SHA256 + AES-256-GCM',
    checksum: 'md5-plaintext-base64',
    fhirSerialized: true,
    contentLength: encrypted.content.length,
    hipPublicKeySpki: hipSpki[0] === 0x30,
    hipNoncePresent: Boolean(encrypted.keyMaterial.nonce),
    roundTrip: true,
  }));
}

run();
