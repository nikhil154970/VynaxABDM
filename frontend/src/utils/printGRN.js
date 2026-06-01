import api from './api';

function safeText(v) {
  const s = v == null ? '' : String(v);
  return s.replace(/[<>&]/g, (ch) => (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'));
}

function fmtMoney(n) {
  const x = Number(n) || 0;
  return `₹ ${x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function printGRN(grnId) {
  if (!grnId) return;

  const res = await api.get(`/pharmacy/grn/${encodeURIComponent(grnId)}/print`);
  const d = res?.data?.printData;
  if (!d) return;

  const itemRows = (d.items || [])
    .map(
      (item) => `
      <tr>
        <td class="c">${safeText(item.sno)}</td>
        <td class="l">${safeText(item.medicineName)}</td>
        <td class="c">${safeText(item.batchNumber)}</td>
        <td class="c">${safeText(item.expiryDate)}</td>
        <td class="c">${safeText(item.orderedQty)}</td>
        <td class="c">${safeText(item.receivedQty)}</td>
        <td class="c">${safeText(item.freeQty)}</td>
        <td class="r">${safeText(fmtNum(item.purchasePrice))}</td>
        <td class="r">${safeText(fmtNum(item.sellingPrice))}</td>
        <td class="r">${safeText(fmtNum(item.mrp))}</td>
        <td class="c">${safeText(item.gstPercentage)}%</td>
        <td class="r">${safeText(fmtNum(item.amount))}</td>
      </tr>`
    )
    .join('');

  const w = window.open('', '_blank', 'width=920,height=900');
  if (!w) return;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>GRN ${safeText(d.grnNumber)}</title>
<style>
@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}
body{font-family:Arial,sans-serif;margin:0;padding:8px;font-size:11px;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc{border:2px solid #003399;max-width:210mm;margin:0 auto}
.top{background:#003399;color:#fff;text-align:center;font-weight:bold;padding:6px;letter-spacing:2px}
.header{display:grid;grid-template-columns:80px 1fr auto;gap:10px;padding:10px;background:linear-gradient(135deg,#003399,#2a5fc9);color:#fff}
.logo-box{width:70px;height:70px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:4px}
.logo-box img{max-width:100%;max-height:100%}
.title-bar{text-align:center;padding:6px;font-weight:800;color:#003399;background:#f8faff;border-bottom:1px solid #c5d4f0}
.meta{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #003399}
.meta-col{padding:10px;font-size:11px;line-height:1.6}
.meta-col+.meta-col{border-left:1px solid #003399}
.lbl{color:#003399;font-weight:700}
.val{font-weight:600}
.grn-no{color:#c00;font-weight:800}
table.items{width:100%;border-collapse:collapse;font-size:10px}
table.items th{background:#003399;color:#fff;padding:6px;border:1px solid #003399}
table.items td{border:1px solid #b8c9e8;padding:5px}
.c{text-align:center}.r{text-align:right}.l{text-align:left}
.bottom{display:grid;grid-template-columns:1fr auto;border-top:1px solid #003399}
.remarks{padding:10px;border-right:1px solid #003399}
.totals td{padding:6px 10px;border-bottom:1px solid #b8c9e8}
.totals .grand td{background:#e8f0ff;font-weight:800;color:#003399}
.sigs{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #003399;text-align:center;font-size:10px}
.sig{padding:10px 6px 14px;border-right:1px solid #b8c9e8}
.footer{text-align:center;padding:8px;font-weight:800;color:#003399;border-top:1px solid #003399}
</style></head><body>
<div class="doc">
<div class="top">GOODS RECEIPT NOTE (GRN)</div>
<div class="header">
<div class="logo-box"><img src="/hopital_logo.png" alt="NH"/></div>
<div><div style="font-size:14px;font-weight:700">${safeText(d.hospital?.nameHi)}</div>
<div style="font-size:13px;font-weight:800">${safeText(d.hospital?.nameEn)}</div>
<div style="font-size:10px;margin-top:4px">${safeText(d.hospital?.address)}</div></div>
<div style="text-align:right;font-size:10px">📞 ${safeText(d.hospital?.phone)}<br/>✉ ${safeText(d.hospital?.email)}</div>
</div>
<div class="title-bar">GOODS RECEIPT NOTE</div>
<div class="meta">
<div class="meta-col">
<div><span class="lbl">GRN No.:</span> <span class="val grn-no">${safeText(d.grnNumber)}</span></div>
<div><span class="lbl">PO No.:</span> <span class="val">${safeText(d.poNumber)}</span></div>
<div><span class="lbl">Status:</span> <span class="val">${safeText(d.status)}</span></div>
<div><span class="lbl">Receipt:</span> <span class="val">${safeText(d.receiptStatus)}</span></div>
<div><span class="lbl">Received Date:</span> <span class="val">${safeText(d.receivedDate)}</span></div>
<div><span class="lbl">Total Items:</span> <span class="val">${safeText(d.totalItems)}</span></div>
</div>
<div class="meta-col">
<div style="font-weight:800;color:#003399;text-decoration:underline;margin-bottom:6px">Supplier Details</div>
<div><span class="lbl">Name:</span> <span class="val">${safeText(d.supplier?.supplierName)}</span></div>
<div><span class="lbl">Address:</span> <span class="val">${safeText(d.supplier?.address)}</span></div>
<div><span class="lbl">Phone:</span> <span class="val">${safeText(d.supplier?.phone)}</span></div>
<div><span class="lbl">GST:</span> <span class="val">${safeText(d.supplier?.gstNumber)}</span></div>
<div><span class="lbl">Invoice No.:</span> <span class="val">${safeText(d.invoiceNumber)}</span></div>
<div><span class="lbl">Invoice Date:</span> <span class="val">${safeText(d.invoiceDate)}</span></div>
</div>
</div>
<table class="items"><thead><tr>
<th>S.NO</th><th>MEDICINE</th><th>BATCH</th><th>EXPIRY</th><th>ORD</th><th>RCV</th><th>FREE</th>
<th>PUR (₹)</th><th>SELL (₹)</th><th>MRP (₹)</th><th>GST</th><th>AMT (₹)</th>
</tr></thead><tbody>${itemRows}</tbody></table>
<div class="bottom">
<div class="remarks"><b>Remarks:</b><br/>${safeText(d.remarks)}</div>
<table class="totals">
<tr><td>SUBTOTAL:</td><td class="r">${safeText(fmtMoney(d.subTotal))}</td></tr>
<tr><td>GST:</td><td class="r">${safeText(fmtMoney(d.gstAmount))}</td></tr>
<tr class="grand"><td>GRAND TOTAL:</td><td class="r">${safeText(fmtMoney(d.grandTotal))}</td></tr>
</table>
</div>
<div class="sigs">
<div class="sig"><b>Received By</b><br/><br/>${safeText(d.preparedBy)}</div>
<div class="sig"><b>Checked By</b><br/><br/>Pharmacist</div>
<div class="sig"><b>Supplier Sign</b><br/><br/></div>
<div class="sig"><b>Authorized</b><br/><br/></div>
</div>
<div class="footer">INVENTORY UPDATED ON COMPLETION</div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>
</body></html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}
