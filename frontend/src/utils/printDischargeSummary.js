function safeText(v) {
  const s = v == null ? '' : String(v);
  return s.replace(/[<>&]/g, (ch) => (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'));
}

function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Printable IPD discharge summary (New H T Hospital branding — matches discharge slip header).
 * @param {{ admission: object, dischargeRequestedAt?: string|null }} opts
 */
export function printDischargeSummary({ admission, dischargeRequestedAt }) {
  if (!admission) return;
  const p = admission.patient || {};
  const doc = admission.doctor?.user?.name || '—';
  const ward = admission.ward
    ? `${safeText(admission.ward.name || '')}${admission.ward.type ? ` (${String(admission.ward.type)})` : ''}`.trim()
    : '—';
  const bed = admission.bed?.code || '—';
  const dx = safeText(admission.notesText || 'As per IPD records.');
  const ipd = safeText(admission.ipdNumber || admission.id || '');
  const meds = Array.isArray(admission?.treatmentPlan?.medicines) ? admission.treatmentPlan.medicines : [];
  const medRows = meds
    .map((m, idx) => {
      const name = safeText(m?.medicine || m?.name || '').trim();
      const dosage = safeText(m?.dosage || '').trim();
      const duration = safeText(m?.duration || '').trim();
      const mode = safeText(m?.mode || '').trim();
      if (!name && !dosage && !duration && !mode) return '';
      return `<tr>
        <td style="width:38px; text-align:center;">${idx + 1}</td>
        <td><strong>${name || '—'}</strong></td>
        <td>${dosage || '—'}</td>
        <td>${duration || '—'}</td>
        <td>${mode || '—'}</td>
      </tr>`;
    })
    .filter(Boolean)
    .join('');

  const w = window.open('', '_blank', 'width=900,height=900');
  if (!w) return;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Discharge Summary — New H T Hospital</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; margin: 0; padding: 12px; font-size: 13px; color: #0f172a;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .wrap { max-width: 760px; margin: 0 auto; border: 1px solid #0f172a; border-radius: 2px; overflow: hidden; }
    .opd-header {
      position: relative; height: 100px; overflow: hidden; border-bottom: 2px solid #0f172a;
      background: linear-gradient(120deg, #1a2e80 0%, #2a52be 45%, #4c1d95 100%);
    }
    .header-text { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; color: #fff; padding: 0 16px; }
    .header-text h1 { margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 0.5px; }
    .header-text .sub { font-size: 12px; font-weight: 600; letter-spacing: 3px; color: #dbeafe; margin-top: 4px; }
    .title { text-align: center; font-weight: 800; font-size: 15px; padding: 12px; background: #f1f5f9; border-bottom: 1px solid #0f172a; letter-spacing: 0.12em; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid #cbd5e1; }
    .cell { padding: 10px 14px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    .cell:nth-child(2n) { border-right: none; }
    .lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 4px; }
    .body { padding: 16px 18px 22px; line-height: 1.65; }
    .body h2 { margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #334155; }
    .sig { margin-top: 28px; display: flex; justify-content: space-between; gap: 16px; font-size: 12px; color: #475569; }
    .line { border-top: 1px solid #0f172a; margin-top: 36px; padding-top: 6px; width: 42%; text-align: center; font-size: 11px; }
    .rx-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    .rx-table th, .rx-table td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
    .rx-table th { background: #f8fafc; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
    .footer { padding: 10px 14px; font-size: 10px; text-align: center; color: #64748b; border-top: 1px solid #cbd5e1; background: #f8fafc; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="opd-header">
      <div class="header-text">
        <h1>नैतिक हॉस्पिटल</h1>
        <div class="sub">New H T Hospital — IPD Discharge Summary</div>
      </div>
    </div>
    <div class="title">DISCHARGE SUMMARY / सारांश</div>
    <div class="grid">
      <div class="cell"><div class="lbl">Patient</div><strong>${safeText(p.name)}</strong></div>
      <div class="cell"><div class="lbl">UHID</div><strong>${safeText(p.uhid)}</strong></div>
      <div class="cell"><div class="lbl">Age / Gender</div>${safeText(p.age ?? '—')} / ${safeText(p.gender || '—')}</div>
      <div class="cell"><div class="lbl">IPD No.</div>${ipd}</div>
      <div class="cell"><div class="lbl">Treating doctor</div>${safeText(doc)}</div>
      <div class="cell"><div class="lbl">Ward / Bed</div>${safeText(ward)} / ${safeText(bed)}</div>
      <div class="cell"><div class="lbl">Admission</div>${fmtDateTime(admission.admissionDate)}</div>
      <div class="cell"><div class="lbl">Nurse discharge request</div>${fmtDateTime(dischargeRequestedAt || admission.dischargeRequestedAt)}</div>
    </div>
    <div class="body">
      <h2>Clinical notes &amp; diagnosis (record)</h2>
      <p style="margin:0; white-space:pre-wrap;">${dx || '—'}</p>
      <h2 style="margin-top:18px;">Medicines (treatment plan)</h2>
      ${
        medRows
          ? `<table class="rx-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Medicine</th>
                  <th>Dosage</th>
                  <th>Duration</th>
                  <th>Mode</th>
                </tr>
              </thead>
              <tbody>${medRows}</tbody>
            </table>`
          : `<p style="margin:0; color:#64748b;">—</p>`
      }
      <h2 style="margin-top:18px;">Condition on discharge</h2>
      <p style="margin:0;">Stable for discharge as per nurse-approved workflow. Further follow-up as advised by treating doctor.</p>
      <div class="sig">
        <div class="line">Treating doctor</div>
        <div class="line">Hospital stamp</div>
      </div>
    </div>
    <div class="footer">Computer-generated summary for administrative use. Authenticated clinical notes remain in the EMR.</div>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
