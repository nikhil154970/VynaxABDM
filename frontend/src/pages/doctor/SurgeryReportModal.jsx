import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function SurgeryReportModal({ scheduleId, onClose, onComplete }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [error, setError] = useState('');
  const [savingAs, setSavingAs] = useState('');

  const [form, setForm] = useState({
    preOperativeDiagnosis: '',
    postOperativeDiagnosis: '',
    procedurePerformed: '',
    operationFindings: '',
    complications: '',
    bloodLoss: '',
    anaesthesiaType: '',
    implantsUsed: '',
    specimenCollected: '',
    procedureSummary: '',
    surgeryOutcome: '',
    specialInstructions: '',
  });

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get(`/doctor/ot/report-data/${scheduleId}`);
        if (!alive) return;
        setSchedule(res.data?.schedule);
        const note = res.data?.schedule?.surgerySession?.postSurgeryNote;
        if (note) {
          setForm({
            preOperativeDiagnosis: note.preOperativeDiagnosis || '',
            postOperativeDiagnosis: note.postOperativeDiagnosis || '',
            procedurePerformed: note.procedureSummary || '',
            operationFindings: note.operationFindings || '',
            complications: note.complications || '',
            bloodLoss: note.bloodLoss || '',
            anaesthesiaType: note.anaesthesiaType || '',
            implantsUsed: note.implantsUsed || '',
            specimenCollected: note.specimenCollected || '',
            procedureSummary: note.surgeonNotes || '',
            surgeryOutcome: note.surgeryOutcome || '',
            specialInstructions: note.specialInstructions || '',
          });
        }
        setError('');
      } catch (e) {
        if (!alive) return;
        setError('Failed to load surgery data');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [scheduleId]);

  const handleSave = async (mode) => {
    if (mode === 'complete') {
      if (!form.surgeryOutcome) {
        setError('Surgery Outcome is required to complete.');
        return;
      }
      if (!String(form.procedurePerformed || '').trim()) {
        setError('Procedure Performed is required to complete.');
        return;
      }
    }
    setSaving(true);
    setSavingAs(mode);
    setError('');
    try {
      if (mode === 'draft') {
        await api.post('/doctor/ot/report-draft', { scheduleId, report: form });
      } else {
        await api.post('/doctor/ot/complete', { scheduleId, report: form });
        onComplete();
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save surgery report');
    } finally {
      setSaving(false);
      setSavingAs('');
    }
  };

  const patient = schedule?.otRequest?.patient;
  const admission = schedule?.otRequest?.admission;
  const otRoom = schedule?.otRoom;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-gray-400">Loading surgery data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 py-8" onClick={onClose}>
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"
             style={{ background: 'rgba(0, 119, 182, 0.04)' }}>
          <h2 className="text-lg font-extrabold text-gray-800">Surgery Report</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {schedule && (
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><span className="text-gray-400">Patient:</span> <span className="font-bold">{patient?.name || '-'}</span></div>
              <div><span className="text-gray-400">UHID:</span> <span className="font-bold">{patient?.uhid || '-'}</span></div>
              <div><span className="text-gray-400">IPD No:</span> <span className="font-bold">{admission?.ipdNumber || '-'}</span></div>
              <div><span className="text-gray-400">Surgery:</span> <span className="font-bold">{schedule?.otRequest?.surgeryRecommendation || '-'}</span></div>
              <div><span className="text-gray-400">OT Room:</span> <span className="font-bold">{otRoom?.roomName || '-'}</span></div>
              <div><span className="text-gray-400">Surgeon:</span> <span className="font-bold">{schedule?.surgeon?.user?.name || '-'}</span></div>
              <div><span className="text-gray-400">Assistant:</span> <span className="font-bold">{schedule?.assistantSurgeon?.user?.name || '-'}</span></div>
              <div><span className="text-gray-400">Anaesthetist:</span> <span className="font-bold">{schedule?.anaesthetist?.user?.name || '-'}</span></div>
              <div><span className="text-gray-400">Date:</span> <span className="font-bold">{schedule?.surgeryDate ? new Date(schedule.surgeryDate).toLocaleDateString() : '-'}</span></div>
              <div><span className="text-gray-400">Time:</span> <span className="font-bold">{schedule?.startTime || '-'}</span></div>
            </div>
          </div>
        )}

        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Pre-Operative Diagnosis</label>
              <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-300" rows={2} value={form.preOperativeDiagnosis} onChange={set('preOperativeDiagnosis')} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Post-Operative Diagnosis</label>
              <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-300" rows={2} value={form.postOperativeDiagnosis} onChange={set('postOperativeDiagnosis')} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Procedure Performed</label>
            <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-300" rows={2} value={form.procedurePerformed} onChange={set('procedurePerformed')} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Operation Findings</label>
              <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-300" rows={3} value={form.operationFindings} onChange={set('operationFindings')} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Complications</label>
              <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-300" rows={3} value={form.complications} onChange={set('complications')} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Blood Loss</label>
              <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-300" value={form.bloodLoss} onChange={set('bloodLoss')} placeholder="e.g., 200ml" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Anaesthesia Type</label>
              <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-300" value={form.anaesthesiaType} onChange={set('anaesthesiaType')} placeholder="e.g., General/Spinal" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Implants Used</label>
              <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-300" value={form.implantsUsed} onChange={set('implantsUsed')} placeholder="e.g., Plate, Screws" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Specimen Collected</label>
              <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-300" value={form.specimenCollected} onChange={set('specimenCollected')} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Surgery Outcome</label>
              <select className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-300" value={form.surgeryOutcome} onChange={set('surgeryOutcome')}>
                <option value="">Select outcome...</option>
                <option value="SUCCESSFUL">Successful</option>
                <option value="STABLE">Stable</option>
                <option value="COMPLICATED">Complicated</option>
                <option value="REFERRED">Referred</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Procedure Summary</label>
            <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-300" rows={3} value={form.procedureSummary} onChange={set('procedureSummary')} />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Special Instructions</label>
            <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-300" rows={2} value={form.specialInstructions} onChange={set('specialInstructions')} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          {error && <span className="text-xs text-red-600 mr-auto">{error}</span>}
          <button
            className="rounded-xl border border-gray-200 bg-white px-5 py-2 text-xs font-extrabold text-gray-600"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded-xl px-5 py-2 text-xs font-extrabold text-white disabled:opacity-50"
            style={{ background: '#001B48' }}
            disabled={saving}
            onClick={() => handleSave('draft')}
          >
            {saving && savingAs === 'draft' ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            className="rounded-xl px-5 py-2 text-xs font-extrabold text-white disabled:opacity-50"
            style={{ background: '#E53935' }}
            disabled={saving || schedule?.surgerySession?.status !== 'IN_PROGRESS'}
            onClick={() => handleSave('complete')}
          >
            {saving && savingAs === 'complete' ? 'Completing...' : 'Complete Surgery & Move to Recovery'}
          </button>
        </div>
      </div>
    </div>
  );
}
