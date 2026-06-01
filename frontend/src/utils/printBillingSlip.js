import { isAyushmanSponsor, slipSponsorBannerHtml, AYUSHMAN_PAYMENT_LABEL } from './ayushmanBilling';
import { hospitalMobileSlipHtml } from './hospitalContact';

function safeText(v) {
  const s = v == null ? '' : String(v);
  return s.replace(/[<>&]/g, (ch) => (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'));
}

function fmtMoney(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
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

export async function printBillingSlip({ billId, data }) {
  if (!data) return;

  const sponsor = data.sponsor || data.sponsorLabel || '';
  const ayushman = data.isAyushman === true || isAyushmanSponsor(sponsor);
  const sponsorBanner = slipSponsorBannerHtml(sponsor);
  const items = Array.isArray(data.items) ? data.items : [];
  const totalsRaw = data.totals || {};
  const totals = ayushman
    ? {
        subtotal: totalsRaw.subtotal ?? 0,
        discount: totalsRaw.discount ?? 0,
        taxAmt: totalsRaw.taxAmt ?? totalsRaw.tax ?? 0,
        total: totalsRaw.total ?? 0,
        paid: totalsRaw.total ?? 0,
        pending: 0,
      }
    : {
        subtotal: totalsRaw.subtotal ?? 0,
        discount: totalsRaw.discount ?? 0,
        taxAmt: totalsRaw.taxAmt ?? totalsRaw.tax ?? 0,
        total: totalsRaw.total ?? 0,
        paid: totalsRaw.paid ?? 0,
        pending: totalsRaw.pending ?? 0,
      };
  if (ayushman) {
    data.paymentStatus = 'Paid';
    data.paymentMode = AYUSHMAN_PAYMENT_LABEL;
  }

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;

  const amountWords = data?.amountInWords || '';

  const html = `
  <html>
  <head>
    <title>Billing Slip</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0; padding: 10px;
        font-size: 12px;
        color: #000;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .slip { border: 1px solid #000; }

      /* ===== HEADER (same as OPD slip) ===== */
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

      /* ===== BODY (same layout style) ===== */
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
      .main-table .qty-col { width: 70px; }
      .main-table .amt-col { width: 140px; }
      .main-table .tot-col { width: 120px; }

      .total-table td { padding: 5px 8px; }
      .total-table .label { text-align: left; font-weight: bold; }
      .total-table .val { text-align: left; font-weight: bold; width: 120px; }

      .footer { padding: 6px 8px; font-size: 11px; border-top: 1px solid #000; }
    </style>
  </head>
  <body>
    <div class="slip">

      <!-- HEADER -->
      <div class="opd-header">
        <svg style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;"
             viewBox="0 0 800 110" preserveAspectRatio="none"
             xmlns="http://www.w3.org/2000/svg">
          <path d="M 95 0 Q 160 55 95 110 L 0 110 L 0 0 Z" fill="rgba(255,255,255,0.12)"/>
          <path d="M 95 82 Q 280 28 500 68 Q 650 92 800 48" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2.5"/>
          <path d="M 95 90 Q 280 36 500 76 Q 650 100 800 56" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
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

      <!-- ROW: BILL NO | BILLING SLIP | MODE -->
      <div class="row-line">
        <div><b>BILL NO:</b> ${safeText(data.billNumber || billId || '—')}</div>
        <div style="font-weight:bold;font-size:13px;">BILLING SLIP (${safeText(data.visitType || '—')})</div>
        <div><b>MODE:</b> ${safeText(data.paymentMode || '—')}</div>
      </div>

      ${sponsorBanner}

      <!-- ROW: STATUS | MOBILE -->
      <div class="row-line">
        <div><b>STATUS:</b> ${safeText(data.paymentStatus || '—')}</div>
        ${hospitalMobileSlipHtml()}
      </div>

      <!-- PATIENT INFO + DATE/TIME -->
      <div class="mid-section">
        <div class="patient-info">
          <div><b>Patient Name:</b> ${safeText(data.patientName || '—')}</div>
          <div class="inline">
            <span><b>UHID:</b> ${safeText(data.uhid || '—')}</span>
            <span><b>Doctor:</b> ${safeText(data.doctorName || '—')}</span>
          </div>
          ${
            data.visitType === 'IPD'
              ? `<div class="inline">
                  <span><b>Ward:</b> ${safeText(data.wardName || '—')}</span>
                  <span><b>Bed:</b> ${safeText(data.bedCode || '—')}</span>
                  <span><b>IPD:</b> ${safeText(data.ipdNumber || '—')}</span>
                </div>`
              : ''
          }
          <div><b>Notes:</b> ${safeText(data.notes || '—')}</div>
        </div>
        <div class="date-info">
          <div class="date-row">
            <span><b>Date</b></span>
            <span>: ${safeText(fmtDateTime(data.createdAt))}</span>
          </div>
          <div class="date-row">
            <span><b>Print</b></span>
            <span>: ${safeText(fmtDateTime(new Date().toISOString()))}</span>
          </div>
        </div>
      </div>

      <!-- ITEMS TABLE -->
      <table class="main-table">
        <thead>
          <tr>
            <th>Particulars</th>
            <th class="right qty-col">Qty</th>
            <th class="right amt-col">Amount</th>
            <th class="right tot-col">Total</th>
          </tr>
        </thead>
        <tbody>
          ${
            items.length
              ? items
                  .map((it) => {
                    const qty = it.qty ?? it.quantity ?? 0;
                    const price = it.price ?? it.unitPrice ?? 0;
                    const total = it.total ?? Number(qty || 0) * Number(price || 0);
                    return `
                      <tr>
                        <td>${safeText(it.name || '—')}</td>
                        <td class="right">${safeText(qty)}</td>
                        <td class="right">${safeText(fmtMoney(price))}</td>
                        <td class="right">${safeText(fmtMoney(total))}</td>
                      </tr>
                    `;
                  })
                  .join('')
              : `<tr><td colspan="4">—</td></tr>`
          }
        </tbody>
      </table>

      <!-- TOTALS (same placement style) -->
      <table class="total-table">
        <tr>
          <td class="label">Subtotal :</td>
          <td class="val">₹${safeText(fmtMoney(totals.subtotal))}</td>
        </tr>
        <tr>
          <td class="label">Discount :</td>
          <td class="val">₹${safeText(fmtMoney(totals.discount))}</td>
        </tr>
        <tr>
          <td class="label">Tax :</td>
          <td class="val">₹${safeText(fmtMoney(totals.taxAmt))}</td>
        </tr>
        <tr>
          <td class="label">Net Payable :</td>
          <td class="val">₹${safeText(fmtMoney(totals.total))}</td>
        </tr>
        <tr>
          <td class="label">Paid :</td>
          <td class="val">${ayushman ? `<b>${safeText(AYUSHMAN_PAYMENT_LABEL)}</b>` : `₹${safeText(fmtMoney(totals.paid))}`}</td>
        </tr>
        <tr>
          <td class="label">Pending :</td>
          <td class="val">₹${safeText(fmtMoney(totals.pending))}</td>
        </tr>
      </table>

      <!-- FOOTER -->
      <div class="footer">
        ${amountWords ? `${safeText(amountWords)}<br>` : ''}
        ISO CERTIFIED 9001-2015
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

