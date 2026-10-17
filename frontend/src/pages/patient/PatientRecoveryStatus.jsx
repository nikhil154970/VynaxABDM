import { useState, useEffect, useCallback } from 'react';
import patientApi from '../../utils/patientApi';

const STATUS_MESSAGES = {
  UNDER_OBSERVATION: 'You are in Recovery Room under observation',
  STABLE: 'Your condition is stable in Recovery Room',
  CRITICAL: 'You are under close monitoring in Recovery Room',
  READY_FOR_TRANSFER: 'Clinical team has cleared you for ward transfer',
  TRANSFERRED: 'You have been transferred to ward',
  DISCHARGED: 'Recovery completed',
};

const STATUS_LABELS = {
  UNDER_OBSERVATION: 'Under Observation',
  STABLE: 'Stable',
  CRITICAL: 'Critical',
  READY_FOR_TRANSFER: 'Ready For Transfer',
  TRANSFERRED: 'Transferred',
  DISCHARGED: 'Recovery Completed',
};

const STATUS_STYLES = {
  UNDER_OBSERVATION: 'bg-amber-50 text-amber-600 border-amber-200',
  STABLE: 'bg-green-50 text-green-600 border-green-200',
  CRITICAL: 'bg-red-50 text-red-600 border-red-200',
  READY_FOR_TRANSFER: 'bg-blue-50 text-blue-600 border-blue-200',
  TRANSFERRED: 'bg-gray-50 text-gray-600 border-gray-200',
  DISCHARGED: 'bg-green-50 text-green-600 border-green-200',
};

const STEP_MAP = {
  UNDER_OBSERVATION: 1,
  CRITICAL: 1,
  STABLE: 2,
  READY_FOR_TRANSFER: 3,
  TRANSFERRED: 4,
  DISCHARGED: 4,
};

const STEPS = ['Recovery Room', 'Assessment Done', 'Ready For Transfer', 'Ward Transfer'];

function isActive(status) {
  return !['TRANSFERRED', 'DISCHARGED'].includes(status);
}

export default function PatientRecoveryStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchRecords = useCallback(async () => {
    try {
      setError(false);
      const r = await patientApi.get('/patient/portal/recovery');
      setData(r.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setLoading(true); fetchRecords(); }, [fetchRecords]);

  if (loading && !data) return <Skeleton />;

  const records = data?.recoveryRecords || [];
  const activeRecord = records.find((r) => isActive(r.status));

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-800">Recovery Status</h1>
        <p className="text-sm text-gray-400 mt-0.5">Track your post-surgery recovery and ward transfer progress</p>
      </div>

      {activeRecord && <ActiveBanner record={activeRecord} />}

      {error ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-500 font-medium">Something went wrong</p>
          <p className="text-xs text-gray-400 mt-1">Could not load recovery records</p>
          <button onClick={fetchRecords} className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm">Retry</button>
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-gray-400 font-medium">No recovery records found</p>
          <p className="text-xs text-gray-300 mt-1">Recovery information appears here after your surgery</p>
        </div>
      ) : (
        <div className="space-y-6">
          {records.map((r) => (
            <RecoveryCard key={r.id} record={r} />
          ))}
        </div>
      )}

      {records.length > 0 && (
        <div className="text-center">
          <a href="/patient/portal/ot-surgery" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 transition">
            View full surgery details →
          </a>
        </div>
      )}

    </div>
  );
}

function ActiveBanner({ record: r }) {
  return (
    <div className="bg-gradient-to-r from-amber-50 to-blue-50 rounded-2xl border border-amber-100 overflow-hidden shadow-sm">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-gray-800">Active Recovery</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-sm text-gray-500 mt-1">{STATUS_MESSAGES[r.status] || r.status}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-amber-100/50">
          <Info label="Admitted" value={r.admittedAt ? new Date(r.admittedAt).toLocaleString('en-IN') : '—'} />
          <Info label="Assigned Nurse" value={r.assignedNurse || 'Nurse will be assigned soon'} />
          <Info label="Pain Score" value={r.painScore != null ? `${r.painScore}/10` : '—'} />
          <Info label="Consciousness" value={r.consciousnessLevel || '—'} />
        </div>
      </div>
    </div>
  );
}

function RecoveryCard({ record: r }) {
  const currentStep = STEP_MAP[r.status] || 1;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">

      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          r.status === 'TRANSFERRED' || r.status === 'DISCHARGED' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
        }`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-800">Recovery Record</p>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusBadge status={r.status} />
            <span className="text-xs text-gray-400">{r.admittedAt?.slice(0, 10)}</span>
          </div>
        </div>
      </div>

      <div className="p-5">

        <Stepper currentStep={currentStep} status={r.status} />

        <VitalsCard record={r} />

        {r.assessments?.length > 0 && <AssessmentsSection assessments={r.assessments.slice(0, 3)} />}

        {(r.status === 'READY_FOR_TRANSFER' || r.status === 'TRANSFERRED') && (
          <TransferStatusCard record={r} />
        )}

        {r.recoveryNotes && (
          <div className="mt-5 p-4 rounded-xl bg-blue-50/50 border border-blue-100">
            <p className="text-xs font-bold text-gray-500 mb-1.5">Recovery Notes</p>
            <p className="text-sm text-gray-700">{r.recoveryNotes}</p>
          </div>
        )}

        {r.timeline?.length > 0 && <TimelineSection timeline={r.timeline} />}

      </div>
    </div>
  );
}

function Stepper({ currentStep, status }) {
  const isCompleted = status === 'TRANSFERRED' || status === 'DISCHARGED';
  return (
    <div className="mb-5">
      <div className="flex items-center">
        {STEPS.map((label, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < currentStep || (isCompleted && stepNum === currentStep);
          const isCurrent = stepNum === currentStep;
          return (
            <div key={i} className="flex-1 flex flex-col items-center relative">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 relative z-10 ${
                isDone ? 'bg-green-500 text-white' : isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-gray-100 text-gray-400'
              }`}>
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : stepNum}
              </div>
              <p className={`text-[10px] font-semibold mt-1.5 text-center leading-tight ${
                isDone ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'
              }`}>{label}</p>
              {i < STEPS.length - 1 && (
                <div className={`absolute top-4 left-[calc(50%+16px)] right-0 h-0.5 -translate-y-1/2 ${
                  isDone ? 'bg-green-400' : isCurrent && i === currentStep - 1 ? 'bg-blue-400' : 'bg-gray-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VitalsCard({ record: r }) {
  return (
    <div className="bg-gray-50/70 rounded-xl p-4 border border-gray-100">
      <p className="text-xs font-bold text-gray-500 mb-3">Latest Vitals</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Info label="BP" value={r.bpSystolic && r.bpDiastolic ? `${r.bpSystolic}/${r.bpDiastolic}` : '—'} />
        <Info label="Pulse" value={r.pulse != null ? `${r.pulse} bpm` : '—'} />
        <Info label="Temperature" value={r.temperature != null ? `${r.temperature}°F` : '—'} />
        <Info label="SpO2" value={r.spo2 != null ? `${r.spo2}%` : '—'} />
        <Info label="Respiratory Rate" value={r.respiratoryRate != null ? `${r.respiratoryRate} /min` : '—'} />
        <Info label="Pain Score" value={r.painScore != null ? `${r.painScore}/10` : '—'} />
        <Info label="Consciousness" value={r.consciousnessLevel || '—'} />
        <Info label="Surgical Site" value={r.surgicalSiteAssessment || '—'} />
      </div>
    </div>
  );
}

function AssessmentsSection({ assessments }) {
  return (
    <div className="mt-5">
      <p className="text-xs font-bold text-gray-500 mb-3">Assessments</p>
      <div className="space-y-2">
        {assessments.map((a, i) => (
          <div key={a.id || i} className="flex items-center justify-between bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-gray-400 font-medium w-28 shrink-0">{a.createdAt ? new Date(a.createdAt).toLocaleString('en-IN') : '—'}</span>
              <span className="font-semibold text-gray-700">
                {a.bpSystolic && a.bpDiastolic ? `${a.bpSystolic}/${a.bpDiastolic}` : '—'}
              </span>
              <span className="text-gray-500">{a.pulse != null ? `${a.pulse} bpm` : '—'}</span>
              <span className="text-gray-500">{a.spo2 != null ? `${a.spo2}%` : '—'}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {a.painScore != null && (
                <span className="text-gray-500">Pain: <span className="font-semibold text-gray-700">{a.painScore}/10</span></span>
              )}
              {a.consciousnessLevel && (
                <span className="text-gray-400">{a.consciousnessLevel}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransferStatusCard({ record: r }) {
  const isWaitingForBed = r.status === 'READY_FOR_TRANSFER' && !r.transferredAt;
  const isTransferred = r.status === 'TRANSFERRED' || r.transferredAt;

  return (
    <div className="mt-5">
      <p className="text-xs font-bold text-gray-500 mb-3">Transfer Status</p>
      <div className={`rounded-xl p-4 border ${
        isTransferred ? 'bg-green-50/50 border-green-100' : 'bg-blue-50/50 border-blue-100'
      }`}>
        {isWaitingForBed && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 animate-pulse">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">Hospital is arranging your ward bed</p>
          </div>
        )}
        {isTransferred && r.transferredTo && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Moved to: {r.transferredTo}</p>
              {r.transferredAt && <p className="text-xs text-gray-400 mt-0.5">{new Date(r.transferredAt).toLocaleString('en-IN')}</p>}
            </div>
          </div>
        )}

        {r.transfers?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-100 space-y-1.5">
            {r.transfers.map((t, i) => (
              <div key={t.id || i} className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <span className="font-medium text-gray-600">{t.fromLocation || 'Recovery'} → {t.toLocation || t.transferType}</span>
                {t.reason && <span className="text-gray-400">({t.reason})</span>}
                <span className="text-gray-400 ml-auto">{t.createdAt ? new Date(t.createdAt).toLocaleString('en-IN') : ''}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-400 mt-3 italic">Ward transfer is handled by hospital staff</p>
      </div>
    </div>
  );
}

function TimelineSection({ timeline }) {
  return (
    <div className="mt-5 pt-5 border-t border-gray-50">
      <p className="text-xs font-bold text-gray-500 mb-3">Timeline</p>
      <div className="space-y-0">
        {timeline.map((t, i) => (
          <div key={t.id || i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full shrink-0 mt-1 ring-2 ${
                i === 0 ? 'bg-blue-500 ring-blue-200' : 'bg-gray-300 ring-gray-100'
              }`} />
              {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-blue-100 min-h-[24px]" />}
            </div>
            <div className="flex-1 pb-3">
              <p className="text-sm font-semibold text-gray-700">{t.eventType}</p>
              {t.eventDescription && <p className="text-xs text-gray-500 mt-0.5">{t.eventDescription}</p>}
              <p className="text-xs text-gray-400 mt-0.5">{t.createdAt ? new Date(t.createdAt).toLocaleString('en-IN') : ''}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
      <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${STATUS_STYLES[status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
        {STATUS_LABELS[status] || status}
      </span>
  );
}

function Info({ label, value, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[11px] text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-semibold text-gray-700 mt-0.5">{value ?? '—'}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-gray-200 rounded-lg" />
      <div className="h-4 w-72 bg-gray-100 rounded-lg" />
      <div className="h-36 bg-gray-100 rounded-2xl" />
      <div className="h-96 bg-gray-100 rounded-2xl" />
    </div>
  );
}
