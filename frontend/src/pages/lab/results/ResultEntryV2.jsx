import { useEffect, useMemo, useState } from 'react';
import './ResultEntry.css';
import { getLabOrders, LAB_STATUS, saveLabOrders, subscribeLabOrders } from '../labDataStore';

const CBC_TEST_NAME = 'CBC';
const REPORT_STATUS_OPTIONS = ['Pending', 'Completed', 'Verified'];

const CBC_PARAMETERS = [
  { parameter: 'Hemoglobin', result: '', unit: 'g/dL', range: '12-16' },
  { parameter: 'WBC Count', result: '', unit: '/cumm', range: '4000-11000' },
  { parameter: 'RBC Count', result: '', unit: 'million/cumm', range: '4.5-5.5' },
  { parameter: 'Platelet Count', result: '', unit: 'lakh/cumm', range: '1.5-4.5' },
  { parameter: 'Hematocrit (HCT/PCV)', result: '', unit: '%', range: '36-46' },
  { parameter: 'MCV', result: '', unit: 'fL', range: '80-100' },
  { parameter: 'MCH', result: '', unit: 'pg', range: '27-32' },
  { parameter: 'MCHC', result: '', unit: 'g/dL', range: '32-36' },
  { parameter: 'RDW', result: '', unit: '%', range: '11-15' },
  { parameter: 'MPV', result: '', unit: 'fL', range: '7.5-11.5' },
];

const MICROBIOLOGY_TESTS = [
  { name: 'AFB Stain / Z-N Stain', rows: [{ parameter: 'AFB Stain / Z-N Stain', result: '', unit: 'text', range: 'Negative' }] },
  { name: 'AFB Stain with concentration', rows: [{ parameter: 'AFB Stain with concentration', result: '', unit: 'text', range: 'Negative' }] },
  { name: 'AFB Stain for M.leprae', rows: [{ parameter: 'AFB Stain for M.leprae', result: '', unit: 'text', range: 'Negative' }] },
  { name: 'Modified AFB Stain for coccidian parasite in Stool', rows: [{ parameter: 'Modified AFB Stain for coccidian parasite in Stool', result: '', unit: 'text', range: 'Negative' }] },
  { name: 'Gram Stain', rows: [{ parameter: 'Gram Stain', result: '', unit: 'text', range: 'Negative' }] },
  { name: 'KOH for fungal hyphae', rows: [{ parameter: 'KOH for fungal hyphae', result: '', unit: 'text', range: 'Negative' }] },
  { name: 'Albert Stain for Diphtheriae Bacilli', rows: [{ parameter: 'Albert Stain for Diphtheriae Bacilli', result: '', unit: 'text', range: 'Negative' }] },
  { name: 'India Ink C.S.F for Cryptococcus', rows: [{ parameter: 'India Ink C.S.F for Cryptococcus', result: '', unit: 'text', range: 'Negative' }] },
  { name: 'Sputum/ETT C/S for bacteria & fungus', rows: [{ parameter: 'Sputum/ETT C/S for bacteria & fungus', result: '', unit: 'text', range: 'No growth' }] },
  { name: 'Throat swab C/S for bacteria & fungus', rows: [{ parameter: 'Throat swab C/S for bacteria & fungus', result: '', unit: 'text', range: 'No growth' }] },
  { name: 'Pus C/S for bacteria & fungus', rows: [{ parameter: 'Pus C/S for bacteria & fungus', result: '', unit: 'text', range: 'No growth' }] },
  { name: 'Fluid C/S for bacteria & fungus', rows: [{ parameter: 'Fluid C/S for bacteria & fungus', result: '', unit: 'text', range: 'No growth' }] },
  { name: 'C.S.F C/S for bacteria & fungus', rows: [{ parameter: 'C.S.F C/S for bacteria & fungus', result: '', unit: 'text', range: 'No growth' }] },
  { name: 'Semen C/S', rows: [{ parameter: 'Semen C/S', result: '', unit: 'text', range: 'No growth' }] },
  { name: 'TB C/S', rows: [{ parameter: 'TB C/S', result: '', unit: 'text', range: 'No growth' }] },
  { name: 'Blood C/S for bacteria & fungus', rows: [{ parameter: 'Blood C/S for bacteria & fungus', result: '', unit: 'text', range: 'No growth' }] },
  { name: 'Urine C/S', rows: [{ parameter: 'Urine C/S', result: '', unit: 'text', range: 'No growth' }] },
  { name: 'Stool C/S', rows: [{ parameter: 'Stool C/S', result: '', unit: 'text', range: 'No growth' }] },
];

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function microbiologyKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function displayValue(value) {
  return String(value ?? '').trim() || '-';
}

function formatAgeGender(order) {
  const age = order?.age === 0 || order?.age ? `${order.age}Y` : '';
  const gender = String(order?.gender || '').trim();
  return [age, gender].filter(Boolean).join(' / ') || '-';
}

function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isCbcTest(testName) {
  const n = normalizeText(testName);
  return n === 'cbc' || n.includes('complete blood count');
}

function isMicrobiologyTest(testName) {
  const key = microbiologyKey(testName);
  return MICROBIOLOGY_TESTS.some((test) => microbiologyKey(test.name) === key);
}

function getOrderTests(order) {
  if (!order) return [];
  const source = Array.isArray(order.tests) && order.tests.length
    ? order.tests
    : Array.isArray(order.selectedFormFilter)
      ? order.selectedFormFilter
      : [];

  const seen = new Set();
  return source
    .map((test) => {
      if (typeof test === 'string') return { name: test, unit: '', range: '' };
      return {
        name: test?.name || test?.testName || test?.label || '',
        unit: test?.unit || '',
        range: test?.range || test?.referenceRange || '',
      };
    })
    .filter((test) => {
      const key = normalizeText(test.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function hydrateCbcRows(order) {
  const existing = new Map(
    (Array.isArray(order?.results) ? order.results : [])
      .filter((result) => result?.testName === CBC_TEST_NAME || isCbcTest(result?.group || result?.test || result?.name))
      .map((result) => [normalizeText(result.parameter || result.name), result]),
  );

  return CBC_PARAMETERS.map((row) => {
    const saved = existing.get(normalizeText(row.parameter));
    return {
      parameter: saved?.parameter || saved?.name || row.parameter,
      result: saved?.result ?? saved?.value ?? row.result,
      unit: saved?.unit ?? row.unit,
      range: saved?.range ?? row.range,
    };
  });
}

function hydrateOtherRows(order, orderedTests) {
  const results = Array.isArray(order?.results) ? order.results : [];
  return orderedTests
    .filter((test) => !isCbcTest(test.name) && !isMicrobiologyTest(test.name))
    .map((test) => {
      const saved = results.find((result) => normalizeText(result.testName || result.name) === normalizeText(test.name));
      return {
        name: test.name,
        result: saved?.result ?? saved?.value ?? '',
        unit: saved?.unit ?? test.unit ?? '',
        range: saved?.range ?? test.range ?? '',
      };
    });
}

function hydrateMicrobiologyRows(order) {
  const results = Array.isArray(order?.results) ? order.results : [];
  return Object.fromEntries(
    MICROBIOLOGY_TESTS.map((test) => [
      test.name,
      test.rows.map((row) => {
        const saved = results.find(
          (result) => microbiologyKey(result.testName || result.group || result.test) === microbiologyKey(test.name)
            && microbiologyKey(result.parameter || result.name) === microbiologyKey(row.parameter),
        );
        return {
          parameter: saved?.parameter || saved?.name || row.parameter,
          result: saved?.result ?? saved?.value ?? row.result,
          unit: saved?.unit ?? row.unit,
          range: saved?.range ?? row.range,
        };
      }),
    ]),
  );
}

export default function ResultEntryV2() {
  const [orders, setOrders] = useState(() => getLabOrders());
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [cbcRows, setCbcRows] = useState(CBC_PARAMETERS);
  const [otherRows, setOtherRows] = useState([]);
  const [microbiologyFilter, setMicrobiologyFilter] = useState('');
  const [microbiologyRowsByTest, setMicrobiologyRowsByTest] = useState(() => hydrateMicrobiologyRows());
  const [remarks, setRemarks] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [verifiedBy, setVerifiedBy] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [reportStatus, setReportStatus] = useState('Pending');
  const [message, setMessage] = useState('');

  useEffect(() => subscribeLabOrders(setOrders), []);

  const collectedOrders = useMemo(
    () => orders.filter((order) => order.status === LAB_STATUS.COLLECTED),
    [orders],
  );

  const patientMatches = useMemo(() => {
    const q = normalizeText(search);
    return collectedOrders
      .filter((order) => {
        if (!q) return true;
        return (
          normalizeText(order.patientName).includes(q)
          || normalizeText(order.uhid).includes(q)
          || normalizeText(order.patientId).includes(q)
          || normalizeText(order.ipd).includes(q)
          || normalizeText(order.ipdNo).includes(q)
          || normalizeText(order.orderNumber).includes(q)
          || normalizeText(order.id).includes(q)
          || normalizeText(order.phone).includes(q)
        );
      })
      .slice(0, 12);
  }, [collectedOrders, search]);

  const orderedTests = useMemo(() => getOrderTests(selected), [selected]);
  const hasCbc = useMemo(() => orderedTests.some((test) => isCbcTest(test.name)), [orderedTests]);
  const hasMicrobiology = useMemo(() => orderedTests.some((test) => isMicrobiologyTest(test.name)), [orderedTests]);
  const visibleOrderedTests = useMemo(() => orderedTests.filter((test) => !isMicrobiologyTest(test.name)), [orderedTests]);
  const selectedMicrobiologyRows = microbiologyFilter ? (microbiologyRowsByTest[microbiologyFilter] || []) : [];

  const selectPatient = (order) => {
    const tests = getOrderTests(order);
    setSelected(order);
    setSearch(`${order.patientName || ''} ${order.uhid || order.ipd || order.ipdNo || order.patientId || ''}`.trim());
    setSearchOpen(false);
    setCbcRows(hydrateCbcRows(order));
    setOtherRows(hydrateOtherRows(order, tests));
    setMicrobiologyFilter('');
    setMicrobiologyRowsByTest(hydrateMicrobiologyRows(order));
    setRemarks(order.overallRemarks || '');
    setDiagnosis(order.diagnosis || '');
    setVerifiedBy(order.verifiedBy || '');
    setApprovedBy(order.approvedBy || '');
    setReportStatus(order.reportStatus || 'Pending');
    setMessage('');
  };

  const updateCbcRow = (index, key, value) => {
    setCbcRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  };

  const updateOtherRow = (index, key, value) => {
    setOtherRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  };

  const updateMicrobiologyRow = (index, key, value) => {
    if (!microbiologyFilter) return;
    setMicrobiologyRowsByTest((prev) => ({
      ...prev,
      [microbiologyFilter]: (prev[microbiologyFilter] || []).map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
    }));
  };

  const buildResults = () => {
    const cbcResults = hasCbc
      ? cbcRows.map((row) => ({
        testName: CBC_TEST_NAME,
        department: 'Hematology',
        parameter: row.parameter,
        name: row.parameter,
        value: row.result,
        result: row.result,
        unit: row.unit,
        range: row.range,
      }))
      : [];

    const otherResults = otherRows.map((row) => ({
      testName: row.name,
      name: row.name,
      value: row.result,
      result: row.result,
      unit: row.unit,
      range: row.range,
    }));

    const microbiologyResults = microbiologyFilter
      ? selectedMicrobiologyRows.map((row) => ({
        testName: microbiologyFilter,
        department: 'Microbiology',
        parameter: row.parameter,
        name: row.parameter,
        value: row.result,
        result: row.result,
        unit: row.unit,
        range: row.range,
      }))
      : [];

    return [...cbcResults, ...otherResults, ...microbiologyResults];
  };

  const persist = (mode) => {
    if (!selected) return;

    const finalReportStatus = mode === 'submit' ? 'Completed' : reportStatus;
    const updated = {
      ...selected,
      overallRemarks: remarks,
      diagnosis,
      verifiedBy,
      approvedBy,
      reportStatus: finalReportStatus,
      status: finalReportStatus === 'Completed' || finalReportStatus === 'Verified' ? LAB_STATUS.COMPLETED : LAB_STATUS.COLLECTED,
      results: buildResults(),
      reportGeneratedAt: mode === 'submit' ? new Date().toISOString() : selected.reportGeneratedAt || null,
    };

    const next = orders.map((order) => (order.id === selected.id ? updated : order));
    saveLabOrders(next);
    setOrders(next);
    setSelected(updated);
    setReportStatus(finalReportStatus);
    setMessage(mode === 'submit' ? 'Report submitted successfully.' : 'Draft saved successfully.');
  };

  return (
    <div className="result-entry-container">
      <div className="result-entry-page">
        <div className="result-entry-panel result-entry-searchPanel">
          <div className="result-entry-search">
            <label className="result-entry-label" htmlFor="resultEntrySearch">Search collected patient</label>
            <div className="result-entry-searchWrap">
              <input
                id="resultEntrySearch"
                className="result-entry-input"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
                placeholder="Patient name / UHID / IPD / phone"
                autoComplete="off"
              />
              {searchOpen ? (
                <div className={`result-entry-suggestions ${patientMatches.length ? '' : 'result-entry-suggestions--empty'}`}>
                  {patientMatches.length ? patientMatches.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      className="result-entry-suggestionItem"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectPatient(order)}
                    >
                      <span className="result-entry-suggestionTop">
                        <span className="result-entry-suggestionName">{displayValue(order.patientName)}</span>
                        <span className="result-entry-suggestionStatus">{displayValue(order.status)}</span>
                      </span>
                      <span className="result-entry-suggestionMeta">
                        <span>{displayValue(order.uhid || order.ipd || order.ipdNo || order.patientId)}</span>
                        <span className="result-entry-suggestionDot">.</span>
                        <span>{formatAgeGender(order)}</span>
                      </span>
                    </button>
                  )) : (
                    <span className="result-entry-suggestionEmpty">No collected samples found.</span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {selected ? (
          <>
            <div className="result-entry-panel">
              <div className="result-entry-panelHeader">
                <p className="result-entry-panelTitle">Patient Basic Details</p>
                <button
                  type="button"
                  className="result-entry-btn result-entry-btn--ghost"
                  onClick={() => {
                    setSelected(null);
                    setMessage('');
                  }}
                >
                  Change Patient
                </button>
              </div>
              <div className="result-entry-infoGrid result-entry-infoGrid--wide">
                <div className="result-entry-infoItem">
                  <p className="result-entry-k">Patient Name</p>
                  <p className="result-entry-v">{displayValue(selected.patientName)}</p>
                </div>
                <div className="result-entry-infoItem">
                  <p className="result-entry-k">UHID/IPD</p>
                  <p className="result-entry-v result-entry-mono">{displayValue(selected.uhid || selected.ipd || selected.ipdNo || selected.patientId)}</p>
                </div>
                <div className="result-entry-infoItem">
                  <p className="result-entry-k">Age/Gender</p>
                  <p className="result-entry-v">{formatAgeGender(selected)}</p>
                </div>
                <div className="result-entry-infoItem">
                  <p className="result-entry-k">Doctor Name</p>
                  <p className="result-entry-v">{displayValue(selected.doctorName)}</p>
                </div>
                <div className="result-entry-infoItem">
                  <p className="result-entry-k">Sample Status</p>
                  <p className="result-entry-v"><span className="result-entry-badge result-entry-badge--pending">{displayValue(selected.status)}</span></p>
                </div>
                <div className="result-entry-infoItem">
                  <p className="result-entry-k">Collected At</p>
                  <p className="result-entry-v">{formatDateTime(selected.collectedAt || selected.date)}</p>
                </div>
              </div>
            </div>

            {visibleOrderedTests.length ? (
              <div className="result-entry-panel">
                <div className="result-entry-panelHeader">
                  <p className="result-entry-panelTitle">Patient Tests</p>
                  <p className="result-entry-tableHint">From receptionist selection</p>
                </div>
                <div className="result-entry-tests result-entry-tests--modal">
                  {visibleOrderedTests.map((test) => (
                    <span key={test.name} className="result-entry-testChip">{test.name}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {hasMicrobiology ? (
              <div className="result-entry-form">
                <div className="result-entry-formHeader">
                  <div>
                    <p className="result-entry-formTitle">Microbiology</p>
                    <p className="result-entry-formHint">Department: Microbiology</p>
                  </div>
                  <div className="result-form-field">
                    <label className="result-form-label" htmlFor="microbiologyFilter">TEST FILTER</label>
                    <select
                      id="microbiologyFilter"
                      className="result-form-input"
                      value={microbiologyFilter}
                      onChange={(e) => setMicrobiologyFilter(e.target.value)}
                    >
                      <option value="">Select microbiology test</option>
                      {MICROBIOLOGY_TESTS.map((test) => (
                        <option key={test.name} value={test.name}>{test.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {microbiologyFilter ? (
                  <div className="result-entry-formTableWrap">
                    <table className="result-entry-formTable">
                      <thead>
                        <tr>
                          <th className="result-entry-formTh">Parameter</th>
                          <th className="result-entry-formTh">Result</th>
                          <th className="result-entry-formTh">Unit</th>
                          <th className="result-entry-formTh">Range</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedMicrobiologyRows.map((row, index) => (
                          <tr key={`${microbiologyFilter}-${row.parameter}-${index}`}>
                            <td className="result-entry-formTd">
                              <input className="result-form-input" value={row.parameter} readOnly />
                            </td>
                            <td className="result-entry-formTd">
                              <input className="result-form-input" value={row.result} onChange={(e) => updateMicrobiologyRow(index, 'result', e.target.value)} placeholder="Enter result" />
                            </td>
                            <td className="result-entry-formTd">
                              <input className="result-form-input" value={row.unit} onChange={(e) => updateMicrobiologyRow(index, 'unit', e.target.value)} />
                            </td>
                            <td className="result-entry-formTd">
                              <input className="result-form-input" value={row.range} onChange={(e) => updateMicrobiologyRow(index, 'range', e.target.value)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}

            {hasCbc ? (
              <div className="result-entry-form">
                <div className="result-entry-formHeader">
                  <div>
                    <p className="result-entry-formTitle">CBC Result Entry</p>
                    <p className="result-entry-formHint">Department: Hematology</p>
                  </div>
                </div>
                <div className="result-entry-formTableWrap">
                  <table className="result-entry-formTable result-entry-cbcTable">
                    <thead>
                      <tr>
                        <th className="result-entry-formTh">Parameter</th>
                        <th className="result-entry-formTh">Result</th>
                        <th className="result-entry-formTh">Unit</th>
                        <th className="result-entry-formTh">Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cbcRows.map((row, index) => (
                        <tr key={`${row.parameter}-${index}`}>
                          <td className="result-entry-formTd">
                            <input className="result-form-input" value={row.parameter} onChange={(e) => updateCbcRow(index, 'parameter', e.target.value)} />
                          </td>
                          <td className="result-entry-formTd">
                            <input className="result-form-input" value={row.result} onChange={(e) => updateCbcRow(index, 'result', e.target.value)} placeholder="Enter result" />
                          </td>
                          <td className="result-entry-formTd">
                            <input className="result-form-input" value={row.unit} onChange={(e) => updateCbcRow(index, 'unit', e.target.value)} />
                          </td>
                          <td className="result-entry-formTd">
                            <input className="result-form-input" value={row.range} onChange={(e) => updateCbcRow(index, 'range', e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {otherRows.length ? (
              <div className="result-entry-form">
                <div className="result-entry-formHeader">
                  <p className="result-entry-formTitle">Other Test Results</p>
                  <p className="result-entry-formHint">Ordered tests only</p>
                </div>
                <div className="result-entry-formTableWrap">
                  <table className="result-entry-formTable">
                    <thead>
                      <tr>
                        <th className="result-entry-formTh">Test</th>
                        <th className="result-entry-formTh">Result</th>
                        <th className="result-entry-formTh">Unit</th>
                        <th className="result-entry-formTh">Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherRows.map((row, index) => (
                        <tr key={`${row.name}-${index}`}>
                          <td className="result-entry-formTd">
                            <input className="result-form-input" value={row.name} onChange={(e) => updateOtherRow(index, 'name', e.target.value)} />
                          </td>
                          <td className="result-entry-formTd">
                            <input className="result-form-input" value={row.result} onChange={(e) => updateOtherRow(index, 'result', e.target.value)} placeholder="Enter result" />
                          </td>
                          <td className="result-entry-formTd">
                            <input className="result-form-input" value={row.unit} onChange={(e) => updateOtherRow(index, 'unit', e.target.value)} />
                          </td>
                          <td className="result-entry-formTd">
                            <input className="result-form-input" value={row.range} onChange={(e) => updateOtherRow(index, 'range', e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="result-form-section">
              <div className="result-form-sectionHeader">
                <span>Report & Verification</span>
              </div>
              <div className="result-form-grid">
                <div className="result-form-field">
                  <label className="result-form-label" htmlFor="remarks">Remarks</label>
                  <textarea id="remarks" className="result-form-input result-form-textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
                </div>
                <div className="result-form-field">
                  <label className="result-form-label" htmlFor="diagnosis">Diagnosis / Interpretation</label>
                  <textarea id="diagnosis" className="result-form-input result-form-textarea" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={3} />
                </div>
                <div className="result-form-field">
                  <label className="result-form-label" htmlFor="verifiedBy">Verified By</label>
                  <input id="verifiedBy" className="result-form-input" value={verifiedBy} onChange={(e) => setVerifiedBy(e.target.value)} />
                </div>
                <div className="result-form-field">
                  <label className="result-form-label" htmlFor="approvedBy">Approved By</label>
                  <input id="approvedBy" className="result-form-input" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} />
                </div>
                <div className="result-form-field">
                  <label className="result-form-label" htmlFor="reportStatus">Report Status</label>
                  <select id="reportStatus" className="result-form-input" value={reportStatus} onChange={(e) => setReportStatus(e.target.value)}>
                    {REPORT_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {message ? <p className="result-entry-saveMsg">{message}</p> : null}

            <div className="result-form-actions">
              <button type="button" className="result-entry-btn result-entry-btn--ghost" onClick={() => selectPatient(selected)}>Reset</button>
              <button type="button" className="result-entry-btn result-entry-btn--ghost" onClick={() => persist('draft')}>Save Draft</button>
              <button type="button" className="result-entry-btn result-entry-btn--primary" onClick={() => persist('submit')}>Submit</button>
            </div>
          </>
        ) : (
          <div className="result-entry-tableWrap">
            <div className="result-entry-tableHeader">
              <p className="result-entry-tableTitle">Collected Samples</p>
              <p className="result-entry-tableHint">Showing <span className="result-entry-strong">{collectedOrders.length}</span></p>
            </div>
            <div className="result-entry-tableScroll">
              <table className="result-entry-table result-entry-patientTable">
                <thead className="result-entry-thead">
                  <tr>
                    <th className="result-entry-th">Patient Name</th>
                    <th className="result-entry-th">UHID/IPD</th>
                    <th className="result-entry-th">Age/Gender</th>
                    <th className="result-entry-th">Doctor</th>
                    <th className="result-entry-th">Sample Status</th>
                  </tr>
                </thead>
                <tbody>
                  {collectedOrders.length ? collectedOrders.map((order) => (
                    <tr key={order.id} className="result-entry-row" onClick={() => selectPatient(order)}>
                      <td className="result-entry-td">
                        <div className="result-entry-patientCell">
                          <div className="result-entry-avatar" aria-hidden="true">{String(order.patientName || '?').slice(0, 1).toUpperCase()}</div>
                          <div className="result-entry-patientText">
                            <div className="result-entry-patientName">{displayValue(order.patientName)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="result-entry-td result-entry-mono">{displayValue(order.uhid || order.ipd || order.ipdNo || order.patientId)}</td>
                      <td className="result-entry-td">{formatAgeGender(order)}</td>
                      <td className="result-entry-td">{displayValue(order.doctorName)}</td>
                      <td className="result-entry-td"><span className="result-entry-badge result-entry-badge--pending">{displayValue(order.status)}</span></td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="result-entry-td" colSpan={5}>
                        <div className="result-entry-empty">
                          <p className="result-entry-emptyTitle">No collected samples</p>
                          <p className="result-entry-emptySub">Collect a sample before entering results.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
