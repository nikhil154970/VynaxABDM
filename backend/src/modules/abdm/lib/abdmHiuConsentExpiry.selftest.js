const crypto = require('crypto');
const { prisma } = require('../../../config/prisma');
const abdmClient = require('./abdmClient');
const { createHiuHealthInformationRequest } = require('./abdmHiuDataFlow');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function artefact({ from, to, status = 'GRANTED' }) {
  return {
    consent: {
      status,
      consentDetail: {
        hiTypes: ['OPConsultation'],
        careContexts: [{ careContextReference: 'CC-EXPIRY-TEST' }],
        permission: {
          accessMode: 'VIEW',
          dateRange: { from, to },
          dataEraseAt: '2010-01-01T00:00:00.000Z',
        },
      },
    },
  };
}

async function seed({ status, from, to }) {
  const consentRequestId = crypto.randomUUID();
  const artefactId = crypto.randomUUID();
  const row = await prisma.abdmConsentRequest.create({
    data: {
      consentRequestId,
      consentId: artefactId,
      artefactId,
      status,
      abhaAddress: 'expiry-test@sbx',
      rawPayload: artefact({ from, to, status }),
    },
  });
  return { row, artefactId, consentRequestId };
}

async function main() {
  const original = abdmClient.abdmRequest;
  let abdmCalls = 0;
  abdmClient.abdmRequest = async () => {
    abdmCalls += 1;
    return {
      status: 202,
      requestId: crypto.randomUUID(),
      data: { hiRequest: { transactionId: crypto.randomUUID() } },
    };
  };

  const createdConsentIds = [];
  const artefactIds = [];
  const txnIds = [];
  try {
    const expired = await seed({
      status: 'EXPIRED',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-12-31T23:59:59.000Z',
    });
    createdConsentIds.push(expired.row.id);
    artefactIds.push(expired.artefactId);
    const before = await prisma.abdmHiuHiTransaction.count();
    const expiredRes = await createHiuHealthInformationRequest({ consentId: expired.artefactId });
    const afterExpired = await prisma.abdmHiuHiTransaction.count();
    assert(expiredRes.status === 409 && expiredRes.body.success === false, 'expired HTTP 409');
    assert(expiredRes.body.consentStatus === 'EXPIRED', 'expired consentStatus');
    assert(afterExpired === before, 'expired creates no transaction');
    assert(abdmCalls === 0, 'expired does not call ABDM');

    const unparseable = await seed({
      status: 'GRANTED',
      from: 'not-a-date',
      to: 'also-not-a-date',
    });
    createdConsentIds.push(unparseable.row.id);
    artefactIds.push(unparseable.artefactId);
    const unparseableRes = await createHiuHealthInformationRequest({ consentId: unparseable.artefactId });
    assert(unparseableRes.status === 409 && unparseableRes.body.success === false, 'unparseable dates HTTP 409');
    assert(String(unparseableRes.body.message || '').includes('invalid'), 'unparseable date message');
    assert(abdmCalls === 0, 'unparseable dates do not call ABDM');

    const invalid = await seed({
      status: 'GRANTED',
      from: '2026-12-31T00:00:00.000Z',
      to: '2026-01-01T00:00:00.000Z',
    });
    createdConsentIds.push(invalid.row.id);
    artefactIds.push(invalid.artefactId);
    const invalidRes = await createHiuHealthInformationRequest({ consentId: invalid.artefactId });
    assert(invalidRes.status === 409 && invalidRes.body.success === false, 'invalid range HTTP 409');
    assert(String(invalidRes.body.message || '').includes('invalid'), 'invalid range message');
    assert(abdmCalls === 0, 'invalid range does not call ABDM');

    const granted = await seed({
      status: 'GRANTED',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-12-31T23:59:59.000Z',
    });
    createdConsentIds.push(granted.row.id);
    artefactIds.push(granted.artefactId);
    const outside = await createHiuHealthInformationRequest({
      consentId: granted.artefactId,
      dateRange: {
        from: '2025-01-01T00:00:00.000Z',
        to: '2026-06-01T00:00:00.000Z',
      },
    });
    assert(outside.status === 409 && outside.body.success === false, 'outside range HTTP 409');
    assert(String(outside.body.message || '').includes('outside'), 'outside range message');
    assert(abdmCalls === 0, 'outside range does not call ABDM');

    const dateOnlyPastTo = await seed({
      status: 'GRANTED',
      from: '2026-01-01',
      to: '2026-10-05',
    });
    createdConsentIds.push(dateOnlyPastTo.row.id);
    artefactIds.push(dateOnlyPastTo.artefactId);
    const historical = await createHiuHealthInformationRequest({ consentId: dateOnlyPastTo.artefactId });
    assert(historical.status === 202 && historical.body.success === true, 'historical permission to still valid');
    if (historical.body.id) txnIds.push(historical.body.id);
    assert(abdmCalls === 1, 'valid historical consent calls mocked ABDM once');

    const valid = await createHiuHealthInformationRequest({ consentId: granted.artefactId });
    assert(valid.status === 202 && valid.body.success === true, 'valid granted initiates');
    if (valid.body.id) txnIds.push(valid.body.id);
    assert(abdmCalls === 2, 'valid granted calls mocked ABDM');

    const after = await prisma.abdmHiuHiTransaction.count();
    assert(after === before + 2, 'only valid requests create transactions');

    console.log('abdmHiuConsentExpiry.selftest OK');
  } finally {
    abdmClient.abdmRequest = original;
    if (txnIds.length) {
      await prisma.abdmHiuHiTransaction.deleteMany({ where: { id: { in: txnIds } } }).catch(() => {});
    }
    if (artefactIds.length) {
      await prisma.abdmHiuHiTransaction.deleteMany({ where: { consentId: { in: artefactIds } } }).catch(() => {});
    }
    if (createdConsentIds.length) {
      await prisma.abdmConsentRequest.deleteMany({ where: { id: { in: createdConsentIds } } }).catch(() => {});
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
