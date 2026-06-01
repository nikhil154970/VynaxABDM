import { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';

export default function TreatmentSection({ admissionId }) {
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [medicines, setMedicines] = useState([{ medicine: '', dosage: '', duration: '' }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const normalizedMeds = useMemo(
    () =>
      (medicines || [])
        .map((m) => ({
          medicine: String(m.medicine || '').trim(),
          dosage: String(m.dosage || '').trim(),
          duration: String(m.duration || '').trim(),
        }))
        .filter((m) => m.medicine || m.dosage || m.duration),
    [medicines]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get(`/treatment/${admissionId}`);
        if (!alive) return;
        const t = res.data?.treatment;
        if (t) {
          setDescription(t.description || '');
          setInstructions(t.instructions || '');
          const meds = Array.isArray(t.medicines) ? t.medicines : [];
          setMedicines(meds.length ? meds : [{ medicine: '', dosage: '', duration: '' }]);
        }
      } catch {
        if (!alive) return;
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [admissionId]);

  if (loading) {
    return (
      <div className="rounded-2xl border p-5" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-5 space-y-3" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
        <div>
          <label className="text-xs font-extrabold text-gray-700">Treatment description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full px-4 py-3 rounded-xl border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 min-h-[110px] text-sm"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-extrabold text-gray-700">Medicines</label>
          {(medicines || []).map((m, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                value={m.medicine}
                onChange={(e) => setMedicines((prev) => prev.map((x, i) => (i === idx ? { ...x, medicine: e.target.value } : x)))}
                placeholder="Name"
                className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
              />
              <input
                value={m.dosage}
                onChange={(e) => setMedicines((prev) => prev.map((x, i) => (i === idx ? { ...x, dosage: e.target.value } : x)))}
                placeholder="Dosage"
                className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
              />
              <input
                value={m.duration}
                onChange={(e) => setMedicines((prev) => prev.map((x, i) => (i === idx ? { ...x, duration: e.target.value } : x)))}
                placeholder="Duration"
                className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
              />
            </div>
          ))}

          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-xl text-xs font-extrabold border bg-white"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
              onClick={() => setMedicines((prev) => [...prev, { medicine: '', dosage: '', duration: '' }])}
              disabled={saving}
            >
              + Add
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-xl text-xs font-extrabold border bg-white disabled:opacity-60"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
              onClick={() => setMedicines((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))}
              disabled={saving || medicines.length <= 1}
            >
              Remove
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-extrabold text-gray-700">Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="mt-1 w-full px-4 py-3 rounded-xl border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 min-h-[92px] text-sm"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving || !description.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await api.post('/treatment', {
                  admission_id: admissionId,
                  description: description.trim(),
                  medicines: normalizedMeds,
                  instructions: instructions.trim(),
                });
              } finally {
                setSaving(false);
              }
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white disabled:opacity-60"
            style={{ background: '#E53935' }}
          >
            Save Treatment
          </button>
        </div>
      </div>
    </div>
  );
}

