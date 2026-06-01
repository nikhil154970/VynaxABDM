export default function PatientInfoCard({ patient }) {
  if (!patient) return null;
  const ageGender =
    patient.age || patient.gender
      ? `${patient.age ?? '—'} / ${patient.gender ? String(patient.gender).toUpperCase() : '—'}`
      : '—';

  return (
    <div className="rounded-2xl border px-6 py-4" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <p className="text-lg font-extrabold text-gray-900 truncate">{patient.name || '—'}</p>
          <p className="text-xs text-gray-600 mt-0.5">
            UHID: <span className="font-extrabold text-gray-900">{patient.uhid || '—'}</span>
          </p>
        </div>
        <div className="flex items-center gap-6 flex-wrap text-xs text-gray-600">
          <div>
            Age / Gender: <span className="font-extrabold text-gray-900">{ageGender}</span>
          </div>
          {'mobile' in patient && (
            <div>
              Mobile: <span className="font-extrabold text-gray-900">{patient.mobile || '—'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

