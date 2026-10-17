import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdPerson, MdSearch, MdLocalHospital, MdClose, MdWork, MdAssignment, MdRefresh, MdVisibility, MdSchedule } from 'react-icons/md';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import '../ot/SurgeryScheduling.css';

const shiftVariant = (s) => {
  if (s === 'MORNING') return 'amber';
  if (s === 'EVENING') return 'purple';
  if (s === 'NIGHT') return 'blue';
  return 'gray';
};

export default function HrNurseAllocation() {
  const [nurses, setNurses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [selectedNurse, setSelectedNurse] = useState(null);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [allocWard, setAllocWard] = useState('');
  const [allocShift, setAllocShift] = useState('');
  const [allocating, setAllocating] = useState(false);

  const [error, setError] = useState('');

  const fetchNurses = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/hr/nurse-allocations');
      console.log('[NurseAlloc] API response:', res.data);
      setNurses(Array.isArray(res.data?.nurses) ? res.data.nurses : []);
    } catch (err) {
      console.error('[NurseAlloc] fetch error:', err.response?.data || err.message);
      setError('Failed to load nurses. ' + (err.response?.data?.message || err.message));
      setNurses([]);
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNurses(); }, []);

  const wards = [
    { id: 'general-ward', name: 'General Ward' },
    { id: 'icu', name: 'ICU' },
    { id: 'private-room', name: 'Private Rooms' },
    { id: 'ot', name: 'OT' },
    { id: 'recovery', name: 'Recovery Room' },
  ];

  const filtered = nurses.filter((n) =>
    !search || n.name.toLowerCase().includes(search.toLowerCase()) || (n.employeeId && n.employeeId.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAllocate = async () => {
    if (!allocWard || !allocShift || !selectedNurse) return;
    setAllocating(true);
    setError('');
    try {
      const w = wards.find((x) => x.id === allocWard);
      console.log('[NurseAlloc] allocating:', { nurseId: selectedNurse.id, wardId: allocWard, wardName: w?.name, shift: allocShift });
      const res = await api.post('/hr/nurse-allocations/' + selectedNurse.id + '/allocate', {
        wardId: allocWard,
        wardName: w?.name || allocWard,
        shift: allocShift,
      });
      console.log('[NurseAlloc] allocate response:', res.data);
      setAllocateOpen(false);
      setAllocWard('');
      setAllocShift('');
      setSelectedNurse(null);
      setError('');
      alert(res.data?.message || 'Duty assigned. Nurse will get notification.');
      fetchNurses();
    } catch (err) {
      console.error('[NurseAlloc] allocate error:', err.response?.data || err.message);
      setError('Allocation failed: ' + (err.response?.data?.message || err.message));
    }
    finally { setAllocating(false); }
  };

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-[#0077B6] rounded-2xl flex items-center justify-center shadow-sm shrink-0">
              <MdLocalHospital className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#001B48]">Nurse Allocation</h1>
              <p className="text-sm text-gray-500 mt-1">Assign ward duty locations and shifts only. Patient nurse assignments are done via Allocation Requests.</p>
            </div>
          </div>
          <button type="button" onClick={fetchNurses}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#0077B6]/90 active:scale-95 transition shadow-sm flex items-center gap-2">
            <MdRefresh className="w-4.5 h-4.5" /> Refresh
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="relative max-w-sm">
            <MdSearch className="absolute left-3.5 top-3 text-gray-400 w-5 h-5" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or employee ID..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/70 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                <tr>
                  <th className="text-left px-4 py-3">Nurse</th>
                  <th className="text-left px-4 py-3">Employee ID</th>
                  <th className="text-left px-4 py-3">Department</th>
                  <th className="text-left px-4 py-3">Today's Duty</th>
                  <th className="text-center px-4 py-3">Patients</th>
                  <th className="text-center px-4 py-3">OT Cases</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td className="px-4 py-8 text-gray-450 text-center font-semibold" colSpan={7}>Loading nurses…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td className="px-4 py-8 text-gray-455 text-center font-semibold" colSpan={7}>No nurses found.</td></tr>
                ) : (
                  filtered.map((n) => (
                    <tr key={n.id} className="hover:bg-gray-50/60 transition cursor-pointer" onClick={() => setSelectedNurse(n)}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0077B6] flex items-center justify-center shrink-0 shadow-sm text-xs font-bold">{n.name.charAt(0).toUpperCase()}</div>
                          <div>
                            <p className="font-bold text-[#001B48]">{n.name}</p>
                            {n.email && <p className="text-xs text-gray-450 font-semibold mt-0.5">{n.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono font-semibold text-gray-600">{n.employeeId || '—'}</td>
                      <td className="px-4 py-3.5 font-semibold text-gray-650">{n.department}</td>
                      <td className="px-4 py-3.5">
                        {n.currentDuty ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="blue">{n.currentDuty.wardName}</Badge>
                            <Badge variant={shiftVariant(n.currentDuty.shift)}>{n.currentDuty.shift.replace(/_/g, ' ')}</Badge>
                          </div>
                        ) : <span className="text-xs text-gray-400 font-semibold">Not assigned</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-xs font-bold text-gray-700">
                          {n.activePatients}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-xs font-bold text-gray-700">
                          {n.activeOtCases}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => { setSelectedNurse(n); setAllocateOpen(true); setAllocWard(n.currentDuty?.wardId || ''); setAllocShift(n.currentDuty?.shift || ''); }}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-[#0077B6] transition" title="Allocate Work">
                            <MdWork className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => setSelectedNurse(n)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-[#0077B6] transition" title="View Details">
                            <MdVisibility className="w-4 h-4" />
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
      </div>

      {/* Nurse Detail Modal */}
      {selectedNurse && !allocateOpen && createPortal(
        <div className="pl-modalOverlay bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedNurse(null)}>
          <div className="pl-modal pl-modalAnimate max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MdPerson className="text-white w-5 h-5" /> {selectedNurse.name}
              </h3>
              <button onClick={() => setSelectedNurse(null)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3"><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Employee ID</p><p className="text-sm font-extrabold text-[#001B48] mt-1">{selectedNurse.employeeId || '—'}</p></div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3"><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Department</p><p className="text-sm font-extrabold text-[#001B48] mt-1">{selectedNurse.department}</p></div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 col-span-2"><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Email</p><p className="text-sm font-extrabold text-[#001B48] mt-1">{selectedNurse.email || '—'}</p></div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 col-span-2"><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Phone</p><p className="text-sm font-extrabold text-[#001B48] mt-1">{selectedNurse.phone || '—'}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center"><p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Patients</p><p className="text-xl font-black text-[#0077B6] mt-1">{selectedNurse.activePatients}</p></div>
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center"><p className="text-xs text-gray-500 font-bold uppercase tracking-wider">OT Cases</p><p className="text-xl font-black text-purple-750 mt-1">{selectedNurse.activeOtCases}</p></div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center"><p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Status</p><p className="text-sm font-extrabold text-green-700 mt-2">{selectedNurse.isActive ? 'Active' : 'Inactive'}</p></div>
              </div>
              {selectedNurse.currentDuty && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-extrabold uppercase tracking-wider">Today's Duty</p>
                    <p className="text-sm font-extrabold text-[#001B48] mt-1">{selectedNurse.currentDuty.wardName}</p>
                  </div>
                  <Badge variant={shiftVariant(selectedNurse.currentDuty.shift)}>{selectedNurse.currentDuty.shift?.replace(/_/g, ' ')}</Badge>
                </div>
              )}
              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => { setAllocateOpen(true); setAllocWard(selectedNurse.currentDuty?.wardId || ''); setAllocShift(selectedNurse.currentDuty?.shift || ''); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#0077B6] text-white hover:bg-[#0077B6]/90 active:scale-95 transition shadow-sm">
                  <MdWork /> Work Allocate
                </button>
                <button type="button" onClick={() => setSelectedNurse(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-250 transition">Close</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Work Allocate Modal */}
      {allocateOpen && selectedNurse && createPortal(
        <div className="pl-modalOverlay bg-slate-900/40 backdrop-blur-sm" onClick={() => { if (!allocating) setAllocateOpen(false); }}>
          <div className="pl-modal pl-modalAnimate max-w-md w-full bg-white rounded-2xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MdWork className="text-white w-5 h-5" /> Work Allocate — {selectedNurse.name}
              </h3>
              <button onClick={() => setAllocateOpen(false)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assign duty location and shift for today.</p>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Duty Location</label>
                <div className="grid grid-cols-2 gap-2">
                  {wards.map((w) => (
                    <div key={w.id} onClick={() => setAllocWard(w.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-bold cursor-pointer transition ${
                        allocWard === w.id ? 'border-[#0077B6] bg-blue-50/50 text-[#0077B6] ring-2 ring-[#0077B6]/10' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}>
                      <MdLocalHospital className="w-4.5 h-4.5 shrink-0" />
                      {w.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Shift</label>
                <div className="grid grid-cols-3 gap-2">
                  {['MORNING', 'EVENING', 'NIGHT'].map((s) => (
                    <div key={s} onClick={() => setAllocShift(s)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-bold cursor-pointer transition ${
                        allocShift === s ? 'border-[#0077B6] bg-blue-50/50 text-[#0077B6] ring-2 ring-[#0077B6]/10' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}>
                      <MdSchedule className="w-4 h-4" />
                      {s === 'MORNING' ? 'Morning' : s === 'EVENING' ? 'Evening' : 'Night'}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setAllocateOpen(false)} disabled={allocating}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition">Cancel</button>
                <button type="button" onClick={handleAllocate} disabled={!allocWard || !allocShift || allocating}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-[#0077B6] text-white hover:bg-[#0077B6]/90 disabled:opacity-50 active:scale-95 transition flex items-center gap-1.5 shadow-sm">
                  {allocating ? 'Allocating…' : <><MdWork /> Allocate Work</>}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
