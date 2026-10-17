const { buildDischargeSummaryBundle } = require('./dischargeSummary');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const bundle = buildDischargeSummaryBundle({
  patient: { id: 'p1', uhid: 'UH1', name: 'Test', gender: 'M' },
  careContext: { careContextId: 'CC-DS-UH1-abc' },
  admission: {
    id: 'a1',
    admissionDate: '2026-10-01T04:00:00.000Z',
    dischargeDate: '2026-10-04T08:00:00.000Z',
    dischargeSummaryData: { diagnosis: 'Recovered', advice: 'Follow up' },
  },
});

assert(bundle.resourceType === 'Bundle', 'bundle');
assert(bundle.entry[0].resource.type.text === 'DischargeSummary', 'type');
let skipped = false;
try {
  buildDischargeSummaryBundle({
    patient: { id: 'p1' },
    careContext: { careContextId: 'CC-DS-1' },
    admission: { id: 'a1', dischargeDate: null, dischargeSummaryData: { x: 1 } },
  });
} catch (err) {
  skipped = /dischargeDate/.test(err.message);
}
assert(skipped, 'no pre-discharge bundle');
console.log(JSON.stringify({ ok: true, type: 'DischargeSummary' }));
