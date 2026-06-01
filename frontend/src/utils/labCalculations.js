function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function toNumber(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function round2(n) {
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function format2(n) {
  const r = round2(n);
  if (r == null) return '';
  return r.toFixed(2);
}

function setDerived(rows, paramKey, valueStr) {
  const k = normalizeKey(paramKey);
  const idx = rows.findIndex((r) => normalizeKey(r?.parameter) === k);
  if (idx < 0) return rows;

  const current = rows[idx] || {};
  const currentStr = String(current.result ?? '').trim();

  // Only auto-fill if empty OR previously auto-derived.
  const canOverwrite = !currentStr || current.autoDerived === true;
  if (!canOverwrite) return rows;

  const nextRow = { ...current, result: valueStr, autoDerived: Boolean(valueStr) };
  const next = rows.slice();
  next[idx] = nextRow;
  return next;
}

function setDerivedAliases(rows, paramKeys, valueStr) {
  let next = rows;
  const keys = Array.isArray(paramKeys) ? paramKeys : [paramKeys];
  for (const key of keys) {
    next = setDerived(next, key, valueStr);
  }
  return next;
}

function getRowNumber(rows, nameOrAliases) {
  const aliases = Array.isArray(nameOrAliases) ? nameOrAliases : [nameOrAliases];
  for (const a of aliases) {
    const key = normalizeKey(a);
    const row = rows.find((r) => normalizeKey(r?.parameter) === key);
    const n = toNumber(row?.result);
    if (n != null) return n;
  }
  return null;
}

/**
 * CBC / CBC with GBP — derived indices (MCV stays manual).
 * Manual: Hemoglobin, RBC Count, MCV.
 * Auto: HCT/PCV, MCH, MCHC (+ PCT, ANC, ALC).
 */
export function applyCbcFormulas(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const hemoglobin = getRowNumber(rows, ['Hemoglobin', 'Hb', 'HB']);
  const rbc = getRowNumber(rows, ['RBC Count', 'RBC']);
  const mcv = getRowNumber(rows, 'MCV');
  const platelet = getRowNumber(rows, ['Platelet Count', 'Platelet', 'Platelet Count(PLT)']);
  const mpv = getRowNumber(rows, 'MPV');
  const wbc = getRowNumber(rows, ['WBC Count', 'WBC', 'TLC']);
  const neutrophils = getRowNumber(rows, ['Neutrophils', 'Neutrophils %', 'Neutrophil']);
  const lymphocytes = getRowNumber(rows, ['Lymphocytes', 'Lymphocytes %', 'Lymphocyte']);

  let next = rows;

  // HCT/PCV = (RBC Count * MCV) / 10
  if (rbc != null && mcv != null && rbc > 0) {
    next = setDerivedAliases(next, ['HCT/PCV', 'HCT', 'PCV'], format2((rbc * mcv) / 10));
  } else {
    next = setDerivedAliases(next, ['HCT/PCV', 'HCT', 'PCV'], '');
  }

  // MCH = (Hemoglobin * 10) / RBC Count
  if (hemoglobin != null && rbc != null && rbc > 0) {
    next = setDerived(next, 'MCH', format2((hemoglobin * 10) / rbc));
  } else {
    next = setDerived(next, 'MCH', '');
  }

  // MCHC = (Hemoglobin * 100) / HCT/PCV (uses computed or manual HCT)
  const hct = getRowNumber(next, ['HCT/PCV', 'HCT', 'PCV']);
  if (hemoglobin != null && hct != null && hct > 0) {
    next = setDerived(next, 'MCHC', format2((hemoglobin * 100) / hct));
  } else {
    next = setDerived(next, 'MCHC', '');
  }

  // PCT = (Platelet * MPV) / 10000
  if (platelet != null && mpv != null) {
    next = setDerived(next, 'PCT', format2((platelet * mpv) / 10000));
  }

  // ANC = (Neutrophils * WBC Count) / 100
  if (wbc != null && neutrophils != null) {
    next = setDerived(next, 'ANC', format2((neutrophils * wbc) / 100));
  }

  // ALC = (Lymphocytes * WBC Count) / 100
  if (wbc != null && lymphocytes != null) {
    next = setDerived(next, 'ALC', format2((lymphocytes * wbc) / 100));
  }

  return next;
}

export function isCbcDerivedParameter(parameter) {
  const k = normalizeKey(parameter);
  if (k === normalizeKey('HCT/PCV') || k === normalizeKey('HCT') || k === normalizeKey('PCV')) return true;
  if (k === normalizeKey('MCH')) return true;
  if (k === normalizeKey('MCHC')) return true;
  if (k === normalizeKey('PCT')) return true;
  if (k === normalizeKey('ANC')) return true;
  if (k === normalizeKey('ALC')) return true;
  return false;
}

/** Biochemistry panel name — exact "LFT" only (not "LFT with GGT"). */
export function isLftPanelTestName(testName) {
  return normalizeKey(testName) === 'lft';
}

/**
 * LFT derived values (Biochemistry → LFT).
 * Manual: Total/Direct Bilirubin, Total Protein, Albumin.
 */
export function applyLftFormulas(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const totalBilirubin = getRowNumber(rows, ['Total Bilirubin', 'Bilirubin Total']);
  const directBilirubin = getRowNumber(rows, ['Direct Bilirubin', 'Direct']);
  const totalProtein = getRowNumber(rows, 'Total Protein');
  const albumin = getRowNumber(rows, 'Albumin');

  let next = rows;

  if (totalBilirubin != null && directBilirubin != null) {
    const indirect = totalBilirubin - directBilirubin;
    const indirectStr = format2(indirect);
    next = setDerivedAliases(next, ['Indirect Bilirubin', 'Indirect'], indirectStr);
  }

  if (totalProtein != null && albumin != null) {
    const globulin = totalProtein - albumin;
    next = setDerivedAliases(next, 'Globulin', format2(globulin));
    if (globulin > 0) {
      const ag = albumin / globulin;
      next = setDerivedAliases(next, ['A/G Ratio', 'A/G', 'AG Ratio', 'Albumin/Globulin Ratio'], format2(ag));
    }
  }

  return next;
}

export function isLftDerivedParameter(parameter) {
  const k = normalizeKey(parameter);
  if (k === normalizeKey('Indirect Bilirubin') || k === normalizeKey('Indirect')) return true;
  if (k === normalizeKey('Globulin')) return true;
  if (k === normalizeKey('A/G Ratio') || k === normalizeKey('AG Ratio') || k === normalizeKey('A/G')) return true;
  if (k.includes('albumin') && k.includes('globulin')) return true;
  return false;
}

function parseGender(gender) {
  const g = normalizeKey(gender);
  if (!g) return null;
  if (g === 'm' || g === 'male' || g.startsWith('male')) return 'male';
  if (g === 'f' || g === 'female' || g.startsWith('female')) return 'female';
  return null;
}

function parseAgeYears(age) {
  const n = toNumber(age);
  if (n == null || n < 0) return null;
  return n;
}

/**
 * CKD-EPI simplified eGFR (creatinine in mg/dL).
 * Requires patient age + gender from registration — no manual row input.
 */
export function calculateEgfrCkdEpi(creatinineMgDl, ageYears, gender) {
  const scr = toNumber(creatinineMgDl);
  const age = parseAgeYears(ageYears);
  const sex = parseGender(gender);
  if (scr == null || scr <= 0 || age == null || !sex) return null;

  const ageFactor = 0.993 ** age;

  if (sex === 'male') {
    const ratio = scr / 0.9;
    const exponent = scr <= 0.9 ? -0.411 : -1.209;
    return round2(141 * ratio ** exponent * ageFactor);
  }

  const ratio = scr / 0.7;
  const exponent = scr <= 0.7 ? -0.329 : -1.209;
  return round2(144 * ratio ** exponent * ageFactor);
}

/** Biochemistry panel — RFT/KFT (renal function). */
export function isRftKftPanelTestName(testName) {
  const k = normalizeKey(testName);
  return k === 'rftkft' || k === 'rft' || k === 'kft';
}

/**
 * RFT/KFT derived values (Biochemistry → RFT/KFT).
 * Manual inputs: Blood Urea, Creatinine (+ patient Age & Gender for eGFR).
 */
export function applyRftKftFormulas(rows, patientContext = {}) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const bloodUrea = getRowNumber(rows, ['Blood Urea', 'Urea']);
  const creatinine = getRowNumber(rows, ['Creatinine', 'Serum Creatinine']);
  const age = patientContext?.age ?? patientContext?.ageYears;
  const gender = patientContext?.gender;

  let next = rows;

  let bunValue = null;
  if (bloodUrea != null) {
    bunValue = bloodUrea * 0.467;
    next = setDerived(next, 'BUN', format2(bunValue));
  } else {
    bunValue = getRowNumber(next, 'BUN');
  }

  if (bunValue != null && creatinine != null && creatinine > 0) {
    next = setDerivedAliases(next, ['BUN/Creatinine Ratio', 'BUN Creatinine Ratio'], format2(bunValue / creatinine));
  }

  const egfr = creatinine != null && creatinine > 0 ? calculateEgfrCkdEpi(creatinine, age, gender) : null;
  next = setDerived(next, 'eGFR', egfr != null ? format2(egfr) : '');

  return next;
}

export function isRftKftDerivedParameter(parameter) {
  const k = normalizeKey(parameter);
  if (k === normalizeKey('BUN')) return true;
  if (k === normalizeKey('BUN/Creatinine Ratio') || k === normalizeKey('BUN Creatinine Ratio')) return true;
  if (k === normalizeKey('eGFR') || k === 'egfr') return true;
  return false;
}

/** Biochemistry panel — Lipid Profile. */
export function isLipidProfilePanelTestName(testName) {
  return normalizeKey(testName) === 'lipidprofile';
}

/**
 * Lipid Profile derived values (Biochemistry → Lipid Profile).
 * Manual: Total Cholesterol, HDL, Triglyceride.
 * Derived fields stay blank when their conditions are not met.
 */
export function applyLipidProfileFormulas(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const totalCholesterol = getRowNumber(rows, ['Total Cholesterol', 'Cholesterol']);
  const hdl = getRowNumber(rows, 'HDL');
  const triglyceride = getRowNumber(rows, ['Triglyceride', 'Triglycerides', 'TG']);

  const tgOk = triglyceride != null && triglyceride <= 400;
  const tcHdlTgOk = totalCholesterol != null && hdl != null && triglyceride != null;

  let next = rows;

  let vldl = null;
  if (tgOk) {
    vldl = triglyceride / 5;
    next = setDerived(next, 'VLDL', format2(vldl));
  } else {
    next = setDerived(next, 'VLDL', '');
  }

  if (tcHdlTgOk && tgOk && vldl != null) {
    next = setDerived(next, 'LDL', format2(totalCholesterol - hdl - vldl));
  } else {
    next = setDerived(next, 'LDL', '');
  }

  if (totalCholesterol != null && hdl != null) {
    next = setDerived(next, 'Non-HDL', format2(totalCholesterol - hdl));
  } else {
    next = setDerived(next, 'Non-HDL', '');
  }

  if (totalCholesterol != null && hdl != null && hdl > 0) {
    next = setDerivedAliases(next, ['TC/HDL Ratio', 'TC HDL Ratio', 'Cholesterol/HDL Ratio'], format2(totalCholesterol / hdl));
  } else {
    next = setDerivedAliases(next, ['TC/HDL Ratio', 'TC HDL Ratio', 'Cholesterol/HDL Ratio'], '');
  }

  const ldlForRatio = getRowNumber(next, ['LDL', 'LDL Cholesterol']);
  if (ldlForRatio != null && hdl != null && hdl > 0) {
    next = setDerivedAliases(next, ['LDL/HDL Ratio', 'LDL HDL Ratio'], format2(ldlForRatio / hdl));
  } else {
    next = setDerivedAliases(next, ['LDL/HDL Ratio', 'LDL HDL Ratio'], '');
  }

  return next;
}

export function isLipidProfileDerivedParameter(parameter) {
  const k = normalizeKey(parameter);
  if (k === normalizeKey('VLDL')) return true;
  if (k === normalizeKey('LDL')) return true;
  if (k === normalizeKey('Non-HDL') || k === normalizeKey('Non HDL')) return true;
  if (k === normalizeKey('TC/HDL Ratio') || k === normalizeKey('TCHDLRatio')) return true;
  if (k === normalizeKey('LDL/HDL Ratio') || k === normalizeKey('LDLHDLRatio')) return true;
  if (k.includes('tchdl') && k.includes('ratio')) return true;
  if (k.includes('ldlhdl') && k.includes('ratio')) return true;
  return false;
}

/** Biochemistry panel — HbA1c. */
export function isHbA1cPanelTestName(testName) {
  return normalizeKey(testName) === 'hba1c';
}

/**
 * HbA1c derived values (Biochemistry → HbA1c).
 * Manual: HbA1c. Auto: eAG = (28.7 × HbA1c) − 46.7
 */
export function applyHbA1cFormulas(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const hba1c = getRowNumber(rows, ['HbA1c', 'HbA1C', 'HBA1C']);
  let next = rows;

  if (hba1c != null) {
    next = setDerived(next, 'eAG', format2(28.7 * hba1c - 46.7));
  } else {
    next = setDerived(next, 'eAG', '');
  }

  return next;
}

export function isHbA1cDerivedParameter(parameter) {
  const k = normalizeKey(parameter);
  return k === normalizeKey('eAG') || k === 'eag';
}

/** Biochemistry panel — Electrolyte. */
export function isElectrolytePanelTestName(testName) {
  return normalizeKey(testName) === 'electrolyte';
}

/**
 * Electrolyte derived values (Biochemistry → Electrolyte).
 * Manual: Sodium, Potassium, Chloride, Bicarbonate (HCO3), Blood Glucose.
 */
export function applyElectrolyteFormulas(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const sodium = getRowNumber(rows, 'Sodium');
  const potassium = getRowNumber(rows, 'Potassium');
  const chloride = getRowNumber(rows, 'Chloride');
  const hco3 = getRowNumber(rows, ['Bicarbonate (HCO3)', 'Bicarbonate', 'HCO3']);
  const glucose = getRowNumber(rows, ['Blood Glucose', 'Glucose', 'Blood Sugar']);

  let next = rows;

  if (sodium != null && potassium != null && chloride != null && hco3 != null) {
    next = setDerived(next, 'Anion Gap', format2(sodium + potassium - (chloride + hco3)));
  } else {
    next = setDerived(next, 'Anion Gap', '');
  }

  if (sodium != null && glucose != null) {
    const corrected = glucose <= 100 ? sodium : sodium + ((glucose - 100) / 100) * 1.6;
    next = setDerived(next, 'Corrected Sodium', format2(corrected));
  } else {
    next = setDerived(next, 'Corrected Sodium', '');
  }

  return next;
}

export function isElectrolyteDerivedParameter(parameter) {
  const k = normalizeKey(parameter);
  if (k === normalizeKey('Anion Gap')) return true;
  if (k === normalizeKey('Corrected Sodium')) return true;
  return false;
}

/** Biochemistry panel — Iron Profile. */
export function isIronProfilePanelTestName(testName) {
  const k = normalizeKey(testName);
  return k === 'ironprofile' || k === 'iron';
}

/**
 * Iron Profile derived values (Biochemistry → Iron Profile).
 * Manual: Serum Iron, TIBC, Ferritin.
 */
export function applyIronProfileFormulas(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const serumIron = getRowNumber(rows, ['Serum Iron', 'Iron']);
  const tibc = getRowNumber(rows, 'TIBC');

  let next = rows;

  if (serumIron != null && tibc != null) {
    next = setDerived(next, 'UIBC', format2(tibc - serumIron));
  } else {
    next = setDerived(next, 'UIBC', '');
  }

  if (serumIron != null && tibc != null && tibc > 0) {
    next = setDerived(next, 'TSAT', format2((serumIron / tibc) * 100));
  } else {
    next = setDerived(next, 'TSAT', '');
  }

  return next;
}

export function isIronProfileDerivedParameter(parameter) {
  const k = normalizeKey(parameter);
  if (k === normalizeKey('UIBC')) return true;
  if (k === normalizeKey('TSAT')) return true;
  return false;
}

/** Biochemistry panel — Cardiac Profile. */
export function isCardiacProfilePanelTestName(testName) {
  const k = normalizeKey(testName);
  return k === 'cardiacprofile' || k === 'cardiac';
}

/**
 * Cardiac Profile derived values (Biochemistry → Cardiac Profile).
 * Manual: CK Total, CK-MB, Troponin I, Previous Troponin.
 */
export function applyCardiacProfileFormulas(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const ckTotal = getRowNumber(rows, ['CK Total', 'CK', 'CPK']);
  const ckMb = getRowNumber(rows, ['CK-MB', 'CKMB', 'CPK-MB']);
  const troponinI = getRowNumber(rows, ['Troponin I', 'Troponin-I']);
  const previousTroponin = getRowNumber(rows, ['Previous Troponin', 'Prior Troponin']);

  let next = rows;

  if (ckMb != null && ckTotal != null && ckTotal > 0) {
    next = setDerivedAliases(next, ['CK-MB Index', 'CKMB Index'], format2((ckMb / ckTotal) * 100));
  } else {
    next = setDerivedAliases(next, ['CK-MB Index', 'CKMB Index'], '');
  }

  if (troponinI != null && previousTroponin != null) {
    next = setDerived(next, 'Troponin Delta', format2(troponinI - previousTroponin));
  } else {
    next = setDerived(next, 'Troponin Delta', '');
  }

  return next;
}

export function isCardiacProfileDerivedParameter(parameter) {
  const k = normalizeKey(parameter);
  if (k === normalizeKey('CK-MB Index') || k === normalizeKey('CKMB Index')) return true;
  if (k === normalizeKey('Troponin Delta')) return true;
  return false;
}

/** Biochemistry panel — Bone Profile. */
export function isBoneProfilePanelTestName(testName) {
  const k = normalizeKey(testName);
  return k === 'boneprofile' || k === 'bone';
}

/**
 * Bone Profile derived values (Biochemistry → Bone Profile).
 * Manual: Calcium Total, Albumin, Phosphorus.
 */
export function applyBoneProfileFormulas(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const calciumTotal = getRowNumber(rows, ['Calcium Total', 'Calcium']);
  const albumin = getRowNumber(rows, 'Albumin');
  const phosphorus = getRowNumber(rows, 'Phosphorus');

  let next = rows;

  if (calciumTotal != null && albumin != null) {
    next = setDerived(next, 'Corrected Calcium', format2(calciumTotal + 0.8 * (4 - albumin)));
  } else {
    next = setDerived(next, 'Corrected Calcium', '');
  }

  if (calciumTotal != null && phosphorus != null && phosphorus > 0) {
    next = setDerivedAliases(next, ['Ca/P Ratio', 'Ca P Ratio'], format2(calciumTotal / phosphorus));
  } else {
    next = setDerivedAliases(next, ['Ca/P Ratio', 'Ca P Ratio'], '');
  }

  return next;
}

export function isBoneProfileDerivedParameter(parameter) {
  const k = normalizeKey(parameter);
  if (k === normalizeKey('Corrected Calcium')) return true;
  if (k === normalizeKey('Ca/P Ratio') || k === normalizeKey('CaPRatio')) return true;
  if (k.includes('ca') && k.includes('p') && k.includes('ratio')) return true;
  return false;
}

/** Biochemistry panel — Infection / Inflammatory Profile. */
export function isInfectionInflammatoryProfilePanelTestName(testName) {
  const k = normalizeKey(testName);
  return (
    k === 'infectioninflammatoryprofile' ||
    k === 'infectionprofile' ||
    k === 'inflammatoryprofile' ||
    k === 'infectioninflammatory'
  );
}

/**
 * Infection / Inflammatory Profile derived values.
 * Manual: CRP, Albumin, Neutrophils, Lymphocytes, Platelet Count.
 */
export function applyInfectionInflammatoryProfileFormulas(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const crp = getRowNumber(rows, ['CRP', 'CRP Value']);
  const albumin = getRowNumber(rows, 'Albumin');
  const neutrophils = getRowNumber(rows, ['Neutrophils', 'Neutrophils %', 'Neutrophil']);
  const lymphocytes = getRowNumber(rows, ['Lymphocytes', 'Lymphocytes %', 'Lymphocyte']);
  const plateletCount = getRowNumber(rows, ['Platelet Count', 'Platelet', 'Platelet Count(PLT)']);

  let next = rows;

  if (crp != null && albumin != null && albumin > 0) {
    next = setDerived(next, 'CAR', format2(crp / albumin));
  } else {
    next = setDerived(next, 'CAR', '');
  }

  if (neutrophils != null && lymphocytes != null && lymphocytes > 0) {
    next = setDerived(next, 'NLR', format2(neutrophils / lymphocytes));
  } else {
    next = setDerived(next, 'NLR', '');
  }

  if (plateletCount != null && lymphocytes != null && lymphocytes > 0) {
    next = setDerived(next, 'PLR', format2(plateletCount / lymphocytes));
  } else {
    next = setDerived(next, 'PLR', '');
  }

  return next;
}

export function isInfectionInflammatoryProfileDerivedParameter(parameter) {
  const k = normalizeKey(parameter);
  if (k === normalizeKey('CAR')) return true;
  if (k === normalizeKey('NLR')) return true;
  if (k === normalizeKey('PLR')) return true;
  return false;
}

/** Hormone Profile — Fertility / Hormonal Profile. */
export function isFertilityHormonalProfilePanelTestName(testName) {
  const k = normalizeKey(testName);
  return (
    k === 'fertilityhormonalprofile' ||
    k === 'fertilityprofile' ||
    k === 'hormonalprofile' ||
    k === 'fertilityhormonal'
  );
}

/**
 * Fertility / Hormonal Profile derived values.
 * Manual: LH, FSH, Testosterone, Estradiol (E2).
 */
export function applyFertilityHormonalProfileFormulas(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const lh = getRowNumber(rows, ['LH', 'LH Value']);
  const fsh = getRowNumber(rows, ['FSH', 'FSH Value']);
  const testosterone = getRowNumber(rows, ['Testosterone', 'Testosterone Value']);
  const estradiol = getRowNumber(rows, ['Estradiol (E2)', 'Estradiol', 'E2', 'Estradiol Value']);

  let next = rows;

  if (lh != null && fsh != null && fsh > 0) {
    next = setDerivedAliases(next, ['LH/FSH Ratio', 'LH FSH Ratio'], format2(lh / fsh));
  } else {
    next = setDerivedAliases(next, ['LH/FSH Ratio', 'LH FSH Ratio'], '');
  }

  if (testosterone != null && estradiol != null && estradiol > 0) {
    next = setDerivedAliases(next, ['T/E2 Ratio', 'T E2 Ratio', 'Testosterone Estradiol Ratio'], format2(testosterone / estradiol));
  } else {
    next = setDerivedAliases(next, ['T/E2 Ratio', 'T E2 Ratio'], '');
  }

  return next;
}

export function isFertilityHormonalProfileDerivedParameter(parameter) {
  const k = normalizeKey(parameter);
  if (k === normalizeKey('LH/FSH Ratio')) return true;
  if (k === normalizeKey('T/E2 Ratio')) return true;
  if (k.includes('lhfsh') && k.includes('ratio')) return true;
  if (k.includes('te2') && k.includes('ratio') && !k.includes('lh')) return true;
  return false;
}

/** Orthopedics — Arthritis Profile. */
export function isArthritisProfilePanelTestName(testName) {
  const k = normalizeKey(testName);
  return k === 'arthritisprofile' || k === 'arthritis';
}

/**
 * Arthritis Profile derived values.
 * Manual: CRP, ESR.
 */
export function applyArthritisProfileFormulas(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const crp = getRowNumber(rows, ['CRP', 'CRP Value']);
  const esr = getRowNumber(rows, ['ESR', 'ESR Value']);

  let next = rows;

  if (crp != null && esr != null && esr > 0) {
    next = setDerivedAliases(next, ['CRP/ESR Ratio', 'CRP ESR Ratio'], format2(crp / esr));
  } else {
    next = setDerivedAliases(next, ['CRP/ESR Ratio', 'CRP ESR Ratio'], '');
  }

  if (crp != null && esr != null) {
    next = setDerivedAliases(next, ['Inflammation Index', 'Inflammation Index Score'], format2(crp * esr));
  } else {
    next = setDerivedAliases(next, ['Inflammation Index', 'Inflammation Index Score'], '');
  }

  return next;
}

export function isArthritisProfileDerivedParameter(parameter) {
  const k = normalizeKey(parameter);
  if (k === normalizeKey('CRP/ESR Ratio')) return true;
  if (k === normalizeKey('Inflammation Index')) return true;
  if (k.includes('crpesr') && k.includes('ratio')) return true;
  if (k.includes('inflammation') && k.includes('index')) return true;
  return false;
}

/** Hematology panel — Coagulation Profile. */
export function isCoagulationProfilePanelTestName(testName) {
  const k = normalizeKey(testName);
  return k === 'coagulationprofile' || k === 'coagulation';
}

/**
 * Coagulation Profile derived values (Hematology → Coagulation Profile).
 * Manual: PT, Control PT, APTT, Control APTT.
 */
export function applyCoagulationProfileFormulas(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const pt = getRowNumber(rows, ['PT', 'Prothrombin Time', 'Prothrombin Time (PT)']);
  const controlPt = getRowNumber(rows, ['Control PT', 'PT Control']);
  const aptt = getRowNumber(rows, 'APTT');
  const controlAptt = getRowNumber(rows, ['Control APTT', 'APTT Control']);

  let next = rows;

  if (pt != null && controlPt != null && controlPt > 0) {
    const ptControlRatio = pt / controlPt;
    next = setDerived(next, 'PT Ratio', format2(ptControlRatio));
  } else {
    next = setDerived(next, 'PT Ratio', '');
  }

  if (aptt != null && controlAptt != null && controlAptt > 0) {
    next = setDerived(next, 'APTT Ratio', format2(aptt / controlAptt));
  } else {
    next = setDerived(next, 'APTT Ratio', '');
  }

  return next;
}

export function isCoagulationProfileDerivedParameter(parameter) {
  const k = normalizeKey(parameter);
  if (k === normalizeKey('PT Ratio')) return true;
  if (k === normalizeKey('APTT Ratio')) return true;
  return false;
}

/** Hormone Profile — FT3 / T3 test names (includes legacy Free T3). */
export function isHormoneFt3TestName(testName) {
  const k = normalizeKey(testName);
  return k === 'ft3' || k === 'freet3' || k === 't3';
}

/** Hormone Profile — FT4 / T4 test names (includes legacy Free T4). */
export function isHormoneFt4TestName(testName) {
  const k = normalizeKey(testName);
  return k === 'ft4' || k === 'freet4' || k === 't4';
}

export function getHormoneFt3FromRows(rows) {
  return getRowNumber(rows, ['FT3', 'Free T3', 'Free T3 Value', 'T3', 'T3 Value']);
}

export function getHormoneFt4FromRows(rows) {
  return getRowNumber(rows, ['FT4', 'Free T4', 'Free T4 Value', 'T4', 'T4 Value']);
}

export function calculateFt3Ft4Ratio(ft3, ft4) {
  if (ft3 == null || ft4 == null || ft4 <= 0) return null;
  return round2(ft3 / ft4);
}

export function applyFt3Ft4RatioRow(rows, ft3, ft4) {
  if (!Array.isArray(rows) || !rows.length) return rows;
  const ratio = calculateFt3Ft4Ratio(ft3, ft4);
  return setDerivedAliases(rows, ['FT3/FT4 Ratio', 'FT3 FT4 Ratio'], ratio != null ? format2(ratio) : '');
}

/** Read FT3 / FT4 values from hormone profile rows-by-test map. */
export function extractHormoneFt3Ft4Values(rowsByTest) {
  const map = rowsByTest && typeof rowsByTest === 'object' ? rowsByTest : {};
  let ft3 = null;
  let ft4 = null;

  Object.entries(map).forEach(([testName, rows]) => {
    if (!Array.isArray(rows)) return;
    if (isHormoneFt3TestName(testName)) {
      const v = getHormoneFt3FromRows(rows);
      if (v != null) ft3 = v;
    }
    if (isHormoneFt4TestName(testName)) {
      const v = getHormoneFt4FromRows(rows);
      if (v != null) ft4 = v;
    }
  });

  return { ft3, ft4 };
}

/** Sync FT3/FT4 ratio row on both FT3 and FT4 hormone tests. */
export function applyHormoneFt3Ft4SharedFormulas(rowsByTest) {
  if (!rowsByTest || typeof rowsByTest !== 'object') return {};
  const { ft3, ft4 } = extractHormoneFt3Ft4Values(rowsByTest);
  const next = { ...rowsByTest };

  Object.keys(next).forEach((testName) => {
    if (isHormoneFt3TestName(testName) || isHormoneFt4TestName(testName)) {
      const rows = Array.isArray(next[testName]) ? next[testName] : [];
      next[testName] = applyFt3Ft4RatioRow(rows, ft3, ft4);
    }
  });

  return next;
}

export function isHormoneFt3Ft4RatioParameter(parameter) {
  const k = normalizeKey(parameter);
  if (k === normalizeKey('FT3/FT4 Ratio')) return true;
  return k.includes('ft3') && k.includes('ft4') && k.includes('ratio');
}

/** Merge templates + apply shared FT3/FT4 ratio across T3, T4, FT3, FT4 tests. */
export function syncHormoneFt3Ft4Panels(rowsByTest, catalogTests) {
  const catalog = Array.isArray(catalogTests) ? catalogTests : [];
  let map = rowsByTest && typeof rowsByTest === 'object' ? { ...rowsByTest } : {};

  catalog.forEach((test) => {
    const testName = test?.name;
    if (!testName || (!isHormoneFt3TestName(testName) && !isHormoneFt4TestName(testName))) return;
    if (!Array.isArray(test.rows) || !test.rows.length) return;
    const existing = Array.isArray(map[testName]) ? map[testName] : [];
    map[testName] = mergeHormoneProfileRows(existing, test.rows);
  });

  Object.keys(map).forEach((testName) => {
    if (!isHormoneFt3TestName(testName) && !isHormoneFt4TestName(testName)) return;
    const tpl = catalog.find((t) => normalizeKey(t?.name) === normalizeKey(testName));
    if (!tpl?.rows?.length) return;
    map[testName] = mergeHormoneProfileRows(map[testName], tpl.rows);
  });

  return applyHormoneFt3Ft4SharedFormulas(map);
}

/** Ensure catalog template rows (e.g. FT3/FT4 Ratio) appear even if state was saved before they existed. */
export function mergeHormoneProfileRows(storedRows, templateRows) {
  const template = Array.isArray(templateRows) ? templateRows : [];
  if (!template.length) return Array.isArray(storedRows) ? storedRows : [];

  const stored = Array.isArray(storedRows) ? storedRows : [];
  const storedByKey = new Map();
  stored.forEach((row) => {
    const k = normalizeKey(row?.parameter);
    if (k) storedByKey.set(k, { ...row });
  });

  const merged = template.map((tpl) => {
    const k = normalizeKey(tpl?.parameter);
    const hit = storedByKey.get(k);
    if (hit) {
      storedByKey.delete(k);
      return {
        ...tpl,
        ...hit,
        parameter: tpl.parameter,
        unit: String(hit.unit ?? tpl.unit ?? '').trim() || tpl.unit || '',
        referenceRange: String(hit.referenceRange ?? tpl.referenceRange ?? '').trim() || tpl.referenceRange || '',
      };
    }
    return {
      ...tpl,
      result: tpl.result ?? '',
      autoDerived: tpl.autoDerived,
    };
  });

  const extras = [...storedByKey.values()];
  return extras.length ? [...merged, ...extras] : merged;
}

