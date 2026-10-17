const { buildDiagnosticReportBundle } = require('./diagnosticReport');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const bundle = buildDiagnosticReportBundle({
  patient: { id: 'p1', uhid: 'UH1', name: 'Test', gender: 'F' },
  careContext: { careContextId: 'CC-LAB-UH1-abc' },
  labOrder: { id: 'lo1', orderNumber: 'LAB-1', updatedAt: '2026-10-04T10:00:00.000Z' },
  results: [
    { testName: 'Hemoglobin', value: '13.2', unit: 'g/dL', referenceRange: '12-15' },
  ],
});

assert(bundle.resourceType === 'Bundle', 'bundle');
assert(bundle.entry.some((e) => e.resource.resourceType === 'DiagnosticReport'), 'report');
assert(bundle.entry.some((e) => e.resource.resourceType === 'Observation'), 'observation');
const obs = bundle.entry.find((e) => e.resource.resourceType === 'Observation').resource;
assert(obs.referenceRange[0].text === '12-15', 'reference range');
console.log(JSON.stringify({ ok: true, type: 'DiagnosticReport' }));
