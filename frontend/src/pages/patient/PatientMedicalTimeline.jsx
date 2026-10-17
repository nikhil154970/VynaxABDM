import { useState, useEffect } from 'react';
import patientApi from '../../utils/patientApi';

const ICONS = {
  REGISTRATION: 'person_add',
  VISIT: 'calendar_today',
  CONSULTATION: 'medical_services',
  ADMISSION: 'bed',
  NURSE_ASSIGNED: 'assignment_ind',
  DISCHARGE: 'exit_to_app',
  OT_REQUEST: 'local_hospital',
  OT_APPROVED_FOR_OT: 'check_circle',
  OT_SCHEDULED: 'schedule',
  OT_IN_PROGRESS: 'play_circle',
  OT_COMPLETED: 'check_circle',
};

export default function PatientMedicalTimeline() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const r = await patientApi.get('/patient/portal/timeline'); setData(r.data); }
      catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <Skeleton />;

  const timeline = data?.timeline || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Medical Timeline</h1>
      <p className="text-sm text-gray-400">Your complete hospital journey</p>

      <div className="relative">
        <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-100 rounded-full" />

        <div className="space-y-6">
          {timeline.length === 0 ? (
            <p className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">No timeline events yet</p>
          ) : timeline.map((event, i) => {
            const DotIcon = ({ color }) => (
              <div className={`absolute left-[14px] w-[22px] h-[22px] rounded-full flex items-center justify-center ring-4 ring-white ${color}`}>
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            );

            const colors = {
              REGISTRATION: 'bg-blue-500',
              VISIT: 'bg-cyan-500',
              CONSULTATION: 'bg-green-500',
              ADMISSION: 'bg-orange-500',
              NURSE_ASSIGNED: 'bg-purple-500',
              DISCHARGE: 'bg-emerald-500',
            };
            const dotColor = colors[event.type] || 'bg-gray-400';

            return (
              <div key={i} className="relative pl-14">
                <div className={`absolute left-[14px] w-[22px] h-[22px] rounded-full ${dotColor} flex items-center justify-center ring-4 ring-white`}>
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-700">{event.title}</p>
                    <span className="text-[11px] text-gray-400">{event.date?.slice(0, 10)}</span>
                  </div>
                  {event.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{event.description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return <div className="max-w-4xl mx-auto space-y-4 animate-pulse">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl ml-14" />)}</div>;
}
