import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  MdSearch,
  MdFilterList,
  MdPerson,
  MdClose,
  MdMedicalServices,
  MdWarning,
  MdSchedule,
  MdOutlineMoreHoriz,
  MdReceiptLong,
  MdCheckCircle,
} from 'react-icons/md';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import '../receptionist/patients/PatientList.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PRIORITY_STYLE = {
  Normal: { badge: 'gray' },
  Urgent: { badge: 'rose' },
};

export default function OtRequests() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [searchUhid, setSearchUhid] = useState('');
  const [priority, setPriority] = useState('All');
  const [page, setPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [preAssessment, setPreAssessment] = useState(null);
  const pageSize = 6;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/ot/requests', { params: { limit: 50 } });
        if (alive) setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!selectedRequest?.id) { setPreAssessment(null); return; }
    let alive = true;
    api.get('/assessment/ot-request/' + selectedRequest.id)
      .then((res) => { if (alive) setPreAssessment(res?.data?.assessment || null); })
      .catch(() => { if (alive) setPreAssessment(null); });
    return () => { alive = false; };
  }, [selectedRequest?.id]);

  const filtered = useMemo(() => {
    const q = String(searchName || '').trim().toLowerCase();
    const u = String(searchUhid || '').trim().toLowerCase();
    return items.filter((r) => {
      if (q && !(r.patient?.name || '').toLowerCase().includes(q)) return false;
      if (u && !(r.uhid || '').toLowerCase().includes(u)) return false;
      if (priority !== 'All' && r.priority !== priority) return false;
      return true;
    });
  }, [items, searchName, searchUhid, priority]);

  const stats = useMemo(() => ({
    total: items.length,
    urgent: items.filter((r) => r.priority === 'Urgent').length,
    normal: items.filter((r) => r.priority === 'Normal' || !r.priority).length,
  }), [items]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const statsCards = [
    { label: 'Approved OT Patients', value: stats.total, icon: MdMedicalServices, bg: '#0f2d5e', light: '#dbeafe' },
    { label: 'Urgent', value: stats.urgent, icon: MdWarning, bg: '#991b1b', light: '#fee2e2' },
    { label: 'Normal', value: stats.normal, icon: MdSchedule, bg: '#1d4ed8', light: '#dbeafe' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 space-y-4">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {statsCards.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.light }}>
                        <Icon className="w-5 h-5" style={{ color: s.bg }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl font-extrabold text-gray-900 leading-tight">{s.value}</p>
                        <p className="text-xs font-semibold text-gray-600 mt-0.5 truncate">{s.label}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="relative flex-1 min-w-0">
                    <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={searchName} onChange={(e) => { setSearchName(e.target.value); setPage(1); }}
                      placeholder="Patient Name..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={searchUhid} onChange={(e) => { setSearchUhid(e.target.value); setPage(1); }}
                      placeholder="UHID..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <MdFilterList className="w-4 h-4 text-gray-400" />
                  <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="pl-select">
                    <option value="All">All Priority</option>
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#f8faff' }}>
                      {['Request ID', 'UHID', 'Patient Name', 'Surgery', 'Priority', 'Approved Date', 'Billing', 'Actions'].map((h) => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pageItems.map((r) => (
                      <tr key={r.id} className="hover:bg-blue-50/30 transition">
                        <td className="px-3 py-3">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md whitespace-nowrap">{r.requestNumber}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-mono text-xs text-gray-700">{r.uhid}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <MdPerson className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="font-semibold text-gray-800">{r.patient?.name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 font-medium max-w-[140px] truncate" title={r.surgeryRecommendation}>{r.surgeryRecommendation}</td>
                        <td className="px-3 py-3">
                          <Badge variant={PRIORITY_STYLE[r.priority]?.badge || 'gray'}>{r.priority || 'Normal'}</Badge>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(r.billDate)}</td>
                        <td className="px-3 py-3 text-xs">
                          {r.bill ? (
                            <div>
                              <span className="text-emerald-700 font-medium block">{r.bill.billNumber}</span>
                              <span className="text-gray-600">Paid ₹{r.bill.paidAmount ?? 0} / ₹{r.bill.totalAmount ?? 0}</span>
                              {Math.max(0, (r.bill.totalAmount ?? 0) - (r.bill.paidAmount ?? 0)) > 0 ? (
                                <span className="text-amber-700 font-semibold block">
                                  Pending ₹{Math.max(0, (r.bill.totalAmount ?? 0) - (r.bill.paidAmount ?? 0))}
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold block">Fully paid</span>
                              )}
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-3">
                          <button type="button" onClick={() => setSelectedRequest(r)}
                            className="text-xs font-extrabold text-blue-700 hover:text-blue-900 underline underline-offset-4">
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pageItems.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <MdMedicalServices className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No approved OT requests</p>
                </div>
              )}

              {filtered.length > 0 ? (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white">
                  <p className="text-xs text-gray-500">
                    Showing <span className="font-semibold text-gray-700">{(safePage - 1) * pageSize + 1}</span>-
                    <span className="font-semibold text-gray-700">{Math.min(safePage * pageSize, filtered.length)}</span> of{' '}
                    <span className="font-semibold text-gray-700">{filtered.length}</span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: totalPages }).slice(0, 6).map((_, i) => {
                      const n = i + 1;
                      return (
                        <button key={n} type="button" onClick={() => setPage(n)}
                          className="pl-pageBtn" style={{ background: safePage === n ? '#1d4ed8' : '#f1f5f9', color: safePage === n ? '#fff' : '#64748b' }}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {selectedRequest ? createPortal(
        <div className="pl-modalOverlay" role="dialog" aria-modal="true">
          <div className="pl-modal pl-modalAnimate">
            <div className="pl-modalHeader">
              <div className="min-w-0 flex items-center gap-3">
                <div className="pl-avatar"><MdPerson className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900 truncate">{selectedRequest.patient?.name}</p>
                  <div className="pl-headerMeta">
                    <span className="pl-chip">UHID <span className="pl-chipMono">{selectedRequest.uhid}</span></span>
                    <span className="pl-chip">Request <span className="pl-chipMono">{selectedRequest.requestNumber}</span></span>
                    <Badge variant={PRIORITY_STYLE[selectedRequest.priority]?.badge || 'gray'}>{selectedRequest.priority || 'Normal'}</Badge>
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedRequest(null)} className="pl-modalClose" title="Close">
                <MdClose className="w-5 h-5" />
              </button>
            </div>

            <div className="pl-modalBody">
              <div className="pl-modalGrid">
                <div className="pl-modalCard">
                  <p className="pl-modalCardTitle">Patient Information</p>
                  <div className="pl-kv">
                    <div><p className="k">Name</p><p className="v">{selectedRequest.patient?.name || '—'}</p></div>
                    <div><p className="k">UHID</p><p className="v">{selectedRequest.uhid}</p></div>
                    <div><p className="k">Doctor</p><p className="v">{selectedRequest.doctor?.user?.name || '—'}</p></div>
                    <div><p className="k">Nurse</p><p className="v">{selectedRequest.nurse?.name || '—'}</p></div>
                  </div>
                </div>
                <div className="pl-modalCard">
                  <p className="pl-modalCardTitle">Surgery Details</p>
                  <div className="pl-kv">
                    <div><p className="k">Diagnosis</p><p className="v">{selectedRequest.diagnosis || '—'}</p></div>
                    <div><p className="k">Surgery</p><p className="v">{selectedRequest.surgeryRecommendation || '—'}</p></div>
                    <div><p className="k">Priority</p><p className="v">{selectedRequest.priority || 'Normal'}</p></div>
                    <div><p className="k">Expected Date</p><p className="v">{formatDate(selectedRequest.expectedSurgeryDate)}</p></div>
                  </div>
                </div>
                <div className="pl-modalCard pl-modalCardWide">
                  <p className="pl-modalCardTitle">Billing & Payment</p>
                  <div className="pl-kv">
                    <div><p className="k">Bill Number</p><p className="v font-mono">{selectedRequest.bill?.billNumber || '—'}</p></div>
                    <div><p className="k">Total Amount</p><p className="v">₹{selectedRequest.bill?.totalAmount || 0}</p></div>
                    <div><p className="k">Paid Amount</p><p className="v">₹{selectedRequest.bill?.paidAmount || 0}</p></div>
                    <div><p className="k">Pending Amount</p><p className="v" style={{ color: Math.max(0, (selectedRequest.bill?.totalAmount || 0) - (selectedRequest.bill?.paidAmount || 0)) > 0 ? '#b45309' : '#15803d' }}>
                      ₹{Math.max(0, (selectedRequest.bill?.totalAmount || 0) - (selectedRequest.bill?.paidAmount || 0))}
                    </p></div>
                    <div><p className="k">Bill Status</p><p className="v">{selectedRequest.bill?.status || '—'}</p></div>
                  </div>
                </div>

                {preAssessment && (
                  <div className="pl-modalCard pl-modalCardWide">
                    <p className="pl-modalCardTitle">Pre-Operative Assessment <MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle' }} /></p>
                    <div className="pl-kv" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                      <div><p className="k">BP</p><p className="v">{preAssessment.bpSystolic || '—'}/{preAssessment.bpDiastolic || '—'}</p></div>
                      <div><p className="k">Pulse</p><p className="v">{preAssessment.pulse ?? '—'}</p></div>
                      <div><p className="k">Temp</p><p className="v">{preAssessment.temperature ?? '—'}</p></div>
                      <div><p className="k">SpO₂</p><p className="v">{preAssessment.spo2 ?? '—'}</p></div>
                      <div><p className="k">RR</p><p className="v">{preAssessment.respiratoryRate ?? '—'}</p></div>
                      <div><p className="k">BMI</p><p className="v">{preAssessment.bmi ?? '—'}</p></div>
                      <div><p className="k">Height</p><p className="v">{preAssessment.heightCm ?? '—'}</p></div>
                      <div><p className="k">Weight</p><p className="v">{preAssessment.weightKg ?? '—'}</p></div>
                      <div><p className="k">Assessed By</p><p className="v">{preAssessment.assessedBy?.name || '—'}</p></div>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, color: '#374151' }}>
                      {preAssessment.diabetes && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 14 }} /> Diabetes</span>}
                      {preAssessment.hypertension && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 14 }} /> Hypertension</span>}
                      {preAssessment.asthma && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 14 }} /> Asthma</span>}
                      {preAssessment.heartDisease && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 14 }} /> Heart Disease</span>}
                      {preAssessment.kidneyDisease && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 14 }} /> Kidney Disease</span>}
                      {preAssessment.consentObtained && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 14 }} /> Consent</span>}
                      {preAssessment.labReportsAvailable && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 14 }} /> Lab Reports</span>}
                      {preAssessment.fastingCompleted && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 14 }} /> Fasting</span>}
                      {preAssessment.bloodAvailable && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 14 }} /> Blood</span>}
                      {preAssessment.surgicalSiteVerified && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 14 }} /> Site Verified</span>}
                      {preAssessment.patientIdentityVerified && <span><MdCheckCircle style={{ color: '#15803d', verticalAlign: 'middle', fontSize: 14 }} /> Identity</span>}
                    </div>
                    {preAssessment.knownAllergies && <div style={{ marginTop: 4, fontSize: 12 }}><strong>Allergies:</strong> {preAssessment.knownAllergies}</div>}
                    {preAssessment.currentMedications && <div style={{ marginTop: 2, fontSize: 12 }}><strong>Medications:</strong> {preAssessment.currentMedications}</div>}
                    {preAssessment.previousSurgeries && <div style={{ marginTop: 2, fontSize: 12 }}><strong>Surgeries:</strong> {preAssessment.previousSurgeries}</div>}
                    {preAssessment.nurseNotes && <div style={{ marginTop: 2, fontSize: 12 }}><strong>Nurse Notes:</strong> {preAssessment.nurseNotes}</div>}
                  </div>
                )}
              </div>

              <div className="pl-modalActions">
                <button type="button" className="pl-actionBtn pl-actionBtnPrimary" onClick={() => navigate(`/dashboard/ot/surgery/schedule?otRequestId=${selectedRequest.id}`)}>
                  <MdSchedule className="w-4 h-4" /> Schedule Surgery
                </button>
                <button type="button" className="pl-actionBtn" onClick={() => setSelectedRequest(null)}>
                  <MdClose className="w-4 h-4" /> Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
