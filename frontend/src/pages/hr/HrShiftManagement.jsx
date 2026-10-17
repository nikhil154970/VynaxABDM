import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  MdAdd, MdClose, MdEdit, MdPeople, MdRefresh, MdSchedule, MdToggleOff, MdToggleOn, MdWarning,
} from 'react-icons/md';
import api from '../../utils/api';
import Badge from '../../components/Badge';

const statusVariant = (s) => {
  if (s === 'RUNNING') return 'green';
  if (s === 'UPCOMING') return 'blue';
  if (s === 'COMPLETED') return 'gray';
  if (s === 'INACTIVE') return 'amber';
  return 'gray';
};

function fmtTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

export default function HrShiftManagement() {
  const [shifts, setShifts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [shiftFormOpen, setShiftFormOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [form, setForm] = useState({ name: '', startTime: '06:00', endTime: '14:00' });
  const [assignForm, setAssignForm] = useState({
    employeeId: '', department: '', shiftId: '',
  });
  const [departments, setDepartments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const selectedShift = useMemo(
    () => shifts.find((s) => s.id === selectedShiftId) || null,
    [shifts, selectedShiftId],
  );

  const loadShifts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [shiftsRes, statsRes] = await Promise.all([
        api.get('/hr/shifts'),
        api.get('/hr/shifts/stats'),
      ]);
      const items = Array.isArray(shiftsRes.data?.items) ? shiftsRes.data.items : [];
      setShifts(items);
      setStats(statsRes.data?.stats || null);
      setSelectedShiftId((prev) => prev || (items[0]?.id ?? null));
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load shifts');
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAssignments = useCallback(async (shiftId) => {
    if (!shiftId) return;
    try {
      const [empRes, assignRes, deptRes] = await Promise.all([
        api.get('/hr/shifts/available-employees'),
        api.get(`/hr/shifts/${shiftId}`),
        api.get('/hr/departments'),
      ]);
      setEmployees(Array.isArray(empRes.data?.items) ? empRes.data.items : []);
      setAssignments(Array.isArray(assignRes.data?.employees) ? assignRes.data.employees : []);
      const depts = Array.isArray(deptRes.data?.departments) ? deptRes.data.departments : [];
      setDepartments(depts.filter((d) => !d.isUnassigned && d.name !== 'IPD' && d.name !== 'OPD'));
    } catch {
      setAssignments([]);
    }
  }, []);

  useEffect(() => { loadShifts(); }, [loadShifts]);
  useEffect(() => {
    if (selectedShiftId) loadAssignments(selectedShiftId);
  }, [selectedShiftId, loadAssignments]);

  const openCreate = () => {
    setEditingShift(null);
    setForm({ name: '', startTime: '06:00', endTime: '14:00' });
    setShiftFormOpen(true);
  };

  const openEdit = (s) => {
    setEditingShift(s);
    setForm({ name: s.name, startTime: s.startTime, endTime: s.endTime });
    setShiftFormOpen(true);
  };

  const saveShift = async () => {
    setSubmitting(true);
    setError('');
    try {
      if (editingShift) {
        await api.put(`/hr/shifts/${editingShift.id}`, form);
      } else {
        await api.post('/hr/shifts', form);
      }
      setShiftFormOpen(false);
      await loadShifts();
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to save shift');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleShift = async (s) => {
    try {
      await api.patch(`/hr/shifts/${s.id}/toggle`);
      await loadShifts();
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to toggle shift');
    }
  };

  const createDefaultShifts = async () => {
    setLoading(true);
    setError('');
    try {
      const defaults = [
        { name: 'Morning Shift', startTime: '06:00', endTime: '14:00' },
        { name: 'Evening Shift', startTime: '14:00', endTime: '22:00' },
        { name: 'Night Shift', startTime: '22:00', endTime: '06:00' },
      ];
      for (const s of defaults) {
        await api.post('/hr/shifts', s);
      }
      await loadShifts();
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to create default shifts');
    } finally {
      setLoading(false);
    }
  };

  const assignEmployee = async () => {
    const targetShiftId = assignForm.shiftId || selectedShiftId;
    if (!targetShiftId || !assignForm.employeeId) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/hr/shifts/assign', {
        shiftId: targetShiftId,
        employeeId: assignForm.employeeId,
        department: assignForm.department,
      });
      setAssignOpen(false);
      setAssignForm({ employeeId: '', department: '', shiftId: '' });
      await loadAssignments(selectedShiftId);
      await loadShifts();
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to assign employee');
    } finally {
      setSubmitting(false);
    }
  };

  const removeAssignment = (assignmentId) => {
    setConfirmDeleteId(assignmentId);
  };

  const executeRemoveAssignment = async () => {
    if (!confirmDeleteId) return;
    try {
      await api.delete(`/hr/shifts/assign/${confirmDeleteId}`);
      setConfirmDeleteId(null);
      await loadAssignments(selectedShiftId);
      await loadShifts();
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to remove assignment');
      setConfirmDeleteId(null);
    }
  };

  const isDoctorOrNurse = (role) => {
    const r = String(role || '').toUpperCase();
    return r.includes('DOCTOR') || r.includes('NURSE');
  };

  const availableForShift = employees.filter(
    (e) => !isDoctorOrNurse(e.role)
      && !(e.assignments || []).some((a) => a.shift?.id === (assignForm.shiftId || selectedShiftId)),
  );

  const wardLabel = (w) => {
    if (w === 'ICU') return 'ICU';
    if (w === 'PRIVATE') return 'Private';
    if (w === 'GENERAL') return 'General';
    return w || '—';
  };

  return (
    <div className="w-full max-w-none bg-white min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdSchedule className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">Shift Management</h1>
              <p className="text-sm font-semibold text-gray-500">
                Create shifts, assign employees, and coordinate rosters. For a detailed calendar view, see{' '}
                <Link to="/dashboard/hr/duty-roster" className="text-[#0077B6] hover:underline font-bold">Duty Roster Board</Link>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadShifts}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 active:scale-95 transition-all duration-200 shrink-0"
            >
              <MdRefresh className="w-4.5 h-4.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0077B6] hover:bg-[#0077B6]/90 active:scale-95 transition-all duration-200 shrink-0"
            >
              <MdAdd className="w-4.5 h-4.5" />
              Create Shift
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 text-red-700 text-sm font-semibold border border-red-100">{error}</div>
        )}

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'On Shift Today', value: stats.totalStaffOnDuty, icon: MdPeople },
              { label: 'Running Shifts', value: stats.runningShifts, icon: MdSchedule },
              { label: 'Available Staff', value: stats.availableStaff, icon: MdPeople },
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Shifts Selection Column */}
          <div className="lg:col-span-1 border border-gray-100 bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 font-extrabold text-[#001B48] text-sm">Shifts Registry</div>
            {loading ? (
              <p className="p-5 text-sm text-gray-400 font-semibold">Loading shifts…</p>
            ) : shifts.length === 0 ? (
              <div className="p-6 flex flex-col items-center justify-center gap-3">
                <p className="text-sm text-gray-400 font-semibold text-center">No shifts configured in shift master.</p>
                <button
                  type="button"
                  onClick={createDefaultShifts}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#0077B6] hover:bg-[#0077B6]/90 transition active:scale-95 duration-200"
                >
                  Create Default Shifts
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {shifts.map((s) => (
                  <li key={s.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedShiftId(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedShiftId(s.id);
                        }
                      }}
                      className={`w-full text-left px-5 py-4 hover:bg-gray-50/50 cursor-pointer transition-all ${
                        selectedShiftId === s.id ? 'bg-blue-50/40 border-r-4 border-[#0077B6]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#001B48]">{s.name}</span>
                        <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                      </div>
                      <p className="text-xs font-semibold text-gray-500 mt-1">
                        {fmtTime(s.startTime)} – {fmtTime(s.endTime)} · {s.employeeCount} assigned
                      </p>
                      <div className="flex gap-3 mt-2.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                          className="text-xs font-bold text-[#0077B6] hover:underline flex items-center gap-1 active:scale-95 transition"
                        >
                          <MdEdit className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleShift(s); }}
                          className="text-xs font-bold text-gray-500 hover:underline flex items-center gap-1 active:scale-95 transition"
                        >
                          {s.isActive ? <MdToggleOn className="w-4 h-4 text-[#0077B6]" /> : <MdToggleOff className="w-4 h-4 text-gray-450" />}
                          {s.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Assignments Column */}
          <div className="lg:col-span-2 border border-gray-100 bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-extrabold text-[#001B48] text-sm">
                  {selectedShift ? `${selectedShift.name} — Duty Assignments` : 'Select a Shift'}
                </p>
                {selectedShift && (
                  <p className="text-xs font-bold text-gray-400 mt-0.5">
                    {fmtTime(selectedShift.startTime)} – {fmtTime(selectedShift.endTime)}
                  </p>
                )}
              </div>
              {selectedShift && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignForm({
                      employeeId: '',
                      department: '',
                      shiftId: selectedShift.id,
                    });
                    setAssignOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#0077B6] text-white text-sm font-bold hover:bg-[#00B4D8] active:bg-[#001B48] active:scale-95 transition shadow-sm"
                >
                  Assign Employee
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/70 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                  <tr>
                    <th className="text-left px-4 py-3">Employee</th>
                    <th className="text-left px-4 py-3">Role</th>
                    <th className="text-left px-4 py-3">Location / Ward</th>
                    <th className="text-center px-4 py-3">Workload</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assignments.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 font-medium">No employees assigned to this shift today.</td></tr>
                  ) : assignments.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/40 transition">
                      <td className="px-4 py-3.5 font-semibold text-[#001B48]">{a.employee?.name}</td>
                      <td className="px-4 py-3.5 text-gray-600 font-semibold">{a.employee?.role}</td>
                      <td className="px-4 py-3.5 text-gray-600 font-medium">
                        {a.duty
                          ? (a.duty.wardType ? wardLabel(a.duty.wardType) : (a.duty.dutyLocation || '—'))
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center text-gray-600 font-bold">
                        {a.workload?.patients || 0} Patients · {a.workload?.ot || 0} OT
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeAssignment(a.id)}
                          className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline active:scale-95 transition"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Create / Edit Shift Modal */}
      {shiftFormOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setShiftFormOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <MdSchedule className="text-white w-5 h-5" /> {editingShift ? 'Edit Shift Details' : 'Create New Shift'}
              </h2>
              <button type="button" onClick={() => setShiftFormOpen(false)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Shift Name</label>
                <input
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Morning Shift"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Start Time</label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">End Time</label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShiftFormOpen(false)}
                  className="px-4 py-2 text-sm font-bold bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl active:scale-95 transition shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting || !form.name}
                  onClick={saveShift}
                  className="px-4 py-2 rounded-xl bg-[#0077B6] text-white text-sm font-bold hover:bg-[#00B4D8] active:bg-[#001B48] disabled:opacity-50 active:scale-95 transition shadow-sm"
                >
                  {submitting ? 'Saving…' : 'Save Shift'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Assign Employee Modal */}
      {assignOpen && selectedShift && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setAssignOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <MdPeople className="text-white w-5 h-5" /> Assign Employee — {selectedShift.name}
              </h2>
              <button type="button" onClick={() => setAssignOpen(false)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
             <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Employee</label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold bg-white"
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm((f) => ({ ...f, employeeId: e.target.value }))}
                >
                  <option value="">Select employee...</option>
                  {availableForShift.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.role}) — {e.availability}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Shift</label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold bg-white"
                  value={assignForm.shiftId}
                  onChange={(e) => setAssignForm((f) => ({ ...f, shiftId: e.target.value }))}
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({fmtTime(s.startTime)} – {fmtTime(s.endTime)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAssignOpen(false)}
                  className="px-4 py-2 text-sm font-bold bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl active:scale-95 transition shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting || !assignForm.employeeId}
                  onClick={assignEmployee}
                  className="px-4 py-2 rounded-xl bg-[#0077B6] text-white text-sm font-bold hover:bg-[#00B4D8] active:bg-[#001B48] disabled:opacity-50 active:scale-95 transition shadow-sm"
                >
                  {submitting ? 'Assigning…' : 'Assign Employee'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {confirmDeleteId && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100 flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
              <MdWarning className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-[#001B48]">Confirm Removal</h3>
              <p className="text-sm font-semibold text-gray-500 leading-relaxed">
                Remove this shift assignment?
              </p>
            </div>
            <div className="flex gap-3 w-full pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 active:scale-95 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRemoveAssignment}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-95 text-sm font-bold text-white transition shadow-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

