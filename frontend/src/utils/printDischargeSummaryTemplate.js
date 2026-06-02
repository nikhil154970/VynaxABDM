import { parseAdmissionDateTimeForPrint } from '../pages/receptionist/ipd/dischargeFormBuilders';
import { HOSPITAL_NAME_DISPLAY } from './hospitalBranding';

function safeText(v) {
  const s = v == null ? '' : String(v);
  return s.replace(/[<>&]/g, (ch) => (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'));
}

function fmtDateOnly(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtDisplayDate(v) {
  if (!v) return '___/___/___';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const out = fmtDateOnly(s);
    if (out) return out;
  }
  return safeText(v);
}

function fmtTimeOnly(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

function moneyInr(n) {
  const x = Math.max(0, Math.round(Number(n) || 0));
  return `₹${x.toLocaleString('en-IN')}`;
}

/** Skip empty or underscore-only placeholder text on print. */
function medHasContent(m) {
  if (!m || typeof m !== 'object') return false;
  return [m.medicine, m.dosage, m.frequency, m.duration, m.mode].some((x) => String(x ?? '').trim());
}

function findingHasContent(v) {
  const s = String(v ?? '').trim();
  if (!s) return false;
  if (/^_+$/.test(s.replace(/\s/g, ''))) return false;
  return true;
}

function invRowHasContent(r) {
  if (!r || typeof r !== 'object') return false;
  return findingHasContent(r.finding);
}

function signaturePrintText(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^_+$/.test(s.replace(/\s/g, ''))) return '';
  return safeText(s);
}

function checkbox(checked, label) {
  const box = checked 
    ? '<span style="display:inline-flex;width:16px;height:16px;border:1.5px solid #000;align-items:center;justify-content:center;font-size:12px;font-weight:bold;background:#fff;">✓</span>'
    : '<span style="display:inline-flex;width:16px;height:16px;border:1.5px solid #000;background:#fff;"></span>';
  return `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:20px;margin-bottom:5px;"><span style="font-size:12px;font-weight:500;">${box}</span><span style="font-size:11px;font-weight:500;">${safeText(label)}</span></span>`;
}

export function printDischargeSummaryTemplate({ summary, billing = null, admission = null, printWindow = null } = {}) {
  if (!summary) return false;

  const p = summary.patientInformation || {};
  const meds = Array.isArray(summary.dischargeMedications) ? summary.dischargeMedications : [];

  /** Patient's actual admission — from backend admission record (not print time). */
  const admissionDT = parseAdmissionDateTimeForPrint(summary, admission);
  /** Always print-time discharge stamp. */
  const dischargeDT = new Date();

  const billTotal = Math.max(0, Number(billing?.total ?? billing?.totalBill) || 0);
  const billPaid = Math.max(0, Number(billing?.paid ?? billing?.paidAmount) || 0);
  const billPending = Math.max(0, Number(billing?.pending ?? billing?.pendingAmount) || 0);
  const showBilling = billing != null && typeof billing === 'object';

  const stampPrint = signaturePrintText(summary.signatures?.hospitalStamp);

  const tx = summary.treatmentChecklist || {};
  const pastHistory = summary.pastHistoryFlags || {};
  const exam = summary.clinicalExamAtAdmission || {};
  
  const invRows = Array.isArray(summary.investigationRows) ? summary.investigationRows : [];
  const invText = summary.investigations?.investigationText || '';
  const filledInvRows = invRows.filter(invRowHasContent);
  const invTextOnly = findingHasContent(invText);
  const otherAlreadyPrinted = filledInvRows.some(
    (r) => String(r.name || '').trim().toLowerCase() === 'other',
  );
  const invPrintRows =
    filledInvRows.length > 0
      ? [...filledInvRows, ...(invTextOnly && !otherAlreadyPrinted ? [{ name: 'Other', finding: invText }] : [])]
      : invTextOnly
        ? [{ name: 'Other', finding: invText }]
        : [];
  const invTableBody = invPrintRows.length
    ? invPrintRows
        .map(
          (r) =>
            `<tr><td>${safeText(r.name)}</td><td>${safeText(r.finding)}</td></tr>`,
        )
        .join('')
    : `<tr><td colspan="2" style="padding:10px;font-size:12px;text-align:center;">—</td></tr>`;
  
  const filledMeds = meds.filter(medHasContent);
  const medRows = filledMeds.length
    ? filledMeds
        .map(
          (m) => `<tr>
      <td style="border:1px solid #000;padding:8px 6px;width:40%;font-size:12px;">${safeText(m.medicine || '')}</td>
      <td style="border:1px solid #000;padding:8px 6px;width:20%;font-size:12px;">${safeText(m.dosage || '')}</td>
      <td style="border:1px solid #000;padding:8px 6px;width:20%;font-size:12px;">${safeText(m.frequency || '')}</td>
      <td style="border:1px solid #000;padding:8px 6px;width:20%;font-size:12px;">${safeText(m.duration || '')}</td>
     </tr>`,
        )
        .join('')
    : `<tr><td colspan="4" style="border:1px solid #000;padding:10px;font-size:12px;text-align:center;">—</td></tr>`;

  const w = printWindow || window.open('', '_blank', 'width=1100,height=1100');
  if (!w) return false;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Discharge Summary - ${HOSPITAL_NAME_DISPLAY}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', 'Arial', sans-serif; 
      margin: 0; 
      padding: 20px; 
      background: #7f8c8d;
    }
    .page { 
      width: 950px; 
      margin: 0 auto 20px auto; 
      background: white; 
      box-shadow: 0 5px 20px rgba(0,0,0,0.3);
    }
    .print-container {
      background: white;
      border: 2px solid #1a2a3a;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
      background: #0b2b5c;
      color: white;
    }
    .header-logo {
      width: 58px;
      height: 58px;
      flex-shrink: 0;
      border-radius: 8px;
      background: rgba(255,255,255,0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .header-logo img {
      width: 52px;
      height: 52px;
      object-fit: contain;
    }
    .header-center {
      flex: 1;
      text-align: center;
    }
    .hospital-name {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 3px;
      color: white;
    }
    .website {
      font-size: 11px;
      color: #ffd966;
      margin-top: 4px;
    }
    .page-num {
      text-align: right;
      font-size: 10px;
      padding: 6px 12px;
      background: #f0f0f0;
      border-bottom: 1px solid #1a2a3a;
      font-weight: 600;
    }
    .grid-table {
      width: 100%;
      border-collapse: collapse;
    }
    .grid-table td, .grid-table th {
      border: 1px solid #1a2a3a;
      padding: 8px 10px;
      vertical-align: top;
      font-size: 12px;
    }
    .label-cell {
      background-color: #e8eef4;
      font-weight: 700;
      width: 28%;
      font-size: 12px;
    }
    .sig-cell {
      height: 78px;
      padding: 10px 12px;
      vertical-align: top;
    }
    .sig-blank {
      min-height: 52px;
    }
    .sig-text {
      font-size: 14px;
      font-weight: bold;
      margin-top: 4px;
    }
    .stamp-cell {
      height: 130px;
      min-height: 130px;
      padding: 12px;
      vertical-align: top;
    }
    .discharge-dt-cell {
      padding: 8px 10px;
      font-size: 12px;
      vertical-align: middle;
      font-weight: 600;
    }
    .section-title {
      background: #1e3a6b;
      color: white;
      font-weight: 800;
      font-size: 13px;
      text-align: center;
      letter-spacing: 1px;
      padding: 8px;
    }
    .sub-section {
      background: #d9e2ef;
      font-weight: 700;
      text-align: center;
      font-size: 12px;
    }
    .check-group {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 4px;
    }
    .inline-check {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .footer-thanks {
      text-align: center;
      font-size: 11px;
      padding: 12px;
      border-top: 2px solid #1a2a3a;
      background: #f5f0e0;
      font-weight: 500;
      color: #2c3e50;
    }
    .clinical-table {
      width: 100%;
      border-collapse: collapse;
    }
    .clinical-table td {
      border: 1px solid #1a2a3a;
      padding: 6px 5px;
      font-size: 11px;
      text-align: center;
    }
    .clinical-label {
      background: #e8eef4;
      font-weight: 700;
    }
    .invest-table {
      width: 100%;
      border-collapse: collapse;
    }
    .invest-table td {
      border: 1px solid #1a2a3a;
      padding: 6px 8px;
      font-size: 11px;
    }
    .invest-header {
      background: #d9e2ef;
      font-weight: 700;
    }
    @media print {
      body { background: white; padding: 0; margin: 0; }
      .page { box-shadow: none; margin: 0; page-break-after: always; }
      .page:last-child { page-break-after: auto; }
      .header { background: #0b2b5c; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .section-title { background: #1e3a6b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .label-cell { background: #e8eef4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .footer-thanks { background: #f5f0e0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="print-container">
    <div class="header">
      <div class="header-logo">
        <img src="/hopital_logo.png" alt="${HOSPITAL_NAME_DISPLAY}" onerror="this.style.display='none'" />
      </div>
      <div class="header-center">
        <div class="hospital-name">DISCHARGE SUMMARY</div>
        
      </div>
    </div>
    <div class="page-num">Page 1 of 2</div>
    
    <table class="grid-table">
      <tr>
        <td class="label-cell">UHID No.</td>
        <td style="width:25%;font-weight:500;">${safeText(summary.uhidNo || '________')}</td>
        <td class="label-cell">Department</td>
        <td style="width:25%;font-weight:500;">${safeText(summary.department || '________')}</td>
      </tr>
      <tr>
        <td class="label-cell">IPD No.</td>
        <td>${safeText(summary.ipdNo || '________')}</td>
        <td class="label-cell">Ward / Bed No.</td>
        <td>${safeText(summary.wardBedNo || '________')}</td>
      </tr>
      <tr>
        <td class="label-cell">Date & Time of Admission</td>
        <td><strong>${safeText(fmtDateOnly(admissionDT))} ${safeText(fmtTimeOnly(admissionDT))}</strong></td>
        <td class="label-cell">Consultant Doctor</td>
        <td>${safeText(summary.consultantDoctor || '________')}</td>
      </tr>
      <tr>
        <td class="label-cell">Date & Time of Discharge</td>
        <td><strong>${safeText(fmtDateOnly(dischargeDT))} ${safeText(fmtTimeOnly(dischargeDT))}</strong></td>
        <td class="label-cell">Treating Team</td>
        <td>${safeText(summary.treatingTeam || '________')}</td>
      </tr>
      
      <tr><td colspan="4" class="section-title">PATIENT INFORMATION</td></tr>
      <tr>
        <td class="label-cell">Patient Name</td>
        <td><strong>${safeText(p.patientName || '________')}</strong></td>
        <td class="label-cell">Age / Gender</td>
        <td>${safeText(p.age || '________')} / ${safeText(p.gender || '________')}</td>
      </tr>
      <tr>
        <td class="label-cell">Address</td>
        <td>${safeText(p.address || '________')}</td>
        <td class="label-cell">Mobile Number</td>
        <td>${safeText(p.mobile || '________')}</td>
      </tr>
      <tr>
        <td class="label-cell">Relative / Attendant Name</td>
        <td>${safeText(summary.attendantName || '________')}</td>
        <td class="label-cell">Blood Group</td>
        <td>${safeText(p.bloodGroup || '________')}</td>
      </tr>
      <tr>
        <td class="label-cell">Occupation</td>
        <td>${safeText(summary.occupation || '________')}</td>
        <td class="label-cell">Marital Status</td>
        <td>${safeText(summary.maritalStatus || '________')}</td>
      </tr>
      
      <tr>
        <td colspan="2" class="section-title">FINAL DIAGNOSIS</td>
        <td colspan="2" class="section-title">CHIEF COMPLAINTS</td>
      </tr>
      <tr>
        <td colspan="2" style="height:85px;font-size:12px;white-space:pre-wrap;"><strong>${safeText(summary.finalDiagnosis || '1. ________\n2. ________\n3. ________')}</strong></td>
        <td colspan="2" style="height:85px;font-size:12px;">${safeText(summary.chiefComplaints || '________')}</td>
      </tr>
      
      <tr>
        <td colspan="2" class="section-title">HISTORY OF PRESENT ILLNESS</td>
        <td colspan="2" class="section-title">PAST HISTORY</td>
      </tr>
      <tr>
        <td colspan="2" style="height:95px;font-size:12px;">${safeText(summary.historyOfPresentIllness || '________')}</td>
        <td colspan="2">
          <div style="font-size:12px;line-height:1.85;">
            ${[
              ['diabetes', 'Diabetes Mellitus'],
              ['hypertension', 'Hypertension'],
              ['asthma', 'Asthma'],
              ['tuberculosis', 'Tuberculosis'],
              ['previousSurgery', 'Previous Surgery'],
              ['drugAllergy', 'Drug Allergy'],
            ]
              .map(
                ([key, label]) =>
                  `<div style="display:flex;align-items:center;gap:8px;margin:2px 0;">${checkbox(pastHistory[key] === true, label)}<span style="margin-left:auto;">${checkbox(pastHistory[key] === false, 'No')}</span></div>`,
              )
              .join('')}
          </div>
          <div style="margin-top:10px;font-size:11px;border-top:1px solid #ccc;padding-top:6px;"><strong>Details (if any):</strong> ${safeText(summary.pastHistoryDetails || summary.pastHistory || '________')}</div>
        </td>
      </tr>
      
      <tr><td colspan="4" class="section-title">CLINICAL EXAMINATION AT ADMISSION</td></tr>
      <tr>
        <td colspan="4">
          <table class="clinical-table">
            <tr style="background:#e8eef4;">
              <td><strong>Pulse Rate</strong></td>
              <td><strong>Blood Pressure</strong></td>
              <td><strong>Temperature</strong></td>
              <td><strong>Respiratory Rate</strong></td>
              <td><strong>SpO₂</strong></td>
              <td><strong>CVS</strong></td>
              <td><strong>RS</strong></td>
              <td><strong>CNS</strong></td>
              <td><strong>P/A</strong></td>
            </tr>
            <tr>
              <td>${safeText(exam.pulseRate || '___')}</td>
              <td>${safeText(exam.bloodPressure || '___')}</td>
              <td>${safeText(exam.temperature || '___')}</td>
              <td>${safeText(exam.respiratoryRate || '___')}</td>
              <td>${safeText(exam.spo2 || '___')}</td>
              <td>${safeText(exam.cvs || '___')}</td>
              <td>${safeText(exam.rs || '___')}</td>
              <td>${safeText(exam.cns || '___')}</td>
              <td>${safeText(exam.pa || '___')}</td>
            </tr>
          </table>
        </td>
      </tr>
      
      <tr><td colspan="4" class="section-title">INVESTIGATIONS</td></tr>
      <tr>
        <td colspan="4">
          <table class="invest-table">
            <tr class="invest-header"><td><strong>Investigation</strong></td><td><strong>Finding</strong></td></tr>
            ${invTableBody}
          </table>
        </td>
      </tr>
      
      ${showBilling ? `
      <tr><td colspan="4" class="section-title">BILLING SUMMARY</td></tr>
      <tr>
        <td class="label-cell">Total Amount</td><td><strong>${moneyInr(billTotal)}</strong></td>
        <td class="label-cell">Paid Amount</td><td><strong>${moneyInr(billPaid)}</strong></td>
      </tr>
      <tr>
        <td class="label-cell">Pending Amount</td><td colspan="3"><strong>${moneyInr(billPending)}</strong></td>
      </tr>
      ` : ''}
    </table>
    <div class="footer-thanks">Thank you for choosing ${HOSPITAL_NAME_DISPLAY}. Wishing you a speedy recovery.</div>
  </div>
</div>

<!-- PAGE 2 -->
<div class="page">
  <div class="print-container">
    <div class="header">
      <div class="header-logo">
        <img src="/hopital_logo.png" alt="${HOSPITAL_NAME_DISPLAY}" onerror="this.style.display='none'" />
      </div>
      <div class="header-center">
        <div class="hospital-name">DISCHARGE SUMMARY</div>
        <div class="website">Website: www.newhthospital.com</div>
      </div>
    </div>
    <div class="page-num">Page 2 of 2</div>
    
    <table class="grid-table">
      <tr>
        <td colspan="2" class="section-title">COURSE DURING HOSPITAL STAY</td>
        <td colspan="2" class="section-title">TREATMENT GIVEN</td>
      </tr>
      <tr>
        <td colspan="2" style="height:110px;font-size:12px;white-space:pre-wrap;">${safeText(summary.courseDuringHospitalStay || '• IV Fluids\n• Antibiotics\n• Analgesics / Antipyretics\n• Nebulization / Oxygen Support\n• Monitoring of Vitals\n• Surgical / Conservative Management as indicated')}</td>
        <td colspan="2">
          <div style="font-size:12px;">
            ${checkbox(tx.ivFluids === true, 'IV Fluids')}
            ${checkbox(tx.antibiotics === true, 'Antibiotics')}
            ${checkbox(tx.analgesics === true, 'Analgesics / Antipyretics')}
            ${checkbox(tx.nebulization === true, 'Nebulization / Oxygen Support')}
            ${checkbox(tx.monitoring === true, 'Monitoring of Vitals')}
            ${checkbox(tx.surgicalManagement === true, 'Surgical / Conservative Management')}
          </div>
          <div style="margin-top:10px;font-size:12px;">${safeText(summary.treatmentGiven || '')}</div>
        </td>
      </tr>
      
      <tr>
        <td colspan="2" class="section-title">SURGICAL PROCEDURE / OPERATION (IF ANY)</td>
        <td colspan="2" class="section-title">CONDITION AT DISCHARGE</td>
      </tr>
      <tr>
        <td colspan="2">
          <div style="font-size:12px;"><strong>Procedure Name:</strong> ${safeText(summary.surgicalProcedureName || '________')}</div>
          <div style="font-size:12px;margin-top:5px;"><strong>Date of Surgery:</strong> ${fmtDisplayDate(summary.dateOfSurgery) === '___/___/___' ? '________' : fmtDisplayDate(summary.dateOfSurgery)}</div>
          <div style="font-size:12px;margin-top:5px;"><strong>Type of Anaesthesia:</strong> ${safeText(summary.anaesthesiaType || '________')}</div>
          <div style="font-size:12px;margin-top:5px;"><strong>Operative Findings:</strong> ${safeText(summary.operativeFindings || '________')}</div>
        </td>
        <td colspan="2" style="height:95px;font-size:12px;white-space:pre-wrap;vertical-align:top;">${safeText(summary.conditionAtDischarge || '')}</td>
      </tr>
      
      <tr><td colspan="4" class="section-title">DISCHARGE MEDICATIONS</td></tr>
      <tr>
        <td colspan="4" style="padding:0;">
          <table style="width:100%; border-collapse:collapse;">
            <tr style="background:#1e3a6b;color:white;">
              <th style="border:1px solid #000;padding:8px;text-align:left;">Medicine Name</th>
              <th style="border:1px solid #000;padding:8px;text-align:left;">Dosage</th>
              <th style="border:1px solid #000;padding:8px;text-align:left;">Frequency</th>
              <th style="border:1px solid #000;padding:8px;text-align:left;">Duration</th>
            </tr>
            ${medRows}
          </table>
        </td>
      </tr>
      
      <tr>
        <td colspan="2" class="section-title">DISCHARGE ADVICE</td>
        <td colspan="2" class="section-title">FOLLOW-UP</td>
      </tr>
      <tr>
        <td colspan="2" style="height:110px;font-size:12px;">
          • Take medicines as prescribed.<br>
          • Maintain proper hydration and diet.<br>
          • Avoid strenuous activity until advised.<br>
          • Monitor BP / Sugar regularly if applicable.<br>
          • Follow wound care instructions if operated.<br>
          • Visit immediately in case of fever, vomiting, pain, breathing difficulty or any emergency symptoms.<br>
          <div style="margin-top:8px;">${safeText(summary.dischargeAdvice || '')}</div>
        </td>
        <td colspan="2" style="font-size:12px;">
          Follow-up after <strong>${safeText(summary.followUpDays || '___')}</strong> days in OPD with all previous records and investigation reports.<br><br>
          Date: ${fmtDisplayDate(summary.followUpDate)}<br>
          Place: ${safeText(summary.followUpPlace || '________')}
        </td>
      </tr>
      
      <tr><td colspan="4" class="section-title">DECLARATION</td></tr>
      <tr>
        <td colspan="4" style="font-size:12px;padding:12px;">
          <strong>I have received and understood all discharge instructions regarding medications, follow-up and precautions.</strong>
        </td>
      </tr>
      <tr>
        <td colspan="2" class="label-cell">Doctor's Signature & Seal</td>
        <td colspan="2" class="label-cell">Patient / Attendant Signature</td>
      </tr>
      <tr>
        <td colspan="2" class="sig-cell"><div class="sig-blank"></div></td>
        <td colspan="2" class="sig-cell"><div class="sig-blank"></div></td>
      </tr>
      <tr>
        <td colspan="2" class="label-cell">Hospital Stamp</td>
        <td colspan="2" class="label-cell">Date & Time of Discharge</td>
      </tr>
      <tr>
        <td colspan="2" class="stamp-cell">
          ${stampPrint ? `<div class="sig-text">${stampPrint}</div>` : ''}
        </td>
        <td colspan="2" class="discharge-dt-cell">${safeText(fmtDateOnly(dischargeDT))} ${safeText(fmtTimeOnly(dischargeDT))}</td>
      </tr>
    </table>
    <div class="footer-thanks">Thank you for choosing ${HOSPITAL_NAME_DISPLAY}. Wishing you a speedy recovery.</div>
  </div>
</div>

<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}