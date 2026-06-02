import { HOSPITAL_NAME_DISPLAY, HOSPITAL_NAME_EN } from './hospitalBranding';

function safeText(v) {
  const s = v == null ? '' : String(v);
  return s.replace(/[<>&]/g, (ch) => (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'));
}

function checkbox(checked, label) {
  const box = checked
    ? `<span style="display:inline-flex;width:12px;height:12px;border:1.5px solid #1e3a8a;background:#1e3a8a;align-items:center;justify-content:center;font-size:9px;color:#fff;border-radius:2px;">✓</span>`
    : `<span style="display:inline-flex;width:12px;height:12px;border:1.5px solid #555;border-radius:2px;"></span>`;
  return `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;">${box}<span>${safeText(label)}</span></span>`;
}

function sectionHead(n, title) {
  return `<tr><td colspan="4" style="background:#1e3a8a;color:#fff;font-weight:800;font-size:11.5px;padding:7px 10px;letter-spacing:0.03em;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${n}. ${title}</td></tr>`;
}

function fmtDt(v) {
  if (!v) return '___________';
  try {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    }
  } catch { /* use raw */ }
  return safeText(v);
}

function formatIsoDateForPrint(v) {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }
  return s;
}

/** Normalize editor lamaForm → print payload */
export function normalizeLamaForPrint(raw) {
  const f = raw && typeof raw === 'object' ? raw : {};
  const ageSex =
    safeText(f.ageSex) ||
    [f.age, f.sex].filter((x) => x != null && String(x).trim() !== '').join(' / ');
  const admittedOn = f.admittedOn ? formatIsoDateForPrint(f.admittedOn) : '';
  const followUpOn = f.followUpOn ? formatIsoDateForPrint(f.followUpOn) : '';

  return {
    ...f,
    patientName: safeText(f.patientName || f.declarationName),
    ageSex,
    admittedOn,
    followUpOn,
    declarationRelationName: safeText(f.declarationRelationName),
    reasonForLeaving: safeText(f.reasonForLeaving),
    investigations: f.investigations || {},
  };
}

function slipHeaderHTML({ showNote = true } = {}) {
  return `
      <div class="slip-hdr">
        <div class="slip-hdr-logo">
          <img src="/hopital_logo.png" alt="${HOSPITAL_NAME_DISPLAY}" onerror="this.style.display='none'" />
        </div>
        <div class="slip-hdr-center">
          <div class="slip-hdr-hospital">${HOSPITAL_NAME_EN}</div>
          <div class="slip-hdr-addr">ANAND BIHAR COLONY BHIKHARIPUR BLW, VARANASI, UP</div>
          <div class="slip-hdr-title">LEAVE AGAINST MEDICAL ADVICE (LAMA)</div>
        </div>
      </div>
      ${
        showNote
          ? '<div class="note">(To be used when a patient or attendant refuses recommended treatment and leaves the hospital against medical advice)</div>'
          : ''
      }`;
}

function buildSlipHTML(f) {
  const inv = f.investigations || {};

  const page1Table = `
        ${sectionHead(1, 'PATIENT DETAILS')}
        <tr>
          <td colspan="3"><span class="lbl">Patient Name</span>${safeText(f.patientName) || '&nbsp;'}</td>
          <td><span class="lbl">Age / Sex</span>${safeText(f.ageSex) || '&nbsp;'}</td>
        </tr>
        <tr>
          <td colspan="3"><span class="lbl">Address</span>${safeText(f.address) || '&nbsp;'}</td>
          <td><span class="lbl">Phone No.</span>${safeText(f.phone) || '&nbsp;'}</td>
        </tr>
        <tr>
          <td><span class="lbl">Admitted On</span>${safeText(f.admittedOn) || '&nbsp;'}</td>
          <td colspan="3"><span class="lbl">Ward / Unit / Bed No.</span>${safeText(f.wardBed) || '&nbsp;'}</td>
        </tr>
        <tr>
          <td colspan="4"><span class="lbl">Consultant / Doctor In-charge</span>${safeText(f.consultant) || '&nbsp;'}</td>
        </tr>

        ${sectionHead(2, 'CLINICAL SUMMARY')}
        <tr><td colspan="4"><span class="lbl">Provisional / Working Diagnosis</span>${safeText(f.diagnosis).replace(/\n/g, '<br/>') || '&nbsp;'}<br/>&nbsp;</td></tr>
        <tr><td colspan="4"><span class="lbl">Brief Summary of Illness / Condition</span>${safeText(f.illnessSummary).replace(/\n/g, '<br/>') || '&nbsp;'}<br/>&nbsp;<br/>&nbsp;</td></tr>

        ${sectionHead(3, 'INVESTIGATIONS')}
        <tr><td colspan="4">
          <span class="lbl">Key Investigations Done</span>
          <div style="margin:4px 0;">
            ${checkbox(inv.cbc, 'CBC')} ${checkbox(inv.rbs, 'RBS')} ${checkbox(inv.kft, 'KFT')}
            ${checkbox(inv.lft, 'LFT')} ${checkbox(inv.ecg, 'ECG')} ${checkbox(inv.xray, 'X-Ray')}
            ${checkbox(inv.usg, 'USG')} ${checkbox(inv.others, 'Others')}
            ${inv.others && inv.othersText ? `<span style="text-decoration:underline;">${safeText(inv.othersText)}</span>` : ''}
          </div>
        </td></tr>
        <tr><td colspan="4"><span class="lbl">Summary / Significant Findings</span>${safeText(f.investigationFindings).replace(/\n/g, '<br/>') || '&nbsp;'}<br/>&nbsp;</td></tr>

        ${sectionHead(4, 'TREATMENT GIVEN')}
        <tr><td colspan="4"><span class="lbl">Treatment / Management Provided</span>${safeText(f.treatmentGiven).replace(/\n/g, '<br/>') || '&nbsp;'}<br/>&nbsp;<br/>&nbsp;</td></tr>

        ${sectionHead(5, 'ADVICE OF DOCTOR & RISKS EXPLAINED')}
        <tr><td colspan="4" style="line-height:1.6;">
          The patient / attendant has been explained about the nature of illness / condition and the need for further
          treatment / investigations / surgery. The risks of not taking treatment and leaving the hospital against medical
          advice were explained in detail, including but not limited to:
          <ul class="bullets">
            <li>Worsening of the current condition</li>
            <li>Complications and disability</li>
            <li>Need for ICU / Ventilator support</li>
            <li>Delay in treatment may be life-threatening</li>
            <li>Permanent injury</li>
            <li>Increased risk of morbidity</li>
            <li>Death</li>
          </ul>
          Despite the above explanation, the patient / attendant has decided to leave the hospital against medical advice.
        </td></tr>`;

  const page2Table = `
        ${sectionHead(6, 'DECLARATION BY PATIENT / ATTENDANT')}
        <tr><td colspan="4" style="line-height:1.7;">
          I, <strong>${safeText(f.patientName) || '___________________________'}</strong> &nbsp;&nbsp;(Name of Patient / Attendant),<br/>
          S/o &nbsp;/&nbsp; D/o &nbsp;/&nbsp; W/o &nbsp;<strong>${safeText(f.declarationRelationName) || '___________________________'}</strong>,
          have been explained in a language I understand about my / my relative's condition and the need for treatment.
          I understand the risks of leaving the hospital against medical advice. I am leaving the hospital on my own decision / on request.<br/><br/>
          <span class="lbl" style="display:inline;">Reason for Leaving (if stated) :</span>&nbsp;
          ${safeText(f.reasonForLeaving) || '_________________________________________________'}
        </td></tr>

        ${sectionHead(7, 'SIGNATURES')}
        <tr class="sig-row">
          <td><span class="lbl">Signature of Patient / Attendant</span><br/><br/><br/>
            <span class="lbl">Date &amp; Time :</span> ${fmtDt(f.sigPatientDate)}</td>
          <td><span class="lbl">Name &amp; Relationship (Attendant)</span><br/>
            ${safeText(f.sigAttendantName) || '&nbsp;'}<br/><br/>
            <span class="lbl">Date &amp; Time :</span> ${fmtDt(f.sigAttendantDate)}</td>
          <td><span class="lbl">Signature of Doctor (Explained Risks)</span><br/><br/><br/>
            <span class="lbl">Date &amp; Time :</span> ${fmtDt(f.sigDoctorDate)}</td>
          <td><span class="lbl">Signature of Witness (Staff)</span><br/><br/><br/>
            <span class="lbl">Date &amp; Time :</span> ${fmtDt(f.sigWitnessDate)}</td>
        </tr>

        ${sectionHead(8, 'FOLLOW-UP ADVICE (IF PATIENT RETURNS)')}
        <tr><td colspan="4">
          <span class="lbl" style="display:inline;">Patient advised to report immediately in case of :</span>&nbsp;
          ${safeText(f.followUpReportIf) || '__________________________________________'}<br/>
          <span class="lbl" style="display:inline;">Follow-up advised on / after :</span>&nbsp;
          ${safeText(f.followUpOn) || '________________'}&nbsp;&nbsp;&nbsp;
          <span class="lbl" style="display:inline;">At :</span>&nbsp;
          ${safeText(f.followUpAt) || '________________'}<br/>
          <span class="lbl" style="display:inline;">Contact / Emergency No. :</span>&nbsp;
          ${safeText(f.followUpContact) || '__________________________________________'}
        </td></tr>`;

  return `
    <div class="wrap wrap--page1">
      ${slipHeaderHTML()}
      <table>${page1Table}</table>
    </div>
    <div class="wrap wrap--page2">
      ${slipHeaderHTML({ showNote: false })}
      <table class="lama-decl-block">${page2Table}</table>
      <div class="footer-note">
        NOTE: This is not a regular discharge. This is Leave Against Medical Advice (LAMA).
      </div>
    </div>
  `;
}

const PRINT_STYLES = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #111; font-size: 11.5px; background: #fff; }
  .wrap { max-width: 790px; margin: 0 auto; border: 1.5px solid #111; }
  .slip-hdr { position: relative; padding: 10px 12px 8px 76px; border-bottom: 2px solid #1e3a8a; min-height: 62px; }
  .slip-hdr-logo { position: absolute; left: 12px; top: 10px; width: 56px; height: 56px; border: 1.5px solid #1e3a8a; border-radius: 8px; background: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .slip-hdr-logo img { width: 50px; height: 50px; object-fit: contain; display: block; }
  .slip-hdr-center { text-align: center; width: 100%; }
  .slip-hdr-hospital { font-weight: 900; font-size: 15px; color: #1e3a8a; letter-spacing: 0.06em; }
  .slip-hdr-addr { font-size: 9px; color: #475569; margin-top: 3px; line-height: 1.4; }
  .slip-hdr-title { font-weight: 900; font-size: 13px; letter-spacing: 0.05em; margin-top: 6px; color: #0f172a; }
  .wrap--page2 { page-break-before: always; break-before: page; margin-top: 0; }
  .lama-decl-block { page-break-inside: avoid; break-inside: avoid; }
  .lama-decl-block tr { page-break-inside: avoid; break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; }
  td { border: 1px solid #94a3b8; padding: 7px 9px; vertical-align: top; font-size: 11.5px; }
  .lbl { font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #475569; display: block; margin-bottom: 3px; }
  .note { font-size: 10.5px; padding: 7px 10px; border-bottom: 1px solid #cbd5e1; font-style: italic; color: #334155; }
  .bullets { margin: 6px 0; padding-left: 20px; columns: 2; column-gap: 20px; }
  .bullets li { margin: 3px 0; break-inside: avoid; }
  .sig-row td { height: 62px; }
  .footer-note { padding: 7px 10px; border-top: 2px solid #b91c1c; color: #991b1b; font-weight: 800; font-size: 11px; text-align: center; }
  @media print {
    body { padding: 0; }
    @page { margin: 10mm; }
  }
`;

/**
 * Print hospital LAMA slip directly — opens a new popup with ONLY the slip
 * and immediately triggers the browser print dialog. No intermediate page shown.
 */
export function printLamaForm({ summary } = {}) {
  const f = normalizeLamaForPrint(summary?.lamaForm || {});
  const w = window.open('', '_blank', 'width=900,height=900');
  if (!w) {
    window.alert('Pop-up blocked. Please allow pop-ups for this site, then try Print again.');
    return;
  }

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>LAMA ${HOSPITAL_NAME_DISPLAY}</title>
<style>${PRINT_STYLES}</style></head><body>
${buildSlipHTML(f)}
<script>window.onload = function () { window.focus(); window.print(); };<\/script>
</body></html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}
