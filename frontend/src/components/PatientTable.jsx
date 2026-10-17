import { useMemo } from 'react';

function StatusPill({ status }) {
  const s = String(status || 'WAITING').toUpperCase();
  const meta =
    s === 'COMPLETED'
      ? { bg: 'rgba(22,163,74,0.1)', fg: '#16A34A', label: 'Completed' }
      : s === 'IN_PROGRESS'
        ? { bg: 'rgba(0,119,182,0.1)', fg: '#0077B6', label: 'In Progress' }
        : { bg: 'rgba(71,85,105,0.1)', fg: '#475569', label: 'Waiting' };

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border"
      style={{
        background: meta.bg,
        color: meta.fg,
        borderColor: `${meta.fg}15`,
      }}
    >
      {meta.label}
    </span>
  );
}

function AdmissionStatusPill({ status }) {
  const s = String(status || 'ADMITTED').toUpperCase();
  const meta =
    s === 'READY_FOR_DISCHARGE'
      ? { bg: 'rgba(217,119,6,0.1)', fg: '#D97706', label: 'Ready for Discharge' }
      : s === 'UNDER_TREATMENT'
        ? { bg: 'rgba(0,119,182,0.1)', fg: '#0077B6', label: 'Under Treatment' }
        : { bg: 'rgba(22,163,74,0.1)', fg: '#16A34A', label: 'Admitted' };

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border"
      style={{
        background: meta.bg,
        color: meta.fg,
        borderColor: `${meta.fg}15`,
      }}
    >
      {meta.label}
    </span>
  );
}

export default function PatientTable({ rows = [], loading = false, activeId = '', onSelect, variant = 'opd' }) {
  const hasRows = useMemo(() => Array.isArray(rows) && rows.length > 0, [rows]);
  const isIPD = variant === 'ipd';

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50/70">
            <tr>
              {isIPD ? (
                <>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Patient Name</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">UHID</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Bed Number</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Admission Date</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Status</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">Action</th>
                </>
              ) : (
                <>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Time</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Patient Name</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">OPD No</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Status</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">Action</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={isIPD ? 6 : 5} className="px-6 py-10 text-center text-gray-500 font-semibold">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-[#0077B6] border-t-transparent rounded-full animate-spin"></div>
                    Loading patients...
                  </div>
                </td>
              </tr>
            ) : !hasRows ? (
              <tr>
                <td colSpan={isIPD ? 6 : 5} className="px-6 py-10 text-center text-gray-500 font-semibold">
                  No assigned patients found.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isActive = activeId === r.id;
                return (
                  <tr
                    key={r.id}
                    className={`transition-colors duration-150 cursor-pointer ${
                      isActive ? 'bg-[#0077B6]/5' : 'hover:bg-gray-50/50'
                    }`}
                    onClick={() => onSelect?.(r)}
                  >
                    {isIPD ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
                          <p>{r.patient_name || '—'}</p>
                          {r.ipd_number ? (
                            <p className="mt-0.5 font-mono text-[11px] font-bold text-[#0077B6]">{r.ipd_number}</p>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-600 font-mono">
                          {r.uhid || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-700">
                          {r.bed_number || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-600">
                          {r.admission_date ? new Date(r.admission_date).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <AdmissionStatusPill status={r.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onSelect?.(r)}
                            className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0077B6] hover:bg-[#005B8C] transition-all shadow-sm active:scale-95 duration-200"
                          >
                            View Details
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-[#001B48]">
                          {r.time || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                          {r.patient_name || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-600 font-mono">
                          {r.opd_number || r.opdNumber || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusPill status={r.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                          {String(r.status || '').toUpperCase() === 'COMPLETED' ? (
                            <span className="text-xs font-semibold text-gray-400">—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSelect?.(r)}
                              className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0077B6] hover:bg-[#005B8C] transition-all shadow-sm active:scale-95 duration-200"
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
