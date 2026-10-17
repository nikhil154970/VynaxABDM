import { useState, useEffect, useCallback } from 'react';
import patientApi from '../../utils/patientApi';
import { printSurgeryReport, downloadSurgeryReport } from '../../utils/printSurgeryReport';

const OT_STATUS_STYLES = {
  OT_REQUEST_CREATED: 'bg-gray-100 text-gray-600 border-gray-200',
  PAYMENT_PENDING: 'bg-amber-50 text-amber-600 border-amber-200',
  PAYMENT_COMPLETED: 'bg-blue-50 text-blue-600 border-blue-200',
  APPROVED_FOR_OT: 'bg-purple-50 text-purple-600 border-purple-200',
  RECEIVED_BY_OT: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  SCHEDULED: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  IN_PROGRESS: 'bg-orange-50 text-orange-600 border-orange-200',
  IN_RECOVERY: 'bg-teal-50 text-teal-600 border-teal-200',
  COMPLETED: 'bg-green-50 text-green-600 border-green-200',
};

const OT_STATUS_LABELS = {
  OT_REQUEST_CREATED: 'OT Request Created',
  PAYMENT_PENDING: 'OT Bill Generated',
  PAYMENT_COMPLETED: 'Payment Completed',
  APPROVED_FOR_OT: 'Approved For OT',
  RECEIVED_BY_OT: 'Received By OT',
  SCHEDULED: 'Surgery Scheduled',
  IN_PROGRESS: 'Surgery In Progress',
  IN_RECOVERY: 'In Recovery',
  COMPLETED: 'Completed',
};

const RECOVERY_STATUS_LABELS = {
  UNDER_OBSERVATION: 'Under Observation',
  STABLE: 'Stable',
  READY_FOR_TRANSFER: 'Ready for Ward Transfer',
  TRANSFERRED: 'Transferred to Ward',
};

const RECOVERY_STATUS_STYLES = {
  UNDER_OBSERVATION: 'bg-amber-50 text-amber-600 border-amber-200',
  STABLE: 'bg-green-50 text-green-600 border-green-200',
  READY_FOR_TRANSFER: 'bg-blue-50 text-blue-600 border-blue-200',
  TRANSFERRED: 'bg-gray-50 text-gray-600 border-gray-200',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'recovery', label: 'Recovery' },
];

function formatInr(amount) {
  return `₹${(amount || 0).toLocaleString('en-IN')}`;
}

function computeMedicineSummary(medicines) {
  if (!medicines?.length) return null;
  let totalIssued = 0;
  let totalUsed = 0;
  let totalReturned = 0;
  let netBillable = 0;
  for (const m of medicines) {
    for (const item of m.items || []) {
      totalIssued += item.lineIssuedTotal ?? item.quantityIssued * (item.unitPrice || 0);
      totalUsed += item.lineUsedTotal ?? item.quantityUsed * (item.unitPrice || 0);
      totalReturned += item.lineReturnedTotal ?? item.quantityReturned * (item.unitPrice || 0);
      netBillable += item.lineNetTotal ?? item.quantityUsed * (item.unitPrice || 0);
    }
  }
  return { totalIssued, totalUsed, totalReturned, netBillable };
}

function isActiveStatus(status) {
  return !['OT_REQUEST_CREATED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'COMPLETED'].includes(status);
}

function buildTimeline(o) {
  const events = (o.statusHistory || []).map((h) => ({
    type: 'status',
    label: OT_STATUS_LABELS[h.status] || h.status,
    date: h.createdAt,
    status: h.status,
  }));

  const rc = o.schedule?.session?.recoveryRecord;
  if (rc) {
    if (rc.admittedAt) events.push({ type: 'recovery', label: 'Recovery Started', date: rc.admittedAt, status: 'RECOVERY' });
    if (rc.dischargedAt) events.push({ type: 'recovery', label: 'Recovery Completed', date: rc.dischargedAt, status: 'RECOVERY_DONE' });
    if (rc.transferredAt) events.push({ type: 'transfer', label: 'Ward Transfer', date: rc.transferredAt, status: 'TRANSFERRED' });
  }

  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  return events;
}

export default function PatientOtSurgery() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setError(false);
      const r = await patientApi.get('/patient/portal/ot-surgery', { params: { filter } });
      setData(r.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { setLoading(true); fetchRequests(); }, [fetchRequests]);

  const openDetail = async (id) => {
    setDetailLoading(true); setDetailOpen(true);
    try {
      const r = await patientApi.get(`/patient/portal/ot-surgery/${id}`);
      setDetail(r.data.otRequest);
    } catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

  const closeDetail = () => { setDetailOpen(false); setDetail(null); };

  const handlePrintReport = () => {
    if (!detail) return;
    printSurgeryReport({
      requestNumber: detail.requestNumber,
      diagnosis: detail.diagnosis,
      surgeryRecommendation: detail.surgeryRecommendation,
      priority: detail.priority,
      ipdNumber: detail.admission?.ipdNumber,
      patient: {
        name: detail.patient?.name || detail.patientName || detail.admission?.patientName,
        uhid: detail.patient?.uhid || detail.uhid,
        age: detail.patient?.age || detail.patientAge || detail.admission?.patientAge,
        gender: detail.patient?.gender || detail.patientGender || detail.admission?.patientGender,
        bloodGroup: detail.patient?.bloodGroup || detail.patientBloodGroup || detail.admission?.patientBloodGroup,
        mobile: detail.patient?.mobile || detail.patientMobile || detail.admission?.patientMobile,
      },
      doctor: detail.doctor,
      schedule: detail.schedule,
      postSurgeryNote: detail.schedule?.session?.postSurgeryNote,
    });
  };

  const handleDownloadReport = () => {
    if (!detail) return;
    downloadSurgeryReport({
      requestNumber: detail.requestNumber,
      diagnosis: detail.diagnosis,
      surgeryRecommendation: detail.surgeryRecommendation,
      priority: detail.priority,
      ipdNumber: detail.admission?.ipdNumber,
      patient: {
        name: detail.patient?.name || detail.patientName || detail.admission?.patientName,
        uhid: detail.patient?.uhid || detail.uhid,
        age: detail.patient?.age || detail.patientAge || detail.admission?.patientAge,
        gender: detail.patient?.gender || detail.patientGender || detail.admission?.patientGender,
        bloodGroup: detail.patient?.bloodGroup || detail.patientBloodGroup || detail.admission?.patientBloodGroup,
        mobile: detail.patient?.mobile || detail.patientMobile || detail.admission?.patientMobile,
      },
      doctor: detail.doctor,
      schedule: detail.schedule,
      postSurgeryNote: detail.schedule?.session?.postSurgeryNote,
    }, `surgery-report-${detail.requestNumber}`);
  };

  if (loading && !data) return <Skeleton />;

  const requests = data?.otRequests || [];
  const currentSurgery = data?.currentSurgery;
  const stats = data?.stats || {};

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">OT & Surgery</h1>
        <p className="text-sm text-gray-400 mt-0.5">Track your complete surgery journey</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="OT Requests" value={stats.total ?? 0} color="blue" />
        <StatCard label="Scheduled Surgeries" value={stats.scheduled ?? 0} color="amber" />
        <StatCard label="Completed Surgeries" value={stats.completed ?? 0} color="green" />
        <StatCard label="Recovery Status" value={stats.recovery ?? 0} color="purple" />
      </div>

      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              filter === f.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {currentSurgery && filter !== 'completed' && filter !== 'recovery' && (
        <CurrentSurgeryCard surgery={currentSurgery} onViewDetails={() => openDetail(currentSurgery.id)} />
      )}

      {error ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-500 font-medium">Something went wrong</p>
          <p className="text-xs text-gray-400 mt-1">Could not load OT & Surgery records</p>
          <button onClick={fetchRequests} className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm">Retry</button>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-gray-400 font-medium">No OT records found</p>
          <p className="text-xs text-gray-300 mt-1">Surgery records will appear here once an OT request is created</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((o) => (
            <SurgeryCard key={o.id} request={o} onViewDetails={openDetail} />
          ))}
        </div>
      )}

      {detailOpen && (
        <DetailDrawer
          detail={detail}
          loading={detailLoading}
          onClose={closeDetail}
          onPrint={handlePrintReport}
          onDownload={handleDownloadReport}
        />
      )}
    </div>
  );
}

function CurrentSurgeryCard({ surgery: o, onViewDetails }) {
  const scheduleInfo = o.schedule;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
      <div className="px-5 py-4 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-blue-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-gray-800">Current Surgery</p>
            <p className="text-xs text-gray-400">{o.requestNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={o.status} />
          {o.status === 'IN_RECOVERY' && o.schedule?.session?.recoveryRecord && (
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${RECOVERY_STATUS_STYLES[o.schedule.session.recoveryRecord.status] || 'bg-teal-50 text-teal-600 border-teal-200'}`}>
              {RECOVERY_STATUS_LABELS[o.schedule.session.recoveryRecord.status] || o.schedule.session.recoveryRecord.status}
            </span>
          )}
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Info label="Surgery" value={o.surgeryRecommendation || '—'} />
          <Info label="Diagnosis" value={o.diagnosis || '—'} />
          <Info label="Priority" value={o.priority || '—'} />
          <Info label="Doctor" value={o.doctor || '—'} />
          {scheduleInfo && (
            <>
              <Info label="Scheduled Date" value={scheduleInfo.surgeryDate?.slice(0, 10) || '—'} />
              <Info label="Time" value={scheduleInfo.startTime || '—'} />
              <Info label="Room" value={scheduleInfo.room || '—'} />
              <Info label="Surgeon" value={scheduleInfo.surgeon || '—'} />
            </>
          )}
        </div>

        {o.medicines?.length > 0 && (
          <div className="mt-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
              Medicines: {o.medicines.length} Issue{o.medicines.length > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {(o.statusHistory?.length > 0 || o.schedule?.session?.recoveryRecord) && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-bold text-gray-500 mb-3">Timeline</p>
            <div className="flex flex-wrap gap-2">
              {o.statusHistory.map((h, i) => (
                <span key={i} className={`text-xs px-3 py-1 rounded-full border ${
                  h.status === o.status ? 'bg-blue-100 text-blue-700 border-blue-200 font-semibold' : 'bg-gray-50 text-gray-400 border-gray-100'
                }`}>
                  {OT_STATUS_LABELS[h.status] || h.status}
                </span>
              ))}
              {o.schedule?.session?.recoveryRecord?.admittedAt && o.status === 'IN_RECOVERY' && (
                <span className="text-xs px-3 py-1 rounded-full border bg-teal-100 text-teal-700 border-teal-200 font-semibold">
                  Recovery Started
                </span>
              )}
            </div>
          </div>
        )}

        <button
          onClick={onViewDetails}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm transition"
        >
          View Surgery Details
        </button>
      </div>
    </div>
  );
}

function SurgeryCard({ request: o, onViewDetails }) {
  return (
    <div
      onClick={() => onViewDetails(o.id)}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            o.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
          }`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-gray-800">{o.requestNumber}</p>
              <StatusBadge status={o.status} />
              {o.priority === 'High' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">High Priority</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{o.surgeryRecommendation || o.diagnosis || ''}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
              <span>Created: {o.createdAt?.slice(0, 10)}</span>
              {o.doctor && <span>Dr. {o.doctor}</span>}
              {o.schedule?.surgeryDate && <span>Scheduled: {o.schedule.surgeryDate?.slice(0, 10)}</span>}
              {o.medicines?.length > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                  {o.medicines.length} Issue{o.medicines.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

function DetailDrawer({ detail, loading, onClose, onPrint, onDownload }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (loading) {
    return (
      <>
        <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
        <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 overflow-y-auto">
          <DrawerHeader title="Surgery Details" onClose={onClose} />
          <div className="p-6 space-y-4 animate-pulse">
            <div className="h-16 bg-gray-100 rounded-xl" />
            <div className="h-32 bg-gray-100 rounded-xl" />
            <div className="h-40 bg-gray-100 rounded-xl" />
            <div className="h-48 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
        <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 overflow-y-auto">
          <DrawerHeader title="Surgery Details" onClose={onClose} />
          <div className="p-6 text-center text-gray-400 py-20">Surgery record not found</div>
        </div>
      </>
    );
  }

  const s = detail.schedule || {};
  const session = s.session || {};
  const note = session.postSurgeryNote;
  const rc = session.recoveryRecord;
  const bill = detail.bill;
  const timeline = buildTimeline(detail);
  const hasReport = note && note.procedureSummary;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 transition-opacity" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 transform transition-transform duration-300 overflow-y-auto md:max-w-lg">
        <DrawerHeader title="Surgery Details" onClose={onClose} />

        <div className="p-6 space-y-6">

          <div className="flex items-center gap-3 pb-4 border-b border-gray-50">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              detail.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
            }`}>OT</div>
            <div className="min-w-0">
              <p className="font-bold text-gray-800 truncate">{detail.requestNumber}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge status={detail.status} />
                {detail.priority === 'High' && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">High Priority</span>
                )}
              </div>
            </div>
          </div>

          <Section title="Surgery Details">
            <div className="grid grid-cols-2 gap-4">
              <Info label="Request Number" value={detail.requestNumber} />
              <Info label="Diagnosis" value={detail.diagnosis || '—'} />
              <Info label="Surgery" value={detail.surgeryRecommendation || '—'} />
              <Info label="Priority" value={detail.priority || '—'} />
              <Info label="IPD Number" value={detail.admission?.ipdNumber || detail.ipdNumber || '—'} />
              <Info label="Expected Date" value={detail.expectedSurgeryDate?.slice(0, 10) || '—'} />
              <Info label="Request Date" value={detail.createdAt?.slice(0, 10) || '—'} />
              <Info label="Last Updated" value={detail.updatedAt?.slice(0, 10) || '—'} />
            </div>
          </Section>

          <Section title="Patient Information">
            <div className="grid grid-cols-2 gap-4">
              <Info label="Name" value={detail.patient?.name || detail.patientName || detail.admission?.patientName || '—'} />
              <Info label="UHID" value={detail.patient?.uhid || detail.uhid || '—'} />
              <Info label="Age" value={detail.patient?.age != null ? `${detail.patient.age} yrs` : detail.patientAge ? `${detail.patientAge} yrs` : detail.admission?.patientAge ? `${detail.admission.patientAge} yrs` : '—'} />
              <Info label="Gender" value={detail.patient?.gender || detail.patientGender || detail.admission?.patientGender || '—'} />
              {detail.patient?.bloodGroup && <Info label="Blood Group" value={detail.patient.bloodGroup} />}
              {detail.patient?.mobile && <Info label="Mobile" value={detail.patient.mobile} />}
            </div>
          </Section>

          {detail.admission && (
            <Section title="Admission Information">
              <div className="grid grid-cols-2 gap-4">
                <Info label="Department" value={detail.admission.department || '—'} />
                <Info label="Admission Date" value={detail.admission.admissionDate?.slice(0, 10) || '—'} />
                <Info label="Ward" value={detail.admission.ward || '—'} />
                <Info label="Bed" value={detail.admission.bed || '—'} />
              </div>
            </Section>
          )}

          <Section title="Medical Team">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <TeamMember
                icon="S" color="bg-blue-100 text-blue-600"
                name={s.surgeon?.name} label="Primary Surgeon"
                detail={s.surgeon?.specialization}
              />
              <TeamMember
                icon="A" color="bg-indigo-100 text-indigo-600"
                name={s.assistantSurgeon?.name} label="Assistant Surgeon"
                detail={s.assistantSurgeon?.specialization}
              />
              <TeamMember
                icon="AN" color="bg-purple-100 text-purple-600"
                name={s.anaesthetist?.name} label="Anaesthetist"
                detail={s.anaesthetist?.specialization}
              />
              <TeamMember
                icon="N" color="bg-amber-100 text-amber-600"
                name={s.otNurse?.name} label="OT Nurse"
              />
            </div>
          </Section>

          {s.room?.name && (
            <Section title="OT Room">
              <div className="grid grid-cols-2 gap-4">
                <Info label="Room" value={`${s.room.name || ''}${s.room.number ? ` (${s.room.number})` : ''}`} />
                <Info label="Floor" value={s.room.floor || '—'} />
                <Info label="Date" value={s.surgeryDate?.slice(0, 10) || '—'} />
                <Info label="Time" value={s.startTime || '—'} />
                <Info label="Duration" value={s.estimatedDuration ? `${s.estimatedDuration} min` : '—'} />
                <Info label="Status" value={s.status || '—'} />
              </div>
            </Section>
          )}

          {bill && (
            <Section title="Billing Information">
              <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Bill Number" value={bill.billNumber || '—'} />
                  <Info label="Total Amount" value={bill.totalAmount != null ? `₹${bill.totalAmount?.toLocaleString('en-IN')}` : '—'} />
                  <Info label="Status" value={bill.status || '—'} />
                  <Info label="Date" value={bill.createdAt?.slice(0, 10) || '—'} />
                </div>
              </div>
            </Section>
          )}

          {timeline.length > 0 && (
            <Section title="OT Timeline">
              <div className="space-y-0">
                {timeline.map((ev, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full shrink-0 mt-1 ring-2 ${
                        ev.status === detail.status || (ev.type === 'recovery' && rc?.status === 'UNDER_OBSERVATION')
                          ? 'bg-blue-500 ring-blue-200' : 'bg-gray-300 ring-gray-100'
                      }`} />
                      {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-blue-100 min-h-[24px]" />}
                    </div>
                    <div className="flex-1 pb-3">
                      <p className={`text-sm font-semibold ${
                        ev.status === detail.status || (ev.type === 'recovery' && rc?.status === 'UNDER_OBSERVATION')
                          ? 'text-blue-700' : 'text-gray-600'
                      }`}>{ev.label}</p>
                      <p className="text-xs text-gray-400">{ev.date ? new Date(ev.date).toLocaleString('en-IN') : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {detail.preOpAssessment && (
            <Section title="Pre-Operative Assessment">
              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Assessment Date" value={detail.preOpAssessment.assessmentDate?.slice(0, 10) || '—'} />
                  <Info label="Assessed By" value={detail.preOpAssessment.assessedBy || '—'} />
                  <Info label="BP" value={detail.preOpAssessment.bpSystolic && detail.preOpAssessment.bpDiastolic ? `${detail.preOpAssessment.bpSystolic}/${detail.preOpAssessment.bpDiastolic}` : '—'} />
                  <Info label="Pulse" value={detail.preOpAssessment.pulse ? `${detail.preOpAssessment.pulse} bpm` : '—'} />
                  <Info label="SpO2" value={detail.preOpAssessment.spo2 ? `${detail.preOpAssessment.spo2}%` : '—'} />
                  <Info label="Temperature" value={detail.preOpAssessment.temperature ? `${detail.preOpAssessment.temperature}°F` : '—'} />
                  <Info label="BMI" value={detail.preOpAssessment.bmi ? detail.preOpAssessment.bmi.toFixed(1) : '—'} />
                  <Info label="Allergies" value={detail.preOpAssessment.knownAllergies || 'None'} />
                </div>
                {detail.preOpAssessment.nurseNotes && (
                  <div className="pt-2 border-t border-blue-100">
                    <p className="text-[11px] text-gray-400 font-medium mb-1">Nurse Notes</p>
                    <p className="text-sm text-gray-700">{detail.preOpAssessment.nurseNotes}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {hasReport && (
            <Section title="Surgery Report">
              <div className="bg-green-50/50 rounded-xl p-4 border border-green-100 space-y-3">
                {note.preOperativeDiagnosis && <Info label="Pre-Operative Diagnosis" value={note.preOperativeDiagnosis} />}
                {note.postOperativeDiagnosis && <Info label="Post-Operative Diagnosis" value={note.postOperativeDiagnosis} />}
                {note.procedureSummary && <Info label="Procedure Performed" value={note.procedureSummary} />}
                {note.operationFindings && <Info label="Findings" value={note.operationFindings} />}
                {note.anaesthesiaType && <Info label="Anaesthesia Type" value={note.anaesthesiaType} />}
                <div className="grid grid-cols-2 gap-3">
                  {note.complications && <Info label="Complications" value={note.complications} />}
                  {note.bloodLoss && <Info label="Blood Loss" value={note.bloodLoss} />}
                  {note.implantsUsed && <Info label="Implants Used" value={note.implantsUsed} />}
                  {note.specimenCollected && <Info label="Specimen" value={note.specimenCollected} />}
                </div>
                {note.surgeryOutcome && <Info label="Outcome" value={note.surgeryOutcome} />}
                {note.surgeonNotes && <Info label="Surgeon Notes" value={note.surgeonNotes} />}
                {note.specialInstructions && <Info label="Special Instructions" value={note.specialInstructions} />}
                {note.followUpInstructions && <Info label="Follow-Up" value={note.followUpInstructions} />}
              </div>
            </Section>
          )}

          {detail.medicines?.length > 0 && (() => {
            const medSummary = computeMedicineSummary(detail.medicines);
            return (
            <Section title="OT Medicines & Supplies">
              <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 space-y-3">
                {medSummary && (
                  <div className="grid grid-cols-2 gap-3 mb-1">
                    <div className="rounded-xl bg-white border border-indigo-100 px-3 py-2.5">
                      <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide">Issued to OT</p>
                      <p className="text-sm font-bold text-indigo-800 mt-0.5">{formatInr(medSummary.totalIssued)}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-indigo-100 px-3 py-2.5">
                      <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide">Used in Surgery</p>
                      <p className="text-sm font-bold text-indigo-800 mt-0.5">{formatInr(medSummary.totalUsed)}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-indigo-100 px-3 py-2.5">
                      <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide">Returned</p>
                      <p className="text-sm font-bold text-emerald-700 mt-0.5">{formatInr(medSummary.totalReturned)}</p>
                    </div>
                    <div className="rounded-xl bg-indigo-600 border border-indigo-600 px-3 py-2.5">
                      <p className="text-[10px] font-semibold text-indigo-200 uppercase tracking-wide">Net Medicine Charges</p>
                      <p className="text-sm font-bold text-white mt-0.5">{formatInr(medSummary.netBillable)}</p>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-indigo-500/80 leading-relaxed">
                  Amounts are from OT pharmacy issue records. Final hospital bill may include other OT/IPD charges.
                </p>
                {detail.medicines.map((m) => (
                  <div key={m.id} className="border-b border-indigo-100 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-indigo-700">{m.issueNumber}</p>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        m.status === 'REQUESTED' ? 'bg-yellow-100 text-yellow-800' :
                        m.status === 'ISSUED' ? 'bg-blue-100 text-blue-800' :
                        m.status === 'IN_USE' ? 'bg-indigo-100 text-indigo-800' :
                        m.status === 'CLOSED' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                      }`}>{m.status}</span>
                    </div>
                    <table className="w-full mt-1 text-[10px]">
                      <thead><tr className="text-left text-slate-400">
                        <th className="pr-2">Medicine</th>
                        <th className="pr-2 text-right">Requested</th>
                        <th className="pr-2 text-right">Issued</th>
                        <th className="pr-2 text-right">Used</th>
                        <th className="pr-2 text-right">Returned</th>
                        <th className="text-right">Amount</th>
                      </tr></thead>
                      <tbody>
                        {m.items.map((item) => (
                          <tr key={item.id} className="text-slate-700">
                            <td className="pr-2 font-medium">{item.medicineName}</td>
                            <td className="pr-2 text-right">{item.quantityRequested}</td>
                            <td className="pr-2 text-right">{item.quantityIssued}</td>
                            <td className="pr-2 text-right">{item.quantityUsed}</td>
                            <td className="pr-2 text-right">{item.quantityReturned}</td>
                            <td className="text-right font-medium">{formatInr(item.lineNetTotal ?? item.quantityUsed * (item.unitPrice || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </Section>
            );
          })()}

          {rc && (
            <Section title="Recovery Status">
              <div className={`rounded-xl p-4 border ${
                rc.status === 'UNDER_OBSERVATION' ? 'bg-amber-50/50 border-amber-100' :
                rc.status === 'STABLE' ? 'bg-green-50/50 border-green-100' :
                rc.status === 'READY_FOR_TRANSFER' ? 'bg-blue-50/50 border-blue-100' :
                rc.status === 'TRANSFERRED' ? 'bg-gray-50/50 border-gray-200' : 'bg-green-50/50 border-green-100'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-700">Recovery Room</p>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${RECOVERY_STATUS_STYLES[rc.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {RECOVERY_STATUS_LABELS[rc.status] || rc.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Info label="Assigned Nurse" value={rc.assignedNurse?.name || '—'} />
                  <Info label="Pain Score" value={rc.painScore != null ? `${rc.painScore}/10` : '—'} />
                  <Info label="Consciousness" value={rc.consciousnessLevel || '—'} />
                  <Info label="SpO2" value={rc.spo2 != null ? `${rc.spo2}%` : '—'} />
                  <Info label="BP" value={rc.bpSystolic && rc.bpDiastolic ? `${rc.bpSystolic}/${rc.bpDiastolic}` : '—'} />
                  <Info label="Pulse" value={rc.pulse ? `${rc.pulse} bpm` : '—'} />
                </div>

                {rc.recoveryNotes && <Info label="Recovery Notes" value={rc.recoveryNotes} className="mt-2" />}

                {rc.transferredTo && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[11px] text-gray-400 font-medium mb-2">Ward Transfer</p>
                    <div className="bg-white rounded-lg px-3 py-2 text-sm text-gray-700 border border-gray-100">
                      <span className="font-semibold">Transferred to:</span> {rc.transferredTo}
                      {rc.transferredAt && <span className="text-gray-400 ml-2">· {new Date(rc.transferredAt).toLocaleString('en-IN')}</span>}
                    </div>
                  </div>
                )}

                {rc.timeline?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[11px] text-gray-400 font-medium mb-2">Recovery Timeline</p>
                    <div className="space-y-1.5">
                      {rc.timeline.map((ev, i) => (
                        <div key={ev.id || i} className="flex items-start gap-2 text-xs text-gray-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 mt-1" />
                          <div>
                            <span className="font-medium text-gray-600">{ev.eventType}</span>
                            {ev.eventDescription && <span> — {ev.eventDescription}</span>}
                            <span className="text-gray-400 ml-1">{ev.createdAt ? new Date(ev.createdAt).toLocaleString('en-IN') : ''}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rc.assessments?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[11px] text-gray-400 font-medium mb-2">Latest Assessment</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Info label="BP" value={rc.assessments[0].bpSystolic && rc.assessments[0].bpDiastolic ? `${rc.assessments[0].bpSystolic}/${rc.assessments[0].bpDiastolic}` : '—'} />
                      <Info label="Pain Score" value={rc.assessments[0].painScore != null ? `${rc.assessments[0].painScore}/10` : '—'} />
                      <Info label="Consciousness" value={rc.assessments[0].consciousnessLevel || '—'} />
                      <Info label="SpO2" value={rc.assessments[0].spo2 != null ? `${rc.assessments[0].spo2}%` : '—'} />
                    </div>
                  </div>
                )}

                <a
                  href="/patient/portal/recovery"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
                >
                  View full recovery details →
                </a>
              </div>
            </Section>
          )}

          {hasReport && (
            <div className="border-t border-gray-50 pt-5">
              <div className="flex gap-3">
                <button
                  onClick={onPrint}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Report
                </button>
                <button
                  onClick={onDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TeamMember({ icon, color, name, label, detail }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-sm font-bold shrink-0`}>{icon}</div>
      <div>
        <p className="text-sm font-semibold text-gray-800">{name || '—'}</p>
        <p className="text-[11px] text-gray-500">{label}{detail ? ` · ${detail}` : ''}</p>
      </div>
    </div>
  );
}

function DrawerHeader({ title, onClose }) {
  return (
    <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
      <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-50 transition text-gray-400 hover:text-gray-600">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${OT_STATUS_STYLES[status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {OT_STATUS_LABELS[status] || status}
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

function StatCard({ label, value, color }) {
  const colors = {
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    purple: 'text-violet-600',
    amber: 'text-amber-600',
    gray: 'text-gray-500',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className={`text-2xl md:text-3xl font-extrabold ${colors[color] || 'text-blue-600'}`}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-1 font-medium">{label}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-gray-200 rounded-lg" />
      <div className="h-4 w-72 bg-gray-100 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 w-28 bg-gray-100 rounded-lg" />)}
      </div>
      <div className="h-48 bg-gray-100 rounded-2xl" />
      <div className="space-y-3">
        {[1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
      </div>
    </div>
  );
}
