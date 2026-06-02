import { HOSPITAL_NAME_DISPLAY } from './hospitalBranding';

function formatMoney(n) {
  const x = Math.max(0, Number(n) || 0);
  return `₹${x.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function exportBillingHistoryCsv(rows) {
  const headers = [
    'Bill Number',
    'Patient Name',
    'UHID',
    'Patient Type',
    'Bill Date',
    'Total Amount',
    'Paid Amount',
    'Pending Amount',
    'Payment Mode',
    'Status',
    'Created By',
  ];
  const lines = rows.map((r) =>
    [
      r.billNumber,
      r.patientName,
      r.patientUhid,
      r.patientTypeLabel,
      r.billDate ? new Date(r.billDate).toISOString() : '',
      r.totalAmount,
      r.paidAmount,
      r.pendingAmount,
      r.paymentModeLabel,
      r.statusLabel,
      r.createdByName,
    ]
      .map(csvEscape)
      .join(',')
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy-billing-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportBillingHistoryExcel(rows) {
  const headers = [
    'Bill Number',
    'Patient Name',
    'UHID',
    'Patient Type',
    'Bill Date',
    'Total Amount',
    'Paid Amount',
    'Pending Amount',
    'Payment Mode',
    'Status',
    'Created By',
  ];
  const trs = rows
    .map(
      (r) => `<tr>
      <td>${r.billNumber || ''}</td>
      <td>${r.patientName || ''}</td>
      <td>${r.patientUhid || ''}</td>
      <td>${r.patientTypeLabel || ''}</td>
      <td>${r.billDate ? new Date(r.billDate).toLocaleDateString('en-IN') : ''}</td>
      <td>${r.totalAmount ?? ''}</td>
      <td>${r.paidAmount ?? ''}</td>
      <td>${r.pendingAmount ?? ''}</td>
      <td>${r.paymentModeLabel || ''}</td>
      <td>${r.statusLabel || ''}</td>
      <td>${r.createdByName || ''}</td>
    </tr>`
    )
    .join('');
  const html = `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${trs}</tbody></table>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy-billing-history-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportBillingHistoryPdf(rows) {
  const trs = rows
    .map(
      (r) => `<tr>
      <td>${r.billNumber || ''}</td>
      <td>${r.patientName || ''}</td>
      <td>${r.patientUhid || '—'}</td>
      <td>${formatMoney(r.totalAmount)}</td>
      <td>${r.statusLabel || ''}</td>
    </tr>`
    )
    .join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Pharmacy Billing History</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; font-size: 11px; padding: 12px; }
    h1 { font-size: 16px; color: #1e3a8a; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px; text-align: left; }
    th { background: #f1f5f9; }
  </style></head><body>
  <h1>${HOSPITAL_NAME_DISPLAY} — Pharmacy Billing History</h1>
  <p>Generated ${new Date().toLocaleString('en-IN')}</p>
  <table>
    <thead><tr><th>Bill No</th><th>Patient</th><th>UHID</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>${trs}</tbody>
  </table>
  <script>window.onload = () => window.print();</script>
  </body></html>`;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
