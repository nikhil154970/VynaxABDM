/**
 * Lab bill / estimate slip — same visual layout as OPD receipt (printOpdSlip).
 * Use mode "preview" before billing; "issued" after POST /lab/confirm.
 */

import { isAyushmanSponsor, slipSponsorBannerHtml, AYUSHMAN_PAYMENT_LABEL } from './ayushmanBilling';
import { hospitalMobileSlipHtml } from './hospitalContact';

function safeText(v) {
  const s = v == null ? '' : String(v);
  return s.replace(/[<>&]/g, (ch) => (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'));
}

function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return safeText(v);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function fmtMoney(n) {
  const x = Math.max(0, Math.round(Number(n) || 0));
  return `₹${x.toLocaleString('en-IN')}`;
}

/**
 * @param {object} p
 * @param {string} [p.patientName]
 * @param {string} [p.patientUhid]
 * @param {string} [p.doctorName]
 * @param {{ name: string, price: number }[]} p.tests
 * @param {number} p.totalAmount
 * @param {'preview'|'issued'} p.mode
 * @param {string} [p.billNumber] — issued
 * @param {string} [p.orderNumber] — issued
 * @param {number} [p.adviceId] — preview serial
 * @param {string|Date} [p.createdAt]
 */
export function printLabBillSlip(p) {
  const sponsor = p.sponsor || p.sponsorLabel || '';
  const ayushman = p.isAyushman === true || isAyushmanSponsor(sponsor);
  const sponsorBanner = ayushman ? slipSponsorBannerHtml('AYUSHMAN') : slipSponsorBannerHtml(sponsor);
  const rawTests = Array.isArray(p.tests) ? p.tests : [];
  const grossFromLines = rawTests.reduce((s, t) => s + Math.max(0, Math.round(Number(t.price) || 0)), 0);
  const grossTotal = Math.max(0, Math.round(Number(p.grossTotalAmount) || grossFromLines || 0));
  const tests = rawTests;
  const total = Math.max(0, Math.round(Number(p.totalAmount) || grossFromLines));
  const paid = ayushman ? total : Math.min(total, Math.max(0, Math.round(Number(p.paidAmount) || 0)));
  const pending = ayushman ? 0 : Math.max(0, total - paid);
  const statusUpper = String(p.paymentStatus || '').toUpperCase();
  let paymentLabel = 'Pending';
  if (ayushman || paid >= total) paymentLabel = 'Paid';
  else if (statusUpper === 'PAID') paymentLabel = 'Paid';
  else if (statusUpper === 'PARTIAL' || paid > 0) paymentLabel = 'Pending';
  const mode = p.mode === 'issued' ? 'issued' : 'preview';
  const serNo =
    mode === 'issued' && p.orderNumber
      ? String(p.orderNumber)
      : p.adviceId != null
        ? `ADV-${p.adviceId}`
        : '—';
  const regNo =
    mode === 'issued' && p.billNumber
      ? String(p.billNumber)
      : p.patientUhid
        ? `UHID ${p.patientUhid} (provisional)`
        : 'Provisional estimate';

  const particularsRows = tests
    .map(
      (t) => `
        <tr>
          <td>${safeText(t.name || '—')}</td>
          <td class="right">${safeText(fmtMoney(t.price))}</td>
          <td class="right">${safeText(fmtMoney(t.price))}</td>
        </tr>`,
    )
    .join('');

  const titleCenter = mode === 'issued' ? 'LAB BILL' : 'LAB BILL (ESTIMATE)';
  const bannerNote =
    mode === 'preview'
      ? '<div style="padding:4px 8px;background:#fff8e6;border-bottom:1px solid #000;font-size:11px;"><b>Note:</b> This is an estimate before billing. Final bill number is issued after reception confirms billing.</div>'
      : '';

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;

  const html = `
  <html>
  <head>
    <title>${mode === 'issued' ? 'Lab Bill' : 'Lab Bill Estimate'}</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0; padding: 10px;
        font-size: 12px; color: #000;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .slip { border: 1px solid #000; }

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
      .logo-box img {
        width: 158px;
        height: 208px;
        object-fit: contain;
      }

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
        font-size: 38px;
        font-weight: 900;
        font-style: italic;
        letter-spacing: 1px;
        line-height: 1;
        text-shadow: 1px 2px 6px rgba(0,0,0,0.3);
      }
      .header-text .sub {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 2px;
        color: #dde8ff;
        margin-bottom: 2px;
      }
      .header-text .addr {
        font-size: 10px;
        color: #b8c8ff;
        letter-spacing: 0.5px;
      }

      .row-line {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px solid #000;
        padding: 4px 8px;
      }
      .mid-section { display: flex; border-bottom: 1px solid #000; }
      .patient-info { flex: 1.5; padding: 6px 8px; border-right: 1px solid #000; }
      .patient-info div { margin-bottom: 3px; }
      .patient-info .inline { display: flex; gap: 18px; }
      .date-info { flex: 0.8; padding: 6px 8px; }
      .date-row { display: flex; justify-content: space-between; margin-bottom: 4px; }

      table { width: 100%; border-collapse: collapse; }
      .main-table th, .main-table td { border: 1px solid #000; padding: 5px 8px; }
      .main-table th { text-align: left; }
      .main-table .right { text-align: right; }
      .main-table .amt-col { width: 140px; }
      .main-table .tot-col { width: 120px; }

      .total-table td { padding: 5px 8px; }
      .total-table .label { text-align: right; font-weight: bold; }
      .total-table .val { text-align: right; font-weight: bold; width: 120px; }

      .footer { padding: 6px 8px; font-size: 11px; border-top: 1px solid #000; }
      .sign-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        padding: 10px 8px 8px;
        border-top: 1px solid #000;
      }
      .stamp-block { width: 170px; }
      .stamp-box {
        width: 140px;
        height: 52px;
        border: 1px dashed #000;
        margin-top: 4px;
      }
      .signature-block {
        text-align: center;
        width: 170px;
      }
      .signature-line {
        border-top: 1px solid #000;
        margin-top: 24px;
        padding-top: 3px;
      }
    </style>
  </head>
  <body>
  <div class="slip">

    <div class="opd-header">
      <svg style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;"
           viewBox="0 0 800 110" preserveAspectRatio="none"
           xmlns="http://www.w3.org/2000/svg">
        <path d="M 95 0 Q 160 55 95 110 L 0 110 L 0 0 Z"
              fill="rgba(255,255,255,0.12)"/>
        <path d="M 95 82 Q 280 28 500 68 Q 650 92 800 48"
              fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2.5"/>
        <path d="M 95 90 Q 280 36 500 76 Q 650 100 800 56"
              fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
      </svg>

      <div class="logo-box">
        <img src="/hopital_logo.png" alt="NH" />
      </div>

      <div class="header-text">
        <h1>नैतिक हॉस्पिटल</h1>
        <div class="sub">एण्ड सर्जिकल सेन्टर</div>
        <div class="addr">ANAND BIHAR COLONY BHIKHARIPUR BLW, VARANASI, UP</div>
      </div>
    </div>

    ${bannerNote}

    <div class="row-line">
      <div><b>SER.NO:</b> ${safeText(serNo)}</div>
      <div style="font-weight:bold;font-size:13px;">${safeText(titleCenter)}</div>
      ${hospitalMobileSlipHtml()}
    </div>

    ${sponsorBanner}

    <div class="row-line" style="justify-content:flex-start;">
      <div><b>REG.NO-</b> ${safeText(regNo)}</div>
    </div>

    <div class="mid-section">
      <div class="patient-info">
        <div><b>Patient UHID:</b> ${safeText(p.patientUhid || '—')}</div>
        <div><b>Patient Name:</b> ${safeText(p.patientName || '—')}</div>
        <div><b>Referred by Doctor:</b> ${safeText(p.doctorName || '—')}</div>
        ${
          mode === 'issued' && p.orderNumber
            ? `<div><b>Lab Order No.:</b> ${safeText(String(p.orderNumber))}</div>`
            : ''
        }
      </div>
      <div class="date-info">
        <div class="date-row">
          <span><b>Print / Bill time</b></span>
          <span>: ${safeText(fmtDateTime(new Date()))}</span>
        </div>
        <div class="date-row">
          <span><b>Advice date</b></span>
          <span>: ${safeText(fmtDateTime(p.createdAt))}</span>
        </div>
      </div>
    </div>

    <table class="main-table">
      <thead>
        <tr>
          <th>Particulars (Lab tests)</th>
          <th class="right amt-col">Amount</th>
          <th class="right tot-col">Total</th>
        </tr>
      </thead>
      <tbody>
        ${particularsRows || '<tr><td colspan="3">No line items</td></tr>'}
      </tbody>
    </table>

    <table class="total-table">
      <tr>
        <td style="width:55%;"></td>
        <td class="label">Bill Total :</td>
        <td class="val">${safeText(fmtMoney(total))}</td>
      </tr>
      <tr>
        <td></td>
        <td class="label">Paid :</td>
        <td class="val">${
          ayushman && mode === 'issued'
            ? `<b>${safeText(AYUSHMAN_PAYMENT_LABEL)}</b>`
            : safeText(mode === 'issued' ? fmtMoney(paid) : '0')
        }</td>
      </tr>
      <tr>
        <td></td>
        <td class="label">Pending :</td>
        <td class="val">${safeText(fmtMoney(mode === 'issued' ? pending : total))}</td>
      </tr>
      ${
        mode === 'issued'
          ? `<tr>
        <td></td>
        <td class="label">Payment Status :</td>
        <td class="val"><b>${safeText(paymentLabel)}</b></td>
      </tr>`
          : ''
      }
    </table>

    <div class="footer">
      ${mode === 'issued' ? 'OPD lab tests billed — report will be available from lab after processing.' : 'Estimate only — pay at reception after billing confirmation.'}<br>
      ISO CERTIFIED 9001-2015
    </div>
    <div class="sign-row">
      <div class="stamp-block">
        <div><b>Stamp</b></div>
        <div class="stamp-box"></div>
      </div>
      <div class="signature-block">
        <div class="signature-line">Signature</div>
      </div>
    </div>

  </div>
  <script>window.onload = function() { window.print(); }</script>
  </body>
  </html>
  `;

  w.document.open();
  w.document.write(html);
  w.document.close();
}
