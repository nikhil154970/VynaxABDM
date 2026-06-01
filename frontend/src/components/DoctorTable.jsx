import Badge from './Badge';

const statusBadge = (isActive) => (
  <Badge variant={isActive ? 'green' : 'rose'}>{isActive ? 'Active' : 'Inactive'}</Badge>
);

const availabilityBadge = (hasAvailability) => (
  <Badge variant={hasAvailability ? 'green' : 'gray'}>{hasAvailability ? 'Available' : 'Not Available'}</Badge>
);

export default function DoctorTable({
  doctors = [],
  loading = false,
  onEdit,
  onAvailability,
  onToggleStatus,
}) {
  return (
    <div className="bg-white rounded-3xl ring-1 ring-black/5 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.45)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F5F7FA] text-gray-700">
            <tr>
              <th className="text-left font-extrabold px-5 py-3">Name</th>
              <th className="text-left font-extrabold px-5 py-3">Email</th>
              <th className="text-left font-extrabold px-5 py-3">Specialization</th>
              <th className="text-left font-extrabold px-5 py-3">Experience</th>
              <th className="text-left font-extrabold px-5 py-3">Status</th>
              <th className="text-left font-extrabold px-5 py-3">Availability</th>
              <th className="text-right font-extrabold px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td className="px-5 py-10 text-gray-400" colSpan={7}>Loading doctors…</td>
              </tr>
            ) : doctors.length === 0 ? (
              <tr>
                <td className="px-5 py-10 text-gray-400" colSpan={7}>No doctors found.</td>
              </tr>
            ) : (
              doctors.map((d) => (
                <tr key={d.id} className="hover:bg-[#F5F7FA]/70 transition">
                  <td className="px-5 py-3 font-bold text-gray-900">{d.name}</td>
                  <td className="px-5 py-3 text-gray-600">{d.email}</td>
                  <td className="px-5 py-3 text-gray-700">{d.specialization}</td>
                  <td className="px-5 py-3 text-gray-700">{Number(d.experienceYears || 0)} yrs</td>
                  <td className="px-5 py-3">{statusBadge(d.isActive)}</td>
                  <td className="px-5 py-3">{availabilityBadge(d.hasAvailability)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit?.(d)}
                        className="px-3 py-2 rounded-xl text-xs font-extrabold bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onAvailability?.(d)}
                        className="px-3 py-2 rounded-xl text-xs font-extrabold bg-[#00AEEF] text-white hover:bg-[#009ad6] transition"
                      >
                        Availability
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleStatus?.(d)}
                        className={`px-3 py-2 rounded-xl text-xs font-extrabold transition ${
                          d.isActive
                            ? 'bg-[#E53935] text-white hover:bg-[#d6322f]'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {d.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

