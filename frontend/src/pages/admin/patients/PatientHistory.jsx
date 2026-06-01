import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../../utils/api';
import Badge from '../../../components/Badge';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function inr(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Number(n)
  );
}

function doctorName(d) {
  return d?.user?.name || d?.user?.email || '—';
}

function buildTimeline(payload) {
  if (!payload) return [];
  const out = [];

  for (const v of payload.receptionVisits || []) {
    out.push({
      key: `v-${v.id}`,
      at: new Date(v.visitDate || v.createdAt).getTime(),
      kind: 'visit',
      title: 'Reception visit',
      subtitle: [v.visitType, v.status].filter(Boolean).join(' · '),
      detail: [v.department, v.doctorName].filter(Boolean).join(' · ') || null,
    });
  }
  for (const a of payload.appointments || []) {
    out.push({
      key: `a-${a.id}`,
      at: new Date(a.date).getTime(),
      kind: 'appointment',
      title: 'Appointment',
      subtitle: a.opdNumber ? `OPD ${a.opdNumber}` : 'OPD',
      detail: `${doctorName(a.doctor)} · ${a.status || ''}`.trim(),
    });
  }
  for (const c of payload.consultations || []) {
    out.push({
      key: `c-${c.id}`,
      at: new Date(c.createdAt).getTime(),
      kind: 'consultation',
      title: 'Consultation',
      subtitle: c.diagnosis ? String(c.diagnosis).slice(0, 80) : 'Recorded',
      detail: `${doctorName(c.doctor)} · ${c.symptoms ? String(c.symptoms).slice(0, 120) : ''}`.trim(),
    });
  }
  for (const ad of payload.admissions || []) {
    out.push({
      key: `ad-${ad.id}`,
      at: new Date(ad.admissionDate).getTime(),
      kind: 'admission',
      title: 'IPD admission',
      subtitle: ad.ipdNumber || ad.status,
      detail: [
        doctorName(ad.doctor),
        ad.ward?.name,
        ad.bed?.code ? `Bed ${ad.bed.code}` : null,
        ad.dischargeDate ? `Discharged ${formatWhen(ad.dischargeDate)}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }
  for (const b of payload.bills || []) {
    out.push({
      key: `b-${b.id}`,
      at: new Date(b.billDate).getTime(),
      kind: 'bill',
      title: 'Bill',
      subtitle: `${b.billNumber} · ${b.visitType}`,
      detail: `${inr(b.totalAmount)} · Paid ${inr(b.paidAmount)} · ${b.status}`,
    });
  }
  for (const l of payload.labOrders || []) {
    out.push({
      key: `l-${l.id}`,
      at: new Date(l.createdAt).getTime(),
      kind: 'lab',
      title: 'Lab order',
      subtitle: l.orderNumber,
      detail: `${doctorName(l.doctor)} · ${l.status} · Report ${l.reportStatus}`,
    });
  }

  out.sort((x, y) => y.at - x.at);
  return out;
}

const kindVariant = (k) => {
  if (k === 'visit') return 'blue';
  if (k === 'appointment') return 'purple';
  if (k === 'consultation') return 'amber';
  if (k === 'admission') return 'amber';
  if (k === 'bill') return 'green';
  if (k === 'lab') return 'gray';
  return 'gray';
};

export default function PatientHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const patientIdParam = (searchParams.get('patientId') || '').trim();

  const [pickerQ, setPickerQ] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerRows, setPickerRows] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const title = useMemo(() => 'Patient History', []);

  const loadHistory = useCallback(async (id) => {
    if (!id) {
      setData(null);
      return;
    }
    setData(null);
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin/patients/${encodeURIComponent(id)}/history`);
      setData(res.data);
    } catch (e) {
      setData(null);
      setError(e?.response?.data?.message || 'Could not load this patient’s history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(patientIdParam);
  }, [patientIdParam, loadHistory]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const q = pickerQ.trim();
      if (q.length < 2) {
        setPickerRows([]);
        return;
      }
      setPickerLoading(true);
      try {
        const res = await api.get('/admin/patients', { params: { q, page: 1, pageSize: 15 } });
        if (!cancelled) setPickerRows(res.data.patients || []);
      } catch {
        if (!cancelled) setPickerRows([]);
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    };
    const t = setTimeout(run, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pickerQ]);

  const timeline = useMemo(() => buildTimeline(data), [data]);
  const patient = data?.patient;

  const selectPatient = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('patientId', id);
    setSearchParams(next);
    setPickerQ('');
    setPickerRows([]);
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
           
            <Link to="/dashboard/admin/patients" className="text-xs font-semibold text-blue-600 hover:text-blue-800 mt-2 inline-block">
              ← Back to all patients
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5 sm:p-6">
          <p className="text-sm font-semibold text-gray-800 mb-2">Find patient</p>
          <p className="text-xs text-gray-500 mb-3">Type at least 2 characters to search by name, UHID, or mobile.</p>
          <div className="relative max-w-xl">
            <input
              type="search"
              value={pickerQ}
              onChange={(e) => setPickerQ(e.target.value)}
              placeholder="Search to open history…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            />
            {pickerQ.trim().length >= 2 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-64 overflow-y-auto">
                {pickerLoading ? (
                  <div className="px-3 py-3 text-xs text-gray-400">Searching…</div>
                ) : pickerRows.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-gray-400">No matches</div>
                ) : (
                  pickerRows.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPatient(p.id)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    >
                      <span className="font-semibold text-gray-900">{p.name}</span>
                      <span className="text-gray-400 mx-1">·</span>
                      <span className="text-xs text-gray-500 font-mono">{p.uhid || p.id.slice(0, 8)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {!patientIdParam && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 px-5 py-10 text-center text-sm text-gray-500">
            Choose a patient from the search above, or open history from <strong>All Patients</strong>.
          </div>
        )}

        {patientIdParam && error && (
          <div className="rounded-2xl bg-rose-50 text-rose-700 text-sm px-5 py-4 ring-1 ring-rose-100">{error}</div>
        )}

        {patientIdParam && loading && !patient && (
          <div className="text-sm text-gray-400 py-6">Loading record…</div>
        )}

        {patient && (
          <>
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-bold text-gray-900">{patient.name}</p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    UHID {patient.uhid || '—'}
                    {patient.registrationNumber ? ` · ${patient.registrationNumber}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="blue">{patient.gender || '—'}</Badge>
                  <Badge variant="gray">{patient.age != null ? `${patient.age} yrs` : 'Age —'}</Badge>
                  <Badge variant="green">{patient.mobile || 'No mobile'}</Badge>
                </div>
              </div>
              <div className="px-5 py-4 grid sm:grid-cols-2 gap-4 text-sm text-gray-700">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Address</p>
                  <p className="mt-1">{patient.address || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Clinical flags</p>
                  <p className="mt-1">Blood group: {patient.bloodGroup || '—'}</p>
                  <p className="mt-1">Allergies: {patient.allergies || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Emergency</p>
                  <p className="mt-1">
                    {[patient.emergencyName, patient.emergencyPhone, patient.emergencyRelation]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Registered</p>
                  <p className="mt-1">{formatWhen(patient.createdAt)}</p>
                </div>
                {patient.basicHistory && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Basic history</p>
                    <p className="mt-1 whitespace-pre-wrap">{patient.basicHistory}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">Unified timeline</p>
                <p className="text-xs text-gray-400 mt-0.5">Newest events first across all modules.</p>
              </div>
              <div className="divide-y divide-gray-100 max-h-[560px] overflow-y-auto">
                {timeline.length === 0 ? (
                  <div className="px-5 py-8 text-sm text-gray-400">No activity recorded yet for this patient.</div>
                ) : (
                  timeline.map((row) => (
                    <div key={row.key} className="px-5 py-3 flex gap-4">
                      <div className="shrink-0 w-36 text-xs text-gray-500 pt-0.5">{formatWhen(row.at)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={kindVariant(row.kind)}>{row.title}</Badge>
                          <span className="text-sm font-semibold text-gray-900">{row.subtitle}</span>
                        </div>
                        {row.detail && <p className="text-xs text-gray-600 mt-1 break-words">{row.detail}</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <section className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-800 mb-3">Recent consultations</h2>
                <ul className="space-y-3 text-sm max-h-64 overflow-y-auto">
                  {(data.consultations || []).length === 0 ? (
                    <li className="text-gray-400">None</li>
                  ) : (
                    data.consultations.map((c) => (
                      <li key={c.id} className="border-b border-gray-50 pb-3 last:border-0">
                        <p className="text-xs text-gray-400">{formatWhen(c.createdAt)}</p>
                        <p className="font-medium text-gray-900">{doctorName(c.doctor)}</p>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{c.diagnosis}</p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Rx lines: {c.prescriptionSummary?.lines ?? 0} · {c.disposition}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </section>
              <section className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-800 mb-3">Recent admissions</h2>
                <ul className="space-y-3 text-sm max-h-64 overflow-y-auto">
                  {(data.admissions || []).length === 0 ? (
                    <li className="text-gray-400">None</li>
                  ) : (
                    data.admissions.map((a) => (
                      <li key={a.id} className="border-b border-gray-50 pb-3 last:border-0">
                        <p className="text-xs text-gray-400">{formatWhen(a.admissionDate)}</p>
                        <p className="font-medium text-gray-900">{a.ipdNumber || a.status}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {[a.ward?.name, a.bed?.code, doctorName(a.doctor)].filter(Boolean).join(' · ')}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
