/**
 * Purchase Order print — professional A4 layout (data from GET /pharmacy/purchase-orders/:id/print).
 */
import api from './api';
import { HOSPITAL_NAME_DISPLAY } from './hospitalBranding';

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

function fmtPrintDateTime() {
  const d = new Date();
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * @param {string} orderId — MongoDB purchase order id
 */
export async function printPurchaseOrder(orderId) {
  if (!orderId) return;

  const res = await api.get(`/pharmacy/purchase-orders/${encodeURIComponent(orderId)}/print`);
  const d = res?.data?.printData;
  if (!d) return;

  const itemRows = (d.items || [])
    .map(
      (item) => `
      <tr>
        <td class="c">${safeText(item.sno)}</td>
        <td class="l med-name">
          <div class="brand">${safeText(item.brandName || item.medicineName)}</div>
          ${item.genericName ? `<div class="generic">(${safeText(item.genericName)})</div>` : ''}
        </td>
        <td class="c">${safeText(item.hsnCode)}</td>
        <td class="c">${safeText(item.quantity)}</td>
        <td class="c">${safeText(item.unit)}</td>
        <td class="r">${safeText(fmtNum(item.rate))}</td>
        <td class="c">${safeText(item.gstPercentage)}%</td>
        <td class="r">${safeText(fmtNum(item.amount))}</td>
      </tr>`,
    )
    .join('');

  const draftBanner =
    d.status === 'Draft'
      ? '<div class="draft-banner">DRAFT — NOT FOR SUPPLY</div>'
      : d.status === 'Cancelled'
        ? '<div class="draft-banner cancelled">CANCELLED</div>'
        : '';

  const w = window.open('', '_blank', 'width=920,height=900');
  if (!w) return;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Purchase Order ${safeText(d.poNumber)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 8px;
      font-size: 11px;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .po-doc { border: 2px solid #003399; max-width: 210mm; margin: 0 auto; }

    .top-bar {
      background: #003399;
      color: #fff;
      text-align: center;
      font-weight: bold;
      font-size: 12px;
      letter-spacing: 2px;
      padding: 5px 8px;
    }

    .header {
      display: grid;
      grid-template-columns: 90px 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      background: linear-gradient(135deg, #003399 0%, #1a4fb5 55%, #2a5fc9 100%);
      color: #fff;
      border-bottom: 3px solid #003399;
    }
    .logo-box {
      width: 78px;
      height: 78px;
      background: #fff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 4px;
    }
    .logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .header-center h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.3px;
    }
    .header-center .hi {
      font-size: 14px;
      font-weight: 700;
      margin-top: 2px;
    }
    .header-center .addr {
      font-size: 10px;
      margin-top: 4px;
      opacity: 0.95;
      line-height: 1.35;
    }
    .header-contact {
      text-align: right;
      font-size: 10px;
      line-height: 1.5;
      min-width: 160px;
    }
    .header-contact .ico { margin-right: 4px; }

    .title-bar {
      text-align: center;
      padding: 6px;
      font-size: 14px;
      font-weight: 800;
      color: #003399;
      border-bottom: 1px solid #c5d4f0;
      background: #f8faff;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid #003399;
    }
    .meta-col {
      padding: 10px 12px;
      font-size: 11px;
      line-height: 1.65;
    }
    .meta-col + .meta-col {
      border-left: 1px solid #003399;
    }
    .meta-col .lbl { color: #003399; font-weight: 700; }
    .meta-col .val { font-weight: 600; }
    .po-no-val { color: #c00; font-weight: 800; }
    .supplier-title {
      color: #003399;
      font-weight: 800;
      font-size: 12px;
      margin-bottom: 6px;
      text-decoration: underline;
    }

    table.items {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    table.items thead th {
      background: #003399;
      color: #fff;
      padding: 7px 6px;
      font-weight: 700;
      border: 1px solid #003399;
      text-align: center;
    }
    table.items tbody td {
      border: 1px solid #b8c9e8;
      padding: 6px 5px;
      vertical-align: top;
    }
    table.items .c { text-align: center; }
    table.items .r { text-align: right; }
    table.items .l { text-align: left; }
    table.items .med-name .brand { font-weight: 700; color: #111; }
    table.items .med-name .generic { font-size: 9.5px; color: #444; margin-top: 1px; }

    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr auto;
      border-top: 1px solid #003399;
    }
    .remarks {
      padding: 10px 12px;
      font-size: 11px;
      border-right: 1px solid #003399;
    }
    .remarks b { color: #003399; }
    .totals {
      min-width: 220px;
      font-size: 11px;
    }
    .totals table { width: 100%; border-collapse: collapse; }
    .totals td {
      padding: 6px 10px;
      border-bottom: 1px solid #b8c9e8;
    }
    .totals .lbl { text-align: left; font-weight: 600; }
    .totals .val { text-align: right; font-weight: 700; white-space: nowrap; }
    .totals tr.grand td {
      background: #e8f0ff;
      color: #003399;
      font-size: 12px;
      font-weight: 800;
      border-bottom: none;
    }

    .signatures {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border-top: 1px solid #003399;
      text-align: center;
      font-size: 10px;
    }
    .sig-cell {
      padding: 10px 6px 14px;
      border-right: 1px solid #b8c9e8;
    }
    .sig-cell:last-child { border-right: none; }
    .sig-title { font-weight: 800; color: #003399; margin-bottom: 28px; }
    .sig-line {
      border-top: 1px dashed #666;
      margin: 0 8px;
      padding-top: 4px;
      font-size: 9px;
      color: #555;
    }
    .stamp-box {
      border: 1px dashed #999;
      height: 36px;
      margin: 4px 12px 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      color: #888;
    }

    .footer-msg {
      text-align: center;
      padding: 8px;
      font-weight: 800;
      color: #003399;
      font-size: 11px;
      border-top: 1px solid #003399;
    }
    .page-no {
      text-align: right;
      padding: 4px 10px 8px;
      font-size: 9px;
      color: #666;
    }

    .draft-banner {
      background: #fff3cd;
      color: #856404;
      text-align: center;
      font-weight: 800;
      padding: 4px;
      font-size: 11px;
      border-bottom: 1px solid #ffc107;
    }
    .draft-banner.cancelled {
      background: #fde8e8;
      color: #b91c1c;
      border-color: #fca5a5;
    }

    .print-ts {
      font-size: 9px;
      color: #666;
      padding: 4px 10px 0;
    }

    @media print {
      body { padding: 0; }
      .po-doc { border-width: 1px; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="print-ts">${safeText(fmtPrintDateTime())}</div>
  <div class="po-doc">
    ${draftBanner}
    <div class="top-bar">PURCHASE ORDER</div>

    <div class="header">
      <div class="logo-box">
        <img src="/hopital_logo.png" alt="${HOSPITAL_NAME_DISPLAY}" />
      </div>
      <div class="header-center">
        <div class="hi">${safeText(d.hospital?.nameHi)}</div>
        <h1>${safeText(d.hospital?.nameEn)}</h1>
        <div class="addr">${safeText(d.hospital?.address)}</div>
      </div>
      <div class="header-contact">
        <div><span class="ico">📞</span> ${safeText(d.hospital?.phone)}</div>
        <div><span class="ico">✉</span> ${safeText(d.hospital?.email)}</div>
      </div>
    </div>

    <div class="title-bar">PURCHASE ORDER (PO)</div>

    <div class="meta-grid">
      <div class="meta-col">
        <div><span class="lbl">PO No.:</span> <span class="val po-no-val">${safeText(d.poNumber)}</span></div>
        <div><span class="lbl">PO Date:</span> <span class="val">${safeText(d.poDate)}</span></div>
        <div><span class="lbl">Total Items:</span> <span class="val">${safeText(d.totalItems)}</span></div>
        <div><span class="lbl">Transport:</span> <span class="val">${safeText(d.transport)}</span></div>
      </div>
      <div class="meta-col">
        <div class="supplier-title">Supplier Details</div>
        <div><span class="lbl">Supplier Name:</span> <span class="val">${safeText(d.supplier?.supplierName)}</span></div>
        <div><span class="lbl">Address:</span> <span class="val">${safeText(d.supplier?.address || '—')}</span></div>
        <div><span class="lbl">Phone No.:</span> <span class="val">${safeText(d.supplier?.phone)}</span></div>
        <div><span class="lbl">GST No.:</span> <span class="val">${safeText(d.supplier?.gstNumber)}</span></div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width:4%">S.NO.</th>
          <th style="width:28%">MEDICINE NAME</th>
          <th style="width:10%">HSN CODE</th>
          <th style="width:6%">QTY</th>
          <th style="width:8%">UNIT</th>
          <th style="width:10%">RATE (₹)</th>
          <th style="width:7%">GST %</th>
          <th style="width:12%">AMOUNT (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || '<tr><td colspan="8" class="c">No items</td></tr>'}
      </tbody>
    </table>

    <div class="bottom-grid">
      <div class="remarks">
        <b>Remarks / Instructions:</b><br/>
        ${safeText(d.remarks)}
      </div>
      <div class="totals">
        <table>
          <tr>
            <td class="lbl">SUBTOTAL:</td>
            <td class="val">${safeText(fmtMoney(d.subTotal))}</td>
          </tr>
          <tr>
            <td class="lbl">${safeText(d.gstLabel || 'GST')}:</td>
            <td class="val">${safeText(fmtMoney(d.gstAmount))}</td>
          </tr>
          <tr class="grand">
            <td class="lbl">GRAND TOTAL:</td>
            <td class="val">${safeText(fmtMoney(d.grandTotal))}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="signatures">
      <div class="sig-cell">
        <div class="sig-title">Prepared By</div>
        <div class="stamp-box">Stamp</div>
        <div class="sig-line">${safeText(d.preparedBy || 'Pharmacist')}</div>
      </div>
      <div class="sig-cell">
        <div class="sig-title">Approved By</div>
        <div class="sig-line">Admin</div>
      </div>
      <div class="sig-cell">
        <div class="sig-title">Supplier Signature</div>
        <div class="sig-line">&nbsp;</div>
      </div>
      <div class="sig-cell">
        <div class="sig-title">Authorized Signature</div>
        <div class="sig-line">&nbsp;</div>
      </div>
    </div>

    <div class="footer-msg">THANK YOU FOR YOUR BUSINESS!</div>
    <div class="page-no">Page 1 of 1</div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 350);
    };
  </script>
</body>
</html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}
