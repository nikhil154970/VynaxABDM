/**
 * Formal lab report HTML — Naitik Hospital header with patient meta and results table.
 * One printed page per billed test/panel within each department (only submitted result rows).
 */

import api from './api';

export const REPORT_LOGO_DATA_URI = '/hopital_logo.png';

/** Stable print order for known lab departments (matches result entry workflow). */
const DEPARTMENT_PRINT_ORDER = [
  'Hematology',
  'Biochemistry',
  'Microbiology',
  'Serology',
  'Clinical Pathology',
  'Hormone Profile',
  'Tumor Marker',
  'Orthopedics / Arthritis / Collagen Profile Panel',
  'Infectious Disease Markers',
  'Hepatology & Gastroenterology',
  'AUTOIMMUNE & COLLAGEN MARKERS',
  'Immunology',
  'Hormones',
  'Coagulation',
  'Tumor Markers',
  'Other',
];

function compactKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function namesMatch(a, b) {
  const x = compactKey(a);
  const y = compactKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))) return true;
  return false;
}

/** Only print rows the technician actually entered (skip blank / placeholder). */
function hasFilledResultValue(v) {
  const s = String(v ?? '').trim();
  if (!s) return false;
  if (s === '—' || s === '-' || s === '–' || s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a') return false;
  return true;
}

/** Guess department from panel/test name when DB category is missing (reception reprint). */
function inferDepartmentFromPanelName(name) {
  const n = compactKey(name);
  if (!n) return null;
  const rules = [
    ['Serology', ['aso', 'widal', 'hbsag', 'hcv', 'hiv', 'vdrl', 'typhoid', 'malaria', 'dengue', 'rheumatoid', 'crp', 'serology']],
    ['Hematology', ['cbc', 'hemoglobin', 'haemoglobin', 'esr', 'platelet', 'coagulation', 'btct', 'peripheral smear', 'hematology']],
    ['Biochemistry', ['lft', 'kft', 'rft', 'lipid', 'glucose', 'sugar', 'creatinine', 'urea', 'bilirubin', 'sgot', 'sgpt', 'hba1c', 'biochemistry']],
    ['Microbiology', ['culture', 'stain', 'afb', 'gram', 'sputum', 'swab', 'fungal', 'koh', 'microbiology']],
    ['Clinical Pathology', ['urine', 'stool', 'semen analysis', 'clinical pathology']],
    ['Hormone Profile', ['hormone', 'tsh', 't3', 't4', 'prolactin', 'cortisol']],
    ['Tumor Marker', ['tumor', 'psa', 'cea', 'afp', 'ca125', 'ca19']],
  ];
  for (const [dept, keys] of rules) {
    if (keys.some((k) => n.includes(compactKey(k)))) return dept;
  }
  return null;
}

function findOrderTestNameForResult(row, orderTests) {
  const name = String(row?.name || row?.testName || '').trim();
  const remarks = String(row?.remarks || row?.group || '').trim();
  const list = Array.isArray(orderTests) ? orderTests : [];
  if (name) {
    const byName = list.find((t) => namesMatch(t.name || t.testName, name));
    if (byName) return String(byName.name || byName.testName || '').trim();
  }
  if (remarks) {
    const byPanel = list.find((t) => namesMatch(t.name || t.testName, remarks));
    if (byPanel) return String(byPanel.name || byPanel.testName || '').trim();
  }
  return name || '';
}

function resolveDepartment(row, orderTests) {
  const fromRow = String(row?.category || '').trim();
  if (fromRow && compactKey(fromRow) !== 'general') return fromRow;

  const remarks = String(row?.remarks || row?.group || '').trim();
  const list = Array.isArray(orderTests) ? orderTests : [];

  if (remarks) {
    const byPanel = list.find((t) => namesMatch(t.name || t.testName, remarks));
    const panelCat = String(byPanel?.category || '').trim();
    if (panelCat && compactKey(panelCat) !== 'general') return panelCat;
  }

  const panel = findOrderTestNameForResult(row, orderTests);
  const hit = list.find((t) => namesMatch(t.name || t.testName, panel));
  const fromOrder = String(hit?.category || '').trim();
  if (fromOrder && compactKey(fromOrder) !== 'general') return fromOrder;

  if (fromRow) return fromRow;

  const panelName = remarks || panel;
  const inferred = inferDepartmentFromPanelName(panelName);
  if (inferred) return inferred;

  return 'Other';
}

function normalizeDeptCompare(value) {
  return compactKey(value);
}

function departmentSortIndex(name) {
  const key = normalizeDeptCompare(name);
  const idx = DEPARTMENT_PRINT_ORDER.findIndex((d) => normalizeDeptCompare(d) === key);
  return idx >= 0 ? idx : 900 + key.charCodeAt(0);
}

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
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function normalizeRow(r, orderTests) {
  if (r?.isSubHeading) return null;
  const name = String(r?.name || r?.testName || '').trim();
  if (!name) return null;
  if (!hasFilledResultValue(r?.value)) return null;

  const department = resolveDepartment(r, orderTests);

  // Group by the panel/test the technician saved (remarks), not fuzzy-matched order line items.
  const panelFromEntry = String(r?.remarks || r?.group || '').trim();
  const testName = panelFromEntry || findOrderTestNameForResult(r, orderTests) || name;

  return {
    name,
    value: String(r?.value ?? '').trim(),
    unit: r?.unit ?? '—',
    range: r?.range ?? r?.referenceRange ?? '—',
    category: department,
    testName,
  };
}

/**
 * @typedef {{ intro: string, sectionTitle: string, blocks: { subHeading: string | null, rows: ReturnType<typeof normalizeRow>[] }[] }} PrintPageDef
 */

/**
 * One print page per test/panel within each department (only rows the user submitted).
 * @param {Record<string, unknown>} report
 * @returns {PrintPageDef[]}
 */
export function buildPrintPagesForReport(report) {
  const orderTests = Array.isArray(report?.orderTests) ? report.orderTests : [];
  const raw = Array.isArray(report?.results) ? report.results : [];
  const rows = raw.map((r) => normalizeRow(r, orderTests)).filter(Boolean);
  if (!rows.length) return [];

  /** @type {Map<string, { dept: string, testName: string, rows: object[], order: number }>} */
  const groups = new Map();
  let seq = 0;

  rows.forEach((row) => {
    const dept = row.category;
    const testName = row.testName;
    const key = `${normalizeDeptCompare(dept)}\x00${compactKey(testName)}`;
    if (!groups.has(key)) {
      groups.set(key, { dept, testName, rows: [], order: seq++ });
    }
    groups.get(key).rows.push(row);
  });

  const sorted = [...groups.values()].sort((a, b) => {
    const deptOrder = departmentSortIndex(a.dept) - departmentSortIndex(b.dept);
    if (deptOrder !== 0) return deptOrder;
    return a.order - b.order;
  });

  return sorted.map((g) => ({
    intro: '',
    sectionTitle: `${g.dept.toUpperCase()} REPORT`,
    blocks: [{ subHeading: g.testName, rows: g.rows }],
  }));
}

/**
 * Build a printable report row from results just submitted (keeps department/category from entry form).
 */
export function buildFormalReportFromSubmit({ detail, patient, results, overallRemarks, diagnosis }) {
  const orderTests = (detail?.items || []).map((it) => ({
    name: it.testName,
    testName: it.testName,
    category: it.category || null,
  }));
  return {
    id: detail?.id,
    orderNumber: detail?.orderNumber || '',
    billNumber: detail?.bill?.billNumber || null,
    patientName: patient?.name,
    uhid: patient?.uhid,
    age: patient?.age,
    gender: patient?.gender,
    doctorName: detail?.doctor?.user?.name || detail?.doctorName || '',
    date: detail?.createdAt || new Date().toISOString(),
    reportGeneratedAt: new Date().toISOString(),
    overallRemarks: overallRemarks || null,
    diagnosis: diagnosis || null,
    sampleType: 'BLOOD',
    orderTests,
    results: (Array.isArray(results) ? results : [])
      .filter((r) => hasFilledResultValue(r?.value))
      .filter((r, i, arr) => arr.findIndex((x) => x.testName === r.testName && x.value === r.value) === i)
      .map((r) => ({
        name: r.testName,
        testName: r.testName,
        value: r.value,
        unit: r.unit,
        range: r.referenceRange,
        category: r.category || null,
        remarks: r.remarks,
      })),
  };
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
    diagnosis: data.diagnosis || null,
    sampleType: 'BLOOD',
    orderTests: (data.tests || []).map((t) => ({
      name: t.name,
      testName: t.name,
      category: t.category || null,
    })),
    results: (data.results || [])
      .filter((r) => hasFilledResultValue(r?.value))
      .filter((r, i, arr) => arr.findIndex((x) => x.testName === r.testName && x.value === r.value) === i)
      .map((r) => {
        const panel = String(r?.remarks || '').trim();
        const orderTests = Array.isArray(data.tests) ? data.tests : [];
        let category = r.category || null;
        if (!category && panel) {
          const hit = orderTests.find((t) => namesMatch(t.name, panel));
          category = hit?.category || null;
        }
        if (!category) category = inferDepartmentFromPanelName(panel || r.testName);
        return {
          name: r.testName,
          testName: r.testName,
          value: r.value,
          unit: r.unit,
          range: r.referenceRange,
          category,
          remarks: r.remarks,
          fileUrl: r.fileUrl,
        };
      }),
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
    font-size: 18px;
    font-weight: 900;
    color: #fff;
    font-family: Georgia, serif;
    text-transform: uppercase;
    letter-spacing: 1px;
    line-height: 1.2;
  }
  .hdr-lab-sub {
    font-size: 8px;
    color: #c8daee;
    line-height: 1.4;
    margin-top: 2px;
  }
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
    font-size: 16px;
    font-weight: 900;
    color: #1a1a1a;
    font-family: Georgia, serif;
    line-height: 1.2;
    margin-top: 16px;
  }
  .hdr-dr-deg {
    font-size: 10px;
    font-weight: 700;
    color: #3a1e00;
    margin-top: 2px;
    text-align: center;
  }

  .body { padding: 10px 14px 14px; }

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

  .r-h-name, .r-name  { flex: 3; }
  .r-h-val,  .r-val   { flex: 1.1; font-weight: 700; }
  .r-h-unit, .r-unit  { flex: 1.4; }
  .r-h-range,.r-range { flex: 1.5; }

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

  .remarks {
    margin-top: 10px;
    font-size: 10px;
    line-height: 1.55;
    color: #333;
    border-top: 1px solid #ccc;
    padding-top: 6px;
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

  const remarksBlock =
    showFooterSignatures && (report.overallRemarks || report.diagnosis)
      ? `<div class="remarks">
          ${report.overallRemarks ? `<b>Remarks:</b> ${escapeHtml(report.overallRemarks)}<br />` : ''}
          ${report.diagnosis ? `<b>Diagnosis:</b> ${escapeHtml(report.diagnosis)}` : ''}
        </div>`
      : '';

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
      <div class="hdr">
        <div class="hdr-left">
          <div class="hdr-logo-wrap">
            <img alt="Naitik Hospital Logo" src="${REPORT_LOGO_DATA_URI}" />
          </div>
          <div class="hdr-info">
            <div class="hdr-lab-name">Naitik Hospital and Surgical Center</div>
            <div class="hdr-lab-sub">
              Anand Vihar Colony, Hydel Road, BLW, Varanasi.<br />
              Mob.: 7541031287
            </div>
          </div>
        </div>
        <div class="hdr-right">
          <div class="hdr-reg-no">Reg. No. ${escapeHtml(regNo)}</div>
          <div class="hdr-dr-name">Dr. Ankit Kumar Singh</div>
          <div class="hdr-dr-deg">M.B.B.S.</div>
        </div>
      </div>

      <div class="body">
        <table class="meta">
          <tr>
            <td class="lbl">Patient Name</td>
            <td class="val">:${escapeHtml(patientDisplayName(report))}</td>
            <td class="lbl">Reported Date</td>
            <td class="val">: ${escapeHtml(reportDate)}</td>
          </tr>
          <tr>
            <td class="lbl">UHID</td>
            <td class="val">:${escapeHtml(report.uhid || '—')}</td>
            <td class="lbl">Reported Time</td>
            <td class="val">: ${escapeHtml(reportTime)}</td>
          </tr>
          <tr>
            <td class="lbl">Age (Y-M-D)</td>
            <td class="val">:${escapeHtml(report.age != null ? String(report.age) : '—')} Yrs.</td>
            <td class="lbl">Given Date</td>
            <td class="val">: ${escapeHtml(givenDate)}</td>
          </tr>
          <tr>
            <td class="lbl">Sex -</td>
            <td class="val">:${escapeHtml(report.gender || '—')}</td>
            <td class="lbl">Given Time</td>
            <td class="val">: ${escapeHtml(givenTime)}</td>
          </tr>
          <tr>
            <td class="lbl">Ref by Dr</td>
            <td class="val">:${escapeHtml(report.doctorName || 'NAITIK HOSPITAL')}</td>
            <td class="lbl">Report No.</td>
            <td class="val">:${escapeHtml(reportNo)}</td>
          </tr>
          <tr>
            <td class="lbl">Sample Type</td>
            <td class="val">:${escapeHtml(report.sampleType || 'BLOOD')}</td>
            <td class="lbl">&nbsp;</td>
            <td class="val">&nbsp;</td>
          </tr>
        </table>

        <div class="category-banner">${escapeHtml(pageDef.sectionTitle)}</div>

        ${buildBlocksHtml(pageDef)}

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

/** Fetch completed lab order report and map to formal S.D. Pathology print row (reception / doctor / nurse). */
export async function fetchFormalLabReportForPrint(requestId) {
  const id = String(requestId || '').trim();
  if (!id) throw new Error('Report id is required');
  const res = await api.get(`/lab/reports/${encodeURIComponent(id)}`);
  const data = res?.data;
  if (!data) throw new Error('Empty report');
  const formal = labReportApiToFormalReport(data);
  if (!buildPrintPagesForReport(formal).length) {
    throw new Error('No printable results found for this report.');
  }
  return formal;
}

/** Open print window immediately on user click (avoids popup blocker after async API). */
export function openLabReportPrintPlaceholder() {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return null;
  try {
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Loading report…</title></head>
      <body style="font-family:Arial,sans-serif;padding:32px;text-align:center;color:#334155">
        <p style="font-size:16px;font-weight:700">Loading lab report…</p>
        <p style="font-size:13px;margin-top:8px;color:#64748b">Please wait</p>
      </body></html>`);
    w.document.close();
  } catch {
    return null;
  }
  return w;
}

/**
 * Write formal report HTML into an already-open window and optionally print.
 * @param {Window|null} w
 * @param {object[]} reports
 * @param {{ autoPrint?: boolean }} opts
 */
export function writeFormalLabReportToWindow(w, reports, opts = {}) {
  const { autoPrint = true } = opts;
  const list = Array.isArray(reports) ? reports.filter(Boolean) : [];
  if (!w || w.closed) {
    window.alert('Print window was closed. Please try again.');
    return null;
  }
  if (!list.length) {
    window.alert('No report data to print.');
    try { w.close(); } catch { /* ignore */ }
    return null;
  }

  const hasPages = list.some((r) => buildPrintPagesForReport(r).length > 0);
  if (!hasPages) {
    window.alert('No printable results found for this report.');
    try { w.close(); } catch { /* ignore */ }
    return null;
  }

  try {
    const html = buildFormalLabReportDocumentHtml(list);
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    if (autoPrint) {
      const triggerPrint = () => {
        setTimeout(() => {
          try {
            w.focus();
            w.print();
          } catch {
            /* ignore */
          }
        }, 300);
      };
      w.onload = triggerPrint;
      if (w.document.readyState === 'complete') triggerPrint();
    }
    return w;
  } catch (error) {
    try {
      w.document.open();
      w.document.write(`<pre style="font-family:Arial;padding:16px">Print failed: ${escapeHtml(error?.message || error)}</pre>`);
      w.document.close();
    } catch {
      window.alert('Print failed. Please try again.');
    }
    return null;
  }
}

/** Fetch report then print — opens window first so popup blockers do not block. */
export async function printFormalLabReportByRequestId(requestId) {
  const w = openLabReportPrintPlaceholder();
  if (!w) {
    window.alert('Popup blocked. Please allow popups for this site (top address bar → allow popups), then try Print again.');
    return null;
  }
  try {
    const formal = await fetchFormalLabReportForPrint(requestId);
    return writeFormalLabReportToWindow(w, [formal], { autoPrint: true });
  } catch (e) {
    try {
      w.document.open();
      w.document.write(
        `<pre style="font-family:Arial;padding:16px;color:#991b1b">${escapeHtml(
          e?.response?.data?.message || e?.message || 'Could not load report for printing.',
        )}</pre>`,
      );
      w.document.close();
    } catch {
      /* ignore */
    }
    window.alert(e?.response?.data?.message || e?.message || 'Could not load report for printing.');
    return null;
  }
}

/**
 * @param {object[]} reports — formal row objects (use {@link labReportApiToFormalReport} per GET /lab/reports)
 * @param {{ autoPrint?: boolean, printWindow?: Window|null }} opts
 */
export function openFormalLabReportWindow(reports, opts = {}) {
  const { autoPrint = true, printWindow = null } = opts;
  const list = Array.isArray(reports) ? reports.filter(Boolean) : [];
  if (!list.length) return null;

  const hasPages = list.some((r) => buildPrintPagesForReport(r).length > 0);
  if (!hasPages) {
    window.alert('No printable results found for this report.');
    return null;
  }

  const w = printWindow || window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    window.alert('Popup blocked. Please allow popups for printing.');
    return null;
  }

  return writeFormalLabReportToWindow(w, list, { autoPrint });
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
