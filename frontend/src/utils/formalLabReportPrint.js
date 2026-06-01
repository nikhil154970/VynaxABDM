/**
 * Formal  HTML — S.D. Pathology header (unchanged) with inner layout
 * matching multi-page pathology PDFs: consulting block, patient meta + page x/y,
 * justified category intro, section title, optional panel sub-headings, results table.
 * Categories from GET /lab/reports/:id (per-line `category` on results).
 *
 * PRINT FORMAT: Matches the physical printed slip exactly (image reference).
 */

export const REPORT_LOGO_DATA_URI = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="140" height="80" viewBox="0 0 140 80">
  <defs>
    <linearGradient id="g" x1="0" x2="1">
      <stop offset="0" stop-color="#7a2ca6"/>
      <stop offset="1" stop-color="#b23bb5"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="140" height="80" rx="10" fill="url(#g)"/>
  <path d="M0 62 C40 48, 78 78, 140 52 L140 80 L0 80 Z" fill="#f6c53a" opacity="0.95"/>
  <text x="70" y="36" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" font-weight="900" fill="#ffffff" letter-spacing="1">S.D.</text>
  <text x="70" y="58" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="16" font-weight="900" fill="#ffffff" letter-spacing="1">PATHOLOGY</text>
</svg>
`)}`;

/** Long intros (reference-style) per panel — similar to printed lab PDFs. */
const INTRO_HEMATOLOGY =
  'A platelet count is a diagnostic test that determines the number of platelets in the patient\'s blood. Platelets, which are also called thrombocytes, are small disk-shaped blood cells produced in the bone marrow and involved in the process of blood clotting. There are normally between 150,000–450,000 platelets in each micro-liter of blood. Low platelet counts or abnormally shaped platelets are associated with bleeding disorders. High platelet counts sometimes indicate disorders of the bone marrow.';

const INTRO_LIVER =
  'Liver function tests, also known as liver chemistries, help determine the health of your liver by measuring the levels of proteins, liver enzymes, and bilirubin in your blood. They can also monitor the progression or treatment of an existing disease. Depending on the test, either higher or lower-than-typical levels of these enzymes or proteins can indicate a problem with your liver. Some of the reasons liver function tests may be performed include screening for diseases such as hepatitis, monitoring the side effects of your medications, and examining the severity of liver disease.';

const INTRO_RENAL =
  'Renal function tests (RFT) are a group of tests that may be performed together to evaluate kidney (renal) function. The tests measure levels of various substances, including several minerals, electrolytes, proteins, and glucose (sugar), in the blood to determine the current health of the kidneys. If the kidneys are not functioning properly, waste products can accumulate in the blood and fluid levels can increase to dangerous volumes, causing damage to the body or a potentially life-threatening situation. Numerous conditions and diseases can result in damage to the kidneys. The most common causes of and main risk factors for kidney disease are diabetes and hypertension.';

const INTRO_GENERIC_BIO =
  'Clinical chemistry tests measure chemical substances in blood or other body fluids. Results help your doctor assess organ function, metabolic status, and response to treatment. Interpretation should always be correlated with clinical findings.';

const INTRO_GENERIC =
  'The following investigations have been performed using standard laboratory methods. Results should be interpreted in conjunction with the patient\'s clinical history and examination findings.';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatDateOnly(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function formatTimeOnly(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function normalizeRow(r) {
  if (r?.isSubHeading) return null;
  const name = String(r?.name || r?.testName || '').trim();
  if (!name) return null;
  return {
    name,
    value: r?.value ?? '—',
    unit: r?.unit ?? '—',
    range: r?.range ?? r?.referenceRange ?? '—',
    category: String(r?.category || '').trim(),
  };
}

function isHematologyRow(row) {
  const c = row.category.toLowerCase();
  if (/hema|haem|cbc|hematology|blood routine|btct/i.test(c)) return true;
  const n = row.name.toLowerCase();
  return /\b(hb|hemoglobin|hgb|wbc|tlc|neutrophil|lymphocyte|monocyte|eosinophil|basophil|platelet|plt|rbc|pcv|hct|mcv|mch|mchc|esr|rdw|mpv)\b/i.test(n);
}

function isBiochemistryRow(row) {
  const c = row.category.toLowerCase();
  if (/bio|chem|clinical|liver|renal|lipid|thyroid|serum|patho/i.test(c)) return true;
  const n = row.name.toLowerCase();
  return /\b(bilirubin|urea|creatinine|creatnine|uric|sodium|potassium|chloride|glucose|sugar|rbs|sgpt|sgot|ast|alt|alkaline|phosphatase|albumin|globulin|protein|crp|calcium|amylase|lipase|tsh|t3|t4)\b/i.test(n);
}

/** Split biochemistry rows into LFT / RFT / ELECTROLYTES / OTHER for PDF-style panels. */
function biochemistryPanel(row) {
  const n = row.name.toLowerCase();
  if (/\b(sodium|potassium|chloride)\b/i.test(n)) return 'ELECTROLYTES';
  if (/\b(urea|creatinine|creatnine|uric acid|calcium|glucose|blood sugar|random blood|rbs|gfr|bun|egfr)\b/i.test(n)) return 'RFT';
  if (/\b(bilirubin|sgpt|sgot|ast|alt|alkaline|phosphatase|albumin|globulin|total protein|crp|amylase|lipase|ldh)\b/i.test(n)) return 'LFT';
  return 'OTHER';
}

function genericIntroForCategory(cat) {
  const c = String(cat || '').trim();
  if (!c) return INTRO_GENERIC;
  return `${INTRO_GENERIC} This sheet covers investigations grouped under "${c}".`;
}

/**
 * @typedef {{ intro: string, sectionTitle: string, blocks: { subHeading: string | null, rows: ReturnType<typeof normalizeRow>[] }[] }} PrintPageDef
 */

/**
 * Build ordered print pages (each becomes one printed sheet with full header repeat).
 * @param {Record<string, unknown>} report
 * @returns {PrintPageDef[]}
 */
export function buildPrintPagesForReport(report) {
  const raw = Array.isArray(report?.results) ? report.results : [];
  const rows = raw.map(normalizeRow).filter(Boolean);
  if (!rows.length) {
    return [{ intro: INTRO_GENERIC, sectionTitle: 'LAB REPORT', blocks: [{ subHeading: null, rows: [] }] }];
  }

  const hema = rows.filter(isHematologyRow);
  const remaining = rows.filter((r) => !isHematologyRow(r));
  const bio = remaining.filter(isBiochemistryRow);
  const nonBio = remaining.filter((r) => !isBiochemistryRow(r));

  /** @type {PrintPageDef[]} */
  const pages = [];

  if (hema.length) {
    pages.push({ intro: INTRO_HEMATOLOGY, sectionTitle: 'HEMATOLOGY REPORT', blocks: [{ subHeading: null, rows: hema }] });
  }

  if (bio.length) {
    const lft = bio.filter((r) => biochemistryPanel(r) === 'LFT');
    const rft = bio.filter((r) => biochemistryPanel(r) === 'RFT');
    const elec = bio.filter((r) => biochemistryPanel(r) === 'ELECTROLYTES');
    const oth = bio.filter((r) => biochemistryPanel(r) === 'OTHER');

    if (lft.length) {
      pages.push({ intro: INTRO_LIVER, sectionTitle: 'BIOCHEMISTRY REPORT', blocks: [{ subHeading: 'LIVER FUNCTION TEST', rows: lft }] });
    }

    const renalBlocks = [];
    if (rft.length) renalBlocks.push({ subHeading: 'RENAL FUNCTION TEST', rows: rft });
    if (elec.length) renalBlocks.push({ subHeading: 'ELECTROLYTES', rows: elec });
    if (oth.length) renalBlocks.push({ subHeading: 'OTHER TESTS', rows: oth });

    if (renalBlocks.length) {
      const onlyOther = renalBlocks.length === 1 && renalBlocks[0].subHeading === 'OTHER TESTS' && !rft.length && !elec.length;
      pages.push({ intro: onlyOther ? INTRO_GENERIC_BIO : INTRO_RENAL, sectionTitle: 'BIOCHEMISTRY REPORT', blocks: renalBlocks });
    }
  }

  const byCat = new Map();
  for (const r of nonBio) {
    const k = r.category || 'GENERAL';
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k).push(r);
  }
  for (const [cat, list] of byCat) {
    if (!list.length) continue;
    pages.push({ intro: genericIntroForCategory(cat), sectionTitle: `${String(cat).toUpperCase()} REPORT`, blocks: [{ subHeading: null, rows: list }] });
  }

  if (pages.length) return pages;

  return [{ intro: INTRO_GENERIC_BIO, sectionTitle: 'LAB REPORT', blocks: [{ subHeading: null, rows }] }];
}

/**
 * Map GET /lab/reports/:requestId JSON → internal "report" row for formal print.
 * @param {Record<string, unknown>} data
 */
export function labReportApiToFormalReport(data) {
  const p = data?.patient || {};
  return {
    id: data.requestId,
    orderNumber: data.orderNumber || '',
    billNumber: data.billNumber || null,
    patientName: p.name,
    uhid: p.uhid,
    age: p.age,
    gender: p.gender,
    doctorName: data.doctorName,
    date: data.createdAt,
    reportGeneratedAt: data.updatedAt || data.createdAt,
    overallRemarks: data.notes || null,
    diagnosis: null,
    sampleType: 'BLOOD',
    results: (data.results || []).map((r) => ({
      name: r.testName,
      value: r.value,
      unit: r.unit,
      range: r.referenceRange,
      category: r.category || null,
      remarks: r.remarks,
      fileUrl: r.fileUrl,
    })),
  };
}

// ─── PRINT STYLES — matches the physical printed slip exactly ────────────────
const PRINT_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Times New Roman", Times, serif;
    background: #fff;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-size: 12px;
  }
  .sheet { width: 780px; margin: 0 auto; background: #fff; }
  .print-page { page-break-after: always; break-after: page; }
  .print-page:last-child { page-break-after: auto; break-after: auto; }

  /* ── HEADER ── */
  .hdr {
    display: flex;
    width: 100%;
    border-bottom: 3px solid #1a3a6b;
    min-height: 72px;
  }
  .hdr-left {
    background: linear-gradient(135deg, #1a3a6b 0%, #0d2347 100%);
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px 8px 10px;
  }
  .hdr-logo-wrap {
    flex-shrink: 0;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: #fff;
    border: 3px solid #f5b800;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hdr-logo-wrap img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .hdr-info { display: flex; flex-direction: column; justify-content: center; }
  .hdr-lab-name {
    font-size: 26px;
    font-weight: 900;
    color: #fff;
    font-family: Georgia, serif;
    text-transform: uppercase;
    letter-spacing: 2px;
    line-height: 1.1;
  }
  .hdr-lab-sub {
    font-size: 9.5px;
    color: #c8daee;
    line-height: 1.5;
    margin-top: 2px;
  }
  /* Right yellow panel */
  .hdr-right {
    background: #f5b800;
    flex: 0 0 220px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 8px 14px;
    position: relative;
  }
  .hdr-reg-no {
    position: absolute;
    top: 6px;
    right: 10px;
    font-size: 9px;
    font-weight: 800;
    color: #3a1e00;
    letter-spacing: 0.5px;
  }
  .hdr-dr-name {
    font-size: 18px;
    font-weight: 900;
    color: #1a1a1a;
    font-family: Georgia, serif;
    line-height: 1.2;
    margin-top: 16px;
  }
  .hdr-dr-deg {
    font-size: 11px;
    font-weight: 700;
    color: #3a1e00;
    margin-top: 2px;
    text-align: center;
  }

  /* ── BODY ── */
  .body { padding: 10px 14px 14px; }

  /* Patient meta table — matches image exactly */
  .meta {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
    margin-top: 10px;
    border: 1px solid #555;
  }
  .meta td {
    border: 1px solid #555;
    padding: 3px 6px;
    vertical-align: middle;
  }
  .meta .lbl {
    font-weight: 700;
    background: #fff;
    white-space: nowrap;
    width: 17%;
    color: #111;
  }
  .meta .val {
    width: 28%;
    color: #111;
  }

  /* ── SECTION BANNER — centered bold box like image ── */
  .category-banner {
    margin: 14px 0 0;
    border: 2px solid #111;
    text-align: center;
    font-weight: 900;
    font-size: 14px;
    text-transform: uppercase;
    padding: 5px 8px;
    background: #fff;
    letter-spacing: 1.5px;
    font-family: "Times New Roman", Times, serif;
  }

  /* Panel sub-heading (LFT / RFT etc.) */
  .panel-sub {
    font-weight: 900;
    font-size: 12px;
    margin: 10px 0 2px;
    text-transform: uppercase;
    color: #0d2347;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #333;
    padding-bottom: 2px;
  }

  /* ── RESULTS TABLE ── */
  .results { margin-top: 6px; }

  .r-header {
    display: flex;
    padding: 5px 2px;
    border-top: 1.5px solid #111;
    border-bottom: 1.5px solid #111;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: #fff;
  }
  .r-row {
    display: flex;
    padding: 4px 2px;
    border-bottom: 1px solid #ddd;
    font-size: 11.5px;
    align-items: center;
  }
  .r-row:last-child { border-bottom: none; }

  /* Column widths matching image proportions */
  .r-h-name, .r-name  { flex: 3; }
  .r-h-val,  .r-val   { flex: 1.1; font-weight: 700; }
  .r-h-unit, .r-unit  { flex: 1.4; }
  .r-h-range,.r-range { flex: 1.5; }

  /* ── INTRO BLURB — small justified text below results ── */
  .intro-blurb {
    font-size: 9px;
    line-height: 1.45;
    text-align: justify;
    margin-top: 10px;
    color: #222;
    hyphens: auto;
  }

  /* ── FOOTER ── */
  .footer-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 32px;
    padding-top: 8px;
  }
  .footer-left {
    font-size: 11px;
    line-height: 1.5;
    color: #111;
  }
  .footer-center {
    font-size: 11px;
    color: #111;
    text-align: center;
  }
  .footer-right {
    text-align: center;
    font-size: 11px;
    color: #111;
    min-width: 180px;
  }
  .sig-line {
    border-top: 1px solid #333;
    width: 160px;
    margin: 36px auto 4px;
  }

  /* ── REMARKS ── */
  .remarks {
    margin-top: 10px;
    font-size: 10px;
    line-height: 1.55;
    color: #333;
    border-top: 1px solid #ccc;
    padding-top: 6px;
  }

  /* ── BOTTOM NOTE BAR ── */
  .note-bar {
    margin-top: 12px;
    background: #f5b800;
    color: #1a1a1a;
    font-size: 9.5px;
    text-align: center;
    padding: 5px 10px;
    font-style: italic;
    font-weight: 600;
    letter-spacing: 0.3px;
  }

  @media print {
    .sheet { width: auto; }
    body { font-size: 11px; }
  }
`;

function buildResultsRowsHtml(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    return '<div class="r-row"><span class="r-name" style="flex:1">No investigations on this page.</span></div>';
  }
  return list
    .map(
      (r) => `
        <div class="r-row">
          <span class="r-name">${escapeHtml(r.name)}</span>
          <span class="r-val">${escapeHtml(String(r.value))}</span>
          <span class="r-unit">${escapeHtml(String(r.unit))}</span>
          <span class="r-range">${escapeHtml(String(r.range))}</span>
        </div>`,
    )
    .join('');
}

function buildBlocksHtml(pageDef) {
  const blocks = pageDef.blocks || [];
  return blocks
    .map((b) => {
      const sub = b.subHeading ? `<div class="panel-sub">${escapeHtml(b.subHeading)}</div>` : '';
      const head = `
        <div class="r-header">
          <span class="r-h-name">INVESTIGATION</span>
          <span class="r-h-val">RESULT</span>
          <span class="r-h-unit">UNIT</span>
          <span class="r-h-range">NORMAL RANGE</span>
        </div>`;
      return `${sub}<div class="results">${head}${buildResultsRowsHtml(b.rows)}</div>`;
    })
    .join('');
}

function patientDisplayName(report) {
  const n = String(report?.patientName || '').trim();
  if (!n) return '—';
  const g = String(report?.gender || '').trim().toUpperCase();
  if (g === 'M' || g === 'MALE') return `MR. ${n}`.toUpperCase();
  if (g === 'F' || g === 'FEMALE') return `MRS. ${n}`.toUpperCase();
  return n.toUpperCase();
}

/**
 * @param {Record<string, unknown>} report
 * @param {PrintPageDef} pageDef
 * @param {number} pageIndex 1-based within this order
 * @param {number} totalPages
 * @param {boolean} addPageBreakAfter
 * @param {boolean} showFooterSignatures
 */
function buildCategorySheetHtml(report, pageDef, pageIndex, totalPages, addPageBreakAfter, showFooterSignatures) {
  const now = new Date();
  const reportDateValue = report.reportGeneratedAt || report.date || now.toISOString();
  const givenDateValue = report.sampleCollectionTime || report.collectedAt || report.date || now.toISOString();
  const reportDate = formatDateOnly(reportDateValue);
  const reportTime = formatTimeOnly(reportDateValue);
  const givenDate = formatDateOnly(givenDateValue);
  const givenTime = formatTimeOnly(givenDateValue);
  const reportNo = String(report.orderNumber || report.billNumber || report.id || '—');
  const regNo = report.regNo || 'AL-2676';

  // Don't print any extra paragraphs below results.
  const introHtml = '';

  // Remarks only on last page
  const remarksBlock =
    showFooterSignatures && (report.overallRemarks || report.diagnosis)
      ? `<div class="remarks">
          ${report.overallRemarks ? `<b>Remarks:</b> ${escapeHtml(report.overallRemarks)}<br />` : ''}
          ${report.diagnosis ? `<b>Diagnosis:</b> ${escapeHtml(report.diagnosis)}` : ''}
        </div>`
      : '';

  // Footer (signature + page number + note bar) on EVERY page
  const footerBlock = `${showFooterSignatures ? remarksBlock : ''}
      <div class="footer-row">
        <div class="footer-left">
          <div>Sanjeev Kumar</div>
          <div>DMLT</div>
        </div>
        <div class="footer-center">Page <b>${pageIndex}</b> of <b>${totalPages}</b></div>
        <div class="footer-right">
          <div class="sig-line"></div>
          <div><b>Consulting Doctor</b></div>
          <div>Dr. Ankit Kumar Singh MBBS</div>
          <div>Reg. No.:841139</div>
        </div>
      </div>
      `;

  return `
    <div class="sheet${addPageBreakAfter ? ' print-page' : ''}">
      <!-- HEADER -->
      <div class="hdr">
        <div class="hdr-left">
          <div class="hdr-logo-wrap">
            <img alt="SD Pathology Logo" src="${REPORT_LOGO_DATA_URI}" />
          </div>
          <div class="hdr-info">
            <div class="hdr-lab-name">S.D. PATHOLOGY</div>
            <div class="hdr-lab-sub">
              Anand Vihar Colony, Hydel Road, BLW, Varanasi.<br />
              Email Id: sdpathology05@gmail.com &nbsp;|&nbsp; Mob.: 7541031287
            </div>
          </div>
        </div>
        <div class="hdr-right">
          <div class="hdr-reg-no">Reg. No. ${escapeHtml(regNo)}</div>
          <div class="hdr-dr-name">Dr. Ankit Kumar Singh</div>
          <div class="hdr-dr-deg">M.B.B.S.</div>
        </div>
      </div>

      <!-- BODY -->
      <div class="body">
        <!-- Patient Meta Table -->
        <table class="meta">
          <tr>
            <td class="lbl">Patient Name</td>
            <td class="val">:${escapeHtml(patientDisplayName(report))}</td>
            <td class="lbl">Reported Date</td>
            <td class="val">: ${escapeHtml(reportDate)}</td>
          </tr>
          <tr>
            <td class="lbl">Age (Y-M-D)</td>
            <td class="val">:${escapeHtml(report.age != null ? String(report.age) : '—')} Yrs.</td>
            <td class="lbl">Reported Time</td>
            <td class="val">: ${escapeHtml(reportTime)}</td>
          </tr>
          <tr>
            <td class="lbl">Sex -</td>
            <td class="val">:${escapeHtml(report.gender || '—')}</td>
            <td class="lbl">Given Date</td>
            <td class="val">: ${escapeHtml(givenDate)}</td>
          </tr>
          <tr>
            <td class="lbl">Ref by Dr</td>
            <td class="val">:${escapeHtml(report.doctorName || 'NEW H T HOSPITAL')}</td>
            <td class="lbl">Given Time</td>
            <td class="val">: ${escapeHtml(givenTime)}</td>
          </tr>
          <tr>
            <td class="lbl">Sample Type</td>
            <td class="val">:${escapeHtml(report.sampleType || 'BLOOD')}</td>
            <td class="lbl">Report No.</td>
            <td class="val">:${escapeHtml(reportNo)}</td>
          </tr>
        </table>

        <!-- Section Banner -->
        <div class="category-banner">${escapeHtml(pageDef.sectionTitle)}</div>

        <!-- Results blocks -->
        ${buildBlocksHtml(pageDef)}

        <!-- Intro blurb below results (as in the printed image) -->
        ${introHtml}

        <!-- Footer -->
        ${footerBlock}
      </div>
    </div>
  `;
}

export function buildFormalLabReportDocumentHtml(reports) {
  const list = Array.isArray(reports) ? reports.filter(Boolean) : [];
  const sorted = list
    .slice()
    .sort((a, b) => new Date(a.reportGeneratedAt || a.date).getTime() - new Date(b.reportGeneratedAt || b.date).getTime());

  const sheets = [];
  let reportIdx = 0;
  for (const report of sorted) {
    const pages = buildPrintPagesForReport(report);
    const n = pages.length;
    pages.forEach((pageDef, pi) => {
      const absLast = reportIdx === sorted.length - 1 && pi === n - 1;
      const showFooter = pi === n - 1;
      sheets.push(buildCategorySheetHtml(report, pageDef, pi + 1, n, !absLast, showFooter));
    });
    reportIdx += 1;
  }

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Lab Report</title>
    <style>${PRINT_STYLES}</style>
  </head>
  <body>${sheets.join('')}</body>
</html>`;
}

/**
 * @param {object[]} reports — formal row objects (use {@link labReportApiToFormalReport} per GET /lab/reports)
 * @param {{ autoPrint?: boolean }} opts
 */
export function openFormalLabReportWindow(reports, opts = {}) {
  const { autoPrint = true } = opts;
  const list = Array.isArray(reports) ? reports.filter(Boolean) : [];
  if (!list.length) return null;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    window.alert('Popup blocked. Please allow popups for printing.');
    return null;
  }

  try {
    const html = buildFormalLabReportDocumentHtml(list);
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    if (autoPrint) {
      w.onload = () => {
        setTimeout(() => {
          w.focus();
          w.print();
        }, 300);
      };
      if (w.document.readyState === 'complete') {
        setTimeout(() => {
          w.focus();
          w.print();
        }, 500);
      }
    }
    return w;
  } catch (error) {
    try {
      w.document.open();
      w.document.write(`<pre style="font-family:Arial;padding:16px">Print failed: ${escapeHtml(error?.message || error)}</pre>`);
      w.document.close();
    } catch (e) {
      window.alert('Print failed. Please try again.');
    }
    return null;
  }
}

/** Save same HTML as a file (open in browser → Print to PDF). */
export function downloadFormalLabReportHtml(reports, filenameBase = 'lab-report') {
  const list = Array.isArray(reports) ? reports.filter(Boolean) : [];
  if (!list.length) return;
  const html = buildFormalLabReportDocumentHtml(list);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${String(filenameBase).replace(/[^a-z0-9-_]+/gi, '-')}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
