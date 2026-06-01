import { useMemo } from 'react';

function StatusPill({ status }) {
  const s = String(status || 'WAITING').toUpperCase();
  const meta =
    s === 'COMPLETED'
      ? { bg: 'rgba(22,163,74,0.12)', fg: '#15803d', label: 'Completed' }
      : s === 'IN_PROGRESS'
        ? { bg: 'rgba(0,174,239,0.14)', fg: '#0369a1', label: 'In Progress' }
        : { bg: 'rgba(148,163,184,0.18)', fg: '#475569', label: 'Waiting' };

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold" style={{ background: meta.bg, color: meta.fg }}>
      {meta.label}
    </span>
  );
}

function AdmissionStatusPill({ status }) {
  const s = String(status || 'ADMITTED').toUpperCase();
  const meta =
    s === 'READY_FOR_DISCHARGE'
      ? { bg: 'rgba(234,88,12,0.12)', fg: '#c2410c', label: 'Ready for Discharge' }
      : s === 'UNDER_TREATMENT'
        ? { bg: 'rgba(0,174,239,0.14)', fg: '#0369a1', label: 'Under Treatment' }
        : { bg: 'rgba(22,163,74,0.12)', fg: '#15803d', label: 'Admitted' };

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold" style={{ background: meta.bg, color: meta.fg }}>
      {meta.label}
    </span>
  );
}

export default function PatientTable({ rows = [], loading = false, activeId = '', onSelect, variant = 'opd' }) {
  const hasRows = useMemo(() => Array.isArray(rows) && rows.length > 0, [rows]);
  const isIPD = variant === 'ipd';

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: '#F5F7FA' }}>
              {isIPD ? (
                <>
                  <th className="px-5 py-3 font-extrabold text-gray-700">Patient Name</th>
                  <th className="px-5 py-3 font-extrabold text-gray-700">UHID</th>
                  <th className="px-5 py-3 font-extrabold text-gray-700">Bed Number</th>
                  <th className="px-5 py-3 font-extrabold text-gray-700">Admission Date</th>
                  <th className="px-5 py-3 font-extrabold text-gray-700">Status</th>
                  <th className="px-5 py-3 font-extrabold text-gray-700">Action</th>
                </>
              ) : (
                <>
                  <th className="px-5 py-3 font-extrabold text-gray-700">Time</th>
                  <th className="px-5 py-3 font-extrabold text-gray-700">Patient Name</th>
                  <th className="px-5 py-3 font-extrabold text-gray-700">OPD No</th>
                  <th className="px-5 py-3 font-extrabold text-gray-700">Status</th>
                  <th className="px-5 py-3 font-extrabold text-gray-700">Action</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isIPD ? 6 : 5} className="px-5 py-6 text-gray-500">Loading…</td></tr>
            ) : !hasRows ? (
              <tr><td colSpan={isIPD ? 6 : 5} className="px-5 py-6 text-gray-500">No patients.</td></tr>
            ) : (
              rows.map((r) => {
                const isActive = activeId === r.id;
                return (
                  <tr
                    key={r.id}
                    className="border-t cursor-pointer"
                    style={{
                      borderColor: 'rgba(0,0,0,0.06)',
                      background: isActive ? 'rgba(0,174,239,0.10)' : '#FFFFFF',
                    }}
                    onClick={() => onSelect?.(r)}
                  >
                    {isIPD ? (
                      <>
                        <td className="px-5 py-3 text-gray-900">
                          <p className="font-extrabold">{r.patient_name || '—'}</p>
                          {r.ipd_number ? (
                            <p className="mt-0.5 font-mono text-[11px] font-bold text-blue-600">{r.ipd_number}</p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 text-gray-700">{r.uhid || '—'}</td>
                        <td className="px-5 py-3 text-gray-700">{r.bed_number || '—'}</td>
                        <td className="px-5 py-3 text-gray-700">
                          {r.admission_date ? new Date(r.admission_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-3"><AdmissionStatusPill status={r.status} /></td>
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onSelect?.(r); }}
                            className="px-3 py-2 rounded-xl text-xs font-extrabold text-white"
                            style={{ background: '#00AEEF' }}
                          >
                            View Details
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-3 font-extrabold text-gray-900">{r.time || '—'}</td>
                        <td className="px-5 py-3 text-gray-900">{r.patient_name || '—'}</td>
                        <td className="px-5 py-3 text-gray-700">{r.opd_number || r.opdNumber || '—'}</td>
                        <td className="px-5 py-3"><StatusPill status={r.status} /></td>
                        <td className="px-5 py-3">
                          {String(r.status || '').toUpperCase() === 'COMPLETED' ? (
                            <span className="text-xs font-semibold text-gray-400">—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onSelect?.(r); }}
                              className="px-3 py-2 rounded-xl text-xs font-extrabold text-white"
                              style={{ background: '#00AEEF' }}
                            >
                              Start Consultation
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

