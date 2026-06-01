export default function NurseDashboard() {
  const cards = [
    { label: 'Assigned IPD Patients', value: 6 },
    { label: 'Medication Rounds Due', value: 3 },
    { label: 'Pending Notes', value: 2 },
    { label: 'Alerts', value: 1 },
  ];

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-3xl bg-white ring-1 ring-gray-200 p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.35)]"
            >
              <p className="text-xs font-semibold text-gray-500">{c.label}</p>
              <p className="text-3xl font-extrabold text-gray-900 mt-2">{c.value}</p>
              <p className="text-xs text-gray-400 mt-2">Dummy data (UI placeholder)</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-3xl bg-white ring-1 ring-gray-200 p-6">
          <p className="text-sm font-bold text-gray-900">Quick Overview</p>
          <p className="text-sm text-gray-500 mt-1">
            This is the nurse dashboard placeholder. Sidebar links are wired and each page renders dummy content for now.
          </p>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200 p-4">
              <p className="text-xs font-bold text-gray-700">Next Round</p>
              <p className="text-sm text-gray-600 mt-1">09:30 AM · Ward A · 4 patients</p>
            </div>
            <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200 p-4">
              <p className="text-xs font-bold text-gray-700">Today</p>
              <p className="text-sm text-gray-600 mt-1">Shift: Morning · Bedside tasks: 8</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

