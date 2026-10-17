import { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import Toast from './Toast';

function labNameMatchesQuery(queryRaw, nameRaw) {
  const query = String(queryRaw || '').trim().toLowerCase();
  if (!query) return true;
  const name = String(nameRaw || '').toLowerCase();
  if (name.includes(query)) return true;
  const qCompact = query.replace(/[^a-z0-9]+/g, '');
  const nCompact = name.replace(/[^a-z0-9]+/g, '');
  if (qCompact && nCompact.includes(qCompact)) return true;
  const words = query.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => name.includes(w))) return true;
  return false;
}

export default function TreatmentSection({ admissionId }) {
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [medicines, setMedicines] = useState([{ medicine: '', dosage: '', duration: '' }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState('');
  const [toast, setToast] = useState({ type: 'success', message: '' });

  const [labCatalog, setLabCatalog] = useState([]);
  const [selectedTestIds, setSelectedTestIds] = useState([]);
  const [labSearch, setLabSearch] = useState('');

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

  const toggleLabTestId = (id) => {
    setSelectedTestIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const testNameById = useMemo(() => {
    const m = new Map();
    (labCatalog || []).forEach((t) => m.set(Number(t.id), t.name));
    return m;
  }, [labCatalog]);

  const filteredLabCatalog = useMemo(() => {
    if (!String(labSearch || '').trim()) return labCatalog;
    return labCatalog.filter((t) => labNameMatchesQuery(labSearch, t.name));
  }, [labCatalog, labSearch]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/lab/tests');
        if (!alive) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setLabCatalog(
          list
            .filter((x) => x && x.id != null && x.name)
            .map((x) => ({ id: parseInt(String(x.id), 10), name: String(x.name) }))
            .filter((x) => Number.isFinite(x.id))
        );
      } catch {
        if (!alive) return;
        setLabCatalog([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
          setUpdatedAt(t.updated_at || t.updatedAt || '');
        }
        setSelectedTestIds(
          Array.isArray(res.data?.selectedTestIds)
            ? res.data.selectedTestIds.map((x) => parseInt(String(x), 10)).filter((n) => Number.isFinite(n))
            : []
        );
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
      <div className="rounded-2xl border p-5" style={{ background: '#FFFFFF', borderColor: '#e0e7ff' }}>
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-5 space-y-3" style={{ background: '#FFFFFF', borderColor: '#e0e7ff' }}>
        <div>
          <label className="text-xs font-extrabold text-gray-700">Treatment description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full px-4 py-3 rounded-xl border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 min-h-[110px] text-sm"
            style={{ borderColor: '#e0e7ff' }}
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
                style={{ borderColor: '#e0e7ff' }}
              />
              <input
                value={m.dosage}
                onChange={(e) => setMedicines((prev) => prev.map((x, i) => (i === idx ? { ...x, dosage: e.target.value } : x)))}
                placeholder="Dosage"
                className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
                style={{ borderColor: '#e0e7ff' }}
              />
              <input
                value={m.duration}
                onChange={(e) => setMedicines((prev) => prev.map((x, i) => (i === idx ? { ...x, duration: e.target.value } : x)))}
                placeholder="Duration"
                className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
                style={{ borderColor: '#e0e7ff' }}
              />
            </div>
          ))}

          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-xl text-xs font-extrabold border bg-white"
              style={{ borderColor: '#e0e7ff' }}
              onClick={() => setMedicines((prev) => [...prev, { medicine: '', dosage: '', duration: '' }])}
              disabled={saving}
            >
              + Add
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-xl text-xs font-extrabold border bg-white disabled:opacity-60"
              style={{ borderColor: '#e0e7ff' }}
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
            style={{ borderColor: '#e0e7ff' }}
          />
        </div>

        <div className="space-y-2 pt-2">
          <label className="text-xs font-extrabold text-gray-700">Required Lab Tests</label>
          <input
            type="text"
            placeholder="Search lab tests..."
            value={labSearch}
            onChange={(e) => setLabSearch(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border bg-white text-sm"
            style={{ borderColor: '#e0e7ff' }}
          />
          <div
            className="max-h-40 overflow-y-auto rounded-xl border bg-white p-2 space-y-0.5"
            style={{ borderColor: '#e0e7ff' }}
          >
            {filteredLabCatalog.length ? (
              filteredLabCatalog.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTestIds.includes(t.id)}
                    onChange={() => toggleLabTestId(t.id)}
                    disabled={saving}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-200"
                  />
                  <span className="text-xs font-semibold text-gray-900">{t.name}</span>
                </label>
              ))
            ) : (
              <p className="text-xs text-gray-400 px-2 py-2">No tests found</p>
            )}
          </div>
          {selectedTestIds.length ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selectedTestIds.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-lg border border-blue-100"
                >
                  {testNameById.get(id) || '—'}
                  <button
                    type="button"
                    onClick={() => setSelectedTestIds((prev) => prev.filter((x) => x !== id))}
                    disabled={saving}
                    className="text-blue-500 hover:text-blue-700 font-bold ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex justify-between items-center mt-4">
          {updatedAt ? (
            <p className="text-xs text-gray-500 font-semibold">
              Last saved: {new Date(updatedAt).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              })}
            </p>
          ) : (
            <div />
          )}
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              if (!description.trim()) {
                setToast({ type: 'error', message: 'Treatment description is required.' });
                return;
              }
              setSaving(true);
              try {
                const res = await api.post('/treatment', {
                  admission_id: admissionId,
                  description: description.trim(),
                  medicines: normalizedMeds,
                  instructions: instructions.trim(),
                  selectedTestIds,
                });
                if (res.data?.treatment) {
                  setUpdatedAt(res.data.treatment.updated_at || res.data.treatment.updatedAt || '');
                  setToast({ type: 'success', message: 'Treatment plan saved successfully.' });
                }
              } catch (err) {
                setToast({
                  type: 'error',
                  message: err?.response?.data?.message || 'Could not save treatment plan.',
                });
              } finally {
                setSaving(false);
              }
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
            style={{ background: '#E53935' }}
          >
            {saving ? 'Saving...' : 'Save Treatment'}
          </button>
        </div>
      </div>
      <Toast
        type={toast.type}
        message={toast.message}
        onClose={() => setToast({ ...toast, message: '' })}
      />
    </div>
  );
}

