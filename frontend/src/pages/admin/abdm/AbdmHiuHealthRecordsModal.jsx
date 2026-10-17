import { useEffect } from 'react';
import { MdClose } from 'react-icons/md';

const GROUP_LABELS = [
  { key: 'opConsultation', label: 'OP Consultation' },
  { key: 'prescription', label: 'Prescription' },
  { key: 'ipd', label: 'IPD / Admission' },
  { key: 'discharge', label: 'Discharge Summary' },
  { key: 'lab', label: 'Lab / Diagnostic' },
  { key: 'additional', label: 'Additional Records' },
];

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function uniqueRecords(records) {
  const seen = new Set();
  const out = [];
  for (const record of records || []) {
    const key = record.id
      || [record.recordType, record.date || record.receivedAt, record.uhid, record.title].filter(Boolean).join('|');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(record);
  }
  return out;
}

function FieldRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[9rem_minmax(0,1fr)] gap-1 py-1.5 border-b border-gray-100 last:border-0">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="text-sm text-slate-800 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

function RecordCard({ record, groupLabel }) {
  const clinical = record.clinical || { header: [], blocks: [] };
  const header = [
    { label: 'Patient Name', value: record.patientName },
    { label: 'UHID', value: record.uhid },
    { label: 'Record Type', value: record.title },
    { label: 'Record Date', value: formatWhen(record.date || record.receivedAt) },
    { label: 'Source Facility', value: record.facilityName },
    ...(clinical.header || []),
  ].filter((row) => row.value);
  const seen = new Set();
  const headerRows = header.filter((row) => {
    const key = row.label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 mb-3 shadow-sm">
      <div className="rounded-lg bg-slate-50 px-3 py-3 mb-3">
        {headerRows.map((row) => (
          <FieldRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
      {(clinical.blocks || []).map((block, index) => {
        const showHeading = block.heading && block.heading !== groupLabel && block.heading !== record.title;
        return (
          <div key={`${block.heading || 'block'}-${index}`} className="mb-3 min-w-0">
            {showHeading ? (
              <p className="text-sm font-extrabold text-[#0077B6] mb-1">{block.heading}</p>
            ) : null}
            {(block.fields || []).map((row) => (
              <FieldRow key={`${block.heading}-${row.label}-${row.value}`} label={row.label} value={row.value} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function AbdmHiuHealthRecordsModal({ open, onClose, loading, data, error }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const groups = data?.groups || {};
  const hasAny = Number(data?.recordCount || 0) > 0;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} />
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hiu-records-title"
          className="pointer-events-auto flex w-full max-w-3xl max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        >
          <div className="shrink-0 flex items-start justify-between gap-3 border-b border-gray-100 bg-[#f8faff] px-5 py-4">
            <div className="min-w-0">
              <p id="hiu-records-title" className="text-base font-extrabold text-[#001B48]">External Health Records</p>
              <p className="text-xs text-slate-500 mt-1">Read-only clinical records received from the patient&apos;s facility</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
              aria-label="Close"
            >
              <MdClose className="w-4 h-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {loading ? <p className="text-sm text-slate-500">Loading records…</p> : null}
            {error ? <p className="text-sm text-red-600 break-words">{error}</p> : null}
            {!loading && !error && !hasAny ? (
              <p className="text-sm text-slate-500">No health records to display yet.</p>
            ) : null}
            {GROUP_LABELS.map((group) => {
              const records = uniqueRecords(groups[group.key] || []);
              if (!records.length) return null;
              return (
                <div key={group.key} className="mt-5 first:mt-0 min-w-0">
                  <p className="text-base font-extrabold text-[#001B48] mb-2">{group.label}</p>
                  {records.map((record) => (
                    <RecordCard key={record.id || `${record.recordType}-${record.date}-${record.uhid}`} record={record} groupLabel={group.label} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
