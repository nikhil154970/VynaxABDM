function formatMoney(n) {
  const x = Math.max(0, Number(n) || 0);
  return `₹${x.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function exportReturnsCsv(rows) {
  const headers = ['Return Number', 'Return Type', 'Reference', 'Patient/Supplier', 'Medicines', 'Total Value', 'Status', 'Created'];
  const lines = rows.map((r) =>
    [
      r.returnNumber,
      r.returnTypeLabel,
      r.referenceNumber,
      r.returnType === 'CUSTOMER_RETURN' ? r.patientName : r.supplierName,
      r.medicineCount,
      r.totalAmount,
      r.statusLabel,
      r.createdAt ? new Date(r.createdAt).toISOString() : '',
    ]
      .map(csvEscape)
      .join(',')
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy-returns-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportReturnsExcel(rows) {
  const headers = ['Return Number', 'Return Type', 'Reference', 'Patient/Supplier', 'Medicines', 'Total Value', 'Status', 'Created'];
  const body = rows
    .map(
      (r) =>
        `<tr>${[
          r.returnNumber,
          r.returnTypeLabel,
          r.referenceNumber,
          r.returnType === 'CUSTOMER_RETURN' ? r.patientName : r.supplierName,
          r.medicineCount,
          formatMoney(r.totalAmount),
          r.statusLabel,
          r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : '',
        ]
          .map((c) => `<td>${String(c ?? '').replace(/</g, '&lt;')}</td>`)
          .join('')}</tr>`
    )
    .join('');
  const html = `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy-returns-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printReturnSlip(ret) {
  if (!ret) return;
  const items = ret.items || [];
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  const rows = items
    .map(
      (i) =>
        `<tr><td>${i.medicineName}</td><td>${i.batchNumber || '—'}</td><td>${i.quantity}</td><td>₹${Number(i.amount || 0).toFixed(2)}</td></tr>`
    )
    .join('');
  w.document.write(`<!DOCTYPE html><html><head><title>${ret.returnNumber}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}h1{font-size:18px;margin:0}
table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}
.meta{margin-top:12px;font-size:12px;color:#444}.total{margin-top:16px;font-size:14px;font-weight:bold}</style></head><body>
<h1>Pharmacy Return Slip — ${ret.returnNumber}</h1>
<div class="meta">Type: ${ret.returnTypeLabel || ret.returnType} · Status: ${ret.statusLabel || ret.status}<br/>
Reference: ${ret.referenceNumber || '—'} · ${ret.returnType === 'CUSTOMER_RETURN' ? `Patient: ${ret.patientName}` : `Supplier: ${ret.supplierName}`}<br/>
Date: ${ret.createdAt ? new Date(ret.createdAt).toLocaleString('en-IN') : '—'}</div>
<table><thead><tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="total">Total: ₹${Number(ret.totalAmount || 0).toLocaleString('en-IN')}</div>
<script>window.onload=function(){window.print();}</script></body></html>`);
  w.document.close();
}
