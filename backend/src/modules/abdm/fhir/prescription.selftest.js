const { buildPrescriptionBundle, extractMedicines } = require('./prescription');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const medicines = extractMedicines([
  { medicine: 'Paracetamol', dosage: '500mg', frequency: 'TID', duration: '3 days' },
  { labTest: 'CBC' },
]);
assert(medicines.length === 1, 'lab-only rows skipped');

const bundle = buildPrescriptionBundle({
  patient: { id: 'p1', uhid: 'UH1', name: 'Test', gender: 'M' },
  careContext: { careContextId: 'CC-RX-UH1-abc' },
  sourceId: 'c1',
  authoredOn: '2026-10-04T10:00:00.000Z',
  medicines,
});

assert(bundle.resourceType === 'Bundle', 'bundle');
assert(bundle.entry[0].resource.resourceType === 'Composition', 'composition');
assert(bundle.entry[0].resource.type.text === 'Prescription', 'type');
assert(bundle.entry.some((e) => e.resource.resourceType === 'MedicationRequest'), 'medication');
console.log(JSON.stringify({ ok: true, type: 'Prescription' }));
