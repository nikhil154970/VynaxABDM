import { useEffect, useMemo, useState } from 'react';
import { MdBed, MdCheckCircle, MdClose, MdPerson, MdSearch } from 'react-icons/md';
import '../patients/PatientList.css';
import api from '../../../utils/api';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
const selectCls = 'pl-select w-full';

const WARDS_FALLBACK = [
  { id: 'ICU', name: 'ICU', kind: 'icu' },
  { id: 'General', name: 'General', kind: 'general' },
  { id: 'Private', name: 'Private', kind: 'private' },
];

const NURSE_TRANSFER_REQUESTS_KEY = 'hims_ipd_transfer_requests';

function safeParseArray(raw) {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function readNurseTransferRequests() {
  return safeParseArray(localStorage.getItem(NURSE_TRANSFER_REQUESTS_KEY));
}

function writeNurseTransferRequests(list) {
  localStorage.setItem(NURSE_TRANSFER_REQUESTS_KEY, JSON.stringify(list));
}

async function fetchWards() {
  try {
    const res = await api.get('/receptionist/ipd/wards');
    const items = Array.isArray(res?.data?.items) ? res.data.items : [];
    const mapped = items.map((w) => ({ id: w.id, name: w.name }));
    return mapped.length ? mapped : WARDS_FALLBACK.map((w) => ({ id: w.id, name: w.name }));
  } catch {
    return WARDS_FALLBACK.map((w) => ({ id: w.id, name: w.name }));
  }
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || '').trim());
}

// Fetch real beds from bed management/IPD APIs
async function fetchBeds(wardIdOrName, wardNameFallback) {
  if (!wardIdOrName && !wardNameFallback) return [];

  // If we don't have a UUID wardId (fallback menus like "ICU"/"General"/"Private"),
  // load all available beds and filter by ward name.
  const useWardId = isUuid(wardIdOrName);
  const res = await api.get('/receptionist/ipd/beds', {
    params: {
      status: 'AVAILABLE',
      ...(useWardId ? { wardId: wardIdOrName } : {}),
    },
  });
  const items = Array.isArray(res?.data?.items) ? res.data.items : [];
  const targetName = String(wardNameFallback || wardIdOrName || '').trim().toLowerCase();
  const filtered = useWardId
    ? items
    : items.filter((b) => String(b.wardName || '').trim().toLowerCase() === targetName);

  return filtered.map((b) => ({ id: b.id, code: b.code }));
}

// TODO: Replace with GET /nurses?ward=
async function fetchNurses(ward) {
  if (!ward) return [];
  try {
    const res = await api.get('/receptionist/ipd/nurses');
    const items = Array.isArray(res?.data?.items) ? res.data.items : [];
    return items.map((n) => ({ id: n.id, name: n.name || n.email || 'Nurse', shift: '' }));
  } catch {
    return [];
  }
}

export default function SimpleTransfer() {
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activePatients, setActivePatients] = useState([]);
  const [loadingActivePatients, setLoadingActivePatients] = useState(false);

  const [patient, setPatient] = useState(null);
  const [selectedWard, setSelectedWard] = useState('');

  const [availableBeds, setAvailableBeds] = useState([]);
  const [bedsLoading, setBedsLoading] = useState(false);
  const [selectedBed, setSelectedBed] = useState(null);

  const [nurseList, setNurseList] = useState([]);
  const [nursesLoading, setNursesLoading] = useState(false);
  const [selectedNurse, setSelectedNurse] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [wards, setWards] = useState([]);
  const [nurseRequests, setNurseRequests] = useState([]);
  const [activeRequestId, setActiveRequestId] = useState('');
  const selectedWardName = useMemo(() => {
    if (!selectedWard) return '';
    return wards.find((w) => String(w.id) === String(selectedWard))?.name || selectedWard;
  }, [selectedWard, wards]);

  const suggestions = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    if (!q) return activePatients.slice(0, 8);
    return activePatients
      .filter((p) => {
        const blob = `${p.name || ''} ${p.uhid || ''} ${p.fromWard || ''} ${p.fromBed || ''}`.toLowerCase();
        return blob.includes(q);
      })
      .slice(0, 8);
  }, [search, activePatients]);

  useEffect(() => {
    setNurseRequests(readNurseTransferRequests());
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingActivePatients(true);
      try {
        const res = await api.get('/receptionist/ipd/active');
        const rows = Array.isArray(res?.data?.patients) ? res.data.patients : [];
        const mapped = rows.map((r) => ({
          patientId: r.id,
          name: r.name || '',
          uhid: r.uhid || '',
          fromWard: r.wardName || r.ward || '',
          fromBed: r.bed || '',
          doctor: r.doctor || '',
          status: r.status || '',
        }));
        if (!alive) return;
        setActivePatients(mapped);
      } catch {
        if (!alive) return;
        setActivePatients([]);
      } finally {
        if (alive) setLoadingActivePatients(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await fetchWards();
      if (!alive) return;
      setWards(list);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!selectedWard) {
        setAvailableBeds([]);
        setSelectedBed(null);
        return;
      }
      setBedsLoading(true);
      try {
        const beds = await fetchBeds(selectedWard, selectedWardName || selectedWard);
        if (!alive) return;
        setAvailableBeds(beds);
        setSelectedBed(null);
      } finally {
        if (alive) setBedsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedWard]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!selectedWard) {
        setNurseList([]);
        setSelectedNurse('');
        return;
      }
      setNursesLoading(true);
      try {
        const nurses = await fetchNurses(selectedWard);
        if (!alive) return;
        setNurseList(nurses);
        setSelectedNurse('');
      } finally {
        if (alive) setNursesLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedWard]);

  // Step-by-step resets
  useEffect(() => {
    setSelectedWard('');
    setAvailableBeds([]);
    setSelectedBed(null);
    setNurseList([]);
    setSelectedNurse('');
    setSuccess('');
  }, [patient?.patientId]);

  const handleSelectPatient = (p) => {
    setPatient(p);
    setSearch(`${p.name} · ${p.uhid}`);
    setDropdownOpen(false);
    setSuccess('');
  };

  const handleApplyNurseRequest = (req) => {
    const matched =
      activePatients.find((p) => String(p.patientId) === String(req.patientId)) ||
      activePatients.find((p) => String(p.uhid).toLowerCase() === String(req.uhid || '').toLowerCase());

    const fallback = {
      patientId: req.patientId,
      name: req.patientName || 'Patient',
      uhid: req.uhid || '',
      fromWard: req.fromWard || '',
      fromBed: req.fromBed || '',
    };

    const selected = matched || fallback;
    setPatient(selected);
    setSearch(`${selected.name} · ${selected.uhid}`);
    setDropdownOpen(false);
    setSelectedWard(req.toWard || '');
    setSelectedBed(null);
    setSelectedNurse('');
    setSuccess('');
    setActiveRequestId(req.id || '');
  };

  const handleTransfer = async () => {
    if (!patient || !selectedWard || !selectedBed || !selectedNurse) return;
    setSubmitting(true);
    try {
      await api.post('/receptionist/ipd/transfers', {
        admissionId: patient.patientId,
        toBedId: selectedBed.id,
        reason: 'Transfer by receptionist',
      });
      /** @type {{patientId:string, fromWard:string, fromBed:string, toWard:string, toBed:string, nurse:string}} */
      const transfer = {
        patientId: patient.patientId,
        fromWard: patient.fromWard,
        fromBed: patient.fromBed,
        toWard: selectedWardName || selectedWard,
        toBed: selectedBed.code,
        nurse: nurseList.find((n) => n.id === selectedNurse)?.name || '',
      };
      setSuccess(`Transferred ${patient.name} to ${transfer.toWard} · ${transfer.toBed} (Nurse: ${transfer.nurse})`);
      setSuccessModalOpen(true);
      if (activeRequestId) {
        const left = readNurseTransferRequests().filter((r) => String(r.id) !== String(activeRequestId));
        writeNurseTransferRequests(left);
        setNurseRequests(left);
        setActiveRequestId('');
      }
      // Refresh active admission source so current ward/bed is updated everywhere
      const res = await api.get('/receptionist/ipd/active');
      const rows = Array.isArray(res?.data?.patients) ? res.data.patients : [];
      setActivePatients(
        rows.map((r) => ({
          patientId: r.id,
          name: r.name || '',
          uhid: r.uhid || '',
          fromWard: r.wardName || r.ward || '',
          fromBed: r.bed || '',
          doctor: r.doctor || '',
          status: r.status || '',
        })),
      );
      setPatient((prev) =>
        prev
          ? {
              ...prev,
              fromWard: transfer.toWard,
              fromBed: transfer.toBed,
            }
          : prev,
      );
    } catch (err) {
      const msg = err?.response?.data?.message || 'Transfer failed. Please try again.';
      window.alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const canPickWard = Boolean(patient);
  const canPickBed = Boolean(patient && selectedWard);
  const canPickNurse = Boolean(patient && selectedWard && selectedBed);
  const canConfirm = Boolean(patient && selectedWard && selectedBed && selectedNurse && !submitting);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="space-y-4">
            {/* Nurse transfer requests (prefill source) */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-extrabold text-gray-600">Nurse transfer requests</p>
                <span className="text-[11px] font-extrabold text-gray-400">{nurseRequests.length} pending</span>
              </div>
              {nurseRequests.length ? (
                <div className="space-y-2 max-h-44 overflow-auto pr-1">
                  {nurseRequests.map((r) => (
                    <div
                      key={r.id}
                      className={`rounded-xl border px-3 py-2 flex items-start justify-between gap-3 ${
                        String(activeRequestId) === String(r.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-gray-50/70'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-gray-900 truncate">{r.patientName || 'Patient'}</p>
                        <p className="text-[11px] text-gray-600">
                          {r.fromWard} / {r.fromBed} → <b>{r.toWard}</b>
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">{r.uhid || '—'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyNurseRequest(r)}
                        className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-extrabold text-blue-800 hover:bg-blue-100 transition"
                      >
                        Use request
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No nurse transfer requests right now.</p>
              )}
            </div>

            {/* 1) Patient search */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-extrabold text-gray-600 mb-2">1) Select patient</p>
              <div className="relative">
                <MdSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder={loadingActivePatients ? 'Loading active admissions…' : 'Search by Name / UHID'}
                  className={`${inputCls} pl-9`}
                />

                {dropdownOpen ? (
                  <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-xl ring-1 ring-black/5">
                    <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-4 py-2 text-[11px] font-extrabold text-gray-500">
                      <span>{suggestions.length} suggestion(s)</span>
                      <button type="button" className="font-extrabold text-blue-700" onClick={() => setDropdownOpen(false)}>
                        Close
                      </button>
                    </div>
                    {suggestions.length ? (
                      suggestions.map((p) => (
                        <button
                          key={p.patientId}
                          type="button"
                          onClick={() => handleSelectPatient(p)}
                          className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition last:border-0 hover:bg-blue-50/70"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                            <MdPerson className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-extrabold text-gray-900">{p.name}</p>
                            <p className="truncate font-mono text-xs font-bold text-blue-600">{p.uhid}</p>
                            <p className="text-xs text-gray-500">
                              {p.fromWard} · <span className="font-mono font-semibold">{p.fromBed}</span>
                            </p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">No match found.</div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Current info */}
              <div className="mt-4 rounded-2xl border border-gray-100 bg-slate-50/80 p-4">
                <p className="text-xs font-extrabold text-gray-600 mb-2">Current info</p>
                {patient ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { k: 'Name', v: patient.name },
                      { k: 'UHID', v: patient.uhid, mono: true },
                      { k: 'Ward', v: patient.fromWard },
                      { k: 'Bed', v: patient.fromBed, mono: true },
                    ].map((x) => (
                      <div key={x.k} className="rounded-xl border border-gray-100 bg-white px-4 py-3">
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">{x.k}</p>
                        <p className={`mt-1 text-sm font-extrabold text-gray-900 ${x.mono ? 'font-mono' : ''}`}>{x.v}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Pick a patient to continue.</p>
                )}
              </div>
            </div>

            {/* 2) Ward */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-extrabold text-gray-600 mb-2">2) Select new ward</p>
              <select
                className={selectCls}
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                disabled={!canPickWard}
              >
                <option value="">{patient ? 'Select ward' : 'Select patient first'}</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3) Beds */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-extrabold text-gray-600">3) Select available bed</p>
                <span className="text-[11px] font-extrabold text-gray-400">
                  {bedsLoading ? 'Loading…' : canPickBed ? `${availableBeds.length} available` : '—'}
                </span>
              </div>

              {!canPickBed ? (
                <p className="text-sm text-gray-500">Select ward to load available beds.</p>
              ) : bedsLoading ? (
                <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
                  Loading beds…
                </div>
              ) : availableBeds.length ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {availableBeds.map((b) => {
                    const selected = selectedBed?.id === b.id;
                    const isCurrent = patient && patient.fromWard === selectedWard && patient.fromBed === b.code;
                    const disabled = isCurrent;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedBed(b)}
                        className={`rounded-xl border-2 px-2 py-3 text-center text-xs font-extrabold transition ${
                          disabled
                            ? 'cursor-not-allowed border-red-200 bg-red-50/90 text-red-400 line-through'
                            : selected
                              ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                              : 'border-emerald-200 bg-emerald-50/80 text-emerald-900 hover:border-emerald-400'
                        }`}
                        title={disabled ? 'Current bed' : 'Available'}
                      >
                        <MdBed className="inline h-4 w-4 mr-1 -mt-0.5" />
                        {b.code}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No beds available.</p>
              )}
              {selectedBed ? (
                <p className="mt-2 text-xs text-gray-600">
                  Selected bed: <span className="font-mono font-extrabold text-blue-700">{selectedBed.code}</span>
                </p>
              ) : null}
            </div>

            {/* 4) Nurse */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-extrabold text-gray-600">4) Select nurse</p>
                <span className="text-[11px] font-extrabold text-gray-400">
                  {nursesLoading ? 'Loading…' : selectedWard ? `${nurseList.length} nurse(s)` : '—'}
                </span>
              </div>

              <select
                className={selectCls}
                value={selectedNurse}
                onChange={(e) => setSelectedNurse(e.target.value)}
                disabled={!canPickNurse}
              >
                <option value="">
                  {!patient
                    ? 'Select patient first'
                    : !selectedWard
                      ? 'Select ward first'
                      : !selectedBed
                        ? 'Select bed first'
                        : 'Select nurse'}
                </option>
                {nurseList.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} {n.shift ? `· ${n.shift}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 5) Confirm */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-extrabold text-gray-600 mb-2">5) Confirm transfer</p>
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-blue-50/50 p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-800">Preview</p>
                <p className="mt-2 text-sm font-extrabold text-gray-900">
                  {patient ? (
                    <>
                      {patient.fromWard} / <span className="font-mono">{patient.fromBed}</span>
                    </>
                  ) : (
                    '—'
                  )}
                  <span className="mx-2 text-indigo-400">→</span>
                  {selectedWard ? (
                    <>
                      {selectedWardName || '—'} / <span className="font-mono">{selectedBed?.code || '—'}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Nurse:{' '}
                  <span className="font-semibold text-gray-800">
                    {selectedNurse ? nurseList.find((n) => n.id === selectedNurse)?.name || '—' : '—'}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleTransfer}
                disabled={!canConfirm}
                className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl py-3 px-5 text-sm font-extrabold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #065f46, #059669)' }}
                title={!canConfirm ? 'Complete previous steps' : 'Confirm transfer'}
              >
                <MdCheckCircle className="h-4 w-4" />
                {submitting ? 'Saving…' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
      </div>
      {successModalOpen && success ? (
        <div className="pl-modalOverlay" role="dialog" aria-modal="true" onClick={() => setSuccessModalOpen(false)}>
          <div className="pl-modal w-full max-w-md !rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <MdCheckCircle className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-emerald-700">Transfer Successful</p>
                    <p className="text-xs text-gray-500">Bed transfer has been completed.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="pl-modalClose !w-9 !h-9"
                  onClick={() => setSuccessModalOpen(false)}
                  title="Close"
                >
                  <MdClose className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="px-5 pb-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-extrabold text-emerald-800">
                {success}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-700"
                  onClick={() => setSuccessModalOpen(false)}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}