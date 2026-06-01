function safeText(v) {
  const s = v == null ? '' : String(v);
  return s.replace(/[<>&]/g, (ch) => (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'));
}

function formatDateForPrint(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
  }
  return s;
}

/** Map editor deathForm (nested placeOfDeath) → print payload */
export function normalizeDeathForPrint(raw) {
  const f = raw && typeof raw === 'object' ? raw : {};
  const pod = f.placeOfDeath && typeof f.placeOfDeath === 'object' ? f.placeOfDeath : {};
  return {
    ...f,
    dateOfIssue: formatDateForPrint(f.dateOfIssue) || f.dateOfIssue,
    admissionDate: formatDateForPrint(f.admissionDate) || f.admissionDate,
    deathDate: formatDateForPrint(f.deathDate) || f.deathDate,
    placeInHospital: !!(pod.inHospital ?? f.placeInHospital),
    placeICU: !!(pod.icu ?? f.placeICU),
    placeEmergency: !!(pod.emergency ?? f.placeEmergency),
    placeWard: !!(pod.ward ?? f.placeWard),
    placeOtherText: safeText(pod.otherText ?? f.placeOtherText ?? ''),
    hospitalRegNo: safeText(f.hospitalRegNo ?? ''),
    nabhNo: safeText(f.nabhNo ?? ''),
  };
}

export function printDeathCertificate({ summary } = {}) {
  const f = normalizeDeathForPrint(summary?.deathForm || {});
  const w = window.open('', '_blank', 'width=900,height=950');
  if (!w) {
    window.alert('Pop-up blocked. Please allow pop-ups for this site, then try Print again.');
    return;
  }
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Provisional Death Certificate</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Times New Roman',serif; background:#7f8c8d; display:flex; justify-content:center; align-items:flex-start; min-height:100vh; padding:20px; }
    .cert { max-width:820px; width:100%; margin:0 auto; background:white; border:2px solid #1a3a6b; box-shadow:0 5px 15px rgba(0,0,0,0.3); }
    .hdr { display:flex; align-items:flex-start; justify-content:space-between; padding:10px 14px 8px; border-bottom:2px solid #1a3a6b; }
    .logo-area { display:flex; align-items:flex-start; gap:10px; }
    .logo-box { width:56px; height:56px; border:2px solid #1a3a6b; border-radius:8px; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#fff; flex-shrink:0; }
    .logo-box img { width:50px; height:50px; object-fit:contain; display:block; }
    .hosp-info .name { font-size:20px; font-weight:900; color:#1a3a6b; letter-spacing:1px; }
    .hosp-info .addr { font-size:9px; color:#333; margin-top:3px; line-height:1.4; }
    .hdr-right { text-align:right; }
    .hdr-right .row { font-size:10px; margin-bottom:5px; }
    .hdr-right .lbl { font-weight:700; color:#1a3a6b; }
    .hdr-right .val { border-bottom:1px solid #000; min-width:120px; display:inline-block; }
    .title-bar { color:white; text-align:center; padding:8px 0 6px; color:#000;  }
    .title-bar h1 { font-size:17px; font-weight:900; letter-spacing:2px; }
    .title-bar p { font-size:9px; color:#c9a03d; margin-top:2px; }
    .accred-bar { display:flex; justify-content:flex-end; gap:24px; padding:5px 14px; border-bottom:1px solid #1a3a6b; background:#f5f8ff; }
    .accred-row { font-size:9.5px; display:flex; gap:6px; align-items:center; }
    .accred-row .lbl { font-weight:700; color:#1a3a6b; }
    .accred-row .val { border-bottom:1px solid #555; min-width:80px; display:inline-block; }
    .body { display:flex; border-top:1px solid #1a3a6b; }
    .col-left { width:50%; border-right:1px solid #1a3a6b; }
    .col-right { width:50%; }
    .sec-head { background:#1a3a6b; color:white; font-size:10.5px; font-weight:700; padding:4px 8px; letter-spacing:0.5px; }
    .field-row { display:flex; align-items:flex-start; border-bottom:0.5px solid #b0b8cc; min-height:24px; }
    .f-lbl { font-size:10px; font-weight:700; color:#1a3a6b; padding:4px 6px; width:36%; flex-shrink:0; }
    .f-sep { font-size:10px; padding:4px 0; color:#555; }
    .f-val { font-size:10px; padding:4px 6px; flex:1; }
    .f-blank { border-bottom:1px solid #555; min-width:50px; display:inline-block; }
    .chk-row { display:flex; align-items:center; gap:10px; padding:4px 6px; font-size:10px; flex-wrap:wrap; }
    .chk { display:inline-flex; align-items:center; gap:3px; }
    .chk-box { width:12px; height:12px; border:1px solid #000; display:inline-block; flex-shrink:0; text-align:center; font-size:9px; line-height:12px; font-weight:700; }
    .cause-section { padding:6px 8px; }
    .cause-item { margin-bottom:8px; }
    .cause-lbl { font-size:10px; font-weight:700; color:#1a3a6b; margin-bottom:3px; }
    .cause-line { border-bottom:1px solid #555; height:22px; }
    .cause-line2 { border-bottom:1px solid #aaa; height:20px; }
    .summary-area { padding:6px 8px; min-height:65px; }
    .sum-line { border-bottom:1px solid #aaa; height:18px; margin-bottom:3px; }
    .cert-section { padding:8px 10px; border-top:1px solid #1a3a6b; font-size:9.5px; font-style:italic; line-height:1.5; }
    .sign-section { display:flex; border-top:1px solid #1a3a6b; }
    .sign-left { width:60%; padding:10px 12px; border-right:1px solid #1a3a6b; }
    .sign-right { width:40%; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:10px 8px; }
    .sign-field { margin-bottom:8px; font-size:10px; }
    .sign-field .slbl { font-weight:700; color:#1a3a6b; }
    .sval { border-bottom:1px solid #555; min-width:140px; display:inline-block; }
    .sig-line { border-top:1px solid #000; width:100%; text-align:center; padding-top:4px; font-size:9px; font-weight:700; margin-top:35px; }
    .stamp-space { width:100%; min-height:100px; margin-top:8px; }
    .footer { background:#fff8e1; border-top:2px solid #1a3a6b; padding:5px 10px; text-align:center; font-size:9px; font-style:italic; color:#b71c1c; font-weight:700; }
    @media print { body { background:white; padding:0; } .cert { box-shadow:none; } * { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style>
</head>
<body>
<div class="cert">
  <div class="hdr">
    <div class="logo-area">
      <div class="logo-box">
        <img src="/hopital_logo.png" alt="New H T Hospital" onerror="this.style.display='none'" />
      </div>
      <div class="hosp-info">
        <div class="name">NEW H T HOSPITAL</div>
        <div class="addr">ANAND BIHAR COLONY BHIKHARIPUR BLW, VARANASI, UP<br>Phone: +91 75410 31287 | 9559988876<br>www.newhthospital.com</div>
      </div>
    </div>
    <div class="hdr-right">
      <div class="row"><span class="lbl">Certificate No. : </span><span class="val">${safeText(f.certificateNo || '')}</span></div>
      <div class="row"><span class="lbl">Date of Issue : </span><span class="val">${safeText(f.dateOfIssue || '___ / ___ / _____')}</span></div>
    </div>
  </div>

  <div class="title-bar">
    <h1>PROVISIONAL DEATH CERTIFICATE</h1>
    <p>(For Hospital Use Only)</p>
  </div>

  <div class="accred-bar">
    <div class="accred-row"><span class="lbl">Hospital Registration No. :</span> <span class="val">${safeText(f.hospitalRegNo || '') || '&nbsp;'}</span></div>
    <div class="accred-row"><span class="lbl">NABH / Other Accreditation No. :</span> <span class="val">${safeText(f.nabhNo || '') || '&nbsp;'}</span></div>
  </div>

  <div class="body">
    <div class="col-left">
      <div class="sec-head">1. PATIENT DETAILS</div>
      <div class="field-row">
        <span class="f-lbl">Patient Name</span><span class="f-sep">:</span>
        <span class="f-val">${safeText(f.patientName || '')}</span>
      </div>
      <div class="field-row" style="align-items:center;">
        <span class="f-lbl">Age / Sex</span><span class="f-sep">:</span>
        <span style="font-size:10px;padding:4px;border-bottom:1px solid #555;min-width:45px;">${safeText(f.ageSex || '')}</span>
        <span style="font-size:10px;padding:4px;">/</span>
        <div class="chk-row" style="padding:2px 4px;">
          <span class="chk"><span class="chk-box">${f.sexMale ? '✓' : ''}</span><span>Male</span></span>
          <span class="chk"><span class="chk-box">${f.sexFemale ? '✓' : ''}</span><span>Female</span></span>
          <span class="chk"><span class="chk-box">${f.sexOther ? '✓' : ''}</span><span>Other</span></span>
        </div>
      </div>
      <div class="field-row">
        <span class="f-lbl">IPD / UHID No.</span><span class="f-sep">:</span>
        <span class="f-val">${safeText(f.ipdNo || '')} / ${safeText(f.uhidNo || '')}</span>
      </div>
      <div class="field-row" style="min-height:34px;">
        <span class="f-lbl">Address</span><span class="f-sep">:</span>
        <span class="f-val" style="min-height:30px;">${safeText(f.address || '')}</span>
      </div>

      <div class="sec-head">3. PROVISIONAL CAUSE OF DEATH <span style="font-weight:400;font-size:9px;">(As per clinical opinion)</span></div>
      <div class="cause-section">
        <div class="cause-item">
          <div class="cause-lbl">a) Immediate Cause</div>
          <div class="cause-line">${safeText(f.causeImmediate || '')}</div>
          <div class="cause-line2"></div>
        </div>
        <div class="cause-item">
          <div class="cause-lbl">b) Antecedent Cause(s)</div>
          <div class="cause-line">${safeText(f.causeAntecedent || '')}</div>
          <div class="cause-line2"></div>
        </div>
        <div class="cause-item" style="margin-bottom:0;">
          <div class="cause-lbl">c) Other Significant Conditions</div>
          <div class="cause-line">${safeText(f.causeOther || '')}</div>
          <div class="cause-line2"></div>
        </div>
      </div>
    </div>

    <div class="col-right">
      <div class="sec-head">2. ADMISSION &amp; DEATH DETAILS</div>
      <div class="field-row">
        <span class="f-lbl">Date of Admission</span><span class="f-sep">:</span>
        <span style="font-size:10px;padding:4px;">${safeText(f.admissionDate || '___ / ___ / _____')}</span>
        <span style="font-size:10px;padding:4px;font-weight:700;">Time:</span>
        <span style="font-size:10px;padding:4px;border-bottom:1px solid #555;min-width:50px;">${safeText(f.admissionTime || '')}</span>
      </div>
      <div class="field-row">
        <span class="f-lbl">Date of Death</span><span class="f-sep">:</span>
        <span style="font-size:10px;padding:4px;">${safeText(f.deathDate || '___ / ___ / _____')}</span>
        <span style="font-size:10px;padding:4px;font-weight:700;">Time:</span>
        <span style="font-size:10px;padding:4px;border-bottom:1px solid #555;min-width:50px;">${safeText(f.deathTime || '')}</span>
      </div>
      <div class="field-row" style="align-items:center;">
        <span class="f-lbl">Place of Death</span><span class="f-sep">:</span>
        <div class="chk-row">
          <span class="chk"><span class="chk-box">${f.placeInHospital ? '✓' : ''}</span><span>In Hospital</span></span>
          <span class="chk"><span class="chk-box">${f.placeICU ? '✓' : ''}</span><span>ICU</span></span>
          <span class="chk"><span class="chk-box">${f.placeEmergency ? '✓' : ''}</span><span>Emergency</span></span>
          <span class="chk"><span class="chk-box">${f.placeWard ? '✓' : ''}</span><span>Ward</span></span>
          <span style="font-size:10px;">Other: <span style="border-bottom:1px solid #555;display:inline-block;min-width:40px;">${safeText(f.placeOtherText || '')}</span></span>
        </div>
      </div>
      <div class="field-row">
        <span class="f-lbl">Ward / Unit / ICU</span><span class="f-sep">:</span>
        <span class="f-val">${safeText(f.wardUnit || '')}</span>
      </div>

      <div class="sec-head">4. CLINICAL SUMMARY</div>
      <div class="summary-area">
        <div style="font-size:10px;line-height:1.6;">${safeText(f.clinicalSummary || '')}</div>
        <div class="sum-line"></div><div class="sum-line"></div><div class="sum-line"></div>
        <div class="sum-line"></div><div class="sum-line"></div><div class="sum-line"></div>
      </div>
    </div>
  </div>

  <div class="cert-section">
    <strong style="color:#1a3a6b;">5. PROVISIONAL CERTIFICATION</strong><br>
    <em>This is to certify that the above named patient expired in this hospital on the date and time mentioned above during the course of treatment.
    This certificate is being issued provisionally for hospital and administrative purposes pending final official registration / documentation.</em>
  </div>

  <div class="sign-section">
    <div class="sign-left">
      <div class="sign-field"><span class="slbl">Name of Doctor :</span> <span class="sval">${safeText(f.doctorName || '')}</span></div>
      <div class="sign-field"><span class="slbl">Designation :</span> <span class="sval">${safeText(f.doctorDesignation || '')}</span></div>
      <div class="sign-field"><span class="slbl">Medical Registration No. :</span> <span class="sval">${safeText(f.doctorRegNo || '')}</span></div>
      <div class="sign-field">
        <span class="slbl">Date :</span>
        <span style="border-bottom:1px solid #555;display:inline-block;min-width:90px;">${safeText(f.certDateTime?.split(' ')[0] || '___ / ___ / _____')}</span>
        &nbsp;<span class="slbl">Time:</span>
        <span style="border-bottom:1px solid #555;display:inline-block;min-width:60px;">${safeText(f.certDateTime?.split(' ')[1] || '')}</span>
      </div>
    </div>
    <div class="sign-right">
      <div style="width:100%;"><div class="sig-line">Signature of Treating Doctor</div></div>
      <div class="stamp-space"></div>
    </div>
  </div>

  <div class="footer">
    Note: This is a provisional certificate and not valid for legal purposes of death registration.
  </div>
</div>
<script>window.onload=function(){window.focus();window.print();}</script>
</body></html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}