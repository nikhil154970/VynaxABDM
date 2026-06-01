import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function Profile() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get('/doctors/me');
        if (!alive) return;
        setMe(res.data?.doctor || null);
      } catch {
        if (!alive) return;
        setMe(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-2xl border p-5" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
        <p className="text-xs font-extrabold tracking-wide" style={{ color: '#2D2A6E' }}>Profile</p>
        <h2 className="text-lg font-bold text-gray-900">Doctor</h2>
        <p className="text-xs text-gray-500 mt-0.5">Account information</p>
      </div>

      <div className="rounded-2xl border p-6" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : !me ? (
          <p className="text-sm text-gray-500">Profile not found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ['Name', me.name],
              ['Email', me.email],
              ['Role', 'Doctor'],
              ['Specialization', me.specialization],
              ['Qualification', me.qualification],
              ['Experience Years', String(me.experienceYears ?? '—')],
              ['Phone', me.phone],
              ['Gender', me.gender],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                <p className="text-xs font-extrabold text-gray-600">{k}</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{v || '—'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

