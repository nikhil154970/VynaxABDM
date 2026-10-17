import { MdEdit, MdCalendarToday, MdBlock, MdCheckCircle } from 'react-icons/md';
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50/70 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3.5 whitespace-nowrap">Name</th>
              <th className="px-4 py-3.5 whitespace-nowrap">Email</th>
              <th className="px-4 py-3.5 whitespace-nowrap">Specialization</th>
              <th className="px-4 py-3.5 whitespace-nowrap">Experience</th>
              <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
              <th className="px-4 py-3.5 whitespace-nowrap">Availability</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td className="px-4 py-10 text-gray-400 text-center font-semibold" colSpan={7}>Loading doctors…</td>
              </tr>
            ) : doctors.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-gray-400 text-center font-semibold" colSpan={7}>No doctors found.</td>
              </tr>
            ) : (
              doctors.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/80 transition duration-150">
                  <td className="px-4 py-3.5 font-semibold text-gray-900 whitespace-nowrap">{d.name}</td>
                  <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{d.email}</td>
                  <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap">{d.specialization}</td>
                  <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap">{Number(d.experienceYears || 0)} yrs</td>
                  <td className="px-4 py-3.5 whitespace-nowrap">{statusBadge(d.isActive)}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap">{availabilityBadge(d.hasAvailability)}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit?.(d)}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#0077B6]/20 bg-blue-50 text-[#0077B6] hover:border-[#0077B6]/40 hover:bg-sky-50 active:bg-sky-100 transition duration-200 cursor-pointer shadow-sm"
                      >
                        <MdEdit className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onAvailability?.(d)}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0077B6] text-white hover:bg-[#005f92] active:bg-[#001B48] transition duration-200 cursor-pointer shadow-sm"
                      >
                        <MdCalendarToday className="w-3.5 h-3.5" />
                        Availability
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleStatus?.(d)}
                        className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition duration-200 cursor-pointer ${
                          d.isActive
                            ? 'border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300 active:bg-rose-100'
                            : 'border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 active:bg-emerald-100'
                        }`}
                      >
                        {d.isActive ? <MdBlock className="w-3.5 h-3.5" /> : <MdCheckCircle className="w-3.5 h-3.5" />}
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

