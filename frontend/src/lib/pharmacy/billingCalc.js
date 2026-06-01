export function calcLineAmount(qty, sellingPrice, discountPercent, gstPercentage) {
  const quantity = Math.max(0, Number(qty) || 0);
  const price = Math.max(0, Number(sellingPrice) || 0);
  const disc = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const gst = Math.max(0, Number(gstPercentage) || 0);
  const lineBase = quantity * price;
  const afterDisc = lineBase - (lineBase * disc) / 100;
  const lineGst = (afterDisc * gst) / 100;
  return Math.round((afterDisc + lineGst) * 100) / 100;
}

export function calcBillTotals(items) {
  let subtotal = 0;
  let discount = 0;
  let gstAmount = 0;
  (items || []).forEach((item) => {
    const price = Number(item.sellingPrice ?? item.mrp) || 0;
    const qty = Number(item.quantity) || 0;
    const discPct = Number(item.discountPercent) || 0;
    const gst = Number(item.gstPercentage) || 0;
    const lineBase = qty * price;
    const lineDisc = (lineBase * discPct) / 100;
    const afterDisc = lineBase - lineDisc;
    subtotal += lineBase;
    discount += lineDisc;
    gstAmount += (afterDisc * gst) / 100;
  });
  const round = (n) => Math.round(n * 100) / 100;
  return {
    subtotal: round(subtotal),
    discount: round(discount),
    gstAmount: round(gstAmount),
    grandTotal: round(subtotal - discount + gstAmount),
  };
}

export function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { month: '2-digit', year: 'numeric' });
}
