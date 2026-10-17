import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../utils/api';
import { DEPARTMENTS } from '../constants/departments';

function FieldLabel({ children }) {
  return <span className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-600">{children}</span>;
}

/** Match typed query to test name (handles "xray" vs "X-Ray", spacing, etc.) */
function labNameMatchesQuery(queryRaw, nameRaw) {
  const query = String(queryRaw || '').trim().toLowerCase();
  if (!query) return true;
  const name = String(nameRaw || '').toLowerCase();
  if (name.includes(query)) return true;
  const qCompact = query.replace(/[^a-z0-9]+/g, '');
  const nCompact = name.replace(/[^a-z0-9]+/g, '');
  if (qCompact && nCompact.includes(qCompact)) return true;
  const words = query.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => name.includes(w))) return true;
  return false;
}

function TextArea({ value, onChange, placeholder, disabled }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="mt-1 w-full px-4 py-2.5 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 min-h-[84px] text-sm disabled:bg-slate-50 disabled:text-slate-400"
      style={{ borderColor: 'rgba(0,0,0,0.12)' }}
    />
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/55 p-4 sm:p-5 space-y-3">
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-700">{title}</p>
      {children}
    </div>
  );
}

export default function ConsultationForm({
  initial = {
    symptoms: '',
    diagnosis: '',
    followUpDate: '',
    disposition: 'NORMAL',
    suggestedWardType: 'GENERAL',
    referredDepartment: '',
    medicines: [{ name: '', dosage: '', duration: '', mode: '' }],
    selectedTestIds: [],
  },
  onSave,
  onComplete,
  disabled = false,
}) {
  const [symptoms, setSymptoms] = useState(initial.symptoms);
  const [diagnosis, setDiagnosis] = useState(initial.diagnosis);
  const [followUpDate, setFollowUpDate] = useState(initial.followUpDate);
  const [disposition, setDisposition] = useState(initial.disposition || 'NORMAL');
  const [suggestedWardType, setSuggestedWardType] = useState(initial.suggestedWardType || 'GENERAL');
  const [referredDepartment, setReferredDepartment] = useState(initial.referredDepartment || '');
  const [referredDoctorId, setReferredDoctorId] = useState(initial.referredDoctorId || '');
  const [deptDoctors, setDeptDoctors] = useState([]);
  const [loadingDeptDoctors, setLoadingDeptDoctors] = useState(false);
  const [medicines, setMedicines] = useState(initial.medicines);
  const [labCatalog, setLabCatalog] = useState([]);
  const [selectedTestIds, setSelectedTestIds] = useState(() =>
    Array.isArray(initial.selectedTestIds)
      ? initial.selectedTestIds.map((x) => parseInt(String(x), 10)).filter((n) => Number.isFinite(n))
      : []
  );
  const [labSearch, setLabSearch] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewEdit, setReviewEdit] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [submittedSnapshot, setSubmittedSnapshot] = useState(null);

  const resetForm = () => {
    setSymptoms(initial.symptoms || '');
    setDiagnosis(initial.diagnosis || '');
    setFollowUpDate(initial.followUpDate || '');
    setDisposition(initial.disposition || 'NORMAL');
    setSuggestedWardType(initial.suggestedWardType || 'GENERAL');
    setReferredDepartment(initial.referredDepartment || '');
    setReferredDoctorId(initial.referredDoctorId || '');
    setMedicines(
      Array.isArray(initial.medicines) && initial.medicines.length
        ? initial.medicines.map((m) => ({ ...m, mode: m?.mode ?? '' }))
        : [{ name: '', dosage: '', duration: '', mode: '' }]
    );
    setSelectedTestIds(
      Array.isArray(initial.selectedTestIds)
        ? initial.selectedTestIds.map((x) => parseInt(String(x), 10)).filter((n) => Number.isFinite(n))
        : []
    );
    setLabSearch('');
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/lab/tests');
        if (!alive) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setLabCatalog(
          list
            .filter((x) => x && x.id != null && x.name)
            .map((x) => ({ id: parseInt(String(x.id), 10), name: String(x.name) }))
            .filter((x) => Number.isFinite(x.id))
        );
      } catch {
        if (!alive) return;
        setLabCatalog([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!referredDepartment) {
      setDeptDoctors([]);
      setReferredDoctorId('');
      return;
    }
    let alive = true;
    (async () => {
      setLoadingDeptDoctors(true);
      try {
        const res = await api.get('/doctors/lookup', { params: { q: referredDepartment } });
        if (!alive) return;
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        const list = items
          .filter((d) => String(d.specialization || '').toLowerCase().includes(referredDepartment.toLowerCase()))
          .map((d) => ({ id: d.id, name: d.name }));
        setDeptDoctors(list);
      } catch (err) {
        console.warn('Failed to load referred department doctors', err);
        if (alive) setDeptDoctors([]);
      } finally {
        if (alive) setLoadingDeptDoctors(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [referredDepartment]);

  const prescription = useMemo(
    () =>
      (medicines || [])
        .map((m) => ({
          medicine: String(m.name || '').trim(),
          dosage: String(m.dosage || '').trim(),
          duration: String(m.duration || '').trim(),
          mode: String(m.mode || '').trim() || null,
        }))
        .filter((m) => m.medicine || m.dosage || m.duration),
    [medicines]
  );

  const hasMissingMode = useMemo(() => {
    const rows = Array.isArray(medicines) ? medicines : [];
    return rows.some((m) => {
      const hasAny = Boolean(String(m?.name || '').trim() || String(m?.dosage || '').trim() || String(m?.duration || '').trim());
      if (!hasAny) return false;
      return !String(m?.mode || '').trim();
    });
  }, [medicines]);

  const canSubmit = useMemo(() => {
    if (!String(symptoms).trim()) return false;
    if (!String(diagnosis).trim()) return false;
    if (prescription.length === 0) return false;
    // Backward-compatible: mode may be missing on old records,
    // but new entries via this form must select a mode per medicine row.
    if (hasMissingMode) return false;
    if (disposition === 'REFER_DEPT' && !referredDepartment) return false;
    return true;
  }, [symptoms, diagnosis, prescription.length, hasMissingMode, disposition, referredDepartment]);

  const testNameById = useMemo(() => {
    const m = new Map();
    (labCatalog || []).forEach((t) => m.set(Number(t.id), t.name));
    return m;
  }, [labCatalog]);

  const filteredLabCatalog = useMemo(() => {
    if (!String(labSearch || '').trim()) return labCatalog;
    return labCatalog.filter((t) => labNameMatchesQuery(labSearch, t.name));
  }, [labCatalog, labSearch]);

  const toggleLabTestId = (id) => {
    const n = Number(id);
    if (!Number.isFinite(n)) return;
    setSelectedTestIds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  };

  const submitPayload = useMemo(
    () => ({
      symptoms: String(symptoms).trim(),
      diagnosis: String(diagnosis).trim(),
      prescription,
      disposition,
      suggestedWardType: disposition === 'REFER_ADMIT' ? suggestedWardType : null,
      referredDepartment: disposition === 'REFER_DEPT' ? referredDepartment : null,
      referredDoctorId: disposition === 'REFER_DEPT' ? referredDoctorId || null : null,
      follow_up_date: followUpDate || null,
      selected_tests: [...selectedTestIds],
    }),
    [symptoms, diagnosis, prescription, disposition, suggestedWardType, referredDepartment, referredDoctorId, followUpDate, selectedTestIds]
  );

  return (
    <div className="space-y-3">
      {/* Top: decision + clinical (side-by-side on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SectionCard title="Doctor decision">
          <FieldLabel>Doctor Decision</FieldLabel>
          <select
            value={disposition}
            onChange={(e) => setDisposition(e.target.value)}
            className="mt-1 h-10 w-full px-3 rounded-xl border bg-white text-sm font-semibold text-slate-800"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            disabled={disabled}
          >
            <option value="NORMAL">Normal</option>
            <option value="REFER_ADMIT">Refer for Admit (IPD)</option>
            <option value="REFER_DEPT">Refer to another Department</option>
          </select>

          {disposition === 'REFER_ADMIT' ? (
            <div className="pt-2">
              <FieldLabel>Suggested ward</FieldLabel>
              <select
                value={suggestedWardType}
                onChange={(e) => setSuggestedWardType(e.target.value)}
                className="mt-1 h-10 w-full px-3 rounded-xl border bg-white text-sm"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                disabled={disabled}
              >
                <option value="GENERAL">General</option>
                <option value="ICU">ICU</option>
                <option value="PRIVATE">Private</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500 font-semibold">
                Visible to Receptionist in IPD referrals.
              </p>
            </div>
          ) : null}

          {disposition === 'REFER_DEPT' ? (
            <div className="pt-2 space-y-2">
              <div>
                <FieldLabel>Select Department</FieldLabel>
                <select
                  value={referredDepartment}
                  onChange={(e) => setReferredDepartment(e.target.value)}
                  className="mt-1 h-10 w-full px-3 rounded-xl border bg-white text-sm font-semibold text-slate-800"
                  style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  disabled={disabled}
                >
                  <option value="">-- Choose Department --</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {referredDepartment && (
                <div>
                  <FieldLabel>Select Doctor (Optional)</FieldLabel>
                  <select
                    value={referredDoctorId}
                    onChange={(e) => setReferredDoctorId(e.target.value)}
                    className="mt-1 h-10 w-full px-3 rounded-xl border bg-white text-sm font-semibold text-slate-800"
                    style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                    disabled={disabled || loadingDeptDoctors}
                  >
                    <option value="">{loadingDeptDoctors ? 'Loading doctors...' : '-- Choose Doctor (Optional) --'}</option>
                    {deptDoctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <p className="mt-1 text-[11px] text-slate-500 font-semibold">
                Visible to Receptionist during registration / booking.
              </p>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Clinical details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Symptoms</FieldLabel>
              <TextArea value={symptoms} onChange={setSymptoms} placeholder="Symptoms" disabled={disabled} />
            </div>
            <div>
              <FieldLabel>Diagnosis</FieldLabel>
              <TextArea value={diagnosis} onChange={setDiagnosis} placeholder="Diagnosis" disabled={disabled} />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Middle: prescription + lab (side-by-side on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SectionCard title="Prescription">
        <div className="space-y-2.5">
          {(medicines || []).map((m, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
              <input
                value={m.name}
                onChange={(e) =>
                  setMedicines((prev) =>
                    prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x))
                  )
                }
                placeholder="Medicine"
                disabled={disabled}
                className="w-full h-10 px-3 rounded-xl border bg-white text-sm"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
              />
              <input
                value={m.dosage}
                onChange={(e) =>
                  setMedicines((prev) =>
                    prev.map((x, i) => (i === idx ? { ...x, dosage: e.target.value } : x))
                  )
                }
                placeholder="Dosage"
                disabled={disabled}
                className="w-full h-10 px-3 rounded-xl border bg-white text-sm"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
              />
              <input
                value={m.duration}
                onChange={(e) =>
                  setMedicines((prev) =>
                    prev.map((x, i) => (i === idx ? { ...x, duration: e.target.value } : x))
                  )
                }
                placeholder="Duration"
                disabled={disabled}
                className="w-full h-10 px-3 rounded-xl border bg-white text-sm"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
              />
              <select
                value={m.mode || ''}
                onChange={(e) =>
                  setMedicines((prev) => prev.map((x, i) => (i === idx ? { ...x, mode: e.target.value } : x)))
                }
                className="w-full h-10 px-3 rounded-xl border bg-white text-sm"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
              >
                <option value="">Mode</option>
                <option value="Oral">Oral</option>
                <option value="Injection">Injection</option>
                <option value="IV Drip">IV Drip</option>
                <option value="Topical">Topical</option>
                <option value="Other">Other</option>
              </select>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMedicines((prev) => [...prev, { name: '', dosage: '', duration: '', mode: '' }])}
            className="px-3 h-9 rounded-xl text-xs font-extrabold border bg-white"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            disabled={disabled}
          >
            + Add
          </button>
          <button
            type="button"
            onClick={() => setMedicines((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))}
            className="px-3 h-9 rounded-xl text-xs font-extrabold border bg-white"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            disabled={disabled || medicines.length <= 1}
          >
            Remove
          </button>
        </div>
        </SectionCard>

        <SectionCard title="Lab tests (optional)">
          <label htmlFor="nh-consultation-lab-filter" className="sr-only">
            Search lab tests
          </label>
          <FieldLabel>Select Lab Tests</FieldLabel>
          <input
            id="nh-consultation-lab-filter"
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            value={labSearch}
            onChange={(e) => setLabSearch(e.target.value)}
            placeholder="Search"
            disabled={disabled}
            className="mt-1 w-full h-10 px-3 rounded-xl border bg-white text-sm"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
          />
          <div
            className="mt-2 max-h-52 overflow-y-auto rounded-xl border bg-white p-2 space-y-0.5"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
          >
            {filteredLabCatalog.length ? (
              filteredLabCatalog.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTestIds.includes(t.id)}
                    onChange={() => toggleLabTestId(t.id)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-gray-300 text-[#0077B6] focus:ring-[#0077B6]/20"
                  />
                  <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                </label>
              ))
            ) : (
              <p className="text-sm text-gray-500 px-2 py-3">No tests</p>
            )}
          </div>
          {selectedTestIds.length ? (
            <ul className="mt-3 space-y-1.5">
              {selectedTestIds.map((id) => (
                <li
                  key={id}
                  className="flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2"
                  style={{ borderColor: 'rgba(0,0,0,0.08)' }}
                >
                  <span className="text-sm font-semibold text-gray-900 truncate">{testNameById.get(id) || '—'}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTestIds((prev) => prev.filter((x) => x !== id))}
                    disabled={disabled}
                    className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-extrabold border bg-white"
                    style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </SectionCard>
      </div>

      {/* Bottom: follow-up + CTA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        <SectionCard title="Follow-up">
          <FieldLabel>Follow-up</FieldLabel>
          <input
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="mt-1 h-10 w-full px-3 rounded-xl border bg-white text-sm"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            disabled={disabled}
          />
        </SectionCard>

        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/55 p-4 sm:p-5">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Complete</p>
            <p className="text-xs text-slate-500 mt-1">
              Review once and submit. Mandatory: symptoms, diagnosis, at least 1 medicine.
            </p>
            <button
              type="button"
              disabled={disabled || !canSubmit}
              onClick={() => {
                setReviewEdit(false);
                setReviewSubmitting(false);
                setReviewSuccess(false);
                setReviewError('');
                setSubmittedSnapshot(null);
                setReviewOpen(true);
              }}
              className="mt-3 w-full h-11 px-4 rounded-xl text-sm font-extrabold text-white bg-[#0077B6] hover:bg-[#00B4D8] disabled:opacity-60 shadow-sm transition"
            >
              Complete Consultation
            </button>
          </div>
        </div>
      </div>

      {reviewOpen
        ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              onClick={() => {
                if (reviewSubmitting) return;
                if (reviewSuccess) resetForm();
                setSubmittedSnapshot(null);
                setReviewOpen(false);
              }}
              aria-label="Close"
            />

            <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900 truncate">
                    {reviewSuccess ? 'Success' : 'Review & Complete'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {reviewSuccess ? 'Consultation completed successfully.' : 'Confirm details below. You can edit before submitting.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (reviewSubmitting) return;
                    if (reviewSuccess) resetForm();
                    setSubmittedSnapshot(null);
                    setReviewOpen(false);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-extrabold border bg-white"
                  style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                >
                  Close
                </button>
              </div>

              <div className="p-5 max-h-[70vh] overflow-auto space-y-4">
                {reviewError ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {reviewError}
                  </div>
                ) : null}

                {reviewSuccess ? (
                  <div className="rounded-2xl p-5 text-white shadow-sm border border-blue-900/10"
                    style={{ background: 'linear-gradient(135deg, #0f2d5e 0%, #1a4a8a 60%, #1d4ed8 100%)' }}
                  >
                    <p className="text-lg font-extrabold">Consultation completed</p>
                    <p className="text-xs text-blue-100 mt-1">
                      Status updated to Completed. You can close this popup now.
                    </p>
                  </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs font-extrabold text-gray-600 mb-2">Doctor Decision</p>
                    {reviewEdit ? (
                      <select
                        value={disposition}
                        onChange={(e) => setDisposition(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
                        style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                      >
                        <option value="NORMAL">Normal</option>
                        <option value="REFER_ADMIT">Refer for Admit (IPD)</option>
                        <option value="REFER_DEPT">Refer to another Department</option>
                      </select>
                    ) : (
                      <p className="text-sm font-extrabold text-gray-900">
                        {disposition === 'REFER_ADMIT' ? 'Refer for Admit (IPD)' : disposition === 'REFER_DEPT' ? 'Refer to another Department' : 'Normal'}
                      </p>
                    )}
                    {disposition === 'REFER_ADMIT' ? (
                      <div className="mt-2">
                        <p className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wide">Suggested ward</p>
                        {reviewEdit ? (
                          <select
                            value={suggestedWardType}
                            onChange={(e) => setSuggestedWardType(e.target.value)}
                            className="mt-1 w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
                            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                          >
                            <option value="GENERAL">General</option>
                            <option value="ICU">ICU</option>
                            <option value="PRIVATE">Private</option>
                          </select>
                        ) : (
                          <p className="text-sm font-extrabold text-gray-900">
                            {suggestedWardType === 'ICU' ? 'ICU' : suggestedWardType === 'PRIVATE' ? 'Private' : 'General'}
                          </p>
                        )}
                      </div>
                    ) : null}
                    {disposition === 'REFER_DEPT' ? (
                      <div className="mt-2 space-y-2">
                        <div>
                          <p className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wide">Referred Department</p>
                          {reviewEdit ? (
                            <select
                              value={referredDepartment}
                              onChange={(e) => setReferredDepartment(e.target.value)}
                              className="mt-1 w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
                              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                            >
                              <option value="">-- Choose Department --</option>
                              {DEPARTMENTS.map((dept) => (
                                <option key={dept} value={dept}>
                                  {dept}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-sm font-extrabold text-gray-900">
                              {referredDepartment || '—'}
                            </p>
                          )}
                        </div>

                        {referredDepartment && (
                          <div>
                            <p className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wide">Referred Doctor</p>
                            {reviewEdit ? (
                              <select
                                value={referredDoctorId}
                                onChange={(e) => setReferredDoctorId(e.target.value)}
                                className="mt-1 w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
                                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                                disabled={loadingDeptDoctors}
                              >
                                <option value="">{loadingDeptDoctors ? 'Loading doctors...' : '-- Choose Doctor (Optional) --'}</option>
                                {deptDoctors.map((doc) => (
                                  <option key={doc.id} value={doc.id}>
                                    {doc.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <p className="text-sm font-extrabold text-gray-900">
                                {deptDoctors.find((d) => d.id === referredDoctorId)?.name || '—'}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs font-extrabold text-gray-600 mb-2">Follow-up date</p>
                    {reviewEdit ? (
                      <input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
                        style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                      />
                    ) : (
                      <p className="text-sm font-extrabold text-gray-900">{followUpDate || '—'}</p>
                    )}
                  </div>
                </div>
                )}

                <div className="rounded-xl border border-gray-100 bg-white p-4">
                  <p className="text-xs font-extrabold text-gray-600 mb-2">Symptoms</p>
                  {reviewEdit ? (
                    <TextArea value={symptoms} onChange={setSymptoms} placeholder="Symptoms" />
                  ) : (
                    <p className="text-sm font-extrabold text-gray-900 whitespace-pre-wrap">
                      {String((reviewSuccess ? submittedSnapshot?.symptoms : symptoms) || '').trim() || '—'}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-4">
                  <p className="text-xs font-extrabold text-gray-600 mb-2">Diagnosis</p>
                  {reviewEdit ? (
                    <TextArea value={diagnosis} onChange={setDiagnosis} placeholder="Diagnosis" />
                  ) : (
                    <p className="text-sm font-extrabold text-gray-900 whitespace-pre-wrap">
                      {String((reviewSuccess ? submittedSnapshot?.diagnosis : diagnosis) || '').trim() || '—'}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-4">
                  <p className="text-xs font-extrabold text-gray-600 mb-3">Medicines</p>
                  {reviewEdit ? (
                    <div className="space-y-2">
                      {(medicines || []).map((m, idx) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            value={m.name}
                            onChange={(e) =>
                              setMedicines((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                            }
                            placeholder="Medicine"
                            className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
                            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                          />
                          <input
                            value={m.dosage}
                            onChange={(e) =>
                              setMedicines((prev) => prev.map((x, i) => (i === idx ? { ...x, dosage: e.target.value } : x)))
                            }
                            placeholder="Dosage"
                            className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
                            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                          />
                          <input
                            value={m.duration}
                            onChange={(e) =>
                              setMedicines((prev) => prev.map((x, i) => (i === idx ? { ...x, duration: e.target.value } : x)))
                            }
                            placeholder="Duration"
                            className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
                            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                          />
                          <select
                            value={m.mode || ''}
                            onChange={(e) =>
                              setMedicines((prev) => prev.map((x, i) => (i === idx ? { ...x, mode: e.target.value } : x)))
                            }
                            className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"
                            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                          >
                            <option value="">Mode</option>
                            <option value="Oral">Oral</option>
                            <option value="Injection">Injection</option>
                            <option value="IV Drip">IV Drip</option>
                            <option value="Topical">Topical</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setMedicines((prev) => [...prev, { name: '', dosage: '', duration: '', mode: '' }])}
                          className="px-3 py-2 rounded-xl text-xs font-extrabold border bg-white"
                          style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                        >
                          + Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setMedicines((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))}
                          className="px-3 py-2 rounded-xl text-xs font-extrabold border bg-white"
                          style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                          disabled={medicines.length <= 1}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (reviewSuccess ? submittedSnapshot?.prescription : prescription)?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="pb-2 pr-2">Medicine</th>
                            <th className="pb-2 pr-2">Dosage</th>
                            <th className="pb-2 pr-2">Duration</th>
                            <th className="pb-2">Mode</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reviewSuccess ? submittedSnapshot?.prescription : prescription).map((m, i) => (
                            <tr key={i} className="border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                              <td className="py-2 pr-2 font-semibold text-gray-900">{m.medicine || '—'}</td>
                              <td className="py-2 pr-2 text-gray-700">{m.dosage || '—'}</td>
                              <td className="py-2 pr-2 text-gray-700">{m.duration || '—'}</td>
                              <td className="py-2 text-gray-700">{m.mode || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-gray-500">—</p>
                  )}
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-4">
                  <p className="text-xs font-extrabold text-gray-600 mb-3">Lab tests</p>
                  {reviewEdit ? (
                    <div className="space-y-2">
                      <input
                        id="nh-consultation-lab-filter-review"
                        type="text"
                        inputMode="search"
                        autoComplete="off"
                        value={labSearch}
                        onChange={(e) => setLabSearch(e.target.value)}
                        placeholder="Search"
                        className="w-full h-10 px-3 rounded-xl border bg-white text-sm"
                        style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                      />
                      <div
                        className="max-h-40 overflow-y-auto rounded-xl border bg-white p-2 space-y-0.5"
                        style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                      >
                        {filteredLabCatalog.length ? (
                          filteredLabCatalog.map((t) => (
                            <label
                              key={t.id}
                              className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedTestIds.includes(t.id)}
                                onChange={() => toggleLabTestId(t.id)}
                                className="h-4 w-4 rounded border-gray-300 text-[#0077B6] focus:ring-[#0077B6]/20"
                              />
                              <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                            </label>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 px-2 py-3">No tests</p>
                        )}
                      </div>
                      {selectedTestIds.length ? (
                        <ul className="space-y-1.5">
                          {selectedTestIds.map((id) => (
                            <li
                              key={id}
                              className="flex items-center justify-between gap-2 rounded-xl border bg-gray-50 px-3 py-2"
                              style={{ borderColor: 'rgba(0,0,0,0.08)' }}
                            >
                              <span className="text-sm font-semibold text-gray-900 truncate">
                                {testNameById.get(id) || '—'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedTestIds((prev) => prev.filter((x) => x !== id))}
                                className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-extrabold border bg-white"
                                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : (reviewSuccess ? submittedSnapshot?.selected_tests : submitPayload.selected_tests)?.length ? (
                    <ul className="space-y-1.5">
                      {(reviewSuccess ? submittedSnapshot?.selected_tests : submitPayload.selected_tests).map((id) => (
                        <li key={id} className="text-sm font-semibold text-gray-900 border-t pt-2 first:border-0 first:pt-0" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                          {testNameById.get(id) || '—'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm font-semibold text-gray-500">—</p>
                  )}
                </div>
              </div>

              <div className="p-5 border-t border-gray-100 flex flex-col sm:flex-row gap-3 justify-end">
                {!reviewSuccess ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setReviewEdit((v) => !v)}
                      className="px-4 py-2.5 rounded-xl text-sm font-extrabold border bg-white"
                      style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                      disabled={reviewSubmitting}
                    >
                      {reviewEdit ? 'Done Editing' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!canSubmit || reviewSubmitting) return;
                        setReviewSubmitting(true);
                        setReviewError('');
                        try {
                          const res = await onComplete?.(submitPayload);
                          if (res && res.ok === false) throw new Error(res.message || 'Failed');
                          setSubmittedSnapshot(submitPayload);
                          setReviewSuccess(true);
                        } catch (e) {
                          setReviewError(e?.message || 'Failed');
                        } finally {
                          setReviewSubmitting(false);
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl text-sm font-extrabold text-white bg-[#0077B6] hover:bg-[#00B4D8] disabled:opacity-60 transition shadow-sm"
                      disabled={disabled || !canSubmit || reviewSubmitting}
                    >
                      {reviewSubmitting ? 'Saving…' : 'Complete'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setReviewOpen(false);
                      resetForm();
                      setSubmittedSnapshot(null);
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm font-extrabold border bg-white"
                    style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
        : null}
    </div>
  );
}

