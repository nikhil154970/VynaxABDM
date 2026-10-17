import { useState, useEffect, useCallback } from 'react';
import patientApi from '../../utils/patientApi';
import { labReportApiToFormalReport, openFormalLabReportWindow, downloadFormalLabReportHtml } from '../../utils/formalLabReportPrint';

const ORDER_STATUS_STYLES = {
  PENDING_BILLING: 'bg-gray-100 text-gray-600',
  BILLED: 'bg-blue-100 text-blue-700',
  COLLECTED: 'bg-purple-100 text-purple-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const ORDER_STATUS_LABELS = {
  PENDING_BILLING: 'Pending Billing',
  BILLED: 'Sample Pending',
  COLLECTED: 'Sample Collected',
  IN_PROGRESS: 'Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const REPORT_STATUS_LABELS = {
  PENDING: 'Report Pending',
  COMPLETED: 'Report Ready',
  VERIFIED: 'Verified',
};

const REPORT_STATUS_STYLES = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  VERIFIED: 'bg-blue-100 text-blue-700',
};

const FILTERS = [
  { key: 'all', label: 'All Tests' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'critical', label: 'Critical' },
  { key: 'this_month', label: 'This Month' },
];

function getResultStatus(value, range) {
  if (!value || !range) return null;
  const num = parseFloat(value);
  if (Number.isNaN(num)) return null;
  const parts = range.split('-').map((s) => parseFloat(s.trim())).filter((n) => !Number.isNaN(n));
  if (parts.length === 2) {
    if (num < parts[0]) return { label: 'Low', color: 'bg-orange-100 text-orange-700' };
    if (num > parts[1]) return { label: 'High', color: 'bg-red-100 text-red-700' };
    return { label: 'Normal', color: 'bg-green-100 text-green-700' };
  }
  return null;
}

function isResultCritical(result) {
  if (result.remarks && /critical|abnormal|urgent/i.test(result.remarks)) return true;
  const st = getResultStatus(result.value, result.referenceRange);
  if (st && (st.label === 'High' || st.label === 'Low')) return true;
  return false;
}

function getEffectiveStatus(order) {
  if (order.status === 'CANCELLED') return { label: 'Cancelled', style: ORDER_STATUS_STYLES.CANCELLED };
  if (order.status === 'COMPLETED') return { label: REPORT_STATUS_LABELS[order.reportStatus] || order.reportStatus, style: REPORT_STATUS_STYLES[order.reportStatus] || ORDER_STATUS_STYLES.COMPLETED };
  return { label: ORDER_STATUS_LABELS[order.status] || order.status, style: ORDER_STATUS_STYLES[order.status] || 'bg-gray-100 text-gray-600' };
}

export default function PatientLabReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchReports = useCallback(async () => {
    try {
      const params = { filter };
      if (debouncedSearch) params.search = debouncedSearch;
      const r = await patientApi.get('/patient/portal/lab-reports', { params });
      setData(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedSearch]);

  useEffect(() => { setLoading(true); fetchReports(); }, [fetchReports]);

  const openDetail = async (id) => {
    setDetailLoading(true); setDetailOpen(true);
    try {
      const r = await patientApi.get(`/patient/portal/lab-reports/${id}`);
      setDetail(r.data.labReport);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => { setDetailOpen(false); setDetail(null); };

  const handlePrint = async () => {
    if (!detail) return;
    const mapped = labReportApiToFormalReport({
      requestId: detail.id,
      orderNumber: detail.orderNumber,
      billNumber: detail.bill?.billNumber,
      patient: detail.patient,
      doctorName: detail.doctorName,
      notes: detail.notes,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      results: detail.results,
    });
    openFormalLabReportWindow([mapped], { title: `Lab Report - ${detail.orderNumber}` });
  };

  const handleDownload = async () => {
    if (!detail) return;
    const mapped = labReportApiToFormalReport({
      requestId: detail.id,
      orderNumber: detail.orderNumber,
      billNumber: detail.bill?.billNumber,
      patient: detail.patient,
      doctorName: detail.doctorName,
      notes: detail.notes,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      results: detail.results,
    });
    downloadFormalLabReportHtml([mapped], `lab-report-${detail.orderNumber}`);
  };

  if (loading && !data) return <Skeleton />;

  const reports = data?.labReports || [];
  const stats = data?.stats || {};

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Lab Reports</h1>
        <p className="text-sm text-gray-400 mt-0.5">View all your laboratory tests and results</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total Tests" value={stats.total ?? 0} color="blue" />
        <StatCard label="Pending Reports" value={stats.pending ?? 0} color="amber" />
        <StatCard label="Completed Reports" value={stats.completed ?? 0} color="green" />
        <StatCard label="Critical Reports" value={stats.critical ?? 0} color="purple" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
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

        <div className="relative w-full md:w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by test name or order number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
          />
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-400 font-medium">No lab reports found</p>
          <p className="text-xs text-gray-300 mt-1">Lab reports will appear here once tests are ordered</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <LabReportCard key={r.id} report={r} onViewDetails={openDetail} />
          ))}
        </div>
      )}

      {detailOpen && (
        <DetailDrawer
          detail={detail}
          loading={detailLoading}
          onClose={closeDetail}
          onPrint={handlePrint}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}

function LabReportCard({ report: r, onViewDetails }) {
  const status = getEffectiveStatus(r);
  const hasCritical = r.results?.some(isResultCritical);

  return (
    <div
      onClick={() => onViewDetails(r.id)}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            r.reportStatus === 'COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
          }`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-gray-800">{r.orderNumber}</p>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${status.style}`}>{status.label}</span>
              {hasCritical && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">Critical</span>}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Dr. {r.doctor || '—'}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
              <span>Ordered: {r.createdAt?.slice(0, 10) || '—'}</span>
              <span>{r.items?.length || 0} test{r.items?.length !== 1 ? 's' : ''}</span>
              {r.updatedAt && <span>Updated: {r.updatedAt?.slice(0, 10)}</span>}
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

  const status = detail ? getEffectiveStatus(detail) : {};

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 transition-opacity" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-xl z-50 transform transition-transform duration-300 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-800">Lab Report Details</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-50 transition text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-4 animate-pulse">
            {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-6 bg-gray-100 rounded-lg" />)}
          </div>
        ) : !detail ? (
          <div className="p-6 text-center text-gray-400">Report not found</div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-50">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600 font-bold shrink-0">
                LB
              </div>
              <div>
                <p className="font-bold text-gray-800">{detail.orderNumber}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${status.style || 'bg-gray-100 text-gray-600'}`}>{status.label || detail.status}</span>
                  {detail.reportStatus === 'COMPLETED' && <span className="text-xs text-green-600 font-medium">Results Available</span>}
                </div>
              </div>
            </div>

            <Section title="Patient Information">
              <div className="grid grid-cols-2 gap-4">
                <Info label="Name" value={detail.patient?.name || '—'} />
                <Info label="UHID" value={detail.patient?.uhid || '—'} />
                <Info label="Age" value={detail.patient?.age != null ? `${detail.patient.age} yrs` : '—'} />
                <Info label="Gender" value={detail.patient?.gender || '—'} />
                <Info label="Blood Group" value={detail.patient?.bloodGroup || '—'} />
                <Info label="Mobile" value={detail.patient?.mobile || '—'} />
              </div>
            </Section>

            <Section title="Order Information">
              <div className="grid grid-cols-2 gap-4">
                <Info label="Order Number" value={detail.orderNumber} />
                <Info label="Order Date" value={detail.createdAt?.slice(0, 10) || '—'} />
                <Info label="Report Generated" value={detail.updatedAt?.slice(0, 10) || '—'} />
                <Info label="Requested Doctor" value={detail.doctorName || '—'} />
                {detail.doctorSpecialization && <Info label="Department" value={detail.doctorSpecialization} />}
                {detail.appointmentDate && <Info label="Appointment Date" value={detail.appointmentDate?.slice(0, 10)} />}
              </div>
            </Section>

            {detail.items?.length > 0 && (
              <Section title="Tests Ordered">
                <div className="space-y-1.5">
                  {detail.items.map((item, i) => (
                    <div key={item.id || i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">{item.testName}</p>
                        <p className="text-[11px] text-gray-400">{item.category || ''}{item.unit ? ` (${item.unit})` : ''}</p>
                      </div>
                      {item.referenceRange && <span className="text-[10px] text-gray-400">Ref: {item.referenceRange}</span>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <div className="border-t border-gray-50 pt-1" />

            {detail.results?.length > 0 ? (
              <Section title="Test Results">
                <div className="space-y-2">
                  {detail.results.map((res, i) => {
                    const st = getResultStatus(res.value, res.referenceRange);
                    const critical = isResultCritical(res);
                    return (
                      <div
                        key={res.id || i}
                        className={`p-4 rounded-xl border ${
                          critical ? 'border-red-200 bg-red-50/50' : st ? 'border-gray-100 bg-white' : 'border-gray-100 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800">{res.testName}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] text-gray-400">
                              {res.unit && <span>Unit: {res.unit}</span>}
                              {res.referenceRange && <span>Range: {res.referenceRange}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-base font-extrabold ${critical ? 'text-red-600' : st?.label === 'Low' ? 'text-orange-600' : st?.label === 'High' ? 'text-red-600' : 'text-gray-800'}`}>
                              {res.value}
                            </p>
                            {st && (
                              <span className={`inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}>
                                {st.label}
                              </span>
                            )}
                          </div>
                        </div>
                        {res.remarks && (
                          <p className="mt-2 text-xs text-gray-500 bg-white rounded-lg px-3 py-2 border border-gray-50">{res.remarks}</p>
                        )}
                        {critical && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            Abnormal Value — Please consult your doctor
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {detail.results.some((r) => isResultCritical(r)) && (
                  <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-red-700">Critical Report Available</p>
                      <p className="text-xs text-red-600 mt-0.5">Please contact your doctor immediately regarding abnormal results.</p>
                    </div>
                  </div>
                )}
              </Section>
            ) : detail.status === 'COMPLETED' ? (
              <div className="text-center py-8 text-gray-400">
                <p>No detailed results available</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 flex items-center justify-center mb-3">
                  <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-600">Test In Progress</p>
                <p className="text-xs text-gray-400 mt-1">Results will appear here once processing is complete</p>
              </div>
            )}

            {detail.notes && (
              <Section title="Notes">
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4">{detail.notes}</p>
              </Section>
            )}

            {(detail.reportStatus === 'COMPLETED' || detail.reportStatus === 'VERIFIED') && (
              <div className="border-t border-gray-50 pt-5 flex gap-3">
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

function Info({ label, value }) {
  return (
    <div>
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
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
      </div>
    </div>
  );
}
