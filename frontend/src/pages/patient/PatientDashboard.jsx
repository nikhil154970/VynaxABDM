import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import patientApi from '../../utils/patientApi';

export default function PatientDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const res = await patientApi.get('/patient/portal/dashboard');
        setData(res.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <LoadingSkeleton />;

  const { patient, upcomingAppointments, pendingBills, latestPrescription, recentLabReports, activeOtRequest, careJourney } = data || {};

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a1628] via-[#0f1f3d] to-[#0a1628] p-5 md:p-7 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
        <div className="relative">
          <p className="text-sm text-blue-200/70 font-medium">{greeting}</p>
          <h1 className="text-xl md:text-2xl font-bold mt-0.5">{patient?.name || 'Patient'}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-blue-200/70">
            <span className="font-mono">UHID: <span className="text-blue-200 font-bold">{patient?.uhid}</span></span>
            {patient?.age && <span className="w-1 h-1 rounded-full bg-blue-300/40" />}
            {patient?.age && <span>{patient.age} yrs</span>}
            {patient?.gender && <span className="w-1 h-1 rounded-full bg-blue-300/40" />}
            {patient?.gender && <span>{patient.gender}</span>}
            {patient?.bloodGroup && <span className="w-1 h-1 rounded-full bg-blue-300/40" />}
            {patient?.bloodGroup && <span className="font-semibold text-blue-200">{patient.bloodGroup}</span>}
          </div>
        </div>
      </div>

      {/* CARE JOURNEY */}
      <CareJourney data={careJourney} />

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Appointments" value={upcomingAppointments?.length || 0} icon="calendar" />
        <StatCard label="Pending Bills" value={pendingBills?.length || 0} icon="dollar" />
        <StatCard label="Lab Reports" value={recentLabReports?.length || 0} icon="flask" />
        <StatCard label="OT Status" value={activeOtRequest ? humanizeOtStatus(activeOtRequest.status) : 'None'} highlight={!!activeOtRequest} />
      </div>

      {/* WIDGETS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Widget title="Upcoming Appointments" link="/patient/portal/appointments">
          {(!upcomingAppointments || upcomingAppointments.length === 0) ? (
            <EmptyState text="No upcoming appointments" />
          ) : (
            <div className="divide-y divide-gray-50">
              {upcomingAppointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{a.doctor || 'Doctor'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(a.date)}{a.time ? ` at ${a.time}` : ''}</p>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 shrink-0 ml-2">{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </Widget>

        <Widget title="Pending Bills" link="/patient/portal/bills">
          {(!pendingBills || pendingBills.length === 0) ? (
            <EmptyState text="No pending bills" />
          ) : (
            <div className="divide-y divide-gray-50">
              {pendingBills.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{b.billNumber}</p>
                    <p className="text-xs text-gray-400 mt-0.5">₹{b.totalAmount?.toLocaleString('en-IN')}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ml-2 ${
                    b.status === 'PARTIAL' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'
                  }`}>{b.status}</span>
                </div>
              ))}
            </div>
          )}
        </Widget>

        <Widget title="Latest Prescription" link="/patient/portal/prescriptions">
          {!latestPrescription ? (
            <EmptyState text="No prescriptions yet" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="font-medium text-gray-600">Dr. {latestPrescription.doctor}</span>
              </div>
              <p className="text-sm font-semibold text-gray-800">{latestPrescription.diagnosis}</p>
              {latestPrescription.medicines && Array.isArray(latestPrescription.medicines) && (
                <div className="space-y-1">
                  {latestPrescription.medicines.slice(0, 3).map((m, i) => (
                    <p key={i} className="text-xs text-gray-500 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                      {m.name || m.medicine || m}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Widget>

        <Widget title="Lab Reports" link="/patient/portal/lab-reports">
          {(!recentLabReports || recentLabReports.length === 0) ? (
            <EmptyState text="No lab reports" />
          ) : (
            <div className="divide-y divide-gray-50">
              {recentLabReports.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{l.orderNumber}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{l.tests?.join(', ')}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ml-2 ${
                    l.reportStatus === 'COMPLETED' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-yellow-50 text-yellow-600 border-yellow-100'
                  }`}>{l.reportStatus}</span>
                </div>
              ))}
            </div>
          )}
        </Widget>
      </div>

      {/* OT BANNER */}
      {activeOtRequest && (
        <div
          onClick={() => navigate('/patient/portal/ot-surgery')}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800">{activeOtRequest.requestNumber}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {activeOtRequest.surgeryDate ? `Scheduled: ${formatDate(activeOtRequest.surgeryDate)}` : 'Surgery scheduled'}
                </p>
                {(activeOtRequest.surgeon || activeOtRequest.room) && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {activeOtRequest.surgeon && `Surgeon: ${activeOtRequest.surgeon}`}
                    {activeOtRequest.surgeon && activeOtRequest.room && ' | '}
                    {activeOtRequest.room && `Room: ${activeOtRequest.room}`}
                  </p>
                )}
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
              {humanizeOtStatus(activeOtRequest.status)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function humanizeOtStatus(s) {
  if (!s) return 'None';
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const JOURNEY_LABELS = {
  REGISTERED: 'Registered',
  OPD: 'OPD',
  IPD_ADMISSION: 'IPD',
  OT_SCHEDULED: 'OT',
  SURGERY_COMPLETED: 'Surgery',
  RECOVERY: 'Recovery',
  READY_FOR_TRANSFER: 'Transfer',
  WARD_TRANSFER: 'Ward',
  DISCHARGED: 'Discharge',
};

const JOURNEY_MSG = {
  REGISTERED: 'Your journey has just begun.',
  OPD: 'Your OPD consultation was completed.',
  IPD_ADMISSION: 'You are currently admitted.',
  OT_SCHEDULED: 'Your surgery is scheduled.',
  SURGERY_COMPLETED: 'Your surgery has been completed.',
  RECOVERY: 'You are in recovery.',
  READY_FOR_TRANSFER: 'Ready for ward transfer.',
  WARD_TRANSFER: 'Transferred to ward.',
  DISCHARGED: 'You have been discharged.',
};

function CareJourney({ data }) {
  if (!data || !data.stages) return null;
  const { stages, currentStage } = data;
  const currentKey = stages[currentStage];
  const statusMsg = JOURNEY_MSG[currentKey] || '';

  return (
    <div className="-mx-5 md:-mx-0">
      <div className="flex items-center justify-between mb-3 px-5 md:px-0">
        <h2 className="text-sm font-bold text-gray-700">Care Journey</h2>
        {statusMsg && <span className="text-[11px] font-medium text-blue-600">{statusMsg}</span>}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5">
        <div className="flex items-center w-full">
        {stages.map((key, idx) => {
          const label = JOURNEY_LABELS[key] || key;
          const done = idx < currentStage;
          const active = idx === currentStage;
          const isLast = idx === stages.length - 1;

          return (
            <div key={key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center w-full">
                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                  done ? 'bg-green-500 text-white shadow-sm' : active ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-200' : 'bg-gray-100 text-gray-400'
                }`}>
                  {done ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <span className={`mt-1 text-[9px] md:text-[10px] font-semibold text-center leading-tight ${
                  active ? 'text-blue-700' : done ? 'text-green-600' : 'text-gray-400'
                }`}>{label}</span>
              </div>
              {!isLast && (
                <div className={`flex-1 h-[3px] mx-1.5 mt-[-14px] md:mt-[-16px] rounded-full ${
                  idx < currentStage ? 'bg-green-400' : idx === currentStage ? 'bg-blue-300' : 'bg-gray-200'
                }`} />
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, highlight }) {
  const icons = {
    calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    dollar: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    flask: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  };
  const isNumber = typeof value === 'number';
  const displayValue = isNumber ? value : (highlight ? value : '—');
  const hColor = highlight ? 'from-blue-500 to-indigo-600' : 'from-gray-400 to-gray-500';
  const hIcon = highlight ? 'text-blue-200' : 'text-gray-300';
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${icon ? (highlight ? hColor : 'from-gray-100 to-gray-50') : 'from-blue-500 to-blue-600'} p-4 shadow-sm relative overflow-hidden`}>
      {icon && (
        <div className={`absolute top-2 right-2 opacity-20 ${highlight ? 'text-white' : 'text-gray-300'}`}>
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icons[icon]} />
          </svg>
        </div>
      )}
      {icon ? (
        <>
          <p className={`text-2xl md:text-3xl font-extrabold ${highlight ? 'text-white' : 'text-gray-800'}`}>{displayValue}</p>
          <p className={`text-[11px] font-medium mt-1 ${highlight ? 'text-white/80' : 'text-gray-400'}`}>{label}</p>
        </>
      ) : (
        <>
          <p className="text-2xl md:text-3xl font-extrabold text-white">{displayValue}</p>
          <p className="text-[11px] text-white/80 font-medium mt-1">{label}</p>
        </>
      )}
    </div>
  );
}

function Widget({ title, link, children }) {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-bold text-gray-700">{title}</h2>
        <button onClick={() => navigate(link)} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">View all</button>
      </div>
      <div className="p-5 flex-1">{children}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="text-sm text-gray-400 text-center py-6">{text}</p>;
}

function LoadingSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-32 bg-gray-200 rounded-2xl" />
      <div className="h-24 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-40 bg-gray-100 rounded-2xl" />)}
      </div>
    </div>
  );
}
