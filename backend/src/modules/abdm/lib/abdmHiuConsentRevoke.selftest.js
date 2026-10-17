const crypto = require('crypto');
const { prisma } = require('../../../config/prisma');
const { handleConsentHiuNotifyCallback } = require('../callbacks/consentHiu.controller');
const { createHiuHealthInformationRequest } = require('./abdmHiuDataFlow');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const consentRequestId = crypto.randomUUID();
  const artefactId = crypto.randomUUID();
  let createdId = null;
  try {
    const granted = await prisma.abdmConsentRequest.create({
      data: {
        consentRequestId,
        consentId: artefactId,
        artefactId,
        status: 'GRANTED',
        abhaAddress: 'revoke-test@sbx',
        rawPayload: {
          consent: {
            status: 'GRANTED',
            consentDetail: {
              consentId: artefactId,
              hiTypes: ['OPConsultation'],
              careContexts: [{ careContextReference: 'CC-TEST-REVOKE' }],
              permission: {
                dateRange: {
                  from: '2026-01-01T00:00:00.000Z',
                  to: '2026-12-31T23:59:59.000Z',
                },
              },
            },
          },
        },
      },
    });
    createdId = granted.id;

    const missing = await handleConsentHiuNotifyCallback({
      notification: {
        consentRequestId,
        consentId: artefactId,
        consentArtefacts: [{ id: artefactId }],
      },
    });
    assert(missing.status === 202, 'missing status still ACKs');
    const afterMissing = await prisma.abdmConsentRequest.findUnique({ where: { id: createdId } });
    assert(afterMissing.status === 'GRANTED', 'missing status must not become REVOKED');

    const unknown = await handleConsentHiuNotifyCallback({
      notification: {
        consentRequestId,
        consentId: artefactId,
        status: 'SOMETHING_ELSE',
      },
    });
    assert(unknown.status === 202, 'unknown status still ACKs');
    const afterUnknown = await prisma.abdmConsentRequest.findUnique({ where: { id: createdId } });
    assert(afterUnknown.status === 'GRANTED', 'unknown status must not become REVOKED');

    const revoked = await handleConsentHiuNotifyCallback({
      notification: {
        consentRequestId,
        consentId: artefactId,
        status: 'REVOKED',
        consentArtefacts: [{ id: artefactId }],
      },
    });
    assert(revoked.status === 202, 'revoke notify ACK');
    const afterRevoke = await prisma.abdmConsentRequest.findUnique({ where: { id: createdId } });
    assert(afterRevoke.status === 'REVOKED', 'status updated to REVOKED');
    assert(afterRevoke.consentId === artefactId, 'artefact consentId preserved');
    assert(afterRevoke.consentRequestId === consentRequestId, 'consent request id preserved');

    const beforeTxn = await prisma.abdmHiuHiTransaction.count();
    const hi = await createHiuHealthInformationRequest({ consentId: artefactId });
    const afterTxn = await prisma.abdmHiuHiTransaction.count();
    assert(hi.status === 409, 'HI request HTTP 409');
    assert(hi.body.success === false, 'HI request success false');
    assert(hi.body.consentStatus === 'REVOKED', 'HI request consentStatus REVOKED');
    assert(afterTxn === beforeTxn, 'no HIU transaction created');

    const byRequest = await createHiuHealthInformationRequest({ consentId: consentRequestId });
    assert(byRequest.status === 409 && byRequest.body.success === false, 'request-id lookup also 409');

    console.log('abdmHiuConsentRevoke.selftest OK');
  } finally {
    if (createdId) {
      await prisma.abdmConsentRequest.delete({ where: { id: createdId } }).catch(() => {});
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
