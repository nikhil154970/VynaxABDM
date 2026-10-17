import { useState, useEffect } from 'react';
import patientApi from '../../utils/patientApi';

const TYPE_ICONS = {
  PRESCRIPTION: 'file-text',
  LAB_REPORT: 'flask',
  SURGERY_REPORT: 'activity',
  DISCHARGE_SUMMARY: 'exit_to_app',
};

const TYPE_COLORS = {
  PRESCRIPTION: 'from-green-400 to-emerald-500',
  LAB_REPORT: 'from-purple-400 to-indigo-500',
  SURGERY_REPORT: 'from-cyan-400 to-blue-500',
  DISCHARGE_SUMMARY: 'from-orange-400 to-rose-500',
};

export default function PatientDocuments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const r = await patientApi.get('/patient/portal/documents'); setData(r.data); }
      catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <Skeleton />;

  const documents = data?.documents || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Documents</h1>

      {documents.length === 0 ? (
        <p className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">No documents found</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map((d) => (
            <div key={d.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition group">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${TYPE_COLORS[d.type] || 'from-gray-400 to-gray-500'} flex items-center justify-center shrink-0 shadow-sm`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate">{d.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {d.doctor && `Dr. ${d.doctor}`}
                    {d.date?.slice(0, 10) && ` — ${d.date.slice(0, 10)}`}
                  </p>
                  {d.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{d.description}</p>}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{d.type}</span>
                {d.attachmentUrl && (
                  <a href={d.attachmentUrl} target="_blank" rel="noopener noreferrer"
                     className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline">
                    View / Download
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-2xl" />)}</div>;
}
