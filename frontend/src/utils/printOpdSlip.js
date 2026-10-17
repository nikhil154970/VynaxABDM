import api from './api';
import { isAyushmanSponsor, slipSponsorBannerHtml, AYUSHMAN_PAYMENT_LABEL } from './ayushmanBilling';
import { hospitalMobileSlipHtml } from './hospitalContact';
import { APPOINTMENT_SLIP_LOGO, printAppointmentSlipHeaderHtml } from './hospitalBranding';

function safeText(v) {
  const s = v == null ? '' : String(v);
  return s.replace(/[<>&]/g, (ch) => (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'));
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return safeText(v);
  return d.toLocaleDateString('en-GB');
}

function fmtTime(v) {
  if (!v) return '—';
  if (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return safeText(v);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
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

/** Fee/amount for slip — preserves 0 (|| would treat 0 as missing). */
function slipFeeAmount(row) {
  const raw = row?.amount ?? row?.fee;
  if (raw === 0 || raw === '0') return '0.00';
  if (raw != null && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n.toFixed(2);
    return String(raw);
  }
  return '0.00';
}

function slipAmountWords(row, formattedAmount) {
  if (row?.amountInWords) return row.amountInWords;
  const n = Number(row?.amount ?? row?.fee);
  if (n === 0) return 'Zero Only.';
  if (Number.isFinite(n)) return `${formattedAmount} Only.`;
  return '';
}

function buildOpdSlipHtmlInner(row) {
  const feeDisplay = row._feeDisplay;
  const sponsorBanner = row._sponsorBanner;
  const amountWords = row._amountWords;
  const ayushman = row._ayushman;

  return `
  <html>
  <head>
    <title>OPD Receipt</title>
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
   
     width: 128px;
    margin-left: -11px;

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
      .stamp-block {
        width: 170px;
      }
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
        <img src="${APPOINTMENT_SLIP_LOGO}" alt="VyanX Hospital Management System" />
      </div>

      <div class="header-text">${printAppointmentSlipHeaderHtml()}
      </div>
    </div>

    <div class="row-line">
      <div><b>SER.NO:</b> ${safeText(row?.serial || row?.opdNumber || '—')}</div>
      <div style="font-weight:bold;font-size:13px;">OPD RECEIPT</div>
      ${hospitalMobileSlipHtml()}
    </div>

    ${sponsorBanner}

    <div class="row-line" style="justify-content:flex-start;">
      <div><b>REG.NO-</b> ${safeText(row?.registrationNumber || '—')}</div>
    </div>

    <div class="mid-section">
      <div class="patient-info">
        <div><b>Outdoor P:</b> ${safeText(row?.opdNumber || '—')} &nbsp;&nbsp; <b>Patient Reg:</b> ${safeText(row?.patientReg || '—')}</div>
        <div><b>Patient Name:</b> ${safeText(row?.patientName || '—')} &nbsp;&nbsp; <b>Mobile:</b> ${safeText(row?.mobile || '—')}</div>
        <div class="inline">
          <span><b>Age:</b> ${safeText(row?.age || '—')}</span>
          <span><b>Sex:</b> ${safeText(row?.gender || '—')}</span>
          <span><b>Weight:</b> ${safeText(row?.weight || row?.weightKg || '—')}</span>
        
        </div>
        <div><b>Patient Add:</b> ${safeText(row?.address || '—')}</div>
        <div><b>Visit To Doctor:</b> ${safeText(row?.doctorName || row?.doctor || '—')}</div>
      </div>
      <div class="date-info">
        <div class="date-row">
          <span><b>Visit Date</b></span>
          <span>: ${safeText(fmtDate(row?.date))}</span>
        </div>
        <div class="date-row">
          <span><b>Reg Time</b></span>
          <span>: ${safeText(fmtTime(row?.time || row?.timeSlot))}</span>
        </div>
        <div style="margin-top:6px;"><b>Reg Date &amp; Time</b></div>
        <div>${safeText(fmtDateTime(row?.dateTime || row?.createdAt))}</div>
      </div>
    </div>

    <table class="main-table">
      <thead>
        <tr>
          <th>Particulars</th>
          <th class="right amt-col">Amount</th>
          <th class="right tot-col">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>OPD CHARGE</td>
          <td class="right">${safeText(feeDisplay)}</td>
          <td class="right">${safeText(feeDisplay)}</td>
        </tr>
      </tbody>
    </table>

    <table class="total-table">
      <tr>
        <td style="width:55%;"></td>
        <td class="label">Net Payable :</td>
        <td class="val">${safeText(feeDisplay)}</td>
      </tr>
      <tr>
        <td></td>
        <td class="label">Paid :</td>
        <td class="val">${ayushman ? `<b>${safeText(AYUSHMAN_PAYMENT_LABEL)}</b>` : safeText(feeDisplay)}</td>
      </tr>
    </table>

    <div class="footer">
      ${safeText(amountWords)}<br>
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
  </body>
  </html>
  `;
}

/**
 * Build the OPD slip HTML from a data row.
 * Can be reused by any caller (reception, patient, etc.).
 */
export function buildOpdSlipHtml(row) {
  const sponsor = row.sponsor || row.sponsorLabel || '';
  const ayushman = row.isAyushman === true || isAyushmanSponsor(sponsor);
  const feeDisplay = slipFeeAmount(row);
  const sponsorBanner = slipSponsorBannerHtml(sponsor);
  const amountWords = slipAmountWords(row, feeDisplay);

  return buildOpdSlipHtmlInner({ ...row, _ayushman: ayushman, _feeDisplay: feeDisplay, _sponsorBanner: sponsorBanner, _amountWords: amountWords });
}

/**
 * Prints the OPD receipt using the same HTML template as Appointment List.
 * Pass an appointment object that includes at least { id }.
 */
export async function printOpdSlip(a) {
  if (!a?.id) return;

  const res = await api.get(`/receptionist/appointments/${encodeURIComponent(a.id)}`);
  const db = res?.data?.appointment || {};

  const row = { ...a, ...db };
  const sponsor = row.sponsor || row.sponsorLabel || '';
  const ayushman = row.isAyushman === true || isAyushmanSponsor(sponsor);
  if (ayushman) {
    row.paymentStatus = 'PAID';
    row.paymentMode = row.paymentMode || AYUSHMAN_PAYMENT_LABEL;
  }

  const html = buildOpdSlipHtml(row);

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;

  w.document.open();
  w.document.write(html);
  w.document.close();

  setTimeout(() => {
    w.focus();
    w.print();
    w.onafterprint = () => w.close();
  }, 600);
}
