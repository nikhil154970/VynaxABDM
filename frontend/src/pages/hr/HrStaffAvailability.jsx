import { useCallback, useEffect, useState } from 'react';
import { MdPeople, MdRefresh, MdSearch } from 'react-icons/md';
import api from '../../utils/api';
import Badge from '../../components/Badge';

const availVariant = (s) => {
  if (s === 'Available') return 'green';
  if (s === 'On Shift') return 'blue';
  if (s === 'Busy') return 'red';
  return 'gray';
};

export default function HrStaffAvailability() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, statsRes] = await Promise.all([
        api.get('/hr/shifts/available-employees'),
        api.get('/hr/shifts/stats'),
      ]);
      setItems(Array.isArray(empRes.data?.items) ? empRes.data.items : []);
      setStats(statsRes.data?.stats || null);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (e.name || '').toLowerCase().includes(q)
      || (e.department || '').toLowerCase().includes(q)
      || (e.employeeId || '').toLowerCase().includes(q);
  });

  return (
    <div className="w-full max-w-none bg-white min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-[#0077B6] rounded-2xl flex items-center justify-center shadow-sm shrink-0">
              <MdPeople className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#001B48]">Staff Availability</h1>
              <p className="text-sm text-gray-500 mt-1">Today's shift assignments and workload across staff.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 active:scale-95 transition-all duration-200 shrink-0 self-start sm:self-auto shadow-xs"
          >
            <MdRefresh className="w-4.5 h-4.5" />
            Refresh
          </button>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Staff', value: stats.totalStaff, icon: MdPeople },
              { label: 'On Shift', value: stats.totalStaffOnDuty, icon: MdPeople },
              { label: 'Available', value: stats.availableStaff, icon: MdPeople },
              { label: 'Busy (Allocations)', value: stats.busyStaff, icon: MdPeople },
            ].map((c) => (
              <div key={c.label} className="border border-gray-100 bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0077B6] flex items-center justify-center shrink-0 shadow-sm">
                  <c.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{c.label}</p>
                  <p className="text-xl font-extrabold text-[#001B48] mt-0.5">{c.value ?? 0}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="border border-gray-100 bg-white rounded-2xl p-4 shadow-sm">
          <div className="relative max-w-sm">
            <MdSearch className="absolute left-3.5 top-3 text-gray-400 w-5 h-5" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff by name, ID or department..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold" />
          </div>
        </div>

        {/* Table Grid */}
        <div className="border border-gray-100 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/70 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                <tr>
                  <th className="text-left px-4 py-3">Employee</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Department</th>
                  <th className="text-left px-4 py-3">Today's Shift</th>
                  <th className="text-center px-4 py-3">Workload</th>
                  <th className="text-center px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 font-semibold">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-450 font-semibold">No staff found</td></tr>
                ) : filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0077B6] flex items-center justify-center shrink-0 shadow-sm text-xs font-bold">{e.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <p className="font-bold text-[#001B48]">{e.name}</p>
                          {e.employeeId && <p className="text-xs text-gray-400 font-mono font-semibold mt-0.5">{e.employeeId}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-gray-600">{e.role}</td>
                    <td className="px-4 py-3.5 font-semibold text-gray-600">{e.department || '—'}</td>
                    <td className="px-4 py-3.5 text-gray-650 font-medium whitespace-nowrap">
                      {(e.assignments || []).length
                        ? e.assignments.map((a) => (
                          <span key={a.id} className="block text-xs font-semibold">
                            {a.shift?.name} ({a.shift?.status})
                          </span>
                        ))
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-gray-700">
                      {e.workload?.patients || 0} IPD &middot; {e.workload?.ot || 0} OT
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge variant={availVariant(e.availability)}>{e.availability}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
