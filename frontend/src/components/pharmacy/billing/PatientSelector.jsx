import { Search } from 'lucide-react';

function Field({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-1.5">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="truncate text-[13px] font-semibold text-slate-800">{value || '—'}</p>
    </div>
  );
}

export default function PatientSelector({
  activeTab,
  onTabChange,
  hospitalSearch,
  onHospitalSearchChange,
  patientResults,
  onSelectPatient,
  selectedPatient,
  walkIn,
  onWalkInChange,
}) {
  return (
    <>
      {activeTab === 'hospital' ? (
        <>
          <label className="relative mb-2 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={hospitalSearch}
              onChange={(e) => onHospitalSearchChange(e.target.value)}
              placeholder="UHID, name, mobile, token..."
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
          </label>
          {patientResults?.length > 0 && !selectedPatient && (
            <ul className="mb-2 max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              {patientResults.map((p) => (
                <li key={p.patientId}>
                  <button
                    type="button"
                    onClick={() => onSelectPatient(p)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-blue-50"
                  >
                    <span className="font-semibold text-slate-900">{p.patientName}</span>
                    <span className="ml-2 text-slate-500">{p.uhid}</span>
                    {p.tokenNumber ? <span className="ml-2 text-blue-600">Token {p.tokenNumber}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedPatient ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Token" value={selectedPatient.tokenNumber} />
              <Field label="Patient" value={selectedPatient.patientName} />
              <Field label="UHID" value={selectedPatient.uhid} />
              <Field label="Doctor" value={selectedPatient.doctorName} />
              <Field label="Mobile" value={selectedPatient.mobile} />
              <Field label="Department" value={selectedPatient.department} />
            </div>
          ) : null}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Customer Name *</span>
            <input
              type="text"
              value={walkIn.name}
              onChange={(e) => onWalkInChange({ ...walkIn, name: e.target.value })}
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-300 focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Mobile</span>
            <input
              type="text"
              value={walkIn.mobile}
              onChange={(e) => onWalkInChange({ ...walkIn, mobile: e.target.value })}
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-300 focus:bg-white"
            />
          </label>
        </div>
      )}
    </>
  );
}
