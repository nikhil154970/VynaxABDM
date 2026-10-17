import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdGroups, MdMedicalServices, MdLocalHospital, MdScience, MdConstruction, MdLocalPharmacy,
  MdPeople, MdAssignment, MdCheckCircle, MdWarning, MdRefresh, MdCalendarToday, MdBusiness,
  MdSchedule, MdNotificationImportant, MdPerson,
} from 'react-icons/md';
import api from '../../utils/api';

function StatCard({ label, value, icon: Icon, tone, to }) {
  const navigate = useNavigate();
  const tones = {
    blue: { bg: '#E0F2FE', fg: '#0077B6' },
    navy: { bg: '#E8F1F5', fg: '#001B48' },
    amber: { bg: '#FEF3C7', fg: '#B45309' },
    teal: { bg: '#CCFBF1', fg: '#0F766E' },
    purple: { bg: '#F3E8FF', fg: '#7E22CE' },
    emerald: { bg: '#D1FAE5', fg: '#047857' },
    rose: { bg: '#FFE4E6', fg: '#BE123C' },
    orange: { bg: '#FFEDD5', fg: '#C2410C' },
    cyan: { bg: '#CFFAFE', fg: '#0E7490' },
    indigo: { bg: '#E0E7FF', fg: '#4338CA' },
    red: { bg: '#FEE2E2', fg: '#B91C1C' },
    green: { bg: '#DCFCE7', fg: '#15803D' },
  };
  const t = tones[tone] || tones.blue;

  return (
    <button
      type="button"
      onClick={() => to && navigate(to)}
      className="text-left w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer hover:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: t.bg }}>
          <Icon className="w-5 h-5" style={{ color: t.fg }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">{label}</p>
          <p className="text-lg font-extrabold mt-0.5 text-gray-900">{value ?? '—'}</p>
        </div>
      </div>
    </button>
  );
}

export default function HrDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [empRes, shiftRes, dutyRes, allocRes, deptRes] = await Promise.all([
        api.get('/hr/employees', { params: { page: 1, pageSize: 1 }, silent: true }),
        api.get('/hr/shifts/stats', { silent: true }),
        api.get('/hr/duty-rosters/stats', { silent: true }),
        api.get('/hr/allocation-requests', { params: { page: 1, pageSize: 1 }, silent: true }),
        api.get('/hr/departments', { silent: true }),
      ]);
      setData({
        employees: empRes.data?.summary || null,
        shifts: shiftRes.data?.stats || null,
        duty: dutyRes.data || null,
        allocations: allocRes.data?.summary || null,
        departments: Array.isArray(deptRes.data?.departments) ? deptRes.data.departments : [],
      });
    } catch {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const s = data?.employees || {};
  const ss = data?.shifts || {};
  const ds = data?.duty || {};
  const al = data?.allocations || {};
  const deptCount = data?.departments?.length || 0;

  const summaryCards = data
    ? [
        { label: 'Total Employees', value: s.total, icon: MdGroups, tone: 'blue', to: '/dashboard/hr/employees' },
        { label: 'Doctors', value: s.doctors, icon: MdMedicalServices, tone: 'purple', to: '/dashboard/hr/employees' },
        { label: 'Nurses', value: s.nurses, icon: MdLocalHospital, tone: 'emerald', to: '/dashboard/hr/employees' },
        { label: 'Receptionists', value: s.receptionists, icon: MdPeople, tone: 'amber', to: '/dashboard/hr/employees' },
        { label: 'Lab Technicians', value: s.labTechnicians, icon: MdScience, tone: 'rose', to: '/dashboard/hr/employees' },
        { label: 'OT Technicians', value: s.otTechnicians, icon: MdConstruction, tone: 'orange', to: '/dashboard/hr/employees' },
        { label: 'Pharmacists', value: s.pharmacists, icon: MdLocalPharmacy, tone: 'cyan', to: '/dashboard/hr/employees' },
        { label: 'Staff on Duty', value: ss.totalStaffOnDuty ?? '—', icon: MdAssignment, tone: 'indigo', to: '/dashboard/hr/shifts' },
        { label: 'Available Staff', value: ss.availableStaff ?? '—', icon: MdCheckCircle, tone: 'green', to: '/dashboard/hr/shifts' },
        { label: 'Busy / Allocated', value: ss.busyStaff ?? '—', icon: MdWarning, tone: 'red', to: '/dashboard/hr/shifts' },
        { label: 'Running Shifts', value: ss.runningShifts ?? '—', icon: MdSchedule, tone: 'teal', to: '/dashboard/hr/shifts' },
        { label: 'Duty Roster (Today)', value: ds.totalToday ?? '—', icon: MdCalendarToday, tone: 'blue', to: '/dashboard/hr/duty-roster' },
        { label: 'Pending Allocations', value: al.pending ?? 0, icon: MdNotificationImportant, tone: 'amber', to: '/dashboard/hr/staff-allocation/requests' },
        { label: 'Departments', value: deptCount, icon: MdBusiness, tone: 'purple', to: '/dashboard/hr/employees' },
      ]
    : [];

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top bar header banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdBusiness className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">HR Dashboard</h1>
                <span className="text-xs text-[#0077B6] font-bold bg-blue-50/70 border border-blue-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <MdCalendarToday className="w-3 h-3" /> {todayStr}
                </span>
              </div>
             
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0077B6] hover:bg-[#005B8C] transition shadow-sm active:scale-95 duration-200 disabled:opacity-50 shrink-0 self-start sm:self-auto"
          >
            <MdRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-500 font-semibold text-sm">
            <div className="w-8 h-8 border-3 border-[#0077B6] border-t-transparent rounded-full animate-spin"></div>
            Loading dashboard data...
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {summaryCards.map((c) => (
                <StatCard key={c.label} {...c} />
              ))}
            </div>

            {/* Quick Links Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <QuickLink
                icon={MdPerson}
                label="All Employees"
                desc="Manage workforce, roles & departments"
                onClick={() => navigate('/dashboard/hr/employees')}
                tone="blue"
              />
              <QuickLink
                icon={MdAssignment}
                label="Allocation Requests"
                desc={`${al.pending ?? 0} pending — view and assign staff`}
                onClick={() => navigate('/dashboard/hr/staff-allocation/requests')}
                tone="amber"
              />
              <QuickLink
                icon={MdSchedule}
                label="Shift Management"
                desc={`${ss.runningShifts ?? 0} shifts running now`}
                onClick={() => navigate('/dashboard/hr/shifts')}
                tone="teal"
              />
              <QuickLink
                icon={MdCalendarToday}
                label="Duty Roster"
                desc={`${ds.totalToday ?? 0} staff on duty today`}
                onClick={() => navigate('/dashboard/hr/duty-roster')}
                tone="indigo"
              />
            </div>

            {/* Duty Roster Status & Shift Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Duty Roster Today */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-extrabold text-[#001B48] flex items-center gap-2 border-b border-gray-150 pb-3">
                  <MdCalendarToday className="w-4.5 h-4.5 text-[#0077B6]" />
                  Duty Roster — Today
                </h3>
                {ds.totalToday > 0 ? (
                  <div className="space-y-4">
                    <StatusRow label="On Duty" value={ds.onDuty ?? 0} total={ds.totalToday} color="#16A34A" />
                    <StatusRow label="Upcoming" value={ds.upcoming ?? 0} total={ds.totalToday} color="#EA580C" />
                    <StatusRow label="Completed" value={ds.completed ?? 0} total={ds.totalToday} color="#475569" />
                    
                    {ds.byType && Object.keys(ds.byType).length > 0 && (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-405 uppercase tracking-wider mb-2">By Duty Type</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(ds.byType).map(([k, v]) => (
                            <span key={k} className="text-xs font-bold bg-gray-50 border border-gray-100 text-gray-700 px-3 py-1 rounded-lg">
                              {k}: <strong className="text-[#0077B6]">{v}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {ds.byShift && Object.keys(ds.byShift).length > 0 && (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-405 uppercase tracking-wider mb-2">By Shift</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(ds.byShift).map(([k, v]) => (
                            <span key={k} className="text-xs font-bold bg-blue-50 border border-blue-100 text-[#0077B6] px-3 py-1 rounded-lg">
                              {k}: <strong className="text-[#001B48]">{v}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-gray-400 py-8 text-center">No duty roster entries scheduled for today</p>
                )}
              </div>

              {/* Shift Breakdown */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-extrabold text-[#001B48] flex items-center gap-2 border-b border-gray-150 pb-3">
                  <MdSchedule className="w-4.5 h-4.5 text-[#0077B6]" />
                  Shift Status
                </h3>
                {ss.shiftBreakdown?.length > 0 ? (
                  <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto pr-1">
                    {ss.shiftBreakdown.map((sh) => (
                      <div key={sh.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              background: sh.status === 'RUNNING' ? '#16A34A'
                                : sh.status === 'UPCOMING' ? '#EA580C'
                                : '#6B7280',
                            }}
                          />
                          <span className="text-sm font-bold text-gray-800">{sh.name}</span>
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${
                            sh.status === 'RUNNING' ? 'bg-green-50 border-green-100 text-green-700'
                            : sh.status === 'UPCOMING' ? 'bg-amber-50 border-amber-100 text-amber-700'
                            : 'bg-gray-50 border-gray-100 text-gray-500'
                          }`}>
                            {sh.status}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-[#0077B6] bg-blue-50/50 border border-blue-100/50 px-2.5 py-1 rounded-xl">
                          {sh.assignedCount} assigned
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-gray-400 py-8 text-center">No shifts configured in shift master</p>
                )}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-500">Total Shift-Eligible Staff</span>
                  <span className="font-extrabold text-[#001B48]">{ss.totalStaff ?? '—'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickLink({ icon: Icon, label, desc, onClick, tone }) {
  const tones = {
    blue: { bg: '#E0F2FE', fg: '#0077B6' },
    navy: { bg: '#E8F1F5', fg: '#001B48' },
    amber: { bg: '#FEF3C7', fg: '#B45309' },
    teal: { bg: '#CCFBF1', fg: '#0F766E' },
    purple: { bg: '#F3E8FF', fg: '#7E22CE' },
    emerald: { bg: '#D1FAE5', fg: '#047857' },
    rose: { bg: '#FFE4E6', fg: '#BE123C' },
    orange: { bg: '#FFEDD5', fg: '#C2410C' },
    cyan: { bg: '#CFFAFE', fg: '#0E7490' },
    indigo: { bg: '#E0E7FF', fg: '#4338CA' },
    red: { bg: '#FEE2E2', fg: '#B91C1C' },
    green: { bg: '#DCFCE7', fg: '#15803D' },
  };
  const t = tones[tone] || tones.blue;

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 transition duration-200 hover:shadow-md hover:border-[#0077B6] focus:outline-none focus:ring-1 focus:ring-[#0077B6]/20 text-left w-full cursor-pointer"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: t.bg }}>
        <Icon className="w-5.5 h-5.5" style={{ color: t.fg }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-[#001B48]">{label}</p>
        <p className="text-xs text-gray-500 font-semibold mt-1 leading-relaxed">{desc}</p>
      </div>
    </button>
  );
}

function StatusRow({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold mb-1.5">
        <span className="text-gray-500">{label}</span>
        <span className="text-[#001B48]">{value} <span className="text-gray-400 font-semibold">({pct}%)</span></span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
