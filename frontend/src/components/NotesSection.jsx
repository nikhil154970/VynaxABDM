import { useEffect, useState } from 'react';
import api from '../utils/api';

export default function NotesSection({ admissionId }) {
  const [note, setNote] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!admissionId) return;
    setLoading(true);
    try {
      const res = await api.get(`/ipd-notes/${admissionId}`);
      setRows(res.data?.notes || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      try {
        await load();
      } catch {
        if (!alive) return;
        setRows([]);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-5" style={{ background: '#FFFFFF', borderColor: '#e0e7ff' }}>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 min-h-[110px] text-sm"
          style={{ borderColor: '#d5d7eb' }}
          placeholder="Add note"
        />
        <div className="flex justify-end mt-3">
          <button
            type="button"
            disabled={saving || !note.trim()}
            onClick={async () => {
              if (!admissionId) return;
              setSaving(true);
              try {
                await api.post('/ipd-notes', { admission_id: admissionId, note: note.trim() });
                setNote('');
                await load();
              } finally {
                setSaving(false);
              }
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white disabled:opacity-60"
            style={{ background: '#E53935' }}
          >
            Add Note
          </button>
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ background: '#FFFFFF', borderColor: '#e0e7ff' }}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: '#F5F7FA' }}>
                <th className="px-5 py-3 font-extrabold text-gray-700">Date</th>
                <th className="px-5 py-3 font-extrabold text-gray-700">Content</th>
                <th className="px-5 py-3 font-extrabold text-gray-700">Doctor</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="px-5 py-6 text-gray-500">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-6 text-gray-500">No notes.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: '#e0e7ff' }}>
                    <td className="px-5 py-3 text-gray-700 font-extrabold">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-900 whitespace-pre-wrap">{r.note}</td>
                    <td className="px-5 py-3 text-gray-700">{r.doctor_name || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

