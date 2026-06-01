function safeText(v) {
  const s = v == null ? '' : String(v);
  return s.replace(/[<>&]/g, (ch) => (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'));
}

function fmtMoney(n) {
  return `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function buildInvoiceHtml(d) {
  if (!d) return '';

  const rows = (d.items || [])
    .map(
      (item) => `
      <tr>
        <td class="c">${item.sno}</td>
        <td class="l">${safeText(item.medicineName)}<br/><small>Batch ${safeText(item.batchNumber)}</small></td>
        <td class="c">${item.quantity}</td>
        <td class="r">${fmtMoney(item.mrp)}</td>
        <td class="c">${item.discountPercent}%</td>
        <td class="c">${item.gstPercentage}%</td>
        <td class="r">${fmtMoney(item.amount)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeText(d.billNumber)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 12px; }
    .head { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 12px; }
    .head h1 { margin: 0; font-size: 16px; color: #1e3a8a; }
    .head p { margin: 2px 0; font-size: 10px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 12px; gap: 8px; }
    .box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; width: 48%; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e2e8f0; padding: 5px 4px; }
    th { background: #f1f5f9; font-size: 10px; }
    .c { text-align: center; } .r { text-align: right; } .l { text-align: left; }
    .totals { margin-top: 12px; width: 280px; margin-left: auto; }
    .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
    .grand { font-size: 14px; font-weight: bold; border-top: 2px solid #111; margin-top: 4px; padding-top: 4px; }
  </style></head><body>
  <div class="head">
    <h1>${safeText(d.hospital?.nameEn)}</h1>
    <p>${safeText(d.hospital?.nameHi)}</p>
    <p>${safeText(d.hospital?.address)} | ${safeText(d.hospital?.phone)}</p>
  </div>
  <div class="meta">
    <div class="box">
      <strong>Bill:</strong> ${safeText(d.billNumber)}<br/>
      <strong>Date:</strong> ${new Date(d.billDate).toLocaleString('en-IN')}<br/>
      <strong>Type:</strong> ${safeText(d.billingType)}
    </div>
    <div class="box">
      <strong>Patient:</strong> ${safeText(d.patient?.name)}<br/>
      <strong>UHID:</strong> ${safeText(d.patient?.uhid)}<br/>
      <strong>Mobile:</strong> ${safeText(d.patient?.mobile)}<br/>
      <strong>Doctor:</strong> ${safeText(d.patient?.doctor)}
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>MRP</th><th>Disc</th><th>GST</th><th>Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal</span><span>${fmtMoney(d.subTotal)}</span></div>
    <div><span>Discount</span><span>- ${fmtMoney(d.discount)}</span></div>
    <div><span>GST</span><span>${fmtMoney(d.gstAmount)}</span></div>
    <div class="grand"><span>Grand Total</span><span>${fmtMoney(d.grandTotal)}</span></div>
    <div><span>Paid</span><span>${fmtMoney(d.paidAmount)}</span></div>
    <div><span>Pending</span><span>${fmtMoney(d.pendingAmount)}</span></div>
    <div><span>Mode</span><span>${safeText(d.paymentMode)}</span></div>
  </div>
  <p style="margin-top:24px;text-align:center;font-size:10px;color:#64748b;">Thank you — Get well soon</p>
  </body></html>`;
}

export function openPharmacyInvoice(printData, { autoPrint = true, downloadPdf = false } = {}) {
  if (!printData) return;
  const html = buildInvoiceHtml(printData);
  const w = window.open('', '_blank', 'width=920,height=900');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  if (downloadPdf) {
    setTimeout(() => w.print(), 400);
  } else if (autoPrint) {
    setTimeout(() => w.print(), 400);
  }
}

export async function printBillFromApi(billId, fetchDetails) {
  if (!billId) return;
  if (fetchDetails) {
    const data = await fetchDetails(billId);
    openPharmacyInvoice(data?.printData, { autoPrint: true });
    return;
  }
  const { printPharmacyBill } = await import('../../../utils/printPharmacyBill');
  return printPharmacyBill(billId);
}
