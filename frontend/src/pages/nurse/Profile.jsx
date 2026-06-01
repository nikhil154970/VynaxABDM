export default function NurseProfile() {
  const profile = {
    name: 'Nurse Demo',
    role: 'NURSE',
    department: 'IPD',
    shift: 'Morning',
    phone: '99999 11111',
    email: 'nurse.demo@ht-hospital.test',
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="rounded-3xl bg-white ring-1 ring-gray-200 p-6 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-bold text-gray-900">My Profile (Dummy)</p>
          <p className="text-sm text-gray-500 mt-1">Placeholder profile card for nurse module.</p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(profile).map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-gray-50 ring-1 ring-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-500">{k.toUpperCase()}</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{v}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-blue-50 ring-1 ring-blue-100 p-4 text-xs text-blue-900">
            Next: link this page with real authenticated user details from backend.
          </div>
        </div>
      </div>
    </div>
  );
}

