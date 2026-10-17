import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MdPerson, MdSearch } from 'react-icons/md';
import api from '../../../utils/api';
import PatientBillingLedger from '../../../components/PatientBillingLedger';
import { isAyushmanSponsor, AYUSHMAN_BILLING_NOTICE } from '../../../utils/ayushmanBilling';
import '../patients/PatientList.css';

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

function Section({ icon: Icon, title, subtitle, headerRight, children }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {Icon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Icon className="h-5 w-5" />
            </span>
          ) : null}
          <div>
            <p className="text-sm font-extrabold text-gray-900">{title}</p>
            {subtitle ? <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p> : null}
          </div>
        </div>
        {headerRight || null}
      </div>
      {children}
    </div>
  );
}

export default function GenerateBilling() {
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [ledgerReload, setLedgerReload] = useState(0);

  const fetchPatientSuggestions = useCallback(async (q) => {
    setLoadingSearch(true);
    try {
      const res = await api.get('/receptionist/patients/search', { params: { q } });
      const list = (res.data?.items || [])
        .map((v) => ({
          patientId: v.patientId,
          uhid: v.uhid,
          name: v.name,
          mobile: v.phone,
          visitType: v.visitType === 'IPD' ? 'IPD' : 'OPD',
          doctorName: v.doctor || '—',
          sponsor: v.sponsor || '',
          isAyushman: v.isAyushman === true || isAyushmanSponsor(v.sponsor),
        }))
        .filter((r) => r.patientId);
      setSuggestions(list);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    const t = setTimeout(() => fetchPatientSuggestions(q), 220);
    return () => clearTimeout(t);
  }, [searchQuery, fetchPatientSuggestions]);

  // Enrich a base patient (from search/details) with visit context for the header card.
  const applySelected = useCallback(async (base) => {
    setSearchQuery(`${base.name} · ${base.uhid}`);
    setDropdownOpen(false);
    try {
      const ctxRes = await api.get('/receptionist/billing/context', { params: { patientId: base.patientId } });
      const ctx = ctxRes.data || {};
      setSelectedPatient({
        ...base,
        wardName: ctx.admission?.wardName || '',
        bedCode: ctx.admission?.bedCode || '',
        admissionDate: ctx.admission?.admissionDate
          ? new Date(ctx.admission.admissionDate).toLocaleDateString('en-CA')
          : '',
        ipdId: ctx.admission?.ipdNumber || '',
        sponsor: ctx.sponsor || base.sponsor || '',
        isAyushman: Boolean(ctx.isAyushman) || base.isAyushman,
        department: ctx.appointment?.department || ctx.admission?.department || base.department || '',
      });
    } catch {
      setSelectedPatient({ ...base });
    }
    setLedgerReload((n) => n + 1);
  }, []);

  const handleSelectPatient = (p) => {
    void applySelected(p);
  };

  // Deep-link: navigate here with { state: { uhid } } to open a patient directly.
  useEffect(() => {
    const uhid = location?.state?.uhid;
    if (!uhid) return;
    (async () => {
      try {
        const res = await api.get(`/receptionist/patients/${encodeURIComponent(uhid)}/details`);
        const d = res.data;
        await applySelected({
          patientId: d.id,
          uhid: d.uhid,
          name: d.name,
          mobile: d.phone,
          visitType: d.visitType === 'IPD' ? 'IPD' : 'OPD',
          doctorName: d.doctor || '—',
          sponsor: d.sponsor || '',
          isAyushman: isAyushmanSponsor(d.sponsor),
        });
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.state?.uhid]);

  const resetAll = () => {
    setSelectedPatient(null);
    setSearchQuery('');
    setDropdownOpen(true);
    fetchPatientSuggestions('');
  };

  return (
    <div className="w-full bg-gray-50 pb-24">
      <div className="w-full max-w-none space-y-5 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        <Section icon={MdPerson} title="Patient" subtitle="Search a patient to view their complete billing history.">
          <div className="relative z-30 w-full">
            <MdSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDropdownOpen(true);
              }}
              onFocus={() => {
                setDropdownOpen(true);
                fetchPatientSuggestions(searchQuery.trim());
              }}
              placeholder="Search by Name / UHID / Mobile"
              className={`${inputCls} pl-9`}
              disabled={Boolean(selectedPatient)}
            />
            {dropdownOpen && !selectedPatient && searchQuery.trim() ? (
              <div className="absolute left-0 right-0 z-[100] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-gray-200/80 bg-white shadow-xl ring-1 ring-black/5">
                <div className="flex justify-between border-b border-gray-100 bg-slate-50 px-4 py-2 text-[11px] font-bold text-gray-600">
                  <span>{loadingSearch ? 'Searching…' : `${suggestions.length} match(es)`}</span>
                  <button type="button" className="text-blue-700" onClick={() => setDropdownOpen(false)}>
                    Close
                  </button>
                </div>
                {loadingSearch ? (
                  <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
                ) : suggestions.length ? (
                  suggestions.map((p) => (
                    <button
                      key={p.patientId}
                      type="button"
                      onClick={() => handleSelectPatient(p)}
                      className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition hover:bg-blue-50/70"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                        <MdPerson className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-extrabold text-gray-900">{p.name}</p>
                        <p className="truncate font-mono text-xs font-bold text-blue-600">{p.uhid}</p>
                        <p className="text-xs text-gray-500">
                          {p.visitType} · {p.doctorName}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="py-8 text-center text-sm text-gray-500">No patients found</div>
                )}
              </div>
            ) : null}
          </div>

          {!searchQuery.trim() && suggestions.length > 0 && !selectedPatient ? (
            <div className="mt-4 rounded-2xl border border-gray-100 bg-slate-50/30 p-4">
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-gray-400">Recent Patients</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {suggestions.map((p) => (
                  <button
                    key={p.patientId}
                    type="button"
                    onClick={() => handleSelectPatient(p)}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-left shadow-sm transition-all duration-200 hover:border-blue-200 hover:bg-blue-50/70 hover:shadow"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                      <MdPerson className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-gray-900">{p.name}</p>
                      <p className="truncate font-mono text-[10px] font-bold text-blue-600">{p.uhid}</p>
                      <p className="mt-0.5 text-[10px] font-semibold text-gray-500">
                        {p.visitType} · {p.doctorName}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {selectedPatient?.isAyushman ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
              {AYUSHMAN_BILLING_NOTICE}
            </p>
          ) : null}

          {selectedPatient ? (
            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Name</p>
                    <p className="font-extrabold text-gray-900">{selectedPatient.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">UHID</p>
                    <p className="font-mono font-bold text-blue-700">{selectedPatient.uhid}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Mobile</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedPatient.mobile || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Visit / Doctor</p>
                    <p className="text-sm font-semibold text-gray-800">
                      <span className="rounded-md bg-white/80 px-2 py-0.5 font-extrabold text-blue-800 ring-1 ring-blue-100">
                        {selectedPatient.visitType}
                      </span>{' '}
                      · {selectedPatient.doctorName}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Department</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedPatient.department || 'General'}</p>
                  </div>
                  {selectedPatient.visitType === 'IPD' ? (
                    <>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Ward / Bed</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {selectedPatient.wardName || '—'} · <span className="font-mono">{selectedPatient.bedCode || '—'}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Admission</p>
                        <p className="text-sm text-gray-700">{selectedPatient.admissionDate || '—'}</p>
                      </div>
                      {selectedPatient.ipdId ? (
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">IPD</p>
                          <p className="font-mono text-sm font-bold text-gray-800">{selectedPatient.ipdId}</p>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={resetAll}
                  className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-extrabold text-blue-800 shadow-sm transition hover:bg-blue-50"
                >
                  Change
                </button>
              </div>
            </div>
          ) : null}
        </Section>

        {selectedPatient ? (
          <PatientBillingLedger
            patientId={selectedPatient.patientId}
            reloadToken={ledgerReload}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center text-gray-400">
            <MdPerson className="mx-auto mb-2 h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Select a patient to see their complete billing history</p>
          </div>
        )}
      </div>
    </div>
  );
}
