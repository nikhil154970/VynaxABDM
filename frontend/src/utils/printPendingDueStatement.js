import { HOSPITAL_NAME_DISPLAY } from './hospitalBranding';

function formatMoney(n) {
  const x = Math.max(0, Number(n) || 0);
  return `₹${x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN');
}

export function printPendingDueStatement(row) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Pharmacy Due Statement</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
  th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
  th { background: #f8faff; }
  .pending { color: #be123c; font-weight: bold; }
  .footer { margin-top: 24px; font-size: 11px; color: #64748b; }
</style></head><body>
  <h1>${HOSPITAL_NAME_DISPLAY} — Pharmacy Due Statement</h1>
  <p class="sub">Generated ${new Date().toLocaleString('en-IN')}</p>
  <table>
    <tr><th>Patient Name</th><td>${row.patientName || '—'}</td></tr>
    <tr><th>UHID</th><td>${row.patientUhid || '—'}</td></tr>
    <tr><th>Patient Type</th><td>${row.patientTypeLabel || '—'}</td></tr>
    <tr><th>Bill Number</th><td>${row.billNumber || '—'}</td></tr>
    <tr><th>Total Amount</th><td>${formatMoney(row.totalAmount)}</td></tr>
    <tr><th>Paid Amount</th><td>${formatMoney(row.paidAmount)}</td></tr>
    <tr><th>Pending Amount</th><td class="pending">${formatMoney(row.pendingAmount)}</td></tr>
    <tr><th>Status</th><td>${row.statusLabel || row.status || '—'}</td></tr>
    <tr><th>Last Payment</th><td>${formatDateTime(row.lastPaymentDate)}</td></tr>
  </table>
  <p class="footer">This is a computer-generated pharmacy due statement.</p>
  <script>window.onload = () => { window.print(); };</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=720,height=800');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function exportPendingDuesCsv(rows) {
  const headers = [
    'Patient Name',
    'UHID',
    'Patient Type',
    'Bill Number',
    'Total Amount',
    'Paid Amount',
    'Pending Amount',
    'Last Payment Date',
    'Status',
  ];
  const lines = rows.map((r) =>
    [
      r.patientName,
      r.patientUhid,
      r.patientTypeLabel,
      r.billNumber,
      r.totalAmount,
      r.paidAmount,
      r.pendingAmount,
      r.lastPaymentDate ? new Date(r.lastPaymentDate).toISOString() : '',
      r.statusLabel,
    ]
      .map(csvEscape)
      .join(',')
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy-pending-dues-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPendingDuesExcel(rows) {
  const headers = [
    'Patient Name',
    'UHID',
    'Patient Type',
    'Bill Number',
    'Total Amount',
    'Paid Amount',
    'Pending Amount',
    'Last Payment Date',
    'Status',
  ];
  const trs = rows
    .map(
      (r) => `<tr>
      <td>${r.patientName || ''}</td>
      <td>${r.patientUhid || ''}</td>
      <td>${r.patientTypeLabel || ''}</td>
      <td>${r.billNumber || ''}</td>
      <td>${r.totalAmount ?? ''}</td>
      <td>${r.paidAmount ?? ''}</td>
      <td>${r.pendingAmount ?? ''}</td>
      <td>${r.lastPaymentDate ? new Date(r.lastPaymentDate).toLocaleDateString('en-IN') : ''}</td>
      <td>${r.statusLabel || ''}</td>
    </tr>`
    )
    .join('');
  const html = `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${trs}</tbody></table>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy-pending-dues-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
