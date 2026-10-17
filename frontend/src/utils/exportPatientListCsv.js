function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatDateExport(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const CSV_HEADERS = [
  'Registration No',
  'UHID',
  'Patient Name',
  'Age',
  'Gender',
  'Mobile',
  'Visit Type',
  'Department',
  'Doctor',
  'Status',
  'Visit Date',
  'Token',
  'Payment Status',
  'Payment Mode',
  'Registration Fee',
  'Sponsor',
  'Address',
];

function rowToCsvLine(p) {
  return [
    p.registrationNumber,
    p.uhid,
    p.name,
    p.age,
    p.gender,
    p.phone,
    p.visitType,
    p.department,
    p.doctor,
    p.status,
    formatDateExport(p.visitDate),
    p.token,
    p.paymentStatus,
    p.paymentMode,
    p.registrationFee,
    p.sponsor,
    p.address,
  ]
    .map(csvCell)
    .join(',');
}

/**
 * Download filtered patient list as CSV (Excel-compatible).
 * @param {object[]} items
 * @param {{ filename?: string }} [opts]
 */
export function downloadPatientListCsv(items, opts = {}) {
  const rows = Array.isArray(items) ? items : [];
  const lines = [CSV_HEADERS.join(','), ...rows.map(rowToCsvLine)];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = opts.filename || `vyanx-patients-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
