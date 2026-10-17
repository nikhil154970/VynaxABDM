function fmtDate(d) {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  return x.toLocaleString();
}

function fmtFollowUp(d) {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  return x.toLocaleDateString();
}

function truncate(text, max = 48) {
  const s = String(text || '').trim();
  if (!s) return '—';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export default function HistoryTable({ rows = [], onRowClick }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: '#FFFFFF', borderColor: '#e0e7ff' }}>
      <div className="overflow-x-auto max-h-[520px]">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: '#F5F7FA' }}>
              <th className="px-5 py-3 font-extrabold text-gray-700">Date</th>
              <th className="px-5 py-3 font-extrabold text-gray-700">Type</th>
              <th className="px-5 py-3 font-extrabold text-gray-700">Diagnosis</th>
              <th className="px-5 py-3 font-extrabold text-gray-700">Prescription</th>
              <th className="px-5 py-3 font-extrabold text-gray-700">Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-6 text-gray-500">No records.</td></tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={`${r.type}-${r.id}`}
                  className="border-t"
                  style={{ borderColor: '#e0e7ff', cursor: onRowClick ? 'pointer' : 'default' }}
                  onClick={() => onRowClick?.(r)}
                >
                  <td className="px-5 py-3 text-gray-900 font-extrabold">{fmtDate(r.date)}</td>
                  <td className="px-5 py-3 text-gray-700 font-extrabold">{r.type || '—'}</td>
                  <td className="px-5 py-3 text-gray-700">{truncate(r.diagnosis, 60)}</td>
                  <td className="px-5 py-3 text-gray-700">{truncate(r.prescription, 60)}</td>
                  <td className="px-5 py-3 text-gray-700 font-extrabold">{fmtFollowUp(r.follow_up)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

