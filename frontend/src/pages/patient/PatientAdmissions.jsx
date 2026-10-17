import { useState, useEffect, useCallback } from 'react';
import patientApi from '../../utils/patientApi';

const STATUS_STYLES = {
  ADMITTED: 'bg-blue-50 text-blue-600 border-blue-100',
  UNDER_TREATMENT: 'bg-amber-50 text-amber-600 border-amber-100',
  DISCHARGE_REQUESTED: 'bg-purple-50 text-purple-600 border-purple-100',
  READY_FOR_DISCHARGE: 'bg-green-50 text-green-600 border-green-100',
};

const STATUS_LABELS = {
  ADMITTED: 'Admitted',
  UNDER_TREATMENT: 'Under Treatment',
  DISCHARGE_REQUESTED: 'Discharge Requested',
  READY_FOR_DISCHARGE: 'Ready for Discharge',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'current', label: 'Current' },
  { key: 'past', label: 'Past' },
  { key: 'discharged', label: 'Discharged' },
];

export default function PatientAdmissions() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchAdmissions = useCallback(async () => {
    try {
      setError(false);
      const r = await patientApi.get('/patient/portal/admissions', { params: { filter } });
      setData(r.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { setLoading(true); fetchAdmissions(); }, [fetchAdmissions]);

  const openDetail = async (id) => {
    setDetailLoading(true); setDetailOpen(true);
    try {
      const r = await patientApi.get(`/patient/portal/admissions/${id}`);
      setDetail(r.data.admission);
    } catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

  const closeDetail = () => { setDetailOpen(false); setDetail(null); };

  if (loading && !data) return <Skeleton />;

  const admissions = data?.admissions || [];
  const currentAdmission = data?.currentAdmission;
  const stats = data?.stats || {};

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Admissions</h1>
        <p className="text-sm text-gray-400 mt-0.5">Track your hospital stay, ward, bed and care team</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Current Admissions" value={stats.current ?? 0} color="text-blue-600" />
        <StatCard label="Past Admissions" value={stats.past ?? 0} color="text-gray-500" />
        <StatCard label="Discharged" value={stats.discharged ?? 0} color="text-emerald-600" />
        <StatCard label="Active" value={stats.active ?? 0} color="text-violet-600" />
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

      {currentAdmission && filter !== 'past' && filter !== 'discharged' && (
        <CurrentAdmissionCard admission={currentAdmission} onViewDetails={() => openDetail(currentAdmission.id)} />
      )}

      {error ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-500 font-medium">Something went wrong</p>
          <p className="text-xs text-gray-400 mt-1">Could not load admissions</p>
          <button onClick={fetchAdmissions} className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm">Retry</button>
        </div>
      ) : admissions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
          </svg>
          <p className="text-gray-400 font-medium">No admissions found</p>
          <p className="text-xs text-gray-300 mt-1">Admission records will appear here once you are admitted</p>
        </div>
      ) : (
        <div className="space-y-3">
          {admissions.map((a) => (
            <AdmissionCard key={a.id} admission={a} onViewDetails={openDetail} />
          ))}
        </div>
      )}

      {detailOpen && <DetailDrawer detail={detail} loading={detailLoading} onClose={closeDetail} />}
    </div>
  );
}

function CurrentAdmissionCard({ admission: a, onViewDetails }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
      <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-blue-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-gray-800">Current Admission</p>
            <p className="text-xs text-gray-400">{a.ipdNumber || 'IPD'}{a.department ? ` — ${a.department}` : ''}</p>
          </div>
        </div>
        <StatusBadge status={a.status} />
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Info label="Admission Date" value={a.admissionDate?.slice(0, 10)} />
          <Info label="Type" value={a.admissionType || '—'} />
          <Info label="Ward" value={a.ward || '—'} />
          <Info label="Bed" value={a.bed || '—'} />
          <Info label="Doctor" value={a.doctor || '—'} />
          <div>
            <p className="text-[11px] text-gray-400 font-medium">Nurse</p>
            {a.nurse ? (
              <p className="text-sm font-semibold text-gray-700 mt-0.5">{a.nurse}</p>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 mt-0.5">
                Nurse assignment in progress
              </span>
            )}
          </div>
          <Info label="Department" value={a.department || '—'} />
          <div>
            <p className="text-[11px] text-gray-400 font-medium">Condition</p>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border mt-0.5 inline-block ${
              a.clinicalCondition === 'CRITICAL' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'
            }`}>{a.clinicalCondition || '—'}</span>
          </div>
        </div>
        {a.transfers?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-bold text-gray-500 mb-2">Transfer History</p>
            <div className="flex flex-wrap gap-2">
              {a.transfers.map((t, i) => (
                <span key={i} className="text-xs bg-gray-50 rounded-lg px-3 py-1.5 text-gray-600 border border-gray-100">
                  {t.fromWard || t.from || 'Admission'} → {t.toWard || t.to}{t.reason ? ` (${t.reason})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
        <button onClick={onViewDetails} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm transition">
          View Admission Details
        </button>
      </div>
    </div>
  );
}

function AdmissionCard({ admission: a, onViewDetails }) {
  const isActive = !a.dischargeDate && a.status !== 'READY_FOR_DISCHARGE';
  return (
    <div onClick={() => onViewDetails(a.id)} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition cursor-pointer">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-gray-800">{a.ipdNumber || 'Admission'}</p>
              <StatusBadge status={a.status} />
              {a.clinicalCondition === 'CRITICAL' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">Critical</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{a.department || ''}{a.department && a.admissionType ? ' · ' : ''}{a.admissionType || ''}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
              <span>Admitted: {a.admissionDate?.slice(0, 10) || '—'}</span>
              <span>Ward: {a.ward || '—'}</span>
              <span>Bed: {a.bed || '—'}</span>
              {a.dischargeDate && <span>Discharged: {a.dischargeDate?.slice(0, 10)}</span>}
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

function DetailDrawer({ detail, loading, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 transition-opacity" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 transform transition-transform duration-300 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-800">Admission Details</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-50 transition text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-4 animate-pulse">
            <div className="h-16 bg-gray-100 rounded-xl" />
            <div className="h-32 bg-gray-100 rounded-xl" />
            <div className="h-40 bg-gray-100 rounded-xl" />
            <div className="h-48 bg-gray-100 rounded-xl" />
          </div>
        ) : !detail ? (
          <div className="p-6 text-center text-gray-400 py-20">Admission not found</div>
        ) : (
          <div className="p-6 space-y-6">

            {/* IPD header */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-50">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                detail.status !== 'READY_FOR_DISCHARGE' && !detail.dischargeDate
                  ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
              }`}>
                {detail.ipdNumber ? detail.ipdNumber.slice(-4) : 'IPD'}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-800 truncate">{detail.ipdNumber || 'Admission'}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={detail.status} />
                  {detail.clinicalCondition === 'CRITICAL' && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">Critical</span>
                  )}
                </div>
              </div>
            </div>

            {/* Admission Information */}
            <Section title="Admission Information">
              <div className="grid grid-cols-2 gap-4">
                <Info label="IPD Number" value={detail.ipdNumber || '—'} />
                <Info label="UHID" value={detail.uhid || '—'} />
                <Info label="Admission Date" value={detail.admissionDate?.slice(0, 10) || '—'} />
                <Info label="Type" value={detail.admissionType || '—'} />
                <Info label="Department" value={detail.department || '—'} />
                <Info label="Condition" value={detail.clinicalCondition || '—'} />
                {detail.dischargeDate && <Info label="Discharge Date" value={detail.dischargeDate?.slice(0, 10)} />}
                {detail.notesText && <Info label="Notes" value={detail.notesText} className="col-span-2" />}
              </div>
            </Section>

            {/* Patient Information */}
            <Section title="Patient Information">
              <div className="grid grid-cols-2 gap-4">
                <Info label="Name" value={detail.patientName || '—'} />
                <Info label="Mobile" value={detail.patientMobile || '—'} />
                <Info label="Age" value={detail.patientAge != null ? `${detail.patientAge} yrs` : '—'} />
                <Info label="Gender" value={detail.patientGender || '—'} />
                <Info label="Blood Group" value={detail.patientBloodGroup || '—'} />
                <Info label="Weight" value={detail.patientWeight ? `${detail.patientWeight} kg` : '—'} />
                {detail.patientAddress && <Info label="Address" value={detail.patientAddress} className="col-span-2" />}
              </div>
            </Section>

            {/* Ward & Bed */}
            <Section title="Ward & Bed Information">
              <div className="bg-blue-50/30 rounded-xl p-4 border border-blue-100">
                <div className="grid grid-cols-2 gap-4">
                  <Info label="Ward Name" value={detail.ward?.name || '—'} />
                  <Info label="Ward Type" value={detail.ward?.type || '—'} />
                  <Info label="Bed Number" value={detail.bed?.code || '—'} />
                  <Info label="Bed Status" value={detail.bed?.status || '—'} />
                </div>
              </div>
            </Section>

            {/* Care Team */}
            <Section title="Assigned Care Team">
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
                    {detail.doctor?.name?.charAt(0) || 'D'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">Dr. {detail.doctor?.name || '—'}</p>
                    <p className="text-xs text-gray-500">{detail.doctor?.specialization || 'Doctor'}</p>
                  </div>
                  {detail.doctor?.phone && <span className="text-xs text-gray-400 shrink-0">{detail.doctor.phone}</span>}
                </div>
                <div className="border-t border-gray-200 pt-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold shrink-0">
                    {detail.nurse?.name?.charAt(0) || 'N'}
                  </div>
                  <div className="flex-1 min-w-0">
                    {detail.nurse?.name ? (
                      <>
                        <p className="font-semibold text-gray-800 truncate">{detail.nurse.name}</p>
                        <p className="text-xs text-gray-500">Assigned Nurse</p>
                      </>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-gray-400">—</p>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 mt-1">
                          Nurse assignment in progress
                        </span>
                      </div>
                    )}
                  </div>
                  {detail.nurse?.phone && <span className="text-xs text-gray-400 shrink-0">{detail.nurse.phone}</span>}
                </div>
              </div>
            </Section>

            {/* Transfer History */}
            {detail.transfers?.length > 0 && (
              <Section title="Transfer History">
                <div className="space-y-3">
                  {detail.transfers.map((t, i) => (
                    <div key={t.id || i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0 mt-1 ring-2 ring-blue-100" />
                        {i < detail.transfers.length - 1 && <div className="w-0.5 flex-1 bg-blue-200 min-h-[24px]" />}
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-700">
                            {t.fromWard || t.fromBed ? `${t.fromWard || ''}${t.fromBed ? ` (${t.fromBed})` : ''}` : 'Admission'}
                          </span>
                          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                          <span className="text-sm font-semibold text-gray-700">
                            {t.toWard || ''}{t.toBed ? ` (${t.toBed})` : ''}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t.date ? new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                          {t.reason ? ` · ${t.reason}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* OT Requests */}
            {detail.otRequests?.length > 0 && (
              <Section title="OT / Surgery Requests">
                <div className="space-y-2">
                  {detail.otRequests.map((o) => (
                    <div key={o.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 border border-amber-100">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-700 truncate">{o.requestNumber}</p>
                        {o.surgeryRecommendation && <p className="text-xs text-gray-400 truncate">{o.surgeryRecommendation}</p>}
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 shrink-0 ml-2">{o.status}</span>
                    </div>
                  ))}
                  <button
                    onClick={() => { window.location.href = '/patient/portal/ot-surgery'; }}
                    className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-700 pt-1 transition"
                  >
                    View all OT & Surgery details →
                  </button>
                </div>
              </Section>
            )}

            {/* Treatment Plan */}
            {detail.treatmentPlan && (
              <Section title="Treatment Plan">
                <div className="bg-blue-50/30 rounded-xl p-4 border border-blue-100 space-y-3">
                  {detail.treatmentPlan.updatedAt && (
                    <div className="flex justify-between items-center text-xs text-gray-500 border-b border-blue-100/50 pb-2">
                      <span>Last updated</span>
                      <span className="font-semibold text-gray-700">
                        {new Date(detail.treatmentPlan.updatedAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                  )}
                  {detail.treatmentPlan.description && <Info label="Description" value={detail.treatmentPlan.description} />}
                  {detail.treatmentPlan.instructions && <Info label="Instructions" value={detail.treatmentPlan.instructions} />}
                  {detail.treatmentPlan.medicines?.length > 0 && (
                    <div>
                      <p className="text-[11px] text-gray-400 font-medium mb-2">Medicines</p>
                      <div className="space-y-1.5">
                        {detail.treatmentPlan.medicines.map((m, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-white rounded-lg px-3 py-2 border border-blue-50">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                            <span className="font-medium">{m.medicine || m.name || m}</span>
                            {m.dosage && <span className="text-gray-400">{m.dosage}</span>}
                            {m.frequency && <span className="text-gray-400">{m.frequency}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Billing */}
            {detail.billing && (
              <Section title="Billing Information">
                <div className="grid grid-cols-2 gap-4">
                  <Info label="Admission Charge" value={detail.billing.admissionCharge != null ? `₹${detail.billing.admissionCharge?.toLocaleString('en-IN')}` : '—'} />
                  <Info label="Room Charge/Day" value={detail.billing.roomChargePerDay != null ? `₹${detail.billing.roomChargePerDay?.toLocaleString('en-IN')}` : '—'} />
                  <Info label="Advance Paid" value={detail.billing.advance != null ? `₹${detail.billing.advance?.toLocaleString('en-IN')}` : '—'} />
                  <Info label="Payment Status" value={detail.billing.paymentStatus || '—'} />
                </div>
              </Section>
            )}

            {/* Discharge Information */}
            {detail.dischargeSummaryData && (
              <Section title="Discharge Information">
                <div className="bg-green-50/50 rounded-xl p-4 border border-green-100 space-y-3">
                  <Info label="Discharge Date" value={detail.dischargeDate?.slice(0, 10) || '—'} />
                  {typeof detail.dischargeSummaryData === 'object' && (
                    <>
                      {detail.dischargeSummaryData.finalDiagnosis && <Info label="Final Diagnosis" value={detail.dischargeSummaryData.finalDiagnosis} />}
                      {detail.dischargeSummaryData.doctorNotes && <Info label="Doctor Notes" value={detail.dischargeSummaryData.doctorNotes} />}
                      {detail.dischargeSummaryData.summary && <Info label="Discharge Summary" value={detail.dischargeSummaryData.summary} />}
                    </>
                  )}
                </div>
              </Section>
            )}

          </div>
        )}
      </div>
    </>
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

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className={`text-2xl md:text-3xl font-extrabold ${color}`}>{value}</p>
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
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 w-24 bg-gray-100 rounded-lg" />)}
      </div>
      <div className="h-64 bg-gray-100 rounded-2xl" />
      <div className="space-y-3">
        {[1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
      </div>
    </div>
  );
}
