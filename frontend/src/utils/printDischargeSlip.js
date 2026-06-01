function safeText(v) {
  const s = v == null ? '' : String(v);
  return s.replace(/[<>&]/g, (ch) => (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'));
}

function fmtMoney(n) {
  const x = Math.max(0, Number(n) || 0);
  return x.toLocaleString('en-IN');
}

function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return safeText(v);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

import { isAyushmanSponsor, slipSponsorBannerHtml, AYUSHMAN_PAYMENT_LABEL } from './ayushmanBilling';

/**
 * Opens print dialog with IPD discharge slip (New H T Hospital branding).
 * @param {{ patient: object }} opts — patient should include billing, lineItems, dischargeStatus, dischargedAt, etc.
 */
export function printDischargeSlip({ patient }) {
  if (!patient) return;

  const sponsor = patient.sponsor || patient.sponsorLabel || '';
  const ayushman = patient.isAyushman === true || isAyushmanSponsor(sponsor);
  const sponsorBanner = slipSponsorBannerHtml(sponsor);
  const b = patient.billing || {};
  const items = Array.isArray(patient.lineItems) ? patient.lineItems : [];
  const rows = items
    .map(
      (it, i) => `
    <tr>
      <td style="text-align:center;">${i + 1}</td>
      <td>${safeText(it.category)}</td>
      <td>${safeText(it.description)}</td>
      <td style="text-align:right;">₹${fmtMoney(it.amount)}</td>
    </tr>`,
    )
    .join('');

  const w = window.open('', '_blank', 'width=900,height=800');
  if (!w) return;

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Discharge Slip — New H T Hospital</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 10px;
        font-size: 12px;
        color: #000;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .slip { border: 1px solid #000; max-width: 800px; margin: 0 auto; }
      .opd-header {
        position: relative;
        height: 110px;
        overflow: hidden;
        border-bottom: 1px solid #000;
        background: linear-gradient(120deg, #1a2e80 0%, #2a52be 45%, #6a3fa0 100%);
      }
      .logo-box {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 3;
        width: 132px;
        height: 104px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: #ffffff;
        border: 2px solid rgba(255,255,255,0.6);
      }
      .logo-box img { width: 158px; height: 208px; object-fit: contain; }
      .header-text {
        position: absolute;
        left: 105px;
        right: 10px;
        top: 50%;
        transform: translateY(-52%);
        z-index: 3;
        color: #fff;
        text-align: center;
      }
      .header-text h1 {
        margin: 0 0 3px 0;
        font-size: 34px;
        font-weight: 900;
        font-style: italic;
        letter-spacing: 1px;
        line-height: 1;
        text-shadow: 1px 2px 6px rgba(0,0,0,0.3);
      }
      .header-text .sub { font-size: 14px; font-weight: 600; letter-spacing: 2px; color: #dde8ff; }
      .header-text .addr { font-size: 10px; color: #b8c8ff; letter-spacing: 0.5px; margin-top: 2px; }
      .row-line {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px solid #000;
        padding: 6px 10px;
        flex-wrap: wrap;
        gap: 8px;
      }
      .title-row { font-weight: bold; font-size: 13px; text-align: center; padding: 8px; border-bottom: 1px solid #000; }
      .info { padding: 8px 10px; border-bottom: 1px solid #000; }
      .info div { margin: 3px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #000; padding: 6px 8px; }
      th { text-align: left; background: #f1f5f9; font-size: 11px; }
      .amt { text-align: right; }
      .totals { margin-top: 0; border-top: 2px solid #000; }
      .totals td { border: 1px solid #000; font-weight: bold; }
      .footer { padding: 8px 10px; font-size: 10px; border-top: 1px solid #000; text-align: center; color: #444; }
    </style>
  </head>
  <body>
    <div class="slip">
      <div class="opd-header">
        <div class="logo-box">
          <img src="/hopital_logo.png" alt="New H T Hospital" onerror="this.style.display='none'" />
        </div>
        <div class="header-text">
          <h1>नैतिक हॉस्पिटल</h1>
          <div class="sub">New H T Hospital — Discharge slip</div>
          <div class="addr">ANAND BIHAR COLONY BHIKHARIPUR BLW, VARANASI, UP</div>
        </div>
      </div>
      <div class="title-row">IPD FINAL DISCHARGE / बिल सारांश</div>
      ${sponsorBanner}
      <div class="row-line">
        <span><b>Admission ID:</b> ${safeText(patient.id)}</span>
        <span><b>Discharge:</b> ${safeText(patient.dischargeStatus || '—')}</span>
        <span><b>Date:</b> ${fmtDateTime(patient.dischargedAt)}</span>
      </div>
      <div class="info">
        <div><b>Patient:</b> ${safeText(patient.name)} &nbsp;|&nbsp; <b>UHID:</b> ${safeText(patient.uhid)}</div>
        <div><b>Ward / Bed:</b> ${safeText(patient.ward)} / ${safeText(patient.bed)} &nbsp;|&nbsp; <b>Doctor:</b> ${safeText(patient.doctor)}</div>
        <div><b>Nurse (approval):</b> ${safeText(patient.nurse)}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:40px;">#</th>
            <th style="width:110px;">Category</th>
            <th>Particular</th>
            <th style="width:100px;" class="amt">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <table class="totals">
        <tr><td colspan="3" style="text-align:right;">Total bill</td><td class="amt">₹${fmtMoney(b.totalBill)}</td></tr>
        <tr><td colspan="3" style="text-align:right;">Paid</td><td class="amt">${ayushman ? `<b>${safeText(AYUSHMAN_PAYMENT_LABEL)}</b>` : `₹${fmtMoney(b.paidAmount)}`}</td></tr>
        <tr><td colspan="3" style="text-align:right;">Pending</td><td class="amt">₹${fmtMoney(ayushman ? 0 : b.pendingAmount)}</td></tr>
      </table>
      <div class="footer">
        This is a computer-generated discharge summary slip for patient records. Please settle pending dues as per hospital policy.
        <br />धन्यवाद — Thank you for choosing New H T Hospital.
      </div>
    </div>
    <script>window.onload = function () { window.print(); };</script>
  </body>
  </html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}
