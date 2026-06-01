function safeText(v) {
  const s = v == null ? '' : String(v);
  return s.replace(/[<>&]/g, (ch) => (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'));
}

function fmtMoney(n) {
  const x = Number(n) || 0;
  return `₹ ${x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function printInventoryReport({ summary, rows, title = 'Pharmacy Inventory Report' }) {
  const itemRows = (rows || [])
    .map(
      (r) => `
      <tr>
        <td class="l">${safeText(r.medicineName)}</td>
        <td class="l">${safeText(r.genericName)}</td>
        <td class="c">${safeText(r.category)}</td>
        <td class="c">${safeText(r.totalStock)}</td>
        <td class="c">${safeText(r.availableStock)}</td>
        <td class="c">${safeText(r.batchCount)}</td>
        <td class="c">${safeText(fmtDate(r.nearestExpiry))}</td>
        <td class="r">${safeText(fmtMoney(r.inventoryValue))}</td>
        <td class="c">${safeText(r.status)}</td>
      </tr>`
    )
    .join('');

  const w = window.open('', '_blank', 'width=920,height=900');
  if (!w) return;

  const printedAt = new Date().toLocaleString('en-IN');
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${safeText(title)}</title>
<style>
@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}
body{font-family:Arial,sans-serif;margin:0;padding:8px;font-size:11px;color:#111}
.doc{border:2px solid #003399;max-width:297mm;margin:0 auto}
.top{background:#003399;color:#fff;text-align:center;font-weight:bold;padding:8px;letter-spacing:1px}
.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px;border-bottom:1px solid #c5d4f0;background:#f8faff}
.meta div{font-size:11px}.meta b{color:#003399;display:block;font-size:10px}
table{width:100%;border-collapse:collapse;font-size:10px}
th{background:#003399;color:#fff;padding:6px;border:1px solid #003399}
td{border:1px solid #b8c9e8;padding:5px}
.c{text-align:center}.r{text-align:right}.l{text-align:left}
.footer{text-align:center;padding:8px;font-size:10px;color:#475569;border-top:1px solid #c5d4f0}
</style></head><body>
<div class="doc">
<div class="top">${safeText(title)}</div>
<div class="meta">
  <div><b>Total Medicines</b>${safeText(summary?.totalMedicines ?? 0)}</div>
  <div><b>Total Stock Qty</b>${safeText(summary?.totalStockQuantity ?? 0)}</div>
  <div><b>Low Stock</b>${safeText(summary?.lowStockMedicines ?? 0)}</div>
  <div><b>Inventory Value</b>${safeText(fmtMoney(summary?.inventoryValue))}</div>
</div>
<table>
<thead><tr>
<th>Medicine</th><th>Generic</th><th>Category</th><th>Total</th><th>Available</th>
<th>Batches</th><th>Nearest Expiry</th><th>Value</th><th>Status</th>
</tr></thead>
<tbody>${itemRows || '<tr><td colspan="9" class="c">No data</td></tr>'}</tbody>
</table>
<div class="footer">Printed ${safeText(printedAt)} · Stock sourced from GRN only</div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;

  w.document.write(html);
  w.document.close();
}
