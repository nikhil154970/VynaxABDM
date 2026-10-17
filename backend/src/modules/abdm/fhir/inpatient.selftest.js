const { buildInpatientBundle } = require('./inpatient');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const bundle = buildInpatientBundle({
  patient: { id: 'p1', uhid: 'UH1', name: 'Test', gender: 'M' },
  careContext: { careContextId: 'CC-IPD-UH1-abc' },
  admission: {
    id: 'a1',
    admissionDate: '2026-10-01T04:00:00.000Z',
    notesText: 'Stable',
  },
  treatmentPlan: { description: 'Supportive care', instructions: 'Monitor vitals' },
  nursingNotes: [{ note: 'Vitals recorded' }],
});

assert(bundle.resourceType === 'Bundle', 'bundle');
assert(bundle.entry.some((e) => e.resource.resourceType === 'Encounter'), 'encounter');
assert(bundle.entry.find((e) => e.resource.resourceType === 'Encounter').resource.class.code === 'IMP', 'IMP');
console.log(JSON.stringify({ ok: true, type: 'Inpatient' }));
