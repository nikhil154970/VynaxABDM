const crypto = require('crypto');
const { prisma } = require('../../../config/prisma');
const abdmClient = require('./abdmClient');
const {
  createHiuHealthInformationRequest,
  upsertHiuClinicalRecord,
} = require('./abdmHiuDataFlow');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const originalRequest = abdmClient.abdmRequest;
  let abdmCalls = 0;
  abdmClient.abdmRequest = async () => {
    abdmCalls += 1;
    return {
      status: 202,
      requestId: crypto.randomUUID(),
      data: { hiRequest: { transactionId: crypto.randomUUID() } },
    };
  };

  const consentRequestId = crypto.randomUUID();
  const artefactId = crypto.randomUUID();
  let consentRowId = null;
  const recordIds = [];
  const txnIds = [];
  try {
    const consent = await prisma.abdmConsentRequest.create({
      data: {
        consentRequestId,
        consentId: artefactId,
        artefactId,
        status: 'GRANTED',
        abhaAddress: 'dup-hi-test@sbx',
        rawPayload: {
          consent: {
            status: 'GRANTED',
            consentDetail: {
              consentId: artefactId,
              hiTypes: ['OPConsultation', 'Prescription'],
              careContexts: [
                { careContextReference: 'CC-DUP-OPD' },
                { careContextReference: 'CC-DUP-RX' },
              ],
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
    consentRowId = consent.id;

    const first = await upsertHiuClinicalRecord({
      transactionId: crypto.randomUUID(),
      consentId: artefactId,
      careContextReference: 'CC-DUP-OPD',
      resourceType: 'Bundle',
      recordType: 'OPConsultation',
      fhirPayload: { resourceType: 'Bundle', id: 'one' },
    });
    recordIds.push(first.id);
    const concurrent = await Promise.all([
      upsertHiuClinicalRecord({
        transactionId: crypto.randomUUID(),
        consentId: artefactId,
        careContextReference: 'CC-DUP-OPD',
        resourceType: 'Bundle',
        recordType: 'OPConsultation',
        fhirPayload: { resourceType: 'Bundle', id: 'two' },
      }),
      upsertHiuClinicalRecord({
        transactionId: crypto.randomUUID(),
        consentId: artefactId,
        careContextReference: 'CC-DUP-OPD',
        resourceType: 'Bundle',
        recordType: 'OPConsultation',
        fhirPayload: { resourceType: 'Bundle', id: 'three' },
      }),
    ]);
    recordIds.push(...concurrent.map((row) => row.id));
    const otherCc = await upsertHiuClinicalRecord({
      transactionId: crypto.randomUUID(),
      consentId: artefactId,
      careContextReference: 'CC-DUP-RX',
      resourceType: 'Bundle',
      recordType: 'Prescription',
      fhirPayload: { resourceType: 'Bundle', id: 'rx' },
    });
    recordIds.push(otherCc.id);
    const opdCount = await prisma.abdmHiuHealthRecord.count({
      where: { consentId: artefactId, careContextReference: 'CC-DUP-OPD', recordType: 'OPConsultation' },
    });
    const rxCount = await prisma.abdmHiuHealthRecord.count({
      where: { consentId: artefactId, careContextReference: 'CC-DUP-RX', recordType: 'Prescription' },
    });
    assert(opdCount === 1, 'same consent+cc+type stays one row');
    assert(rxCount === 1, 'different care context is kept');

    const firstReq = await createHiuHealthInformationRequest({ consentId: artefactId });
    assert(firstReq.status === 202 && firstReq.body.success === true, 'first HI request accepted');
    if (firstReq.body.id) txnIds.push(firstReq.body.id);
    const sequentialDup = await createHiuHealthInformationRequest({ consentId: artefactId });
    assert(sequentialDup.status === 409 && sequentialDup.body.success === false, 'sequential in-flight duplicate rejected');
    assert(sequentialDup.body.duplicate === true, 'sequential marked duplicate');

    const concurrentReqs = await Promise.all([
      createHiuHealthInformationRequest({ consentId: artefactId }),
      createHiuHealthInformationRequest({ consentId: artefactId }),
    ]);
    assert(concurrentReqs.every((row) => row.status === 409 && row.body.success === false), 'concurrent in-flight rejected');
    assert(abdmCalls === 1, 'ABDM called once while in-flight');

    const inflight = await prisma.abdmHiuHiTransaction.findMany({ where: { consentId: artefactId } });
    txnIds.push(...inflight.map((row) => row.id));
    const inflightCount = inflight.filter((row) => ['PENDING', 'REQUESTED', 'ACKNOWLEDGED'].includes(row.status)).length;
    assert(inflightCount === 1, 'only one active HIU transaction');

    await prisma.abdmHiuHiTransaction.updateMany({
      where: { consentId: artefactId },
      data: { status: 'RECEIVED' },
    });
    const repeatAfterComplete = await createHiuHealthInformationRequest({ consentId: artefactId });
    assert(repeatAfterComplete.status === 202 && repeatAfterComplete.body.success === true, 'repeat fetch allowed after complete');
    if (repeatAfterComplete.body.id) txnIds.push(repeatAfterComplete.body.id);
    assert(abdmCalls === 2, 'repeat after complete calls ABDM again');

    console.log('abdmHiuDuplicateHiRequest.selftest OK');
  } finally {
    abdmClient.abdmRequest = originalRequest;
    const uniqueRecordIds = [...new Set(recordIds.filter(Boolean))];
    if (uniqueRecordIds.length) {
      await prisma.abdmHiuHealthRecord.deleteMany({ where: { id: { in: uniqueRecordIds } } }).catch(() => {});
    }
    await prisma.abdmHiuHealthRecord.deleteMany({ where: { consentId: artefactId } }).catch(() => {});
    const uniqueTxnIds = [...new Set(txnIds.filter(Boolean))];
    if (uniqueTxnIds.length) {
      await prisma.abdmHiuHiTransaction.deleteMany({ where: { id: { in: uniqueTxnIds } } }).catch(() => {});
    }
    await prisma.abdmHiuHiTransaction.deleteMany({ where: { consentId: artefactId } }).catch(() => {});
    if (consentRowId) {
      await prisma.abdmConsentRequest.delete({ where: { id: consentRowId } }).catch(() => {});
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
