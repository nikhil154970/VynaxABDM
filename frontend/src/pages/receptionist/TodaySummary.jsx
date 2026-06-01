import {
  MdPeople, MdCalendarToday, MdBed, MdReceiptLong,
  MdAccessTime, MdTrendingUp, MdTrendingDown, MdCheckCircle,
  MdWarning, MdLocalHospital, MdArrowForward
} from 'react-icons/md';

const hourlyData = [
  { hour: '8 AM', opd: 4, ipd: 1 },
  { hour: '9 AM', opd: 9, ipd: 2 },
  { hour: '10 AM', opd: 13, ipd: 1 },
  { hour: '11 AM', opd: 10, ipd: 3 },
  { hour: '12 PM', opd: 7, ipd: 0 },
  { hour: '1 PM', opd: 5, ipd: 1 },
  { hour: '2 PM', opd: 6, ipd: 2 },
  { hour: '3 PM', opd: 0, ipd: 0 },
];

const deptStats = [
  { name: 'General Medicine', patients: 22, pct: 40 },
  { name: 'Cardiology', patients: 14, pct: 26 },
  { name: 'Gynecology', patients: 10, pct: 18 },
  { name: 'Orthopedics', patients: 8, pct: 15 },
  { name: 'Others', patients: 2, pct: 1 },
];

const highlights = [
  { label: 'OPD Patients', value: '54', prev: '47', up: true, icon: MdCalendarToday, color: '#1d4ed8', bg: '#dbeafe' },
  { label: 'IPD Admitted', value: '8', prev: '6', up: true, icon: MdBed, color: '#065f46', bg: '#d1fae5' },
  { label: 'Discharges', value: '3', prev: '5', up: false, icon: MdCheckCircle, color: '#92400e', bg: '#fef3c7' },
  { label: 'Bills Generated', value: '19', prev: '21', up: false, icon: MdReceiptLong, color: '#6b21a8', bg: '#f3e8ff' },
  { label: 'Pending Dues', value: '12', prev: '9', up: true, icon: MdWarning, color: '#991b1b', bg: '#fee2e2' },
  { label: 'Avg Wait (min)', value: '18', prev: '22', up: false, icon: MdAccessTime, color: '#0369a1', bg: '#e0f2fe' },
];

const maxOPD = Math.max(...hourlyData.map(d => d.opd));

export default function TodaySummary() {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Today's Summary</h1>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <MdAccessTime className="w-3.5 h-3.5" /> {today}
            </p>
          </div>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {highlights.map((h) => {
            const Icon = h.icon;
            return (
              <div key={h.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: h.bg }}>
                  <Icon className="w-5 h-5" style={{ color: h.color }} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{h.value}</p>
                <p className="text-xs font-semibold text-gray-600 mt-0.5 leading-tight">{h.label}</p>
                <div className="flex items-center gap-1 mt-1">
                  {h.up
                    ? <MdTrendingUp className="w-3 h-3 text-green-500" />
                    : <MdTrendingDown className="w-3 h-3 text-red-400" />}
                  <span className={`text-xs font-medium ${h.up ? 'text-green-600' : 'text-red-500'}`}>
                    vs {h.prev} yesterday
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Hourly Chart */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-gray-800">Hourly Patient Flow</h2>
                <p className="text-xs text-gray-400 mt-0.5">OPD registrations per hour today</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" />OPD</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400" />IPD</span>
              </div>
            </div>
            <div className="flex items-end gap-3 h-40">
              {hourlyData.map((d) => (
                <div key={d.hour} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col-reverse gap-0.5">
                    {d.ipd > 0 && (
                      <div
                        className="w-full rounded-t-sm"
                        style={{ height: `${(d.ipd / maxOPD) * 120}px`, background: '#fb923c' }}
                      />
                    )}
                    <div
                      className="w-full rounded-t-md"
                      style={{ height: `${(d.opd / maxOPD) * 120}px`, background: d.opd === 0 ? '#e5e7eb' : '#3b82f6' }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{d.hour}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dept Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <MdLocalHospital className="w-4 h-4 text-blue-600" /> By Department
            </h2>
            <div className="space-y-4">
              {deptStats.map((d) => (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">{d.name}</span>
                    <span className="text-xs font-bold text-gray-900">{d.patients}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${d.pct}%`, background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total OPD', value: '54', color: '#1d4ed8' },
                  { label: 'Total IPD', value: '8', color: '#065f46' },
                  { label: 'Beds Occupied', value: '9/12', color: '#92400e' },
                  { label: 'Revenue Today', value: '₹41k', color: '#6b21a8' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-3 bg-gray-50">
                    <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick navigation */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4">Jump To</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Patient Queue', path: '/dashboard/reception/queue', color: '#1d4ed8', bg: '#dbeafe' },
              { label: 'Register Patient', path: '/dashboard/reception/patients/register', color: '#065f46', bg: '#d1fae5' },
              { label: 'Bed Status', path: '/dashboard/reception/beds', color: '#92400e', bg: '#fef3c7' },
              { label: 'Pending Dues', path: '/dashboard/reception/billing/dues', color: '#991b1b', bg: '#fee2e2' },
            ].map(a => (
              <a key={a.label} href={a.path}
                className="flex items-center justify-between p-4 rounded-xl transition hover:opacity-80"
                style={{ background: a.bg }}>
                <span className="text-sm font-semibold" style={{ color: a.color }}>{a.label}</span>
                <MdArrowForward className="w-4 h-4" style={{ color: a.color }} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
