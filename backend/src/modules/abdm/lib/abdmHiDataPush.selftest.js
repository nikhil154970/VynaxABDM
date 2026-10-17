const { saveHiSession } = require('./abdmHiSessionStore');
const { generateFideliusKeyMaterial } = require('./abdmHealthDataCrypto');
const { pushHealthInformation } = require('./abdmHiDataPush');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const hiu = generateFideliusKeyMaterial();
  const transactionId = '11111111-2222-4333-8444-555555555555';
  saveHiSession({
    consentId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    transactionId,
    dateRange: { from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T23:59:59.000Z' },
    dataPushUrl: 'http://127.0.0.1:9/mock-hiu/data/notification',
    keyMaterial: hiu.keyMaterial,
    requestId: '99999999-aaaa-4bbb-8ccc-dddddddddddd',
  });

  const fhirBundle = { resourceType: 'Bundle', type: 'document', id: 'data-push-selftest' };
  let postedUrl = null;
  let postedBody = null;

  const result = await pushHealthInformation({
    transactionId,
    fhirBundle,
    careContextReference: 'CC-OPD-TEST-1',
    httpPost: async (url, payload) => {
      postedUrl = url;
      postedBody = payload;
      return { status: 202, data: { acknowledgement: 'ACCEPTED' } };
    },
  });

  assert(postedUrl === 'http://127.0.0.1:9/mock-hiu/data/notification', 'mock dataPushUrl');
  assert(postedBody.pageNumber === 0 && postedBody.pageCount === 1, 'paging');
  assert(postedBody.transactionId === transactionId, 'transactionId from HI session');
  assert(postedBody.entries.length === 1, 'one entry');
  assert(postedBody.entries[0].media === 'application/fhir+json', 'media');
  assert(typeof postedBody.entries[0].content === 'string' && postedBody.entries[0].content.length > 0, 'content');
  assert(typeof postedBody.entries[0].checksum === 'string' && postedBody.entries[0].checksum.length > 0, 'checksum');
  assert(postedBody.entries[0].careContextReference === 'CC-OPD-TEST-1', 'careContextReference');
  assert(postedBody.keyMaterial?.cryptoAlg === 'ECDH', 'HIP keyMaterial');
  assert(result.status === 202, 'mock 202');

  console.log(JSON.stringify({
    ok: true,
    mockPost: true,
    status: result.status,
    transactionId: postedBody.transactionId,
    media: postedBody.entries[0].media,
    contentPresent: true,
    checksumPresent: true,
    keyMaterialPresent: true,
  }));
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
