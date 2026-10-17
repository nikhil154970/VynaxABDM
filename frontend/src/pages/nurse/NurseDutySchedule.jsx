import { useEffect, useState, useCallback } from 'react';
import { MdAssignment, MdToday, MdPeople, MdMedicalServices, MdLocalHospital, MdRefresh, MdWork, MdEventNote, MdNotificationsActive, MdFilterList, MdHourglassTop, MdDoneAll } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Badge from '../../components/Badge';

const statusVariant = (s) => {
  const st = (s || '').replace(/_/g, ' ');
  if (st.toLowerCase().includes('on') || st === 'ON DUTY') return 'green';
  if (st === 'UPCOMING') return 'blue';
  if (st === 'COMPLETED') return 'gray';
  if (st.toLowerCase().includes('off') || st === 'OFF DUTY') return 'amber';
  if (st === 'CRITICAL') return 'rose';
  if (st === 'STABLE') return 'green';
  return 'gray';
};

const shiftVariant = (s) => {
  if (s === 'MORNING') return 'amber';
  if (s === 'EVENING') return 'purple';
  if (s === 'NIGHT') return 'indigo';
  return 'gray';
};

const dutyTypeVariant = (t) => {
  if (t === 'WARD' || t === 'IPD') return 'blue';
  if (t === 'RECOVERY') return 'green';
  if (t === 'OT') return 'purple';
  if (t === 'EMERGENCY') return 'rose';
  return 'gray';
};

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtTimeStr(t) {
  if (!t) return '-';
  const p = t.split(':');
  if (p.length < 2) return t;
  const h = parseInt(p[0], 10);
  const m = parseInt(p[1], 10);
  if (isNaN(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function isSameDate(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export default function NurseDutySchedule() {
  const { user } = useAuth();

  const [hrDuties, setHrDuties] = useState([]);
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [otPatients, setOtPatients] = useState([]);
  const [nurseDuty, setNurseDuty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('today');

  const fetchAll = useCallback(async () => {
    try {
      const [hrToday, hrAll, pat, ot, nd] = await Promise.all([
        api.get('/hr/my-duties/today').catch(() => ({ data: { items: [] } })),
        api.get('/hr/my-duties').catch(() => ({ data: { items: [] } })),
        api.get('/nurse/ipd/assigned').catch(() => ({ data: { items: [] } })),
        api.get('/nurse/ot-patients').catch(() => ({ data: [] })),
        api.get('/nurse/my-duty').catch(() => ({ data: { duty: null } })),
      ]);

      const todayItems = hrToday.data?.items || [];
      const allItems = hrAll.data?.items || [];

      const todayIds = new Set(todayItems.map(i => i.id));
      const merged = [...todayItems, ...allItems.filter(i => !todayIds.has(i.id))];
      setHrDuties(merged);
      setAssignedPatients(Array.isArray(pat.data?.items) ? pat.data.items : []);
      setOtPatients(Array.isArray(ot.data) ? ot.data : Array.isArray(ot.data?.items) ? ot.data.items : []);
      setNurseDuty(nd.data?.duty || null);
    } catch (err) {
      console.error('fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const i = setInterval(fetchAll, 300000); return () => clearInterval(i); }, [fetchAll]);

  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();

  const dutyStatus = (d) => {
    if (!d) return 'OFF_DUTY';
    if (d.liveStatus) return d.liveStatus;
    if (d.startTime && d.endTime) {
      const [sh, sm] = d.startTime.split(':').map(Number);
      const [eh, em] = d.endTime.split(':').map(Number);
      const s = sh * 60 + sm;
      const e = eh * 60 + em;
      if (curMin < s) return 'UPCOMING';
      if (curMin >= s && curMin < e) return 'ON_DUTY';
      return 'COMPLETED';
    }
    return 'UPCOMING';
  };

  const todayList = hrDuties.filter((d) => isSameDate(d.date, now));
  const currentDuty = todayList.find((d) => dutyStatus(d) === 'ON_DUTY') || todayList[0] || null;

  let filtered = todayList;
  if (filter === 'week') {
    const ws = new Date(now); ws.setDate(ws.getDate() - ws.getDay());
    const we = new Date(ws); we.setDate(we.getDate() + 7);
    filtered = hrDuties.filter((d) => { const dd = new Date(d.date); return dd >= ws && dd < we; });
  } else if (filter === 'upcoming') {
    filtered = hrDuties.filter((d) => dutyStatus(d) === 'UPCOMING');
  } else if (filter === 'completed') {
    filtered = hrDuties.filter((d) => dutyStatus(d) === 'COMPLETED' || dutyStatus(d) === 'OFF_DUTY');
  }

  const sorted = [...filtered].sort((a, b) => {
    const c = new Date(b.date) - new Date(a.date);
    return c !== 0 ? c : (a.startTime || '') < (b.startTime || '') ? -1 : 1;
  });

  const totalPatients = assignedPatients.length;
  const criticalPatients = assignedPatients.filter((p) => String(p.status || '').trim().toLowerCase() === 'critical').length;
  const recoveryPatients = otPatients.filter((p) => {
    const s = String(p.status || '').toLowerCase();
    return s.includes('recovery') || s.includes('observation') || s.includes('under');
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <MdAssignment className="text-blue-600" /> My Duty Schedule
          </h1>
          <p className="text-sm text-gray-500">View your assigned duties, patients, and schedule</p>
        </div>
        <button onClick={fetchAll} className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100" title="Refresh"><MdRefresh size={20} /></button>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm transition hover:shadow-md flex flex-col justify-between h-28">
          <div>
            <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs">
              <span className="p-1 rounded bg-slate-50 text-slate-600 flex items-center justify-center"><MdToday size={14} /></span>
              <span>Today's Shift</span>
            </div>
            <p className="text-lg font-bold mt-2 text-slate-800" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {nurseDuty?.shift || currentDuty?.shift || currentDuty?.dutyType || '-'}
            </p>
          </div>
          {currentDuty?.startTime && currentDuty?.endTime ? (
            <p className="text-[10px] text-slate-400">{fmtTimeStr(currentDuty.startTime)} - {fmtTimeStr(currentDuty.endTime)}</p>
          ) : (
            <p className="text-[10px] text-slate-400">No timings set</p>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm transition hover:shadow-md flex flex-col justify-between h-28">
          <div>
            <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs">
              <span className="p-1 rounded bg-teal-50 text-teal-600 flex items-center justify-center"><MdWork size={14} /></span>
              <span>Current Duty</span>
            </div>
            <p className="text-base font-bold mt-2 text-slate-800 truncate leading-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {currentDuty?.dutyType || nurseDuty?.wardName || 'N/A'}
            </p>
          </div>
          <div className="mt-0.5">
            <Badge variant={statusVariant(dutyStatus(currentDuty))} className="text-[9px] py-0.5 px-1.5">
              {dutyStatus(currentDuty).replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm transition hover:shadow-md flex flex-col justify-between h-28">
          <div>
            <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs">
              <span className="p-1 rounded bg-blue-50 text-blue-600 flex items-center justify-center"><MdPeople size={14} /></span>
              <span>Assigned Patients</span>
            </div>
            <p className="text-xl font-bold mt-2 text-slate-800" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {totalPatients}
            </p>
          </div>
          <p className="text-[10px] text-slate-400">{criticalPatients > 0 ? `${criticalPatients} critical` : 'All stable'}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm transition hover:shadow-md flex flex-col justify-between h-28">
          <div>
            <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs">
              <span className="p-1 rounded bg-purple-50 text-purple-600 flex items-center justify-center"><MdMedicalServices size={14} /></span>
              <span>OT Cases</span>
            </div>
            <p className="text-xl font-bold mt-2 text-slate-800" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {otPatients.length}
            </p>
          </div>
          <p className="text-[10px] text-slate-400">{recoveryPatients.length} in recovery</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm transition hover:shadow-md flex flex-col justify-between h-28">
          <div>
            <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs">
              <span className="p-1 rounded bg-amber-50 text-amber-600 flex items-center justify-center"><MdLocalHospital size={14} /></span>
              <span>Recovery</span>
            </div>
            <p className="text-xl font-bold mt-2 text-slate-800" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {recoveryPatients.length}
            </p>
          </div>
          <p className="text-[10px] text-slate-400">Under observation</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm transition hover:shadow-md flex flex-col justify-between h-28">
          <div>
            <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs">
              <span className="p-1 rounded bg-rose-50 text-rose-600 flex items-center justify-center"><MdNotificationsActive size={14} /></span>
              <span>Alerts</span>
            </div>
            <p className="text-xl font-bold mt-2 text-slate-800" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {loading ? '-' : totalPatients > 0 ? totalPatients : 0}
            </p>
          </div>
          <p className="text-[10px] text-slate-400">Active assignments</p>
        </div>
      </div>

      {/* Duty Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-sky-50 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2"><MdAssignment className="text-blue-600" /> Duty Summary</h2>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          <div><p className="text-xs text-gray-400">Nurse Name</p><p className="font-semibold text-gray-800">{user?.name || '-'}</p></div>
          <div><p className="text-xs text-gray-400">Employee ID</p><p className="font-semibold text-gray-800">{user?.employeeId || '-'}</p></div>
          <div><p className="text-xs text-gray-400">Department</p><p className="font-semibold text-gray-800">{currentDuty?.department || nurseDuty?.wardName || 'Nursing'}</p></div>
          <div><p className="text-xs text-gray-400">Current Shift</p><p className="font-semibold text-gray-800"><Badge variant={shiftVariant(currentDuty?.shift || nurseDuty?.shift)}>{currentDuty?.shift || nurseDuty?.shift || '-'}</Badge></p></div>
          <div><p className="text-xs text-gray-400">Shift Time</p><p className="font-semibold text-gray-800">{currentDuty?.startTime && currentDuty?.endTime ? `${fmtTimeStr(currentDuty.startTime)} - ${fmtTimeStr(currentDuty.endTime)}` : '-'}</p></div>
          <div><p className="text-xs text-gray-400">Duty Status</p><p><Badge variant={statusVariant(dutyStatus(currentDuty))}>{dutyStatus(currentDuty).replace(/_/g, ' ')}</Badge></p></div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-500 flex items-center gap-1"><MdFilterList size={14} /> Filter:</span>
        {[
          { key: 'today', label: 'Today', icon: MdToday },
          { key: 'week', label: 'This Week', icon: MdEventNote },
          { key: 'upcoming', label: 'Upcoming', icon: MdHourglassTop },
          { key: 'completed', label: 'Completed', icon: MdDoneAll },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${filter === key ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-auto">{sorted.length} dut{sorted.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      {/* Duty Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Shift</th>
                <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Duty Type</th>
                <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Location</th>
                <th className="text-center px-4 py-3 font-semibold text-white text-xs uppercase">Patients</th>
                <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No duties found</td></tr>}
              {sorted.map((duty, idx) => (
                <tr key={duty.id || idx} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(duty.date)}</td>
                  <td className="px-4 py-3"><Badge variant={shiftVariant(duty.shift)}>{duty.shift}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={dutyTypeVariant(duty.dutyType)}>{duty.dutyType}</Badge></td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{duty.otRoomName || duty.recoveryRoomName || duty.dutyLocation || duty.wardType || duty.department || '-'}</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-semibold text-gray-700">{duty.patientCount || 0}</span></td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{duty.startTime && duty.endTime ? `${fmtTimeStr(duty.startTime)} - ${fmtTimeStr(duty.endTime)}` : '-'}</td>
                  <td className="px-4 py-3"><Badge variant={statusVariant(dutyStatus(duty))}>{dutyStatus(duty).replace(/_/g, ' ')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Assignments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-sky-50 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2"><MdPeople className="text-blue-600" /> Patient Assignments</h2>
        </div>
        {assignedPatients.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No patients assigned</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Patient</th>
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">UHID</th>
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Ward</th>
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Bed</th>
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {assignedPatients.map((p, idx) => (
                  <tr key={p.id || p.admissionId || idx} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 font-medium text-gray-800">{p.name || p.patientName || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.uhid || p.patient?.uhid || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.wardName || p.ward?.name || p.department || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.bed || p.bedCode || p.bedNumber || '-'}</td>
                    <td className="px-4 py-3"><Badge variant={statusVariant(p.status)}>{p.status || 'ACTIVE'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* OT / Surgery Assignments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-sky-50 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2"><MdMedicalServices className="text-blue-600" /> OT / Surgery Assignments</h2>
        </div>
        {otPatients.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No OT cases assigned</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Patient</th>
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">OT Room</th>
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Time</th>
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Surgeon</th>
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {otPatients.map((p, idx) => {
                  const pt = p.surgerySession?.surgerySchedule?.otRequest?.patient;
                  const sched = p.surgerySession?.surgerySchedule || p.surgerySchedule || p.schedule || {};
                  return (
                    <tr key={p.id || idx} className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-3 font-medium text-gray-800">{pt?.name || p.patientName || p.name || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{sched.otRoom?.roomName || sched.otRoomName || p.otRoomName || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{sched.startTime ? `${fmtDate(sched.surgeryDate)} ${fmtTimeStr(sched.startTime)}` : fmtTime(p.admittedAt || p.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-600">{sched.surgeon?.user?.name || sched.surgeonName || '-'}</td>
                      <td className="px-4 py-3"><Badge variant={statusVariant(p.status)}>{(p.status || 'ACTIVE').replace(/_/g, ' ')}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recovery Assignments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2"><MdLocalHospital className="text-green-600" /> Recovery Assignments</h2>
        </div>
        {recoveryPatients.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No recovery assignments</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Patient</th>
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Recovery/Bed</th>
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Start Time</th>
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recoveryPatients.map((p, idx) => {
                  const pt = p.surgerySession?.surgerySchedule?.otRequest?.patient;
                  return (
                    <tr key={p.id || idx} className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-3 font-medium text-gray-800">{pt?.name || p.patientName || p.name || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{p.recoveryRoomName || p.assignedBedCode || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{fmtTime(p.admittedAt || p.createdAt)}</td>
                      <td className="px-4 py-3"><Badge variant={statusVariant(p.status)}>{(p.status || 'UNDER_OBSERVATION').replace(/_/g, ' ')}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
