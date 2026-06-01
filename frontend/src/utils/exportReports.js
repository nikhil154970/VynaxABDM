function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function formatMoneyExport(n) {
  const x = Math.max(0, Number(n) || 0);
  return `₹${x.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** Build export rows for Overview tab (summary + trends + widgets). */
export function buildOverviewExport(data) {
  if (!data) return null;

  const rows = [];
  const push = (section, metric, value) => rows.push({ section, metric, value });

  const c = data.cards || {};
  push('Summary', 'Total Revenue', formatMoneyExport(c.totalRevenue));
  push('Summary', 'Total Purchase Value', formatMoneyExport(c.totalPurchaseValue));
  push('Summary', 'Inventory Value', formatMoneyExport(c.currentInventoryValue));
  push('Summary', 'Outstanding Dues', formatMoneyExport(c.totalOutstandingDues));
  push('Summary', 'Returns Value', formatMoneyExport(c.totalReturnsValue));

  (data.charts?.salesTrend || []).forEach((p) => {
    push('Sales Trend', p.label || p.date, formatMoneyExport(p.amount));
  });
  (data.charts?.purchaseTrend || []).forEach((p) => {
    push('Purchase Trend', p.label || p.date, formatMoneyExport(p.amount));
  });
  (data.charts?.revenueVsPurchase || []).forEach((p) => {
    push('Revenue vs Purchase', `${p.label || ''} — Revenue`, formatMoneyExport(p.revenue));
    push('Revenue vs Purchase', `${p.label || ''} — Purchase`, formatMoneyExport(p.purchase));
  });

  (data.widgets?.topSellingMedicines || []).forEach((m) => {
    push('Top Selling Medicines', m.medicineName, `${m.quantity} units · ${formatMoneyExport(m.amount)}`);
  });
  (data.widgets?.topSuppliers || []).forEach((s) => {
    push('Top Suppliers', s.supplierName, formatMoneyExport(s.purchaseValue));
  });
  (data.widgets?.lowStockAlerts || []).forEach((m) => {
    push('Low Stock Alerts', m.medicineName, `${m.availableQty} units`);
  });
  (data.widgets?.expiryAlerts || []).forEach((e) => {
    push('Expiry Alerts', e.medicineName, `${e.daysRemaining ?? '—'} days · batch ${e.batchNumber || '—'}`);
  });

  return {
    title: 'Pharmacy Overview Report',
    columns: [
      { key: 'section', label: 'Section' },
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value' },
    ],
    rows,
  };
}

export function exportTableCsv(filename, headers, rows) {
  const lines = rows.map((row) => headers.map((h) => csvEscape(row[h.key] ?? row[h] ?? '')).join(','));
  const headerLine = headers.map((h) => (typeof h === 'string' ? h : h.label)).join(',');
  const csv = [headerLine, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportTableExcel(filename, headers, rows) {
  const head = headers.map((h) => (typeof h === 'string' ? h : h.label));
  const body = rows
    .map((row) =>
      `<tr>${headers
        .map((h) => {
          const key = typeof h === 'string' ? h : h.key;
          const val = row[key] ?? '';
          return `<td>${String(val).replace(/</g, '&lt;')}</td>`;
        })
        .join('')}</tr>`
    )
    .join('');
  const html = `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printReportHtml(title, headers, rows) {
  const head = headers.map((h) => (typeof h === 'string' ? h : h.label));
  const keys = headers.map((h) => (typeof h === 'string' ? h : h.key));
  const body = rows
    .map(
      (row) =>
        `<tr>${keys.map((k) => `<td>${String(row[k] ?? '—').replace(/</g, '&lt;')}</td>`).join('')}</tr>`
    )
    .join('');
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px}h1{font-size:16px}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f8faff}</style></head>
<body><h1>${title}</h1><p style="color:#666;font-size:12px">Generated ${new Date().toLocaleString('en-IN')}</p>
<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}
