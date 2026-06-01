export default function PatientSummaryCard({ patient }) {
  return (
    <div className="rounded-2xl border px-6 py-4" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <p className="text-lg font-extrabold text-gray-900 truncate">{patient?.patient_name || '—'}</p>
          <p className="text-xs text-gray-600 mt-0.5">
            UHID: <span className="font-extrabold text-gray-900">{patient?.uhid || '—'}</span>
          </p>
        </div>

        <div className="flex items-center gap-6 flex-wrap">
          <div className="text-xs text-gray-600">
            <span className="font-extrabold text-gray-900">{patient?.patient_age ?? '—'}</span> /{' '}
            <span className="font-extrabold text-gray-900">{patient?.patient_gender || '—'}</span>
          </div>
          <div className="text-xs text-gray-600">
            Bed: <span className="font-extrabold text-gray-900">{patient?.bed_number || '—'}</span>
          </div>
          <div className="text-xs text-gray-600">
            Admission: <span className="font-extrabold text-gray-900">
              {patient?.admission_date ? new Date(patient.admission_date).toLocaleDateString() : '—'}
            </span>
          </div>
          <span
            className="px-3 py-1 rounded-full text-xs font-extrabold"
            style={{
              background:
                String(patient?.status || '').toUpperCase() === 'READY_FOR_DISCHARGE'
                  ? 'rgba(234,88,12,0.12)'
                  : String(patient?.status || '').toUpperCase() === 'UNDER_TREATMENT'
                    ? 'rgba(0,174,239,0.14)'
                    : 'rgba(22,163,74,0.12)',
              color:
                String(patient?.status || '').toUpperCase() === 'READY_FOR_DISCHARGE'
                  ? '#c2410c'
                  : String(patient?.status || '').toUpperCase() === 'UNDER_TREATMENT'
                    ? '#0369a1'
                    : '#15803d',
            }}
          >
            {String(patient?.status || 'ADMITTED')
              .replace(/_/g, ' ')
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        </div>
      </div>
    </div>
  );
}

