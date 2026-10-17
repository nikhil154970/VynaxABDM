import { useState, useEffect } from 'react';
import patientApi from '../../utils/patientApi';

export default function PatientVitalsHistory() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const r = await patientApi.get('/patient/portal/vitals'); setData(r.data); }
      catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <Skeleton />;

  const { vitals, preOperative, recoveryAssessments } = data || {};

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Vitals History</h1>

      {(!vitals || vitals.length === 0) && (!preOperative || preOperative.length === 0) ? (
        <p className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">No vitals records found</p>
      ) : (
        <>
          {vitals?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50">
                <h2 className="text-sm font-bold text-gray-700">Vitals Records</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase"><th className="px-4 py-3 text-left">Date/Time</th><th className="px-4 py-3 text-left">BP</th><th className="px-4 py-3 text-left">Pulse</th><th className="px-4 py-3 text-left">Temp</th><th className="px-4 py-3 text-left">SpO2</th><th className="px-4 py-3 text-left">O₂ Therapy</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {vitals.map((v, i) => (
                      <tr key={v.id || i} className="hover:bg-blue-50/30">
                        <td className="px-4 py-3 text-xs text-gray-500">{v.recordedAt?.slice(0, 16).replace('T', ' ')}</td>
                        <td className="px-4 py-3 font-semibold text-gray-700">{v.bp || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{v.pulse != null ? `${v.pulse} bpm` : '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{v.temperature != null ? `${v.temperature}°F` : '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{v.spo2 != null ? `${v.spo2}%` : '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{v.oxygenTherapy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preOperative?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50">
                <h2 className="text-sm font-bold text-gray-700">Pre-Operative Assessments</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase"><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">BP</th><th className="px-4 py-3 text-left">Pulse</th><th className="px-4 py-3 text-left">Temp</th><th className="px-4 py-3 text-left">SpO2</th><th className="px-4 py-3 text-left">RR</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {preOperative.map((a, i) => (
                      <tr key={a.id || i} className="hover:bg-blue-50/30">
                        <td className="px-4 py-3 text-xs text-gray-500">{a.date?.slice(0, 10)}</td>
                        <td className="px-4 py-3 font-semibold text-gray-700">{a.bpSystolic ? `${a.bpSystolic}/${a.bpDiastolic}` : '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{a.pulse != null ? `${a.pulse} bpm` : '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{a.temperature != null ? `${a.temperature}°F` : '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{a.spo2 != null ? `${a.spo2}%` : '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{a.respiratoryRate != null ? `${a.respiratoryRate}/min` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Skeleton() {
  return <div className="max-w-5xl mx-auto space-y-4 animate-pulse"><div className="h-64 bg-gray-100 rounded-2xl" /></div>;
}
