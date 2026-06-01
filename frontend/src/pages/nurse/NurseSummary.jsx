export default function NurseSummary() {
  const today = {
    totalPatients: 6,
    highPriority: 2,
    tasksDue: 8,
    handoverNotes: [
      'Bed 12: monitor BP every 2 hours',
      'Bed 8: post-op dressing check at 11:00',
      'Bed 5: insulin sliding scale as charted',
    ],
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl bg-white ring-1 ring-gray-200 p-6 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-bold text-gray-900">Today Summary (Dummy)</p>
          <p className="text-sm text-gray-500 mt-1">Shift overview and priority indicators.</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500">Patients</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">{today.totalPatients}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500">High Priority</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">{today.highPriority}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500">Tasks Due</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">{today.tasksDue}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500">Status</p>
              <p className="text-sm font-bold text-emerald-700 mt-2">On Track</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-blue-50 ring-1 ring-blue-100 p-5">
            <p className="text-xs font-extrabold text-blue-700 tracking-wide uppercase">Handover Notes</p>
            <ul className="mt-3 space-y-2">
              {today.handoverNotes.map((n) => (
                <li key={n} className="text-sm text-blue-900">
                  - {n}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

