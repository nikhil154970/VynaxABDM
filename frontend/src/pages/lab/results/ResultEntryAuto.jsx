import { useCallback, useEffect, useMemo, useState } from 'react';
import { MdCheckCircle, MdRefresh, MdSearch } from 'react-icons/md';
import api from '../../../utils/api';
import {
  applyCbcFormulas,
  applyCardiacProfileFormulas,
  applyBoneProfileFormulas,
  applyCoagulationProfileFormulas,
  applyElectrolyteFormulas,
  applyArthritisProfileFormulas,
  applyFertilityHormonalProfileFormulas,
  applyHbA1cFormulas,
  applyInfectionInflammatoryProfileFormulas,
  applyIronProfileFormulas,
  applyLftFormulas,
  applyLipidProfileFormulas,
  applyRftKftFormulas,
  isCbcDerivedParameter,
  isCardiacProfileDerivedParameter,
  isCardiacProfilePanelTestName,
  isBoneProfileDerivedParameter,
  isBoneProfilePanelTestName,
  isCoagulationProfileDerivedParameter,
  isCoagulationProfilePanelTestName,
  isElectrolyteDerivedParameter,
  isElectrolytePanelTestName,
  isArthritisProfileDerivedParameter,
  isArthritisProfilePanelTestName,
  isFertilityHormonalProfileDerivedParameter,
  isFertilityHormonalProfilePanelTestName,
  isHbA1cDerivedParameter,
  isHbA1cPanelTestName,
  isInfectionInflammatoryProfileDerivedParameter,
  isInfectionInflammatoryProfilePanelTestName,
  isIronProfileDerivedParameter,
  isIronProfilePanelTestName,
  isHormoneFt3Ft4RatioParameter,
  isHormoneFt3TestName,
  isHormoneFt4TestName,
  mergeHormoneProfileRows,
  syncHormoneFt3Ft4Panels,
  isLftDerivedParameter,
  isLftPanelTestName,
  isLipidProfileDerivedParameter,
  isLipidProfilePanelTestName,
  isRftKftDerivedParameter,
  isRftKftPanelTestName,
} from '../../../utils/labCalculations';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

const CBC_PARAMETERS = [
  { parameter: 'Hemoglobin', result: '', unit: 'g/dL', referenceRange: '12-16' },
  { parameter: 'WBC Count', result: '', unit: '/cumm', referenceRange: '4000-11000' },
  { parameter: 'RBC Count', result: '', unit: 'million/cumm', referenceRange: '4.5-5.5' },
  { parameter: 'Neutrophils', result: '', unit: '%', referenceRange: '40-75' },
  { parameter: 'Lymphocytes', result: '', unit: '%', referenceRange: '20-45' },
  { parameter: 'Platelet Count', result: '', unit: 'lakh/cumm', referenceRange: '1.5-4.5' },
  { parameter: 'HCT/PCV', result: '', unit: '%', referenceRange: '36-46' },
  { parameter: 'MCV', result: '', unit: 'fL', referenceRange: '80-100' },
  { parameter: 'MCH', result: '', unit: 'pg', referenceRange: '27-32' },
  { parameter: 'MCHC', result: '', unit: 'g/dL', referenceRange: '32-36' },
  { parameter: 'RDW', result: '', unit: '%', referenceRange: '11-15' },
  { parameter: 'MPV', result: '', unit: 'fL', referenceRange: '7.5-11.5' },
  { parameter: 'PCT', result: '', unit: '%', referenceRange: '' },
  { parameter: 'ANC', result: '', unit: '/cumm', referenceRange: '' },
  { parameter: 'ALC', result: '', unit: '/cumm', referenceRange: '' },
  { parameter: 'Peripheral Smear', result: '', unit: 'text', referenceRange: 'Normal' },
];

const HEMATOLOGY_TESTS = [
  { name: 'CBC (With GBP)', rows: CBC_PARAMETERS },
  { name: 'ESR', rows: [{ parameter: 'ESR', result: '', unit: 'mm/hr', referenceRange: '0-20' }] },
  { name: 'CBC (With ESR)', rows: [...CBC_PARAMETERS, { parameter: 'ESR', result: '', unit: 'mm/hr', referenceRange: '0-20' }] },
  {
    name: 'RFT',
    rows: [
      { parameter: 'Blood Urea', result: '', unit: 'mg/dL', referenceRange: '15-45' },
      { parameter: 'Creatinine', result: '', unit: 'mg/dL', referenceRange: '0.6-1.3' },
      { parameter: 'Uric Acid', result: '', unit: 'mg/dL', referenceRange: '3.5-7.2' },
      { parameter: 'Sodium', result: '', unit: 'mmol/L', referenceRange: '135-145' },
      { parameter: 'Potassium', result: '', unit: 'mmol/L', referenceRange: '3.5-5.0' },
      { parameter: 'Chloride', result: '', unit: 'mmol/L', referenceRange: '96-106' },
    ],
  },
  { 
    name: 'LFT',
    rows: [
      { parameter: 'Total Bilirubin', result: '', unit: 'mg/dL', referenceRange: '0.2-1.2' },
      { parameter: 'Direct Bilirubin', result: '', unit: 'mg/dL', referenceRange: '0-0.3' },
      { parameter: 'SGOT / AST', result: '', unit: 'U/L', referenceRange: '5-40' },
      { parameter: 'SGPT / ALT', result: '', unit: 'U/L', referenceRange: '7-56' },
      { parameter: 'Alkaline Phosphatase', result: '', unit: 'U/L', referenceRange: '44-147' },
      { parameter: 'Albumin', result: '', unit: 'g/dL', referenceRange: '3.5-5.5' },
      { parameter: 'Total Protein', result: '', unit: 'g/dL', referenceRange: '6.0-8.3' },
    ],
  },
  { name: 'RBS', rows: [{ parameter: 'Blood Sugar (Random)', result: '', unit: 'mg/dL', referenceRange: '70-140' }] },
  { name: 'FBS', rows: [{ parameter: 'Blood Sugar (Fasting)', result: '', unit: 'mg/dL', referenceRange: '70-100' }] },
  { name: 'PPBS', rows: [{ parameter: 'Blood Sugar (Post Prandial)', result: '', unit: 'mg/dL', referenceRange: '70-140' }] },
  {
    name: 'HIV',
    rows: [
      { parameter: 'HIV I', result: '', unit: 'text', referenceRange: 'Negative' },
      { parameter: 'HIV II', result: '', unit: 'text', referenceRange: 'Negative' },
      { parameter: 'Interpretation', result: '', unit: 'text', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'HBsAg',
    rows: [
      { parameter: 'HBsAg Result', result: '', unit: 'text', referenceRange: 'Negative' },
      { parameter: 'Interpretation', result: '', unit: 'text', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'Anti-HCV',
    rows: [
      { parameter: 'Anti-HCV Result', result: '', unit: 'text', referenceRange: 'Negative' },
      { parameter: 'Interpretation', result: '', unit: 'text', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'Blood Group ABORh',
    rows: [
      { parameter: 'Blood Group', result: '', unit: 'text', referenceRange: 'A/B/AB/O' },
      { parameter: 'Rh Factor', result: '', unit: 'text', referenceRange: 'Positive/Negative' },
    ],
  },
  { name: 'Platelet Count', rows: [{ parameter: 'Platelet Count', result: '', unit: 'lakh/cumm', referenceRange: '1.5-4.5' }] },
  {
    name: 'Dengue Rapid Test',
    rows: [
      { parameter: 'NS1 Antigen', result: '', unit: 'text', referenceRange: 'Negative' },
      { parameter: 'IgG', result: '', unit: 'text', referenceRange: 'Negative' },
      { parameter: 'IgM', result: '', unit: 'text', referenceRange: 'Negative' },
      { parameter: 'Interpretation', result: '', unit: 'text', referenceRange: 'Negative' },
    ],
  },
  { name: 'HbA1c', rows: [{ parameter: 'HbA1c', result: '', unit: '%', referenceRange: '4-5.6' }] },
  {
    name: 'BT/CT',
    rows: [
      { parameter: 'Bleeding Time', result: '', unit: 'min', referenceRange: '2-7' },
      { parameter: 'Clotting Time', result: '', unit: 'min', referenceRange: '5-11' },
    ],
  },
  {
    name: 'Prothrombin Time PT (PT/INR)',
    rows: [
      { parameter: 'PT', result: '', unit: 'sec', referenceRange: '11-15' },
      { parameter: 'INR', result: '', unit: 'ratio', referenceRange: '0.8-1.2' },
    ],
  },
  {
    name: 'APTT/KCTT/PTT',
    rows: [
      { parameter: 'APTT', result: '', unit: 'sec', referenceRange: '25-35' },
      { parameter: 'KCTT', result: '', unit: 'sec', referenceRange: '60-90' },
      { parameter: 'PTT', result: '', unit: 'sec', referenceRange: '25-35' },
    ],
  },
  {
    name: 'Coagulation Profile',
    rows: [
      { parameter: 'BT', result: '', unit: 'min', referenceRange: '2-7' },
      { parameter: 'CT', result: '', unit: 'min', referenceRange: '5-11' },
      { parameter: 'PT', result: '', unit: 'sec', referenceRange: '11-15' },
      { parameter: 'Control PT', result: '', unit: 'sec', referenceRange: 'Normal' },
      { parameter: 'PT Ratio', result: '', unit: 'Ratio', referenceRange: '0.8-1.2' },
      { parameter: 'INR', result: '', unit: 'Ratio', referenceRange: '0.8-1.2' },
      { parameter: 'PC', result: '', unit: '%', referenceRange: '70-120' },
      { parameter: 'APTT', result: '', unit: 'sec', referenceRange: '25-35' },
      { parameter: 'Control APTT', result: '', unit: 'sec', referenceRange: 'Normal' },
      { parameter: 'APTT Ratio', result: '', unit: 'Ratio', referenceRange: '0.8-1.2' },
    ],
  },
  {
    name: 'GBP for MP & MF',
    rows: [
      { parameter: 'Malaria Parasite', result: '', unit: 'text', referenceRange: 'Negative' },
      { parameter: 'Microfilaria', result: '', unit: 'text', referenceRange: 'Negative' },
    ],
  },
];

const BIOCHEMISTRY_TESTS = [
  { name: 'Glucose Fasting', rows: [{ parameter: 'Blood Sugar Fasting', result: '', unit: 'mg/dL', referenceRange: '70-100' }] },
  { name: 'Glucose PP', rows: [{ parameter: 'Blood Sugar PP', result: '', unit: 'mg/dL', referenceRange: '70-140' }] },
  { name: 'Glucose Random', rows: [{ parameter: 'Blood Sugar Random', result: '', unit: 'mg/dL', referenceRange: '70-140' }] },
  {
    name: 'GTT (3 Sample)',
    rows: [
      { parameter: 'Fasting', result: '', unit: 'mg/dL', referenceRange: '70-100' },
      { parameter: '1 Hour', result: '', unit: 'mg/dL', referenceRange: '70-140' },
      { parameter: '2 Hour', result: '', unit: 'mg/dL', referenceRange: '70-140' },
    ],
  },
  {
    name: 'GTT (5 Sample)',
    rows: [
      { parameter: 'Fasting', result: '', unit: 'mg/dL', referenceRange: '70-100' },
      { parameter: '30 Min', result: '', unit: 'mg/dL', referenceRange: '70-140' },
      { parameter: '1 Hour', result: '', unit: 'mg/dL', referenceRange: '70-140' },
      { parameter: '2 Hour', result: '', unit: 'mg/dL', referenceRange: '70-140' },
      { parameter: '3 Hour', result: '', unit: 'mg/dL', referenceRange: '70-140' },
    ],
  },
  { name: 'GCT', rows: [{ parameter: 'Glucose Challenge Test', result: '', unit: 'mg/dL', referenceRange: '70-140' }] },
  {
    name: 'HbA1c',
    rows: [
      { parameter: 'HbA1c', result: '', unit: '%', referenceRange: '4-5.6' },
      { parameter: 'eAG', result: '', unit: 'mg/dL', referenceRange: '70-126' },
    ],
  },
  {
    name: 'Lipid Profile',
    rows: [
      { parameter: 'Total Cholesterol', result: '', unit: 'mg/dL', referenceRange: '<200' },
      { parameter: 'HDL', result: '', unit: 'mg/dL', referenceRange: '40-60' },
      { parameter: 'LDL', result: '', unit: 'mg/dL', referenceRange: '<100' },
      { parameter: 'VLDL', result: '', unit: 'mg/dL', referenceRange: '5-40' },
      { parameter: 'Triglyceride', result: '', unit: 'mg/dL', referenceRange: '<150' },
      { parameter: 'Non-HDL', result: '', unit: 'mg/dL', referenceRange: '<130' },
      { parameter: 'TC/HDL Ratio', result: '', unit: 'Ratio', referenceRange: '<5' },
      { parameter: 'LDL/HDL Ratio', result: '', unit: 'Ratio', referenceRange: '<3' },
    ],
  },
  { name: 'Cholesterol', rows: [{ parameter: 'Total Cholesterol', result: '', unit: 'mg/dL', referenceRange: '<200' }] },
  { name: 'HDL', rows: [{ parameter: 'HDL', result: '', unit: 'mg/dL', referenceRange: '40-60' }] },
  { name: 'LDL Cholesterol', rows: [{ parameter: 'LDL', result: '', unit: 'mg/dL', referenceRange: '<100' }] },
  { name: 'VLDL Cholesterol', rows: [{ parameter: 'VLDL', result: '', unit: 'mg/dL', referenceRange: '5-40' }] },
  { name: 'Triglyceride', rows: [{ parameter: 'Triglyceride', result: '', unit: 'mg/dL', referenceRange: '<150' }] },
  {
    name: 'LFT with GGT',
    rows: [
      { parameter: 'Total Bilirubin', result: '', unit: 'mg/dL', referenceRange: '0.2-1.2' },
      { parameter: 'SGOT', result: '', unit: 'U/L', referenceRange: '5-40' },
      { parameter: 'SGPT', result: '', unit: 'U/L', referenceRange: '7-56' },
      { parameter: 'ALP', result: '', unit: 'U/L', referenceRange: '44-147' },
      { parameter: 'GGT', result: '', unit: 'U/L', referenceRange: '9-48' },
      { parameter: 'Albumin', result: '', unit: 'g/dL', referenceRange: '3.5-5.5' },
    ],
  },
  { name: 'Bilirubin Total', rows: [{ parameter: 'Total Bilirubin', result: '', unit: 'mg/dL', referenceRange: '0.2-1.2' }] },
  {
    name: 'Bilirubin (T+D+I)',
    rows: [
      { parameter: 'Total', result: '', unit: 'mg/dL', referenceRange: '0.2-1.2' },
      { parameter: 'Direct', result: '', unit: 'mg/dL', referenceRange: '0-0.3' },
      { parameter: 'Indirect', result: '', unit: 'mg/dL', referenceRange: '0.2-0.9' },
    ],
  },
  { name: 'SGOT (AST)', rows: [{ parameter: 'SGOT', result: '', unit: 'U/L', referenceRange: '5-40' }] },
  { name: 'SGPT (ALT)', rows: [{ parameter: 'SGPT', result: '', unit: 'U/L', referenceRange: '7-56' }] },
  { name: 'Alkaline Phosphatase', rows: [{ parameter: 'ALP', result: '', unit: 'U/L', referenceRange: '44-147' }] },
  { name: 'Total Protein', rows: [{ parameter: 'Total Protein', result: '', unit: 'g/dL', referenceRange: '6-8.3' }] },
  { name: 'Albumin', rows: [{ parameter: 'Albumin', result: '', unit: 'g/dL', referenceRange: '3.5-5.5' }] },
  {
    name: 'Infection / Inflammatory Profile',
    rows: [
      { parameter: 'CRP', result: '', unit: 'mg/L', referenceRange: 'Normal' },
      { parameter: 'Albumin', result: '', unit: 'g/dL', referenceRange: '3.5-5' },
      { parameter: 'Neutrophils', result: '', unit: '%', referenceRange: '40-75' },
      { parameter: 'Lymphocytes', result: '', unit: '%', referenceRange: '20-45' },
      { parameter: 'Platelet Count', result: '', unit: 'lakh/cumm', referenceRange: '1.5-4.5' },
      { parameter: 'CAR', result: '', unit: 'Ratio', referenceRange: 'Normal' },
      { parameter: 'NLR', result: '', unit: 'Ratio', referenceRange: 'Normal' },
      { parameter: 'PLR', result: '', unit: 'Ratio', referenceRange: 'Normal' },
    ],
  },
  {
    name: 'RFT/KFT',
    rows: [
      { parameter: 'Blood Urea', result: '', unit: 'mg/dL', referenceRange: '15-45' },
      { parameter: 'Creatinine', result: '', unit: 'mg/dL', referenceRange: '0.6-1.3' },
      { parameter: 'Uric Acid', result: '', unit: 'mg/dL', referenceRange: '3.5-7.2' },
      { parameter: 'Sodium', result: '', unit: 'mmol/L', referenceRange: '135-145' },
      { parameter: 'Potassium', result: '', unit: 'mmol/L', referenceRange: '3.5-5' },
      { parameter: 'Chloride', result: '', unit: 'mmol/L', referenceRange: '98-107' },
      { parameter: 'Calcium', result: '', unit: 'mg/dL', referenceRange: '8.5-10.5' },
      { parameter: 'Phosphorus', result: '', unit: 'mg/dL', referenceRange: '2.5-4.5' },
      { parameter: 'BUN', result: '', unit: 'mg/dL', referenceRange: '7-20' },
      { parameter: 'BUN/Creatinine Ratio', result: '', unit: 'Ratio', referenceRange: '10-20' },
      { parameter: 'eGFR', result: '', unit: 'mL/min/1.73m²', referenceRange: '>90' },
    ],
  },
  { name: 'Urea', rows: [{ parameter: 'Blood Urea', result: '', unit: 'mg/dL', referenceRange: '15-45' }] },
  { name: 'Creatinine', rows: [{ parameter: 'Creatinine', result: '', unit: 'mg/dL', referenceRange: '0.6-1.3' }] },
  {
    name: 'Electrolyte',
    rows: [
      { parameter: 'Sodium', result: '', unit: 'mmol/L', referenceRange: '135-145' },
      { parameter: 'Potassium', result: '', unit: 'mmol/L', referenceRange: '3.5-5' },
      { parameter: 'Chloride', result: '', unit: 'mmol/L', referenceRange: '96-106' },
      { parameter: 'Bicarbonate (HCO3)', result: '', unit: 'mmol/L', referenceRange: '22-28' },
      { parameter: 'Blood Glucose', result: '', unit: 'mg/dL', referenceRange: '70-140' },
      { parameter: 'Anion Gap', result: '', unit: 'mEq/L', referenceRange: '8-16' },
      { parameter: 'Corrected Sodium', result: '', unit: 'mmol/L', referenceRange: '135-145' },
    ],
  },
  { name: 'Calcium Total', rows: [{ parameter: 'Calcium', result: '', unit: 'mg/dL', referenceRange: '8.5-10.5' }] },
  {
    name: 'Bone Profile',
    rows: [
      { parameter: 'Calcium Total', result: '', unit: 'mg/dL', referenceRange: '8.5-10.5' },
      { parameter: 'Albumin', result: '', unit: 'g/dL', referenceRange: '3.5-5' },
      { parameter: 'Corrected Calcium', result: '', unit: 'mg/dL', referenceRange: '8.5-10.5' },
      { parameter: 'Phosphorus', result: '', unit: 'mg/dL', referenceRange: '2.5-4.5' },
      { parameter: 'Ca/P Ratio', result: '', unit: 'Ratio', referenceRange: 'Normal' },
    ],
  },
  { name: 'Phosphorus', rows: [{ parameter: 'Phosphorus', result: '', unit: 'mg/dL', referenceRange: '2.5-4.5' }] },
  {
    name: 'Iron Profile',
    rows: [
      { parameter: 'Serum Iron', result: '', unit: 'ug/dL', referenceRange: '60-170' },
      { parameter: 'TIBC', result: '', unit: 'ug/dL', referenceRange: '250-450' },
      { parameter: 'Ferritin', result: '', unit: 'ng/mL', referenceRange: '30-400' },
      { parameter: 'UIBC', result: '', unit: 'ug/dL', referenceRange: '111-343' },
      { parameter: 'TSAT', result: '', unit: '%', referenceRange: '20-50' },
    ],
  },
  {
    name: 'Cardiac Profile',
    rows: [
      { parameter: 'CK Total', result: '', unit: 'U/L', referenceRange: '30-170' },
      { parameter: 'CK-MB', result: '', unit: 'ng/mL', referenceRange: '0-5' },
      { parameter: 'CK-MB Index', result: '', unit: '%', referenceRange: '<5' },
      { parameter: 'Troponin I', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
      { parameter: 'Previous Troponin', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
      { parameter: 'Troponin Delta', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
    ],
  },
  { name: 'Uric Acid', rows: [{ parameter: 'Uric Acid', result: '', unit: 'mg/dL', referenceRange: '3.5-7.2' }] },
  { name: 'Magnesium', rows: [{ parameter: 'Magnesium', result: '', unit: 'mg/dL', referenceRange: '1.7-2.2' }] },
  { name: 'CPK', rows: [{ parameter: 'CPK', result: '', unit: 'U/L', referenceRange: '20-200' }] },
  { name: 'CPK-MB', rows: [{ parameter: 'CPK-MB', result: '', unit: 'U/L', referenceRange: '0-25' }] },
  { name: 'LDH', rows: [{ parameter: 'LDH', result: '', unit: 'U/L', referenceRange: '140-280' }] },
  { name: 'Amylase', rows: [{ parameter: 'Amylase', result: '', unit: 'U/L', referenceRange: '30-110' }] },
  { name: 'Lipase', rows: [{ parameter: 'Lipase', result: '', unit: 'U/L', referenceRange: '0-160' }] },
  {
    name: 'LFT',
    rows: [
      { parameter: 'Total Bilirubin', result: '', unit: 'mg/dL', referenceRange: '0.2-1.2' },
      { parameter: 'Direct Bilirubin', result: '', unit: 'mg/dL', referenceRange: '0-0.3' },
      { parameter: 'Indirect Bilirubin', result: '', unit: 'mg/dL', referenceRange: '0.2-0.9' },
      { parameter: 'SGOT', result: '', unit: 'U/L', referenceRange: '5-40' },
      { parameter: 'SGPT', result: '', unit: 'U/L', referenceRange: '7-56' },
      { parameter: 'ALP', result: '', unit: 'U/L', referenceRange: '44-147' },
      { parameter: 'Total Protein', result: '', unit: 'g/dL', referenceRange: '6.0-8.3' },
      { parameter: 'Albumin', result: '', unit: 'g/dL', referenceRange: '3.5-5.5' },
      { parameter: 'Globulin', result: '', unit: 'g/dL', referenceRange: '2.0-3.5' },
      { parameter: 'A/G Ratio', result: '', unit: 'ratio', referenceRange: '1.0-2.0' },
    ],
  },
];

const MICROBIOLOGY_TESTS = [
  {
    name: 'AFB Stain / Z-N Stain',
    rows: [
      { parameter: 'Acid Fast Bacilli', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Bacilli Seen', result: '', unit: '/HPF', referenceRange: 'Nil' },
      { parameter: 'Smear Result', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'AFB Stain with concentration',
    rows: [
      { parameter: 'AFB Concentrated Smear', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Bacilli Count', result: '', unit: '/HPF', referenceRange: 'Nil' },
      { parameter: 'Smear Grade', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'AFB Stain for M.leprae',
    rows: [
      { parameter: 'Lepra Bacilli', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Bacillary Index', result: '', unit: '+', referenceRange: 'Nil' },
      { parameter: 'Morphological Index', result: '', unit: '%', referenceRange: 'Nil' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Modified AFB Stain for coccidian parasite in Stool',
    rows: [
      { parameter: 'Oocyst Seen', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Parasite Load', result: '', unit: '/HPF', referenceRange: 'Nil' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Gram Stain',
    rows: [
      { parameter: 'Gram Positive Cocci', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Gram Negative Bacilli', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Pus Cells', result: '', unit: '/HPF', referenceRange: 'Nil' },
      { parameter: 'Epithelial Cells', result: '', unit: '/HPF', referenceRange: 'Few' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'KOH for fungal hyphae',
    rows: [
      { parameter: 'Fungal Elements', result: '', unit: '-', referenceRange: 'Absent' },
      { parameter: 'Hyphae Seen', result: '', unit: '-', referenceRange: 'No' },
      { parameter: 'Spores Seen', result: '', unit: '-', referenceRange: 'No' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Albert Stain for Diphtheriae Bacilli',
    rows: [
      { parameter: 'Bacilli Seen', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Metachromatic Granules', result: '', unit: '-', referenceRange: 'Absent' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'India Ink C.S.F for Cryptococcus',
    rows: [
      { parameter: 'Cryptococcus', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Yeast Cells', result: '', unit: '-', referenceRange: 'Absent' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Sputum/ETT C/S for bacteria & fungus',
    rows: [
      { parameter: 'Organism Isolated', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Pus Cells', result: '', unit: '/HPF', referenceRange: 'Nil' },
      { parameter: 'Epithelial Cells', result: '', unit: '/HPF', referenceRange: 'Few' },
      { parameter: 'Fungal Growth', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Antibiotic Sensitivity', result: '', unit: '-', referenceRange: '-' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Throat swab C/S for bacteria & fungus',
    rows: [
      { parameter: 'Organism Isolated', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Throat Flora', result: '', unit: '-', referenceRange: 'Normal' },
      { parameter: 'Pus Cells', result: '', unit: '/HPF', referenceRange: 'Nil' },
      { parameter: 'Antibiotic Sensitivity', result: '', unit: '-', referenceRange: '-' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Pus C/S for bacteria & fungus',
    rows: [
      { parameter: 'Organism Isolated', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Pus Cells', result: '', unit: '/HPF', referenceRange: 'Nil' },
      { parameter: 'Necrotic Material', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Antibiotic Sensitivity', result: '', unit: '-', referenceRange: '-' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Fluid C/S for bacteria & fungus',
    rows: [
      { parameter: 'Organism Isolated', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Cell Count', result: '', unit: '/cumm', referenceRange: 'Nil' },
      { parameter: 'Fungal Growth', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Antibiotic Sensitivity', result: '', unit: '-', referenceRange: '-' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'C.S.F C/S for bacteria & fungus',
    rows: [
      { parameter: 'Organism Isolated', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'WBC', result: '', unit: '/cumm', referenceRange: '0–5' },
      { parameter: 'Protein', result: '', unit: 'mg/dL', referenceRange: 'Normal' },
      { parameter: 'Glucose', result: '', unit: 'mg/dL', referenceRange: 'Normal' },
      { parameter: 'Antibiotic Sensitivity', result: '', unit: '-', referenceRange: '-' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Semen C/S',
    rows: [
      { parameter: 'Organism Isolated', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Pus Cells', result: '', unit: '/HPF', referenceRange: 'Nil' },
      { parameter: 'Fungal Growth', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Antibiotic Sensitivity', result: '', unit: '-', referenceRange: '-' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'TB C/S',
    rows: [
      { parameter: 'Mycobacterium Growth', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Colony Count', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Drug Sensitivity', result: '', unit: '-', referenceRange: '-' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Blood C/S for bacteria & fungus',
    rows: [
      { parameter: 'Organism Isolated', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Blood Culture Growth', result: '', unit: '-', referenceRange: 'No Growth' },
      { parameter: 'Antibiotic Sensitivity', result: '', unit: '-', referenceRange: '-' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Urine C/S',
    rows: [
      { parameter: 'Organism Isolated', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Colony Count', result: '', unit: 'CFU/ml', referenceRange: 'Nil' },
      { parameter: 'Pus Cells', result: '', unit: '/HPF', referenceRange: 'Nil' },
      { parameter: 'Antibiotic Sensitivity', result: '', unit: '-', referenceRange: '-' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Stool C/S',
    rows: [
      { parameter: 'Organism Isolated', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Parasites', result: '', unit: '-', referenceRange: 'Nil' },
      { parameter: 'Occult Blood', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Antibiotic Sensitivity', result: '', unit: '-', referenceRange: '-' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
];

const CLINICAL_PATHOLOGY_TESTS = [
  'CSF R/M',
  'CSF Cytology',
  'Fluid R/M',
  'Fluid Cytology',
  'Complete Semen Analysis',
  'Semen pH',
  'Semen Morphology',
  'Semen Fructose',
  'Urine R/M',
  'Urine Chyle',
  '24 hrs Urine Protein',
  'Urine Microalbumin',
  'Urine Sugar',
  'Urine Protein',
  'Stool R/M',
  'Stool pH',
  'Stool Occult Blood',
  'Stool Ova Cyst',
  'ADA (Fluid)',
];

const SEROLOGY_TESTS = [
  {
    name: 'CRP Titre Qualitative',
    rows: [
      { parameter: 'CRP Result', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Titre', result: '', unit: '-', referenceRange: '-' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Latex Agglutination' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'CRP Titre Quantitative',
    rows: [
      { parameter: 'CRP Value', result: '', unit: 'mg/L', referenceRange: '0-6' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Turbidimetric' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'RA Titre Qualitative',
    rows: [
      { parameter: 'RA Factor', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Latex Agglutination' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'ASO Titre Qualitative',
    rows: [
      { parameter: 'ASO Result', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Latex Agglutination' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Malaria Combined Test',
    rows: [
      { parameter: 'P. Vivax', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'P. Falciparum', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Parasite Seen', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'FilariaAb Test (IgG+IgM)',
    rows: [
      { parameter: 'Filaria IgG', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Filaria IgM', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Antibody Result', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Aldehyde Test For Kalazar',
    rows: [
      { parameter: 'Aldehyde Test', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Reaction Time', result: '', unit: 'min', referenceRange: 'Normal' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Kalazar K-39',
    rows: [
      { parameter: 'K39 Antigen', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Result Status', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Widal',
    rows: [
      { parameter: 'Salmonella Typhi O', result: '', unit: 'titre', referenceRange: '<1:80' },
      { parameter: 'Salmonella Typhi H', result: '', unit: 'titre', referenceRange: '<1:80' },
      { parameter: 'Salmonella Paratyphi A', result: '', unit: 'titre', referenceRange: '<1:80' },
      { parameter: 'Salmonella Paratyphi B', result: '', unit: 'titre', referenceRange: '<1:80' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Typhidot IgG+IgM',
    rows: [
      { parameter: 'Typhidot IgG', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Typhidot IgM', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Result Status', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'VDRL',
    rows: [
      { parameter: 'VDRL Result', result: '', unit: '-', referenceRange: 'Non Reactive' },
      { parameter: 'Titre', result: '', unit: 'titre', referenceRange: 'Nil' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'HIV',
    rows: [
      { parameter: 'HIV 1', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'HIV 2', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Result Status', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },

  {
    name: 'HBsAg',
    rows: [
      { parameter: 'HBsAg Result', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Rapid Card' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'HCV',
    rows: [
      { parameter: 'Anti HCV', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Rapid Card' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Mantoux Test',
    rows: [
      { parameter: 'Induration Size', result: '', unit: 'mm', referenceRange: '0-5' },
      { parameter: 'Result Status', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Reading Time', result: '', unit: 'hr', referenceRange: '48-72' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Pregnancy Test',
    rows: [
      { parameter: 'Urine hCG', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Result Status', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Rapid Card' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Trop-T Test',
    rows: [
      { parameter: 'Troponin T', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
      { parameter: 'Result Status', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Trop-I Test',
    rows: [
      { parameter: 'Troponin I', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
      { parameter: 'Result Status', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Dengue Rapid Test',
    rows: [
      { parameter: 'NS1 Antigen', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'IgG', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'IgM', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Viral Marker',
    rows: [
      { parameter: 'HIV', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'HBsAg', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'HCV', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Anti CCP',
    rows: [
      { parameter: 'Anti CCP Value', result: '', unit: 'U/mL', referenceRange: '0-20' },
      { parameter: 'Result Status', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Vit-D (25-HYDROXY)',
    rows: [
      { parameter: 'Vitamin D Value', result: '', unit: 'ng/mL', referenceRange: '30-100' },
      { parameter: 'Result Status', result: '', unit: '-', referenceRange: 'Normal' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Vit-D (1,25-Di-HYDROXY)',
    rows: [
      { parameter: 'Vitamin D Value', result: '', unit: 'pg/mL', referenceRange: '18-72' },
      { parameter: 'Result Status', result: '', unit: '-', referenceRange: 'Normal' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Vit-B12',
    rows: [
      { parameter: 'Vitamin B12 Value', result: '', unit: 'pg/mL', referenceRange: '200-900' },
      { parameter: 'Result Status', result: '', unit: '-', referenceRange: 'Normal' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Vit-E',
    rows: [
      { parameter: 'Vitamin E Value', result: '', unit: 'mg/L', referenceRange: '5-20' },
      { parameter: 'Result Status', result: '', unit: '-', referenceRange: 'Normal' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'HLA-B27',
    rows: [
      { parameter: 'HLA-B27 Result', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Immunoassay' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Genexpert',
    rows: [
      { parameter: 'MTB Detected', result: '', unit: '-', referenceRange: 'Not Detected' },
      { parameter: 'Rifampicin Resistance', result: '', unit: '-', referenceRange: 'Not Detected' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'PCR' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'D-Dimer',
    rows: [
      { parameter: 'D-Dimer Value', result: '', unit: 'ng/mL', referenceRange: '0-500' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Immunoturbidimetric' },
      { parameter: 'Result Status', result: '', unit: '-', referenceRange: 'Normal' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
];

const CLINICAL_PATHOLOGY_TEST_NAME_SET = new Set(CLINICAL_PATHOLOGY_TESTS.map((t) => normalizeText(t)));

// Parameter templates for Clinical Pathology — only auto-fills parameter/unit/range, result stays blank.

// Ranges/units are placeholders (since backend schema for these lab templates isn't provided in this task).
const CLINICAL_PATHOLOGY_TESTS_TEMPLATES = {
  'CSF R/M': [{ parameter: 'Protein', unit: 'mg/dL', referenceRange: '15-45' }, { parameter: 'Sugar', unit: 'mg/dL', referenceRange: '40-70' }, { parameter: 'RBC Count', unit: 'cells/µL', referenceRange: '0-10' }, { parameter: 'WBC Count', unit: 'cells/µL', referenceRange: '0-5' }],
  'CSF Cytology': [{ parameter: 'Cytology Report', unit: 'text', referenceRange: 'Negative' }],
  'Fluid R/M': [{ parameter: 'Protein', unit: 'mg/dL', referenceRange: '15-45' }, { parameter: 'Sugar', unit: 'mg/dL', referenceRange: '40-70' }, { parameter: 'RBC Count', unit: 'cells/µL', referenceRange: '0-10' }, { parameter: 'WBC Count', unit: 'cells/µL', referenceRange: '0-5' }],
  'Fluid Cytology': [{ parameter: 'Cytology Report', unit: 'text', referenceRange: 'Negative' }],
  'Complete Semen Analysis': [
    { parameter: 'Semen Volume', unit: 'mL', referenceRange: '1.5-5' },
    { parameter: 'Semen pH', unit: 'pH', referenceRange: '7.2-8.0' },
    { parameter: 'Sperm Count', unit: 'million/mL', referenceRange: '>15' },
    { parameter: 'Motility', unit: '%', referenceRange: '>=40' },
    { parameter: 'Morphology', unit: '%', referenceRange: '>=4' },
  ],
  'Semen pH': [{ parameter: 'Semen pH', unit: 'pH', referenceRange: '7.2-8.0' }],
  'Semen Morphology': [{ parameter: 'Morphology', unit: '%', referenceRange: '>=4' }],
  'Semen Fructose': [{ parameter: 'Fructose', unit: 'mg/dL', referenceRange: '20-30' }],
  'Urine R/M': [{ parameter: 'Albumin', unit: 'g/L', referenceRange: 'Negative' }, { parameter: 'Sugar', unit: 'g/L', referenceRange: 'Negative' }, { parameter: 'RBC', unit: 'cells/HPF', referenceRange: '0-2' }, { parameter: 'Pus Cells', unit: 'cells/HPF', referenceRange: '0-5' }],
  'Urine Chyle': [{ parameter: 'Chyle', unit: 'text', referenceRange: 'Negative' }],
  '24 hrs Urine Protein': [{ parameter: 'Total Protein', unit: 'g/24h', referenceRange: '<0.15' }],
  'Urine Microalbumin': [{ parameter: 'Microalbumin', unit: 'mg/L', referenceRange: '<30' }],
  'Urine Sugar': [{ parameter: 'Urine Sugar', unit: 'text', referenceRange: 'Negative' }],
  'Urine Protein': [{ parameter: 'Urine Protein', unit: 'g/L', referenceRange: 'Negative' }],
  'Stool R/M': [{ parameter: 'Stool Appearance', unit: 'text', referenceRange: 'Normal' }],
  'Stool pH': [{ parameter: 'Stool pH', unit: 'pH', referenceRange: '6.0-7.5' }],
  'Stool Occult Blood': [{ parameter: 'Occult Blood', unit: 'text', referenceRange: 'Negative' }],
  'Stool Ova Cyst': [{ parameter: 'Ova/Cyst', unit: 'text', referenceRange: 'Negative' }],
  'ADA (Fluid)': [{ parameter: 'ADA', unit: 'U/L', referenceRange: '<40' }],
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function compactTestKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function catalogTestList(catalogTests) {
  return (Array.isArray(catalogTests) ? catalogTests : []).map((t) => (typeof t === 'string' ? { name: t } : t));
}

function stripQualQuantSuffix(compact) {
  return String(compact || '').replace(/(qualitative|quantitative)$/, '');
}

function findCatalogTestName(name, catalogTests) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const list = catalogTestList(catalogTests);
  const exact = list.find((t) => normalizeText(t?.name) === normalizeText(raw));
  if (exact?.name) return String(exact.name).trim();
  const compact = compactTestKey(raw);
  const fuzzy = list.find((t) => compactTestKey(t?.name) === compact);
  if (fuzzy?.name) return String(fuzzy.name).trim();
  const base = stripQualQuantSuffix(compact);
  if (base) {
    const partial = list.find((t) => stripQualQuantSuffix(compactTestKey(t?.name)) === base);
    if (partial?.name) return String(partial.name).trim();
  }
  return raw;
}

function cloneCatalogRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    parameter: r.parameter || '',
    result: r.result ?? '',
    unit: r.unit || '',
    referenceRange: r.referenceRange || '',
  }));
}

/** Default parameter rows for a catalog test (used when state has no rows yet). */
function getCatalogTestTemplateRows(testName, catalogTests) {
  const list = catalogTestList(catalogTests);
  const canonical = findCatalogTestName(testName, list);
  const hit = list.find((t) => compactTestKey(t?.name) === compactTestKey(canonical));
  if (hit?.rows?.length) return cloneCatalogRows(hit.rows);
  return [{ parameter: canonical || String(testName || '').trim() || 'Result', result: '', unit: '', referenceRange: '' }];
}

/**
 * Full department catalog in dropdown + reception tests not in catalog.
 * (Reception chips still show only advised tests; dropdown stays complete for manual entry.)
 */
function buildDepartmentDropdownTests(catalogTests, advisedNames) {
  const base = catalogTestList(catalogTests);
  const seen = new Set();
  const out = [];
  const add = (test) => {
    const key = compactTestKey(test?.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(test);
  };

  (Array.isArray(advisedNames) ? advisedNames : []).forEach((orderName) => {
    const name = String(orderName || '').trim();
    if (!name) return;
    const canonical = findCatalogTestName(name, catalogTests);
    const hit = base.find((t) => compactTestKey(t.name) === compactTestKey(canonical));
    if (hit) add(hit);
    else add({ name: canonical, rows: getCatalogTestTemplateRows(name, catalogTests) });
  });

  base.forEach(add);
  return out.length ? out : catalogTests;
}

function panelKeysMatch(a, b) {
  const left = compactTestKey(a);
  const right = compactTestKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 3 && right.length >= 3 && (left.includes(right) || right.includes(left))) return true;
  return false;
}

function getPanelRowsByTest(rowsByTest, testName, catalogTests) {
  const map = rowsByTest || {};
  const canonical = findCatalogTestName(testName, catalogTests);
  if (Array.isArray(map[canonical]) && map[canonical].length) return map[canonical];
  const direct = map[String(testName || '').trim()];
  if (Array.isArray(direct) && direct.length) return direct;
  for (const [key, rows] of Object.entries(map)) {
    if (!Array.isArray(rows) || !rows.length) continue;
    if (panelKeysMatch(key, canonical) || panelKeysMatch(key, testName)) return rows;
  }
  return [];
}

/** Rows shown in the table — falls back to catalog template when state is not seeded yet. */
function getEditablePanelRows(rowsByTest, testName, catalogTests) {
  const stored = getPanelRowsByTest(rowsByTest, testName, catalogTests);
  if (stored.length) return stored;
  const canonical = findCatalogTestName(testName, catalogTests);
  return getCatalogTestTemplateRows(canonical || testName, catalogTests);
}

function testsForDepartment(allTests, departmentLabel) {
  const target = normalizeText(departmentLabel);
  return (Array.isArray(allTests) ? allTests : []).filter((test) => {
    const dept = normalizeText(departmentName(test));
    if (target === normalizeText('hepatology & gastroenterology')) {
      return isHepatologyGastroDepartmentName(departmentName(test));
    }
    return dept === target;
  });
}

function collectOrderedPanelResults(orderedItems, catalogTests, rowsByTest, mapRow) {
  const seen = new Set();
  const results = [];
  (Array.isArray(orderedItems) ? orderedItems : []).forEach((item) => {
    const orderName = String(item?.testName || '').trim();
    const filterKey = findCatalogTestName(orderName, catalogTests);
    const dedupeKey = compactTestKey(filterKey);
    if (!dedupeKey || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    let rows = getPanelRowsByTest(rowsByTest, filterKey, catalogTests);
    if (!rows.length) rows = getPanelRowsByTest(rowsByTest, orderName, catalogTests);

    const filledRows = rows.filter((row) => String(row?.result ?? '').trim());
    if (!filledRows.length) return;

    filledRows.forEach((row) => results.push(mapRow({ filterKey, row, item })));
  });
  return results;
}

function filterCatalogToAdvised(catalogTests, advisedNames) {
  const list = catalogTestList(catalogTests);
  if (!list.length || !Array.isArray(advisedNames) || !advisedNames.length) return catalogTests;
  const seen = new Set();
  const matched = [];
  advisedNames.forEach((orderName) => {
    const catalogName = findCatalogTestName(orderName, list);
    const key = compactTestKey(catalogName);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const item = list.find((t) => compactTestKey(t?.name) === key);
    if (item) matched.push(item);
  });
  return matched.length ? matched : catalogTests;
}

function getDepartmentCatalog(department) {
  const d = normalizeText(department);
  if (d === 'hematology') return HEMATOLOGY_TESTS;
  if (d === 'biochemistry') return BIOCHEMISTRY_TESTS;
  if (d === 'microbiology') return MICROBIOLOGY_TESTS;
  if (d === 'serology') return SEROLOGY_TESTS;
  if (d === 'clinical pathology') return CLINICAL_PATHOLOGY_TESTS.map((name) => ({ name }));
  if (d === 'tumor marker') return TUMOR_MARKER_TESTS;
  if (d === 'autoimmune & collagen markers') return AUTOIMMUNE_COLLAGEN_MARKERS_TESTS;
  if (d === 'orthopedics / arthritis / collagen profile panel') return ORTHOPEDICS_PANEL_TESTS.map((name) => ({ name }));
  if (d === 'infectious disease markers') return INFECTIOUS_DISEASE_MARKERS_TESTS;
  if (d === 'hepatology & gastroenterology' || d === 'gastroenterology' || d === 'hepatology') return HEPATLOGY_GASTROENTEROLOGY_TESTS;
  if (d === 'hormone profile') return HORMONE_PROFILE_TESTS;
  return [];
}

const ALL_DEPARTMENTS = [
  'Hematology',
  'Biochemistry',
  'Microbiology',
  'Serology',
  'Clinical Pathology',
  'Hormone Profile',
  'Tumor Marker',
  'Orthopedics / Arthritis / Collagen Profile Panel',
  'AUTOIMMUNE & COLLAGEN MARKERS',
  'Infectious Disease Markers',
  'Hepatology & Gastroenterology',
];

function isSameTestName(a, b) {
  return compactTestKey(a) === compactTestKey(b);
}

function microbiologyKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function displayValue(value) {
  return String(value ?? '').trim() || '-';
}

function formatDateTime(dt) {
  if (!dt) return '-';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatAgeGender(patient) {
  const age = patient?.age === 0 || patient?.age ? `${patient.age}Y` : '';
  const gender = String(patient?.gender || '').trim();
  return [age, gender].filter(Boolean).join(' / ') || '-';
}

function formatStatus(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  return raw
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isCbcName(name) {
  const text = normalizeText(name);
  return text === 'cbc' || text.includes('cbc') || text.includes('complete blood count');
}

function resultKey(name) {
  return normalizeText(name).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

const ORTHOPEDICS_PANEL_TESTS = [
  'PRP (Platelet Rich Plasma)',
  'HLA-B27 (RT-PCR)',
  'Alkaline Phosphatase',
  'Anti CCP2Ab',
  'Anti RNP',
  'Anti-B2 Glycoprotein Antibodies',
  'Anti-Centromere Antibody',
  'Anti-DS-DNA Antibody',
  'Anti-Histones Antibody',
  'Antinuclear Antibody (ANF)',
  'Anti-Sm',
  'Anti-SSA (Ro)',
  'Anti-SSB (La)',
  'ASO Titre',
  'C.ANCA (MPO ANCA)',
  'P.ANCA (PR3 ANCA)',
  'C3',
  'C4',
  'Calcium',
  'Cardiolipin IgA',
  'Cardiolipin IgG',
  'Cardiolipin IgM',
  'CBC',
  'CRP',
  'ESR',
  'Arthritis Profile',
  'Ionized Calcium',
  'iPTH',
  'Jo-1 Antibodies',
  'AFB C/S Cold Abscess',
  'Pus C/S',
  'RA Factor',
  'SCL-70',
  'Synovial Fluid RM',
  'Uric Acid',
  'Urinary Albumin / Creatinine Ratio',
  'Vitamin D (25-HYDROXY)',
  'Phosphorus',
];

const INFECTIOUS_DISEASE_MARKERS_TESTS = [
  {
    name: 'Hepatitis A IgM',
    rows: [{ parameter: 'Hepatitis A IgM', result: '', unit: 'Index', referenceRange: 'Negative <1' }],
  },
  {
    name: 'Hepatitis A IgG',
    rows: [{ parameter: 'Hepatitis A IgG', result: '', unit: 'Index', referenceRange: 'Negative <1' }],
  },
  {
    name: 'HBV DNA Viral Load',
    rows: [{ parameter: 'HBV DNA', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' }],
  },
  {
    name: 'HBsAg Quantitative',
    rows: [{ parameter: 'HBsAg', result: '', unit: 'IU/mL', referenceRange: 'Non Reactive' }],
  },
  {
    name: 'Anti HBc IgM',
    rows: [{ parameter: 'Anti HBc IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti HBc IgG',
    rows: [{ parameter: 'Anti HBc IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'HBeAg',
    rows: [{ parameter: 'HBeAg', result: '', unit: 'Index', referenceRange: 'Non Reactive' }],
  },
  {
    name: 'Anti HBe',
    rows: [{ parameter: 'Anti HBe', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'HCV Viral Load',
    rows: [{ parameter: 'HCV RNA', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' }],
  },
  {
    name: 'HCV Genotype',
    rows: [{ parameter: 'HCV Genotype', result: '', unit: '-', referenceRange: 'As per report' }],
  },

  // Batch 2 (11–20)
  {
    name: 'HCV IgG',
    rows: [{ parameter: 'HCV IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Hepatitis D (Anti HDV IgM)',
    rows: [{ parameter: 'Anti HDV IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },

  {
    name: 'HEV IgM',
    rows: [{ parameter: 'HEV IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'HEV IgG',
    rows: [{ parameter: 'HEV IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'EBV IgM',
    rows: [{ parameter: 'EBV IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'EBV IgG',
    rows: [{ parameter: 'EBV IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'EBV Viral Load',
    rows: [
      { parameter: 'EBV DNA Viral Load', result: '', unit: 'copies/mL', referenceRange: 'Not Detected' },
      { parameter: 'EBV DNA Viral Load', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' },
      { parameter: 'EBV DNA (Log Value)', result: '', unit: 'log10 IU/mL', referenceRange: 'Not Detected' },
    ],
  },
  {
    name: 'CMV IgM',
    rows: [{ parameter: 'CMV IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'CMV IgG',
    rows: [{ parameter: 'CMV IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'CMV Viral Load',
    rows: [
      { parameter: 'CMV DNA Viral Load', result: '', unit: 'copies/mL', referenceRange: 'Not Detected' },
      { parameter: 'CMV DNA Viral Load', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' },
      { parameter: 'CMV DNA (Log Value)', result: '', unit: 'log10 IU/mL', referenceRange: 'Not Detected' },
    ],
  },

  // Next batch (21–30)
  {
    name: 'HSV IgM',
    rows: [{ parameter: 'HSV IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'HSV IgG',
    rows: [{ parameter: 'HSV IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'HSV Viral Load',
    rows: [
      { parameter: 'HSV DNA Viral Load', result: '', unit: 'copies/mL', referenceRange: 'Not Detected' },
      { parameter: 'HSV DNA Viral Load', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' },
      { parameter: 'HSV DNA (Log Value)', result: '', unit: 'log10 IU/mL', referenceRange: 'Not Detected' },
    ],
  },
  {
    name: 'Mumps IgM',
    rows: [{ parameter: 'Mumps IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Mumps IgG',
    rows: [{ parameter: 'Mumps IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Measles IgM',
    rows: [{ parameter: 'Measles IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Measles IgG',
    rows: [{ parameter: 'Measles IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Rubella IgM',
    rows: [{ parameter: 'Rubella IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Rubella IgG',
    rows: [{ parameter: 'Rubella IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Varicella IgM',
    rows: [{ parameter: 'Varicella IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },

  // Batch 3 (31–40)
  {
    name: 'Varicella IgG',
    rows: [{ parameter: 'Varicella IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Dengue NS1 IgM IgG',
    rows: [
      { parameter: 'Dengue NS1', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'Dengue IgM', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'Dengue IgG', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },

  {
    name: 'Dengue RNA Viral Load',
    rows: [
      { parameter: 'Dengue RNA Viral Load', result: '', unit: 'copies/mL', referenceRange: 'Not Detected' },
      { parameter: 'Dengue RNA Viral Load', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' },
      { parameter: 'Dengue RNA (Log Value)', result: '', unit: 'log10 IU/mL', referenceRange: 'Not Detected' },
    ],
  },

  {
    name: 'Chikungunya IgM',
    rows: [{ parameter: 'Chikungunya IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Chikungunya RNA Viral Load',
    rows: [
      { parameter: 'Chikungunya RNA Viral Load', result: '', unit: 'copies/mL', referenceRange: 'Not Detected' },
      { parameter: 'Chikungunya RNA Viral Load', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' },
      { parameter: 'Chikungunya RNA (Log Value)', result: '', unit: 'log10 IU/mL', referenceRange: 'Not Detected' },
    ],
  },
  {
    name: 'Adenovirus IgM',
    rows: [{ parameter: 'Adenovirus IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Adenovirus IgG',
    rows: [{ parameter: 'Adenovirus IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Influenza H1N1 IgM',
    rows: [{ parameter: 'Influenza H1N1 IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Influenza H1N1 IgG',
    rows: [{ parameter: 'Influenza H1N1 IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Parvo Virus IgM',
    rows: [{ parameter: 'Parvo Virus IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },

  // Batch 4 (41–50)
  {
    name: 'Parvo Virus IgG',
    rows: [{ parameter: 'Parvo Virus IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'HIV Quantitative',
    rows: [
      { parameter: 'HIV Quantitative', result: '', unit: 'copies/mL', referenceRange: 'Not Detected' },
      { parameter: 'HIV Quantitative', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' },
      { parameter: 'HIV (Log Value)', result: '', unit: 'log10 IU/mL', referenceRange: 'Not Detected' },
    ],
  },
  {
    name: 'HIV Western Blot',
    rows: [{ parameter: 'HIV Western Blot', result: '', unit: '-', referenceRange: 'Non Reactive' }],
  },
  {
    name: 'HIV RNA Viral Load',
    rows: [
      { parameter: 'HIV RNA Viral Load', result: '', unit: 'copies/mL', referenceRange: 'Not Detected' },
      { parameter: 'HIV RNA Viral Load', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' },
      { parameter: 'HIV RNA (Log Value)', result: '', unit: 'log10 IU/mL', referenceRange: 'Not Detected' },
    ],
  },
  {
    name: 'HPV DNA Viral Load',
    rows: [
      { parameter: 'HPV DNA Viral Load', result: '', unit: 'copies/mL', referenceRange: 'Not Detected' },
      { parameter: 'HPV DNA Viral Load', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' },
      { parameter: 'HPV DNA (Log Value)', result: '', unit: 'log10 IU/mL', referenceRange: 'Not Detected' },
    ],
  },
  {
    name: 'Japanese Encephalitis RNA Viral Load',
    rows: [
      { parameter: 'Japanese Encephalitis RNA Viral Load', result: '', unit: 'copies/mL', referenceRange: 'Not Detected' },
      { parameter: 'Japanese Encephalitis RNA Viral Load', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' },
      { parameter: 'Japanese Encephalitis RNA (Log Value)', result: '', unit: 'log10 IU/mL', referenceRange: 'Not Detected' },
    ],
  },
  {
    name: 'Leptospira IgM',
    rows: [{ parameter: 'Leptospira IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Leptospira IgG',
    rows: [{ parameter: 'Leptospira IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Entamoeba Histolytica IgG',
    rows: [{ parameter: 'Entamoeba Histolytica IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Plasmodium Vivax/Ovale/Falciparum PCR',
    rows: [
      { parameter: 'Plasmodium PCR', result: '', unit: 'copies/mL', referenceRange: 'Not Detected' },
      { parameter: 'Plasmodium PCR', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' },
      { parameter: 'Plasmodium PCR (Log Value)', result: '', unit: 'log10 IU/mL', referenceRange: 'Not Detected' },
    ],
  },

  // Batch 5 (51–57)
  {
    name: 'Parasitic IgG (HRP-2 p.LDH)',
    rows: [
      { parameter: 'Parasitic IgG HRP-2', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'Parasitic IgG p.LDH', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'Parasitic IgG Final', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'Filaria IgM/IgG',
    rows: [
      { parameter: 'Filaria IgM', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'Filaria IgG', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'Filaria (Provocation test 30 minutes after DEC)',
    rows: [{ parameter: 'Filaria Provocation Test', result: '', unit: '-', referenceRange: 'Negative' }],
  },
  {
    name: 'Kalazar (Leishmaniasis) K39',
    rows: [{ parameter: 'Kalazar K39', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Cysticercosis IgG',
    rows: [{ parameter: 'Cysticercosis IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Toxoplasma Gold IgM & IgG',
    rows: [
      { parameter: 'Toxoplasma IgM', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'Toxoplasma IgG', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'Echinococcus IgG',
    rows: [{ parameter: 'Echinococcus IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },

];






const INFECTIOUS_DISEASE_MARKERS_BY_TEST_NAME = Object.fromEntries(
  INFECTIOUS_DISEASE_MARKERS_TESTS.map((t) => [t.name, t.rows]),
);

// Tumor Marker (dropdown + single-row table per selected test)
const TUMOR_MARKER_TESTS = [
  {
    name: 'Alpha-Fetoprotein (AFP)',
    rows: [{ parameter: 'AFP', result: '', unit: 'ng/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'Beta-2 Macroglobulin',
    rows: [{ parameter: 'Beta-2 Macroglobulin', result: '', unit: 'mg/L', referenceRange: 'Normal' }],
  },
  {
    name: 'BR-15-3 (Mucinous Adenocarcinoma Breast)',
    rows: [{ parameter: 'BR-15-3', result: '', unit: 'U/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'CA-125 (Epithelial Ovarian Cancer)',
    rows: [{ parameter: 'CA-125', result: '', unit: 'U/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'CA-19-9 (Pancreatic Cancer)',
    rows: [{ parameter: 'CA-19-9', result: '', unit: 'U/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'CA-242 (Colo-Rectal Cancer)',
    rows: [{ parameter: 'CA-242', result: '', unit: 'U/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'Calcitonin',
    rows: [{ parameter: 'Calcitonin', result: '', unit: 'pg/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'Carcinoembryonic Antigen (CEA)',
    rows: [{ parameter: 'CEA', result: '', unit: 'ng/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'Ferritin',
    rows: [{ parameter: 'Ferritin', result: '', unit: 'ng/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'Free Human Chorionic Gonadotropin (Free-BhCG)',
    rows: [{ parameter: 'Free-BhCG', result: '', unit: 'mIU/mL', referenceRange: 'Normal' }],
  },

  // 11–21 Tumor Marker batch additions
  {
    name: 'Free PSA + Total PSA',
    rows: [
      { parameter: 'Free PSA', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
      { parameter: 'Total PSA', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
    ],
  },
  {
    name: 'Beta hCG (Human Chorionic Gonadotropin)',
    rows: [{ parameter: 'Beta hCG', result: '', unit: 'mIU/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'Prostate Specific Antigen (Total PSA)',
    rows: [{ parameter: 'Total PSA', result: '', unit: 'ng/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'VMA',
    rows: [{ parameter: 'VMA', result: '', unit: 'mg/24hr', referenceRange: 'Normal' }],
  },
  {
    name: 'Thyroglobulin',
    rows: [{ parameter: 'Thyroglobulin', result: '', unit: 'ng/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'Inhibin B',
    rows: [{ parameter: 'Inhibin B', result: '', unit: 'pg/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'Inhibin A',
    rows: [{ parameter: 'Inhibin A', result: '', unit: 'pg/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'Estrogen',
    rows: [{ parameter: 'Estrogen', result: '', unit: 'ng/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'Progesterone',
    rows: [{ parameter: 'Progesterone', result: '', unit: 'ng/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'Jak-2',
    rows: [{ parameter: 'JAK-2 Mutation', result: '', unit: '-', referenceRange: 'Negative' }],
  },
  {
    name: 'LDH',
    rows: [{ parameter: 'LDH', result: '', unit: 'U/L', referenceRange: 'Normal' }],
  },
];


function makeTumorMarkerRows(existingResults = []) {
  const savedByTestName = new Map(existingResults.map((r) => [normalizeText(r.testName), r]));
  return Object.fromEntries(
    TUMOR_MARKER_TESTS.map((test) => {
      const saved = savedByTestName.get(normalizeText(test.name));
      return [
        test.name,
        (test.rows || []).map((row) => ({
          ...row,
          result: saved?.value || row.result,
          unit: saved?.unit || row.unit,
          referenceRange: saved?.referenceRange || row.referenceRange,
        })),
      ];
    }),
  );
}

// Autoimmune & Collagen Markers
const AUTOIMMUNE_COLLAGEN_MARKERS_TESTS = [
  {
    name: 'Anti RNP',
    rows: [
      { parameter: 'Anti RNP IgG', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'Anti RNP IgM', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'Anti-B2 Glycoprotein Antibodies',
    rows: [
      { parameter: 'B2 Glycoprotein IgG', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'B2 Glycoprotein IgM', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'Anti-Centromere Antibodies',
    rows: [{ parameter: 'Anti-Centromere Antibody', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti-ds-DNA Antibody',
    rows: [{ parameter: 'Anti-ds-DNA', result: '', unit: 'IU/mL', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti-GAD Antibodies',
    rows: [{ parameter: 'Anti-GAD Antibody', result: '', unit: 'IU/mL', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti-GBM Antibodies',
    rows: [{ parameter: 'Anti-GBM Antibody', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti-Gliadin Antibodies',
    rows: [
      { parameter: 'Gliadin IgA', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'Gliadin IgG', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'Anti-Histones Antibody',
    rows: [{ parameter: 'Anti-Histones Antibody', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti-Mitochondrial Antibodies (M2)',
    rows: [{ parameter: 'AMA M2', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Antinuclear Antibody (ANF)',
    rows: [
      { parameter: 'ANF Pattern', result: '', unit: '-', referenceRange: 'Negative' },
      { parameter: 'ANF Titre', result: '', unit: '-', referenceRange: 'Negative' },
    ],
  },

  // Batch 11–20 (Autoimmune & Collagen Markers)
  {
    name: 'Anti-Parietal cell Antibodies',
    rows: [{ parameter: 'Anti-Parietal Cell Antibody', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti-Phospholipid Antibodies IgG',
    rows: [{ parameter: 'Anti-Phospholipid IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti-Phospholipid Antibodies IgM',
    rows: [{ parameter: 'Anti-Phospholipid IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti-Sm',
    rows: [{ parameter: 'Anti-Sm Antibody', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti-SSA (Ro)',
    rows: [
      { parameter: 'SSA (Ro) IgG', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'SSA (Ro) IgM', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'Anti-SSb (La)',
    rows: [
      { parameter: 'SSB (La) IgG', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'SSB (La) IgM', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'Anti-Tissue Transglutaminase Antibody',
    rows: [
      { parameter: 'tTG IgA', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'tTG IgG', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'ASA Antibody (Anti-sperm antibody)',
    rows: [
      { parameter: 'ASA IgG', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'ASA IgM', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'ASO Titre',
    rows: [{ parameter: 'ASO Titre', result: '', unit: 'IU/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'C.ANCA (MPO ANCA)',
    rows: [
      { parameter: 'C-ANCA', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'MPO ANCA', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },

  // Batch 21–28 (Autoimmune & Collagen Markers)
  {
    name: 'Cardiolipin IgA',
    rows: [{ parameter: 'Cardiolipin IgA', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Cardiolipin IgM',
    rows: [{ parameter: 'Cardiolipin IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'CRP',
    rows: [{ parameter: 'CRP', result: '', unit: 'mg/L', referenceRange: 'Normal' }],
  },
  {
    name: 'Jo-1 Antibodies',
    rows: [{ parameter: 'Jo-1 Antibody', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'LKM-1 Antibodies',
    rows: [{ parameter: 'LKM-1 Antibody', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'P.ANCA (PR3 ANCA)',
    rows: [
      { parameter: 'P-ANCA', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'PR3 ANCA', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'RA Factor',
    rows: [{ parameter: 'RA Factor', result: '', unit: 'IU/mL', referenceRange: 'Normal' }],
  },
  {
    name: 'SCL-70',
    rows: [{ parameter: 'SCL-70 Antibody', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
];

const HEPATLOGY_GASTROENTEROLOGY_TESTS = [
  {
    name: 'Anti ASCA IgM & IgG',
    rows: [
      { parameter: 'Anti ASCA IgM', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'Anti ASCA IgG', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'Anti Gliadin Antibodies IgG & IgA',
    rows: [
      { parameter: 'Anti Gliadin IgG', result: '', unit: 'Index', referenceRange: 'Negative' },
      { parameter: 'Anti Gliadin IgA', result: '', unit: 'Index', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'Anti HBc IgG (Hep-B)',
    rows: [{ parameter: 'Anti HBc IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti HBe IgM (Hep-B)',
    rows: [{ parameter: 'Anti HBe IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti HBe (Hep-B)',
    rows: [{ parameter: 'Anti HBe', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti HCV IgG',
    rows: [{ parameter: 'Anti HCV IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti HCV IgG (Hep-E)',
    rows: [{ parameter: 'Anti HCV IgG (Hep-E)', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti HEV IgM (Hep-E)',
    rows: [{ parameter: 'Anti HEV IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti Mitochondrial Antibodies (M2)',
    rows: [{ parameter: 'AMA M2', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti Tissue Transglutaminase Antibody IgA',
    rows: [{ parameter: 'tTG IgA', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },

  // Batch 11–20 (Gastroenterology)
  {
    name: 'Anti-HAV IgG (Hep-A)',
    rows: [{ parameter: 'Anti-HAV IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti-HAV IgM (Hep-A)',
    rows: [{ parameter: 'Anti-HAV IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Ceruloplasmin',
    rows: [{ parameter: 'Ceruloplasmin', result: '', unit: 'mg/dL', referenceRange: 'Normal' }],
  },
  {
    name: 'CMV IgM',
    rows: [{ parameter: 'CMV IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'CMV IgG',
    rows: [{ parameter: 'CMV IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'EBV IgG',
    rows: [{ parameter: 'EBV IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'EBV IgM',
    rows: [{ parameter: 'EBV IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Entamoeba Histolytica IgG',
    rows: [{ parameter: 'Entamoeba Histolytica IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'HBV DNA (Quant. RT-PCR)',
    rows: [
      { parameter: 'HBV DNA Viral Load', result: '', unit: 'copies/mL', referenceRange: 'Not Detected' },
      { parameter: 'HBV DNA Viral Load', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' },
      { parameter: 'HBV DNA Log Value', result: '', unit: 'log10 IU/mL', referenceRange: 'Not Detected' },
    ],
  },
  {
    name: 'HCV RNA (Quant.)',
    rows: [
      { parameter: 'HCV RNA Viral Load', result: '', unit: 'copies/mL', referenceRange: 'Not Detected' },
      { parameter: 'HCV RNA Viral Load', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' },
      { parameter: 'HCV RNA Log Value', result: '', unit: 'log10 IU/mL', referenceRange: 'Not Detected' },
    ],
  },

  // Batch 21–25 (Gastroenterology)
  {
    name: 'HAD Ag (Hep-D)',
    rows: [{ parameter: 'HAD Ag', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Leptospira IgG',
    rows: [{ parameter: 'Leptospira IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Leptospira IgM',
    rows: [{ parameter: 'Leptospira IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'LKM-1 Antibodies',
    rows: [{ parameter: 'LKM-1 Antibodies', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Serum & Urinary Copper',
    rows: [
      { parameter: 'Serum Copper', result: '', unit: 'ug/dL', referenceRange: 'Normal' },
      { parameter: 'Urinary Copper', result: '', unit: 'ug/24hr', referenceRange: 'Normal' },
    ],
  },

  // Batch 11–20 (Gastroenterology)
  {
    name: 'Anti-HAV IgG (Hep-A)',
    rows: [{ parameter: 'Anti-HAV IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Anti-HAV IgM (Hep-A)',
    rows: [{ parameter: 'Anti-HAV IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Ceruloplasmin',
    rows: [{ parameter: 'Ceruloplasmin', result: '', unit: 'mg/dL', referenceRange: 'Normal' }],
  },
  {
    name: 'CMV IgM',
    rows: [{ parameter: 'CMV IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'CMV IgG',
    rows: [{ parameter: 'CMV IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'EBV IgG',
    rows: [{ parameter: 'EBV IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'EBV IgM',
    rows: [{ parameter: 'EBV IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Entamoeba Histolytica IgG',
    rows: [{ parameter: 'Entamoeba Histolytica IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'HBV DNA (Quant. RT-PCR)',
    rows: [
      { parameter: 'HBV DNA Viral Load', result: '', unit: 'copies/mL', referenceRange: 'Not Detected' },
      { parameter: 'HBV DNA Viral Load', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' },
      { parameter: 'HBV DNA Log Value', result: '', unit: 'log10 IU/mL', referenceRange: 'Not Detected' },
    ],
  },
  {
    name: 'HCV RNA (Quant.)',
    rows: [
      { parameter: 'HCV RNA Viral Load', result: '', unit: 'copies/mL', referenceRange: 'Not Detected' },
      { parameter: 'HCV RNA Viral Load', result: '', unit: 'IU/mL', referenceRange: 'Not Detected' },
      { parameter: 'HCV RNA Log Value', result: '', unit: 'log10 IU/mL', referenceRange: 'Not Detected' },
    ],
  },

  // Batch 21–25 (Gastroenterology)
  {
    name: 'HAD Ag (Hep-D)',
    rows: [{ parameter: 'HAD Ag', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Leptospira IgG',
    rows: [{ parameter: 'Leptospira IgG', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Leptospira IgM',
    rows: [{ parameter: 'Leptospira IgM', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'LKM-1 Antibodies',
    rows: [{ parameter: 'LKM-1 Antibodies', result: '', unit: 'Index', referenceRange: 'Negative' }],
  },
  {
    name: 'Serum & Urinary Copper',
    rows: [
      { parameter: 'Serum Copper', result: '', unit: 'ug/dL', referenceRange: 'Normal' },
      { parameter: 'Urinary Copper', result: '', unit: 'ug/24hr', referenceRange: 'Normal' },
    ],
  },
];

function isHepatologyGastroDepartmentName(dept) {
  const d = normalizeText(dept);
  return d === 'hepatology & gastroenterology' || d === 'gastroenterology' || d === 'hepatology';
}


function findHepatologyGastroTemplate(testName) {
  const key = normalizeText(testName);
  const exact = HEPATLOGY_GASTROENTEROLOGY_TESTS.find((t) => normalizeText(t.name) === key);
  if (exact) return exact;
  if (key.includes('asca')) return HEPATLOGY_GASTROENTEROLOGY_TESTS.find((t) => normalizeText(t.name).includes('asca'));
  if (key.includes('gliadin')) return HEPATLOGY_GASTROENTEROLOGY_TESTS.find((t) => normalizeText(t.name).includes('gliadin'));
  if (key.includes('hbc') || key.includes('hep-b') || key.includes('hep b')) {
    return HEPATLOGY_GASTROENTEROLOGY_TESTS.find((t) => normalizeText(t.name).includes('hbc'));
  }
  if (key.includes('hbe')) return HEPATLOGY_GASTROENTEROLOGY_TESTS.find((t) => normalizeText(t.name).includes('hbe'));
  if (key.includes('hcv')) return HEPATLOGY_GASTROENTEROLOGY_TESTS.find((t) => normalizeText(t.name).includes('hcv'));
  if (key.includes('hev')) return HEPATLOGY_GASTROENTEROLOGY_TESTS.find((t) => normalizeText(t.name).includes('hev'));
  if (key.includes('mitochondrial') || key.includes('ama')) {
    return HEPATLOGY_GASTROENTEROLOGY_TESTS.find((t) => normalizeText(t.name).includes('mitochondrial'));
  }
  if (key.includes('transglutaminase') || key.includes('ttg')) {
    return HEPATLOGY_GASTROENTEROLOGY_TESTS.find((t) => normalizeText(t.name).includes('transglutaminase'));
  }
  return null;
}

function rowsForHepatologyGastroTest(testName, existingResults = []) {
  const template = findHepatologyGastroTemplate(testName);
  const templateRows = template?.rows || [{ parameter: testName, result: '', unit: 'Index', referenceRange: 'Negative' }];
  const savedTestNames = new Set([normalizeText(testName), normalizeText(template?.name)].filter(Boolean));

  return templateRows.map((row) => {
    const savedRow = existingResults.find(
      (sr) =>
        savedTestNames.has(normalizeText(sr.testName)) &&
        normalizeText(sr.parameter || sr.name) === normalizeText(row.parameter),
    );
    return {
      ...row,
      result: savedRow?.value || savedRow?.result || '',
    };
  });
}

function makeHepatologyGastroRows(existingResults = [], orderTests = []) {
  const rowsByTest = {};
  HEPATLOGY_GASTROENTEROLOGY_TESTS.forEach((test) => {
    const name = String(test.name || '').trim();
    if (!name) return;
    rowsByTest[name] = rowsForHepatologyGastroTest(name, existingResults);
  });

  orderTests.forEach((item) => {
    const name = String(item?.testName || '').trim();
    if (!name) return;
    if (isHepatologyGastroDepartmentName(departmentName(item))) {
      rowsByTest[name] = rowsForHepatologyGastroTest(name, existingResults);
    }
  });

  return rowsByTest;
}

function getHepatologyGastroRowsForFilter(rowsByTest, filter) {
  const key = String(filter || '').trim();
  if (!key) return [];
  if (Array.isArray(rowsByTest[key]) && rowsByTest[key].length) return rowsByTest[key];
  const catalogHit = HEPATLOGY_GASTROENTEROLOGY_TESTS.find((t) => normalizeText(t.name) === normalizeText(key));
  if (catalogHit) {
    const catalogKey = String(catalogHit.name || '').trim();
    if (Array.isArray(rowsByTest[catalogKey]) && rowsByTest[catalogKey].length) return rowsByTest[catalogKey];
  }
  return rowsForHepatologyGastroTest(key);
}

function makeInfectiousDiseaseRows(existingResults = []) {
  return Object.fromEntries(
    INFECTIOUS_DISEASE_MARKERS_TESTS.map((t) => [
      t.name,
      (t.rows || []).map((row) => {
        const savedRow = existingResults.find(
          (sr) => normalizeText(sr.testName) === normalizeText(t.name) && normalizeText(sr.parameter || sr.name) === normalizeText(row.parameter),
        );
        return {
          ...row,
          result: savedRow?.value || savedRow?.result || '',
        };
      }),
    ]),
  );
}

const ORTHOPEDICS_PANEL_TESTS_TEMPLATES = {
  'PRP (Platelet Rich Plasma)': [
    { parameter: 'Platelet Count', result: '', unit: '/uL', referenceRange: 'Normal' },
    { parameter: 'PRP Volume', result: '', unit: 'mL', referenceRange: 'Normal' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'HLA-B27 (RT-PCR)': [
    { parameter: 'HLA-B27', result: '', unit: '-', referenceRange: 'Positive/Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'RT-PCR' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],

  // Added Orthopedics dropdown missing tests (kept UI same; no duplicates)
  'RA Factor': [
    { parameter: 'RA Factor', result: '', unit: '-', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'Latex Agglutination' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'SCL-70': [
    { parameter: 'Scl-70', result: '', unit: '-', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Synovial Fluid RM': [
    { parameter: 'Synovial Fluid R/M', result: '', unit: '-', referenceRange: 'Normal' },
    { parameter: 'WBC Count', result: '', unit: 'cells/µL', referenceRange: '0-200' },
    { parameter: 'RBC Count', result: '', unit: 'cells/µL', referenceRange: '0-1000' },
    { parameter: 'Crystals', result: '', unit: '-', referenceRange: 'Absent' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Uric Acid': [
    { parameter: 'Uric Acid', result: '', unit: 'mg/dL', referenceRange: '3.5-7.2' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'Colorimetric' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Urinary Albumin / Creatinine Ratio': [
    { parameter: 'Urinary Albumin', result: '', unit: 'mg/L', referenceRange: 'Negative' },
    { parameter: 'Urinary Creatinine', result: '', unit: 'mg/dL', referenceRange: 'Normal' },
    { parameter: 'Albumin/Creatinine Ratio', result: '', unit: 'mg/g', referenceRange: '<30' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Vitamin D (25-HYDROXY)': [
    { parameter: 'Vitamin D Value', result: '', unit: 'ng/mL', referenceRange: '30-100' },
    { parameter: 'Result Status', result: '', unit: '-', referenceRange: 'Normal' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Phosphorus': [
    { parameter: 'Phosphorus', result: '', unit: 'mg/dL', referenceRange: '2.5-4.5' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'Colorimetric' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Alkaline Phosphatase': [
    { parameter: 'ALP', result: '', unit: 'U/L', referenceRange: '44-147' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Anti CCP2Ab': [
    { parameter: 'Anti CCP2Ab', result: '', unit: 'U/mL', referenceRange: '<20' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Anti RNP': [
    { parameter: 'Anti RNP', result: '', unit: 'U/mL', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Anti-B2 Glycoprotein Antibodies': [
    { parameter: 'Anti-B2 Glycoprotein', result: '', unit: 'U/mL', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Anti-Centromere Antibody': [
    { parameter: 'Anti-Centromere', result: '', unit: 'U/mL', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Anti-DS-DNA Antibody': [
    { parameter: 'Anti-DS-DNA', result: '', unit: 'IU/mL', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Anti-Histones Antibody': [
    { parameter: 'Anti-Histones', result: '', unit: 'U/mL', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Antinuclear Antibody (ANF)': [
    { parameter: 'ANA Titre', result: '', unit: '-', referenceRange: 'Negative' },
    { parameter: 'Pattern', result: '', unit: '-', referenceRange: '-' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],

  'Anti-Sm': [
    { parameter: 'Anti-Sm', result: '', unit: 'U/mL', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Anti-SSA (Ro)': [
    { parameter: 'Anti-SSA', result: '', unit: 'U/mL', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Anti-SSB (La)': [
    { parameter: 'Anti-SSB', result: '', unit: 'U/mL', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'ASO Titre': [
    { parameter: 'ASO Value', result: '', unit: 'IU/mL', referenceRange: '<200' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'Latex' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'C.ANCA (MPO ANCA)': [
    { parameter: 'C.ANCA', result: '', unit: 'U/mL', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'P.ANCA (PR3 ANCA)': [
    { parameter: 'P.ANCA', result: '', unit: 'U/mL', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'C3': [
    { parameter: 'C3 Value', result: '', unit: 'mg/dL', referenceRange: '90-180' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'Immunoassay' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'C4': [
    { parameter: 'C4 Value', result: '', unit: 'mg/dL', referenceRange: '10-40' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'Immunoassay' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Calcium': [
    { parameter: 'Calcium', result: '', unit: 'mg/dL', referenceRange: '8.5-10.5' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Cardiolipin IgA': [
    { parameter: 'Cardiolipin IgA', result: '', unit: 'GPL/MPL', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],

  'Cardiolipin IgG': [
    { parameter: 'Cardiolipin IgG', result: '', unit: 'GPL/MPL', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Cardiolipin IgM': [
    { parameter: 'Cardiolipin IgM', result: '', unit: 'MPL', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  CBC: [
    { parameter: 'Hemoglobin', result: '', unit: 'g/dL', referenceRange: 'Normal' },
    { parameter: 'TLC', result: '', unit: '/cumm', referenceRange: 'Normal' },
    { parameter: 'Platelet Count', result: '', unit: '/uL', referenceRange: 'Normal' },
  ],
  CRP: [
    { parameter: 'CRP Value', result: '', unit: 'mg/L', referenceRange: '<6' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'Latex' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  ESR: [
    { parameter: 'ESR', result: '', unit: 'mm/hr', referenceRange: 'Normal' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'Westergren' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Arthritis Profile': [
    { parameter: 'CRP', result: '', unit: 'mg/L', referenceRange: 'Normal' },
    { parameter: 'ESR', result: '', unit: 'mm/hr', referenceRange: 'Normal' },
    { parameter: 'CRP/ESR Ratio', result: '', unit: 'Ratio', referenceRange: 'Normal' },
    { parameter: 'Inflammation Index', result: '', unit: 'Score', referenceRange: 'Normal' },
  ],
  'Ionized Calcium': [
    { parameter: 'Ionized Calcium', result: '', unit: 'mmol/L', referenceRange: '1.1-1.3' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  iPTH: [
    { parameter: 'iPTH', result: '', unit: 'pg/mL', referenceRange: '15-65' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Jo-1 Antibodies': [
    { parameter: 'Jo-1 Antibodies', result: '', unit: 'U/mL', referenceRange: 'Negative' },
    { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'AFB C/S Cold Abscess': [
    { parameter: 'Organism', result: '', unit: '-', referenceRange: 'Nil' },
    { parameter: 'Growth', result: '', unit: '-', referenceRange: 'Nil' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
  'Pus C/S': [
    { parameter: 'Organism', result: '', unit: '-', referenceRange: 'Nil' },
    { parameter: 'Pus Cells', result: '', unit: '/HPF', referenceRange: 'Nil' },
    { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
  ],
};

function makeAutoimmuneCollagenRows(existingResults = []) {
  const byName = new Map(existingResults.map((result) => [normalizeText(result.testName || result.parameter || result.name), result]));

  return Object.fromEntries(
    AUTOIMMUNE_COLLAGEN_MARKERS_TESTS.map((test) => [
      test.name,
      (test.rows || []).map((row) => {
        const saved = existingResults.find(
          (r) => normalizeText(r.testName) === normalizeText(test.name) && normalizeText(r.parameter || r.name) === normalizeText(row.parameter),
        );

        return {
          parameter: saved?.testName || saved?.parameter || row.parameter,
          result: saved?.value || saved?.result || row.result,
          unit: saved?.unit || row.unit,
          referenceRange: saved?.referenceRange || saved?.range || row.referenceRange,
        };
      }),
    ]),
  );
}

function makeOrthopedicsRows(existingResults = []) {
  return Object.fromEntries(
    ORTHOPEDICS_PANEL_TESTS.map((testName) => [
      testName,
      (ORTHOPEDICS_PANEL_TESTS_TEMPLATES[testName] || []).map((row) => {
        const savedRow = existingResults.find(
          (sr) => normalizeText(sr.testName) === normalizeText(testName) && normalizeText(sr.parameter || sr.name) === normalizeText(row.parameter),
        );
        return {
          ...row,
          result: savedRow?.value || savedRow?.result || '',
        };
      }),
    ]),
  );
}

function departmentName(test) {
  if (isCbcName(test?.testName)) return 'Hematology';
  const testName = normalizeText(test?.testName);
  const category = String(test?.category || '').trim();
  const categoryNorm = normalizeText(category);

  // Honor explicit department selected at billing side.
  if (categoryNorm === 'autoimmune & collagen markers' || categoryNorm === 'autoimmune and collagen markers') {
    return 'AUTOIMMUNE & COLLAGEN MARKERS';
  }

  if (BIOCHEMISTRY_TESTS.some((item) => normalizeText(item.name) === testName)) return 'Biochemistry';
  if (MICROBIOLOGY_TESTS.some((item) => microbiologyKey(item.name) === microbiologyKey(test?.testName))) return 'Microbiology';
  if (SEROLOGY_TESTS.some((item) => normalizeText(item.name) === testName)) return 'Serology';

  if (testName && INFECTIOUS_DISEASE_MARKERS_TESTS.some((t) => normalizeText(t.name) === testName)) return 'Infectious Disease Markers';

  if (categoryNorm === 'gastroenterology' || categoryNorm === 'hepatology' || categoryNorm === 'hepatology & gastroenterology') {
    return category;
  }

  if (categoryNorm === 'tumor marker') return 'Tumor Marker';
  if (testName && TUMOR_MARKER_TESTS.some((t) => normalizeText(t.name) === testName)) return 'Tumor Marker';

  if (testName && AUTOIMMUNE_COLLAGEN_MARKERS_TESTS.some((t) => normalizeText(t.name) === testName)) {
    return 'AUTOIMMUNE & COLLAGEN MARKERS';
  }

  if (testName && HEPATLOGY_GASTROENTEROLOGY_TESTS.some((t) => normalizeText(t.name) === testName)) {
    return category || 'Gastroenterology';
  }

  if (CLINICAL_PATHOLOGY_TEST_NAME_SET.has(testName)) return 'Clinical Pathology';

  if (testName && testName === normalizeText('Hormone Profile')) return 'Hormone Profile';

  // Orthopedics / Arthritis / Collagen Profile Panel
  if (testName && ORTHOPEDICS_PANEL_TESTS.some((t) => normalizeText(t) === testName)) return 'Orthopedics / Arthritis / Collagen Profile Panel';

  return String(test?.category || 'General').trim() || 'General';
}



function makeCbcRows(existingResults = []) {
  const byName = new Map(existingResults.map((result) => [normalizeText(result.testName || result.parameter || result.name), result]));
  return CBC_PARAMETERS.map((row) => {
    const saved = byName.get(normalizeText(row.parameter));
    return {
      parameter: saved?.testName || saved?.parameter || row.parameter,
      result: saved?.value || saved?.result || row.result,
      unit: saved?.unit || row.unit,
      referenceRange: saved?.referenceRange || saved?.range || row.referenceRange,
    };
  });
}

function makeHematologyRows(existingResults = []) {
  const byName = new Map(existingResults.map((result) => [normalizeText(result.testName || result.parameter || result.name), result]));
  return Object.fromEntries(
    HEMATOLOGY_TESTS.map((test) => [
      test.name,
      test.rows.map((row) => {
        const saved = byName.get(normalizeText(row.parameter));
        return {
          parameter: saved?.testName || saved?.parameter || row.parameter,
          result: saved?.value || saved?.result || row.result,
          unit: saved?.unit || row.unit,
          referenceRange: saved?.referenceRange || saved?.range || row.referenceRange,
        };
      }),
    ]),
  );
}

function makeBiochemistryRows(existingResults = []) {
  const byName = new Map(existingResults.map((result) => [normalizeText(result.testName || result.parameter || result.name), result]));
  return Object.fromEntries(
    BIOCHEMISTRY_TESTS.map((test) => [
      test.name,
      test.rows.map((row) => {
        const saved = byName.get(normalizeText(row.parameter));
        return {
          parameter: saved?.testName || saved?.parameter || row.parameter,
          result: saved?.value || saved?.result || row.result,
          unit: saved?.unit || row.unit,
          referenceRange: saved?.referenceRange || saved?.range || row.referenceRange,
        };
      }),
    ]),
  );
}

function makeMicrobiologyRows(existingResults = []) {
  return Object.fromEntries(
    MICROBIOLOGY_TESTS.map((test) => [
      test.name,
      test.rows.map((row) => {
        const saved = existingResults.find(
          (result) => microbiologyKey(result.testName || result.group || result.test || result.remarks) === microbiologyKey(test.name)
            && microbiologyKey(result.parameter || result.name || result.testName) === microbiologyKey(row.parameter),
        );
        return {
          parameter: saved?.parameter || saved?.name || row.parameter,
          result: saved?.value || saved?.result || row.result,
          unit: saved?.unit || row.unit,
          referenceRange: saved?.referenceRange || saved?.range || row.referenceRange,
        };
      }),
    ]),
  );
}

function makeSerologyRows(existingResults = []) {
  const byName = new Map(existingResults.map((result) => [normalizeText(result.testName || result.parameter || result.name), result]));

  return Object.fromEntries(
    SEROLOGY_TESTS.map((test) => [
      test.name,
      test.rows.map((row) => {
        const saved = byName.get(normalizeText(row.parameter));
        return {
          parameter: saved?.testName || saved?.parameter || row.parameter,
          result: saved?.value || saved?.result || row.result,
          unit: saved?.unit || row.unit,
          referenceRange: saved?.referenceRange || saved?.range || row.referenceRange,
        };
      }),
    ]),
  );
}

function makeClinicalPathologyRows(existingResults = []) {
  const byName = new Map(existingResults.map((result) => [normalizeText(result.testName || result.parameter || result.name), result]));

  return Object.fromEntries(
    CLINICAL_PATHOLOGY_TESTS.map((testName) => [
      testName,
      (CLINICAL_PATHOLOGY_TESTS_TEMPLATES[testName] || []).map((row) => {
        const saved = byName.get(normalizeText(row.parameter));
        return {
          parameter: saved?.testName || saved?.parameter || row.parameter,
          result: saved?.value || saved?.result || '',
          unit: saved?.unit || row.unit || '',
          referenceRange: saved?.referenceRange || saved?.range || row.referenceRange || '',
        };
      }),
    ]),
  );
}

const HORMONE_PROFILE_TESTS = [
  { name: '17-OH Progesterone' },
  { name: 'ACTH' },
  { name: 'ADH' },
  { name: 'Adiponectin' },
  { name: 'AFP' },
  { name: 'Aldosterone' },
  { name: 'AMH' },
  { name: 'Androstenedione' },
  { name: 'Anti-TG antibodies' },
  { name: 'Anti-TPO antibodies' },
  { name: 'Beta-hCG' },
  { name: 'BNP' },
  { name: 'C-Peptide' },
  { name: 'Calcitonin' },
  { name: 'Cortisol' },
  { name: 'DHEA-S' },
  { name: 'Dihydroxy testosterone' },
  { name: 'Epinephrine' },
  { name: 'Erythropoietin' },
  { name: 'Estradiol (E2)' },
  { name: 'Estriol (E3)' },
  { name: 'Free Beta-hCG' },
  { name: 'FT3' },
  { name: 'FT4' },
  { name: 'Free Testosterone' },
  { name: 'FSH' },
  { name: 'Growth Hormone' },
  { name: 'IgF-1' },
  { name: 'Inhibin-A' },
  { name: 'Inhibin-B' },
  { name: 'Insulin' },
  { name: 'Leptin' },
  { name: 'LH' },
  { name: 'Fertility / Hormonal Profile' },
  { name: 'Metanephrine' },
  { name: 'Norepinephrine' },
  { name: 'PAPPA' },
  { name: 'Parathyroid hormone (PTH) intact' },
  { name: 'Progesterone' },
  { name: 'Prolactin' },
  { name: 'T3' },
  { name: 'T4' },
  { name: 'TSH' },
  { name: 'Testosterone' },
  { name: 'VMA' },
];

const HORMONE_PROFILE_FIRST_5_TESTS = [
  // Kept for backward compatibility with existing code; Hormone profile section now uses full set.

  {
    name: '17-OH Progesterone',
    rows: [
      { parameter: '17-OH Progesterone', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'ACTH',
    rows: [
      { parameter: 'ACTH Value', result: '', unit: 'pg/mL', referenceRange: '7-63' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'ADH',
    rows: [
      { parameter: 'ADH Value', result: '', unit: 'pg/mL', referenceRange: '0-13' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Adiponectin',
    rows: [
      { parameter: 'Adiponectin Value', result: '', unit: 'ug/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'AFP',
    rows: [
      { parameter: 'AFP Value', result: '', unit: 'ng/mL', referenceRange: '0-10' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Aldosterone',
    rows: [
      { parameter: 'Aldosterone Value', result: '', unit: 'ng/dL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'AMH',
    rows: [
      { parameter: 'AMH Value', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Androstenedione',
    rows: [
      { parameter: 'Androstenedione Value', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Anti-TG antibodies',
    rows: [
      { parameter: 'Anti-TG antibodies', result: '', unit: 'IU/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Anti-TPO antibodies',
    rows: [
      { parameter: 'Anti-TPO antibodies', result: '', unit: 'IU/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Beta-hCG',
    rows: [
      { parameter: 'Beta-hCG Value', result: '', unit: 'mIU/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'BNP',
    rows: [
      { parameter: 'BNP Value', result: '', unit: 'pg/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Immunoassay' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'C-Peptide',
    rows: [
      { parameter: 'C-Peptide Value', result: '', unit: 'ng/mL', referenceRange: '0.8-3.1' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Calcitonin',
    rows: [
      { parameter: 'Calcitonin Value', result: '', unit: 'pg/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Cortisol',
    rows: [
      { parameter: 'Cortisol Value', result: '', unit: 'ug/dL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'DHEA-S',
    rows: [
      { parameter: 'DHEA-S Value', result: '', unit: 'ug/dL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Dihydroxy testosterone',
    rows: [
      { parameter: 'DHT Value', result: '', unit: 'pg/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Epinephrine',
    rows: [
      { parameter: 'Epinephrine Value', result: '', unit: 'pg/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Immunoassay' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Erythropoietin',
    rows: [
      { parameter: 'Erythropoietin Value', result: '', unit: 'mIU/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Estradiol (E2)',
    rows: [
      { parameter: 'Estradiol Value', result: '', unit: 'pg/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Estriol (E3)',
    rows: [
      { parameter: 'Estriol Value', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Free Beta-hCG',
    rows: [
      { parameter: 'Free Beta-hCG Value', result: '', unit: 'mIU/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'FT3',
    rows: [
      { parameter: 'FT3', result: '', unit: 'pg/mL', referenceRange: '2.3-4.2' },
      { parameter: 'FT3/FT4 Ratio', result: '', unit: 'Ratio', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'FT4',
    rows: [
      { parameter: 'FT4', result: '', unit: 'ng/dL', referenceRange: '0.8-1.8' },
      { parameter: 'FT3/FT4 Ratio', result: '', unit: 'Ratio', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Free Testosterone',
    rows: [
      { parameter: 'Free Testosterone', result: '', unit: 'pg/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'FSH',
    rows: [
      { parameter: 'FSH Value', result: '', unit: 'mIU/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Growth Hormone',
    rows: [
      { parameter: 'Growth Hormone Value', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'IgF-1',
    rows: [
      { parameter: 'IGF-1 Value', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Immunoassay' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Inhibin-A',
    rows: [
      { parameter: 'Inhibin-A Value', result: '', unit: 'pg/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Inhibin-B',
    rows: [
      { parameter: 'Inhibin-B Value', result: '', unit: 'pg/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Insulin',
    rows: [
      { parameter: 'Insulin Value', result: '', unit: 'uIU/mL', referenceRange: '2-25' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Leptin',
    rows: [
      { parameter: 'Leptin Value', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'ELISA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'LH',
    rows: [
      { parameter: 'LH Value', result: '', unit: 'mIU/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Fertility / Hormonal Profile',
    rows: [
      { parameter: 'LH', result: '', unit: 'mIU/mL', referenceRange: 'Normal' },
      { parameter: 'FSH', result: '', unit: 'mIU/mL', referenceRange: 'Normal' },
      { parameter: 'LH/FSH Ratio', result: '', unit: 'Ratio', referenceRange: 'Normal' },
      { parameter: 'Testosterone', result: '', unit: 'ng/dL', referenceRange: 'Normal' },
      { parameter: 'Estradiol (E2)', result: '', unit: 'pg/mL', referenceRange: 'Normal' },
      { parameter: 'T/E2 Ratio', result: '', unit: 'Ratio', referenceRange: 'Normal' },
    ],
  },
  {
    name: 'Metanephrine',
    rows: [
      { parameter: 'Metanephrine Value', result: '', unit: 'pg/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Immunoassay' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Norepinephrine',
    rows: [
      { parameter: 'Norepinephrine Value', result: '', unit: 'pg/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Immunoassay' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'PAPPA',
    rows: [
      { parameter: 'PAPPA Value', result: '', unit: 'mIU/L', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Immunoassay' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Parathyroid hormone (PTH) intact',
    rows: [
      { parameter: 'PTH Value', result: '', unit: 'pg/mL', referenceRange: '15-65' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Progesterone',
    rows: [
      { parameter: 'Progesterone Value', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Prolactin',
    rows: [
      { parameter: 'Prolactin Value', result: '', unit: 'ng/mL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'T3',
    rows: [
      { parameter: 'T3 Value', result: '', unit: 'ng/dL', referenceRange: '80-200' },
      { parameter: 'FT3/FT4 Ratio', result: '', unit: 'Ratio', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'T4',
    rows: [
      { parameter: 'T4 Value', result: '', unit: 'ug/dL', referenceRange: '5-12' },
      { parameter: 'FT3/FT4 Ratio', result: '', unit: 'Ratio', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'TSH',
    rows: [
      { parameter: 'TSH Value', result: '', unit: 'uIU/mL', referenceRange: '0.4-4.5' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'Testosterone',
    rows: [
      { parameter: 'Testosterone Value', result: '', unit: 'ng/dL', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'CLIA' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
  {
    name: 'VMA',
    rows: [
      { parameter: 'VMA Value', result: '', unit: 'mg/24hr', referenceRange: 'Normal' },
      { parameter: 'Method', result: '', unit: '-', referenceRange: 'Spectrophotometric' },
      { parameter: 'Remarks', result: '', unit: '-', referenceRange: '-' },
    ],
  },
];

function resolveHormoneFilterKey(filter) {
  const n = normalizeText(filter);
  if (n === 'freet3' || n === 'ft3') return 'FT3';
  if (n === 'freet4' || n === 'ft4') return 'FT4';
  if (n === 't3') return 'T3';
  if (n === 't4') return 'T4';
  return findCatalogTestName(filter, HORMONE_PROFILE_FIRST_5_TESTS) || String(filter || '').trim();
}

function HormoneProfileTable({ rows, onRowChange, isAutoCalculatedRow = null }) {
  return (
    <div className="overflow-auto rounded-xl border border-gray-100">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="border-b border-gray-100 px-3 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">Parameter</th>
            <th className="border-b border-gray-100 px-3 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">Result</th>
            <th className="border-b border-gray-100 px-3 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">Unit</th>
            <th className="border-b border-gray-100 px-3 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">Range</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.parameter}-${index}`}>
              <td className="border-b border-gray-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <input className={inputCls} value={row.parameter} onChange={(e) => onRowChange(index, 'parameter', e.target.value)} />
                  {typeof isAutoCalculatedRow === 'function' && isAutoCalculatedRow(row) ? (
                    <span
                      className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-extrabold text-blue-700"
                      title="This value will auto-calculate when related inputs are entered (you can still edit it)."
                    >
                      Auto
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="border-b border-gray-50 px-3 py-2">
                <input
                  className={inputCls}
                  value={row.result}
                  onChange={(e) => onRowChange(index, 'result', e.target.value)}
                  placeholder={
                    typeof isAutoCalculatedRow === 'function' && isAutoCalculatedRow(row)
                      ? 'Auto-calculated'
                      : 'Enter result'
                  }
                  title={
                    typeof isAutoCalculatedRow === 'function' && isAutoCalculatedRow(row)
                      ? 'Auto-calculated when you enter required values. You can still edit manually.'
                      : undefined
                  }
                />
              </td>
              <td className="border-b border-gray-50 px-3 py-2">
                <input className={inputCls} value={row.unit} onChange={(e) => onRowChange(index, 'unit', e.target.value)} />
              </td>
              <td className="border-b border-gray-50 px-3 py-2">
                <input
                  className={inputCls}
                  value={row.referenceRange}
                  onChange={(e) => onRowChange(index, 'referenceRange', e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HormoneProfileSection({ filter, onFilterChange, rowsByTest, onRowChange }) {
  const catalog = HORMONE_PROFILE_FIRST_5_TESTS;
  const filterKey = filter ? resolveHormoneFilterKey(filter) : '';
  const templateHit = catalog.find((t) => normalizeText(t.name) === normalizeText(filterKey));
  const templateRows = templateHit?.rows?.length ? cloneCatalogRows(templateHit.rows) : [];
  const storedRows = filterKey ? getPanelRowsByTest(rowsByTest, filterKey, catalog) : [];
  const displayRows = templateRows.length ? mergeHormoneProfileRows(storedRows, templateRows) : storedRows;

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-gray-600">Test Filter</label>
        <select
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-extrabold text-gray-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          value={filterKey || filter}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="">Select hormone profile test</option>
          {HORMONE_PROFILE_TESTS.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {filterKey ? (
        <HormoneProfileTable
          rows={displayRows}
          onRowChange={(index, key, value) => onRowChange(filterKey, index, key, value)}
          isAutoCalculatedRow={(row) =>
            isHormoneFt3Ft4RatioParameter(row?.parameter) ||
            isFertilityHormonalProfileDerivedParameter(row?.parameter)
          }
        />
      ) : null}
    </div>
  );
}

function ParameterResultTable({ rows, onChange, parameterReadOnly = true, isAutoCalculatedRow = null }) {

  return (
    <div className="overflow-auto rounded-xl border border-gray-100">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="border-b border-gray-100 px-3 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
              Parameter
            </th>
            <th className="border-b border-gray-100 px-3 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
              Result
            </th>
            <th className="border-b border-gray-100 px-3 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
              Unit
            </th>
            <th className="border-b border-gray-100 px-3 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
              Range
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.parameter}-${index}`}>
              <td className="border-b border-gray-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <input
                    className={parameterReadOnly ? `${inputCls} bg-gray-100` : inputCls}
                    value={row.parameter}
                    onChange={(e) => onChange(index, 'parameter', e.target.value)}
                    readOnly={parameterReadOnly}
                  />
                  {typeof isAutoCalculatedRow === 'function' && isAutoCalculatedRow(row) ? (
                    <span
                      className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-extrabold text-blue-700"
                      title="This value will auto-calculate when related inputs are entered (you can still edit it)."
                    >
                      Auto
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="border-b border-gray-50 px-3 py-2">
                <input
                  className={inputCls}
                  value={row.result}
                  onChange={(e) => onChange(index, 'result', e.target.value)}
                  placeholder={
                    typeof isAutoCalculatedRow === 'function' && isAutoCalculatedRow(row)
                      ? 'Auto-calculated'
                      : 'Enter result'
                  }
                  title={
                    typeof isAutoCalculatedRow === 'function' && isAutoCalculatedRow(row)
                      ? 'Auto-calculated when you enter required values. You can still edit manually.'
                      : undefined
                  }
                />
              </td>
              <td className="border-b border-gray-50 px-3 py-2">
                <input className={inputCls} value={row.unit} onChange={(e) => onChange(index, 'unit', e.target.value)} />
              </td>
              <td className="border-b border-gray-50 px-3 py-2">
                <input
                  className={inputCls}
                  value={row.referenceRange}
                  onChange={(e) => onChange(index, 'referenceRange', e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DepartmentTestFilterSection({

  title,
  tests,
  filter,
  onFilterChange,
  rows,
  onRowChange,
  onAddRow,
  placeholder,
  parameterReadOnly = true,
  isAutoCalculatedRow = null,
  receptionAdvisedTests = null,
  remarks = '',
  onRemarksChange,
}) {
  const uniqueTests = Array.from(new Map(tests.map((test) => [compactTestKey(test.name), test])).values());
  const resolvedFilter = filter ? findCatalogTestName(filter, uniqueTests) : '';
  const advisedList = Array.isArray(receptionAdvisedTests) ? receptionAdvisedTests : [];
  const showNotRecommendedByReception =
    Boolean(resolvedFilter) &&
    advisedList.length > 0 &&
    !advisedList.some((t) => isSameTestName(t, resolvedFilter));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="max-w-sm">
          <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-gray-600">Test Filter</label>
          <select
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-extrabold text-gray-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            value={resolvedFilter}
            onChange={(e) => onFilterChange(e.target.value)}
          >
            <option value="">{placeholder || `Select ${title} test`}</option>
            {uniqueTests.map((test) => (
              <option key={test.name} value={test.name}>
                {test.name}
              </option>
            ))}
          </select>
        </div>

        {resolvedFilter && onAddRow ? (
          <button
            type="button"
            onClick={onAddRow}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-xs font-extrabold border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
            title="Add a manual parameter row"
          >
            Add New Row
          </button>
        ) : null}
      </div>

      {showNotRecommendedByReception ? (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
          role="status"
        >
          This test was not recommended by the receptionist. You can still enter results if required.
        </div>
      ) : null}

      {resolvedFilter ? (
        <>
          <ParameterResultTable
            rows={rows}
            onChange={onRowChange}
            parameterReadOnly={parameterReadOnly}
            isAutoCalculatedRow={isAutoCalculatedRow}
          />
          {onRemarksChange ? (
            <div>
              <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-gray-600">Remarks</label>
              <textarea
                className={inputCls}
                rows={3}
                value={remarks}
                onChange={(e) => onRemarksChange(e.target.value)}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function ResultEntryAuto() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [values, setValues] = useState({});
  const [cbcRows, setCbcRows] = useState(CBC_PARAMETERS);
  const [hematologyRowsByTest, setHematologyRowsByTest] = useState(() => makeHematologyRows());
  const [hematologyFilter, setHematologyFilter] = useState('');
  const [biochemistryRowsByTest, setBiochemistryRowsByTest] = useState(() => makeBiochemistryRows());
  const [biochemistryFilter, setBiochemistryFilter] = useState('');
  const [microbiologyRowsByTest, setMicrobiologyRowsByTest] = useState(() => makeMicrobiologyRows());
  const [microbiologyFilter, setMicrobiologyFilter] = useState('');
  const [microbiologyRemarksByTest, setMicrobiologyRemarksByTest] = useState({});
  const [serologyRowsByTest, setSerologyRowsByTest] = useState(() => makeSerologyRows());
  const [serologyFilter, setSerologyFilter] = useState('');
  const [serologyRemarksByTest, setSerologyRemarksByTest] = useState({});
  const [clinicalPathologyRowsByTest, setClinicalPathologyRowsByTest] = useState(() => makeClinicalPathologyRows());
  const [clinicalPathologyFilter, setClinicalPathologyFilter] = useState('');
  const [hormoneProfileFilter, setHormoneProfileFilter] = useState('');
  const [hormoneProfileRowsByTest, setHormoneProfileRowsByTest] = useState({});

  const [hepatologyGastroFilter, setHepatologyGastroFilter] = useState('');
  const [hepatologyGastroRowsByTest, setHepatologyGastroRowsByTest] = useState(() => makeHepatologyGastroRows());
  const [orthopedicsFilter, setOrthopedicsFilter] = useState('');
  const [tumorMarkerFilter, setTumorMarkerFilter] = useState('');
  const [tumorMarkerRowsByTest, setTumorMarkerRowsByTest] = useState(() => makeTumorMarkerRows());
  const [autoimmuneCollagenFilter, setAutoimmuneCollagenFilter] = useState('');
  const [autoimmuneCollagenRowsByTest, setAutoimmuneCollagenRowsByTest] = useState(() => ({}));
  const [orthopedicsRowsByTest, setOrthopedicsRowsByTest] = useState(() => makeOrthopedicsRows());
  const [infectiousDiseaseFilter, setInfectiousDiseaseFilter] = useState('');
  const [infectiousDiseaseRowsByTest, setInfectiousDiseaseRowsByTest] = useState(() => makeInfectiousDiseaseRows());



  const [activeDepartment, setActiveDepartment] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/lab/orders', { params: { status: 'IN_PROGRESS' } });
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setOrders(items.filter((item) => !['COMPLETED', 'VERIFIED'].includes(String(item.reportStatus || '').toUpperCase())));
    } catch (e) {
      setOrders([]);
      setError(e?.response?.data?.message || 'Failed to load lab work queue.');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id) => {
    if (!id) return;
    setDetailLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await api.get(`/lab/orders/${encodeURIComponent(id)}`);
      const order = res?.data?.order || null;
      const tests = Array.isArray(order?.items) ? order.items : [];
      const savedResults = Array.isArray(order?.results) ? order.results : [];
      const init = {};

      tests.forEach((test) => {
        if (isCbcName(test.testName)) return;
        const saved = savedResults.find((result) => normalizeText(result.testName) === normalizeText(test.testName));
        const key = `t_${test.id || resultKey(test.testName)}`;
        init[`${key}_name`] = saved?.testName || test.testName || '';
        init[`${key}_value`] = saved?.value || '';
        init[`${key}_unit`] = saved?.unit || test.unit || '';
        init[`${key}_referenceRange`] = saved?.referenceRange || test.referenceRange || '';
        init[`${key}_remarks`] = saved?.remarks || '';
      });

      init.overallRemarks = order?.notes || '';
      init.diagnosis = '';
      init.verifiedBy = '';
      init.approvedBy = '';
      init.reportStatus = 'COMPLETED';

      setDetail(order);
      setValues(init);
      setCbcRows(makeCbcRows(savedResults));
      setHematologyRowsByTest(makeHematologyRows(savedResults));
      setBiochemistryRowsByTest(makeBiochemistryRows(savedResults));
      setMicrobiologyRowsByTest(makeMicrobiologyRows(savedResults));
      setMicrobiologyRemarksByTest({});
      setSerologyRowsByTest(makeSerologyRows(savedResults));
      setSerologyRemarksByTest({});
      setClinicalPathologyRowsByTest(makeClinicalPathologyRows(savedResults));
      setHematologyFilter('');
      setBiochemistryFilter('');
      setMicrobiologyFilter('');
      setMicrobiologyRemarksByTest({});
      setSerologyFilter('');
      setSerologyRemarksByTest({});
      setClinicalPathologyFilter('');
      setHormoneProfileFilter('');
      setHormoneProfileRowsByTest({});
      setHepatologyGastroRowsByTest(makeHepatologyGastroRows(savedResults, tests));
      setHepatologyGastroFilter('');
      setInfectiousDiseaseRowsByTest(makeInfectiousDiseaseRows(savedResults));
      setInfectiousDiseaseFilter('');
      setOrthopedicsRowsByTest(makeOrthopedicsRows(savedResults));
      setOrthopedicsFilter('');

      // Tumor Marker
      setTumorMarkerRowsByTest(makeTumorMarkerRows(savedResults));
      setTumorMarkerFilter('');

      // Autoimmune & Collagen Markers
      setAutoimmuneCollagenRowsByTest(makeAutoimmuneCollagenRows(savedResults));
      setAutoimmuneCollagenFilter('');
    } catch (e) {


      setDetail(null);
      setError(e?.response?.data?.message || 'Failed to load order.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setActiveDepartment('');
      setHematologyFilter('');
      setBiochemistryFilter('');
      setMicrobiologyFilter('');
      setSerologyFilter('');
      setSerologyRemarksByTest({});
      setClinicalPathologyFilter('');
      setHormoneProfileFilter('');
      setHormoneProfileRowsByTest({});
      setHepatologyGastroFilter('');
      setInfectiousDiseaseFilter('');
      setOrthopedicsFilter('');
      setTumorMarkerFilter('');
      setAutoimmuneCollagenFilter('');
      return;


    }
    loadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const suggestions = useMemo(() => {
    const q = normalizeText(search);
    return orders.filter((order) => {
      const patient = order.patient || {};
      if (!q) return true;
      const blob = `${order.orderNumber} ${patient.name} ${patient.uhid} ${patient.mobile} ${patient.age} ${patient.gender} ${order.doctorName}`.toLowerCase();
      return blob.includes(q);
    });
  }, [orders, search]);

  const tests = Array.isArray(detail?.items) ? detail.items : [];
  const patient = detail?.patient || null;
  const otherTests = tests.filter((test) => !isCbcName(test.testName));
  const departments = useMemo(() => {
    const base = Array.from(new Set(tests.map(departmentName))).filter(Boolean);
    const hormonePresent = tests.some((t) => normalizeText(t?.testName) === normalizeText('Hormone Profile'));
    const hasHormoneProfile = base.some((d) => normalizeText(d) === 'hormone profile');
    if (!hasHormoneProfile && hormonePresent) return [...base, 'Hormone Profile'];
    return base;
  }, [tests]);

  const testsByDepartment = useMemo(() => {
    const map = new Map();
    tests.forEach((test) => {
      const dept = departmentName(test);
      map.set(dept, [...(map.get(dept) || []), test]);
    });
    return map;
  }, [tests]);
  const visibleDepartment = activeDepartment || departments[0] || '';
  const visibleDepartmentTests = testsByDepartment.get(visibleDepartment) || [];
  const visibleCbcTest = visibleDepartmentTests.find((test) => isCbcName(test.testName));
  const visibleOtherTests = visibleDepartmentTests.filter((test) => !isCbcName(test.testName));

  const isHematologyActive = normalizeText(visibleDepartment) === 'hematology';
  const isBiochemistryActive = normalizeText(visibleDepartment) === 'biochemistry';
  const isMicrobiologyActive = normalizeText(visibleDepartment) === 'microbiology';
  const isSerologyActive = normalizeText(visibleDepartment) === 'serology';
  const isClinicalPathologyActive = normalizeText(visibleDepartment) === 'clinical pathology';
  const isHormoneProfileActive = normalizeText(visibleDepartment) === 'hormone profile';
  const isOrthopedicsActive = normalizeText(visibleDepartment) === 'orthopedics / arthritis / collagen profile panel';
  const isTumorMarkerActive = normalizeText(visibleDepartment) === 'tumor marker';
  const isHepatologyGastroActive = isHepatologyGastroDepartmentName(visibleDepartment);

  const isAutoimmuneCollagenActive = normalizeText(visibleDepartment) === 'autoimmune & collagen markers';

  const isInfectiousDiseaseActive = normalizeText(visibleDepartment) === 'infectious disease markers';

  const selectedHematologyRows = hematologyFilter
    ? getEditablePanelRows(hematologyRowsByTest, hematologyFilter, HEMATOLOGY_TESTS)
    : [];
  const selectedBiochemistryRows = biochemistryFilter
    ? getEditablePanelRows(biochemistryRowsByTest, biochemistryFilter, BIOCHEMISTRY_TESTS)
    : [];
  const selectedMicrobiologyRows = microbiologyFilter
    ? getEditablePanelRows(microbiologyRowsByTest, microbiologyFilter, MICROBIOLOGY_TESTS)
    : [];
  const selectedMicrobiologyRemarks = microbiologyFilter ? (microbiologyRemarksByTest[microbiologyFilter] || '') : [];
  const selectedClinicalPathologyRows = clinicalPathologyFilter
    ? getEditablePanelRows(
        clinicalPathologyRowsByTest,
        clinicalPathologyFilter,
        CLINICAL_PATHOLOGY_TESTS.map((name) => ({ name })),
      )
    : [];

  const selectedHepatologyGastroRows = useMemo(
    () => getHepatologyGastroRowsForFilter(hepatologyGastroRowsByTest, hepatologyGastroFilter),
    [hepatologyGastroFilter, hepatologyGastroRowsByTest],
  );
  const selectedAutoimmuneCollagenRows = autoimmuneCollagenFilter
    ? getEditablePanelRows(autoimmuneCollagenRowsByTest, autoimmuneCollagenFilter, AUTOIMMUNE_COLLAGEN_MARKERS_TESTS)
    : [];
  const selectedOrthopedicsRows = orthopedicsFilter
    ? getEditablePanelRows(
        orthopedicsRowsByTest,
        orthopedicsFilter,
        ORTHOPEDICS_PANEL_TESTS.map((name) => ({ name })),
      )
    : [];
  const selectedInfectiousDiseaseRows = infectiousDiseaseFilter
    ? getEditablePanelRows(infectiousDiseaseRowsByTest, infectiousDiseaseFilter, INFECTIOUS_DISEASE_MARKERS_TESTS)
    : [];
  const selectedTumorMarkerRows = tumorMarkerFilter
    ? getEditablePanelRows(tumorMarkerRowsByTest, tumorMarkerFilter, TUMOR_MARKER_TESTS)
    : [];

  const advisedDepartmentTests = useMemo(() => {
    const names = (visibleDepartmentTests || [])
      .map((t) => String(t?.testName || '').trim())
      .filter(Boolean);
    return Array.from(new Set(names));
  }, [visibleDepartmentTests]);

  const departmentCatalog = useMemo(() => getDepartmentCatalog(visibleDepartment), [visibleDepartment]);
  // Full department catalog in filter + reception-advised names first (chips stay reception-only).
  const departmentFilterDropdownTests = useMemo(
    () => buildDepartmentDropdownTests(departmentCatalog, advisedDepartmentTests),
    [departmentCatalog, advisedDepartmentTests],
  );

  const serologyDropdownTests = useMemo(() => {
    if (!isSerologyActive) return SEROLOGY_TESTS;
    return buildDepartmentDropdownTests(SEROLOGY_TESTS, advisedDepartmentTests);
  }, [isSerologyActive, advisedDepartmentTests]);

  const selectedSerologyRows = useMemo(() => {
    if (!serologyFilter) return [];
    const filterKey = findCatalogTestName(serologyFilter, SEROLOGY_TESTS);
    return getEditablePanelRows(serologyRowsByTest, filterKey, SEROLOGY_TESTS);
  }, [serologyFilter, serologyRowsByTest]);

  const selectedSerologyRemarks = useMemo(() => {
    if (!serologyFilter) return '';
    const filterKey = findCatalogTestName(serologyFilter, SEROLOGY_TESTS);
    return serologyRemarksByTest[filterKey] || serologyRemarksByTest[serologyFilter] || '';
  }, [serologyFilter, serologyRemarksByTest]);

  const departmentFilterState = useMemo(() => {
    if (isHematologyActive) return { filter: hematologyFilter, setFilter: setHematologyFilter, rowsByTest: hematologyRowsByTest };
    if (isBiochemistryActive) return { filter: biochemistryFilter, setFilter: setBiochemistryFilter, rowsByTest: biochemistryRowsByTest };
    if (isMicrobiologyActive) return { filter: microbiologyFilter, setFilter: setMicrobiologyFilter, rowsByTest: microbiologyRowsByTest };
    if (isSerologyActive) return { filter: serologyFilter, setFilter: setSerologyFilter, rowsByTest: serologyRowsByTest };
    if (isClinicalPathologyActive) return { filter: clinicalPathologyFilter, setFilter: setClinicalPathologyFilter, rowsByTest: clinicalPathologyRowsByTest };
    if (isHepatologyGastroActive) return { filter: hepatologyGastroFilter, setFilter: setHepatologyGastroFilter, rowsByTest: hepatologyGastroRowsByTest };
    if (isInfectiousDiseaseActive) return { filter: infectiousDiseaseFilter, setFilter: setInfectiousDiseaseFilter, rowsByTest: infectiousDiseaseRowsByTest };
    if (isOrthopedicsActive) return { filter: orthopedicsFilter, setFilter: setOrthopedicsFilter, rowsByTest: orthopedicsRowsByTest };
    if (isAutoimmuneCollagenActive) return { filter: autoimmuneCollagenFilter, setFilter: setAutoimmuneCollagenFilter, rowsByTest: autoimmuneCollagenRowsByTest };
    if (isTumorMarkerActive) return { filter: tumorMarkerFilter, setFilter: setTumorMarkerFilter, rowsByTest: tumorMarkerRowsByTest };
    return { filter: '', setFilter: null, rowsByTest: null };
  }, [
    autoimmuneCollagenFilter,
    autoimmuneCollagenRowsByTest,
    biochemistryFilter,
    biochemistryRowsByTest,
    clinicalPathologyFilter,
    clinicalPathologyRowsByTest,
    hematologyFilter,
    hematologyRowsByTest,
    hepatologyGastroFilter,
    hepatologyGastroRowsByTest,
    infectiousDiseaseFilter,
    infectiousDiseaseRowsByTest,
    isAutoimmuneCollagenActive,
    isBiochemistryActive,
    isClinicalPathologyActive,
    isHematologyActive,
    isHepatologyGastroActive,
    isInfectiousDiseaseActive,
    isMicrobiologyActive,
    isOrthopedicsActive,
    isSerologyActive,
    isTumorMarkerActive,
    microbiologyFilter,
    microbiologyRowsByTest,
    orthopedicsFilter,
    orthopedicsRowsByTest,
    serologyFilter,
    serologyRowsByTest,
    tumorMarkerFilter,
    tumorMarkerRowsByTest,
  ]);

  const isDepartmentTestDone = useCallback(
    (testName) => {
      const keyName = String(testName || '').trim();

      const rowsByTest = departmentFilterState.rowsByTest;
      if (rowsByTest) {
        const rows = getPanelRowsByTest(rowsByTest, keyName, departmentCatalog);
        if (!Array.isArray(rows) || !rows.length) return false;
        return rows.every((r) => String(r?.result || '').trim());
      }

      // Fallback for legacy (non-panel) departments that use `values` + `visibleOtherTests` table.
      const match = (visibleDepartmentTests || []).find((t) => normalizeText(t?.testName) === normalizeText(keyName));
      if (!match) return false;
      const vKey = `t_${match.id || resultKey(match.testName)}`;
      return Boolean(String(values[`${vKey}_value`] || '').trim());
    },
    [departmentCatalog, departmentFilterState, visibleDepartmentTests, values],
  );

  const goToDepartmentTest = useCallback(
    (testName) => {
      if (!departmentFilterState?.setFilter) return;
      const resolved = departmentCatalog.length
        ? findCatalogTestName(testName, departmentCatalog)
        : String(testName || '').trim();
      departmentFilterState.setFilter(resolved);
    },
    [departmentCatalog, departmentFilterState],
  );

  const currentDeptTestIndex = useMemo(() => {
    const key = String(departmentFilterState.filter || '').trim();
    if (!key) return -1;
    return advisedDepartmentTests.findIndex((t) => isSameTestName(t, key));
  }, [advisedDepartmentTests, departmentFilterState.filter]);

  const goPrevDeptTest = useCallback(() => {
    if (!advisedDepartmentTests.length) return;
    const idx = currentDeptTestIndex >= 0 ? currentDeptTestIndex : 0;
    const nextIdx = Math.max(0, idx - 1);
    goToDepartmentTest(advisedDepartmentTests[nextIdx]);
  }, [advisedDepartmentTests, currentDeptTestIndex, goToDepartmentTest]);

  const goNextDeptTest = useCallback(() => {
    if (!advisedDepartmentTests.length) return;
    const idx = currentDeptTestIndex >= 0 ? currentDeptTestIndex : -1;
    const nextIdx = Math.min(advisedDepartmentTests.length - 1, idx + 1);
    goToDepartmentTest(advisedDepartmentTests[nextIdx]);
  }, [advisedDepartmentTests, currentDeptTestIndex, goToDepartmentTest]);

  // Auto-select first reception test only when filter is empty — do not override manual catalog picks.
  useEffect(() => {
    if (!departmentFilterState?.setFilter) return;
    const current = String(departmentFilterState.filter || '').trim();

    if (!current) {
      if (!advisedDepartmentTests.length) return;
      const first = advisedDepartmentTests[0];
      const resolved = departmentCatalog.length ? findCatalogTestName(first, departmentCatalog) : first;
      departmentFilterState.setFilter(resolved);
      return;
    }

    if (departmentCatalog.length) {
      const resolved = findCatalogTestName(current, departmentCatalog);
      if (resolved && resolved !== current) {
        departmentFilterState.setFilter(resolved);
      }
    }
  }, [advisedDepartmentTests, departmentCatalog, departmentFilterState, visibleDepartment]);



  useEffect(() => {
    if (!isOrthopedicsActive) return;
    setOrthopedicsFilter((current) => {
      const valid = ORTHOPEDICS_PANEL_TESTS.some((name) => normalizeText(name) === normalizeText(current));
      return valid ? current : ORTHOPEDICS_PANEL_TESTS[0] || '';
    });
  }, [isOrthopedicsActive, visibleDepartment]);

  useEffect(() => {
    if (!isInfectiousDiseaseActive) return;
    setInfectiousDiseaseFilter((current) => {
      const valid = INFECTIOUS_DISEASE_MARKERS_TESTS.some((t) => normalizeText(t.name) === normalizeText(current));
      return valid ? current : INFECTIOUS_DISEASE_MARKERS_TESTS[0]?.name || '';
    });
  }, [isInfectiousDiseaseActive, visibleDepartment]);

  useEffect(() => {
    if (!isAutoimmuneCollagenActive) return;
    setAutoimmuneCollagenFilter((current) => {
      const currentNorm = normalizeText(current);
      const valid = AUTOIMMUNE_COLLAGEN_MARKERS_TESTS.some((t) => normalizeText(t.name) === currentNorm);
      return valid ? String(current || '').trim() : String(AUTOIMMUNE_COLLAGEN_MARKERS_TESTS[0]?.name || '').trim();
    });
  }, [isAutoimmuneCollagenActive, visibleDepartment]);

  useEffect(() => {
    if (!isHepatologyGastroActive) return;
    setHepatologyGastroFilter((current) => {
      const valid = HEPATLOGY_GASTROENTEROLOGY_TESTS.some((t) => normalizeText(t.name) === normalizeText(current));
      if (valid) return String(current).trim();
      const matched = findHepatologyGastroTemplate(current);
      return matched?.name ? String(matched.name).trim() : String(HEPATLOGY_GASTROENTEROLOGY_TESTS[0]?.name || '').trim();
    });
  }, [isHepatologyGastroActive, visibleDepartment]);

  useEffect(() => {
    const filterKey = String(hepatologyGastroFilter || '').trim();
    if (!filterKey) return;
    setHepatologyGastroRowsByTest((prev) => {
      const rows = getHepatologyGastroRowsForFilter(prev, filterKey);
      if (!rows.length) return prev;
      if (Array.isArray(prev[filterKey]) && prev[filterKey].length) return prev;
      return { ...prev, [filterKey]: rows };
    });
  }, [hepatologyGastroFilter]);

  useEffect(() => {
    if (!isSerologyActive || !serologyFilter) return;
    const filterKey = findCatalogTestName(serologyFilter, SEROLOGY_TESTS);
    setSerologyRowsByTest((prev) => {
      const existing = getPanelRowsByTest(prev, filterKey, SEROLOGY_TESTS);
      if (existing.length) return prev;
      const template = getCatalogTestTemplateRows(filterKey, SEROLOGY_TESTS);
      if (!template.length) return prev;
      return { ...prev, [filterKey]: template };
    });
  }, [isSerologyActive, serologyFilter]);

  useEffect(() => {
    if (!isHematologyActive || !hematologyFilter) return;
    const filterKey = findCatalogTestName(hematologyFilter, HEMATOLOGY_TESTS);
    setHematologyRowsByTest((prev) => {
      const existing = getPanelRowsByTest(prev, filterKey, HEMATOLOGY_TESTS);
      if (existing.length) return prev;
      const template = getCatalogTestTemplateRows(filterKey, HEMATOLOGY_TESTS);
      if (!template.length) return prev;
      return { ...prev, [filterKey]: template };
    });
  }, [isHematologyActive, hematologyFilter]);

  useEffect(() => {
    if (!isBiochemistryActive || !biochemistryFilter) return;
    const filterKey = findCatalogTestName(biochemistryFilter, BIOCHEMISTRY_TESTS);
    setBiochemistryRowsByTest((prev) => {
      const existing = getPanelRowsByTest(prev, filterKey, BIOCHEMISTRY_TESTS);
      if (existing.length) return prev;
      const template = getCatalogTestTemplateRows(filterKey, BIOCHEMISTRY_TESTS);
      if (!template.length) return prev;
      return { ...prev, [filterKey]: template };
    });
  }, [isBiochemistryActive, biochemistryFilter]);

  useEffect(() => {
    if (!isBiochemistryActive || !biochemistryFilter) return;
    const filterKey = findCatalogTestName(biochemistryFilter, BIOCHEMISTRY_TESTS);
    if (!isRftKftPanelTestName(filterKey)) return;
    setBiochemistryRowsByTest((prev) => {
      const base = getPanelRowsByTest(prev, filterKey, BIOCHEMISTRY_TESTS);
      if (!base.length) return prev;
      const next = applyRftKftFormulas(base, { age: patient?.age, gender: patient?.gender });
      const unchanged =
        next.length === base.length &&
        next.every((row, i) => row.result === base[i]?.result && row.autoDerived === base[i]?.autoDerived);
      return unchanged ? prev : { ...prev, [filterKey]: next };
    });
  }, [isBiochemistryActive, biochemistryFilter, patient?.age, patient?.gender]);

  useEffect(() => {
    if (!isHormoneProfileActive || !hormoneProfileFilter) return;
    const filterKey = resolveHormoneFilterKey(hormoneProfileFilter);
    if (!filterKey) return;
    setHormoneProfileRowsByTest((prev) => {
      const catalog = HORMONE_PROFILE_FIRST_5_TESTS;
      const hit = catalog.find((t) => normalizeText(t.name) === normalizeText(filterKey));
      const templateRows = hit?.rows?.length ? cloneCatalogRows(hit.rows) : [];
      const existing = getPanelRowsByTest(prev, filterKey, catalog);
      const merged = mergeHormoneProfileRows(existing, templateRows);
      let map = { ...prev, [filterKey]: merged };
      if (isHormoneFt3TestName(filterKey) || isHormoneFt4TestName(filterKey)) {
        return syncHormoneFt3Ft4Panels(map, catalog);
      }
      return map;
    });
  }, [isHormoneProfileActive, hormoneProfileFilter]);

  useEffect(() => {
    if (!departments.length) {
      setActiveDepartment('');
      return;
    }
    setActiveDepartment((current) => (departments.includes(current) ? current : departments[0]));
  }, [departments]);

  const selectPatient = (order) => {
    const patientRow = order.patient || {};
    setSelectedId(order.id);
    setSearch(`${patientRow.name || ''} ${patientRow.uhid || order.orderNumber || ''}`.trim());
    setSuggestionsOpen(false);
  };

  const setVal = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));
  const setCbcVal = (index, key, value) => {
    setCbcRows((prev) => {
      const next = prev.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const updated = { ...row, [key]: value };
        // If user manually edits a derived field, stop auto-overwriting it.
        if (key === 'result' && isCbcDerivedParameter(row?.parameter)) {
          updated.autoDerived = false;
        }
        return updated;
      });

      // Apply CBC formulas only (Hematology / CBC / CBC with GBP).
      // CBC table is rendered when `visibleCbcTest` exists for the active department.
      return applyCbcFormulas(next);
    });
  };
  const setHematologyVal = (index, key, value) => {
    if (!hematologyFilter) return;
    const filterKey = findCatalogTestName(hematologyFilter, HEMATOLOGY_TESTS);
    setHematologyRowsByTest((prev) => {
      const base = getEditablePanelRows(prev, filterKey, HEMATOLOGY_TESTS);
      const next = base.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const updated = { ...row, [key]: value };
        if (
          key === 'result' &&
          (isCbcDerivedParameter(row?.parameter) || isCoagulationProfileDerivedParameter(row?.parameter))
        ) {
          updated.autoDerived = false;
        }
        return updated;
      });

      let withFormulas = next;
      if (isCbcName(filterKey)) {
        withFormulas = applyCbcFormulas(next);
      } else if (isCoagulationProfilePanelTestName(filterKey)) {
        withFormulas = applyCoagulationProfileFormulas(next);
      }
      return { ...prev, [filterKey]: withFormulas };
    });
  };
  const addHematologyRow = () => {
    if (!hematologyFilter) return;
    const filterKey = findCatalogTestName(hematologyFilter, HEMATOLOGY_TESTS);
    setHematologyRowsByTest((prev) => {
      const current = getPanelRowsByTest(prev, filterKey, HEMATOLOGY_TESTS);
      return {
        ...prev,
        [filterKey]: [
          ...current,
          { parameter: '', result: '', unit: '', referenceRange: '' },
        ],
      };
    });
  };
  const setBiochemistryVal = (index, key, value) => {
    if (!biochemistryFilter) return;
    const filterKey = findCatalogTestName(biochemistryFilter, BIOCHEMISTRY_TESTS);
    setBiochemistryRowsByTest((prev) => {
      const base = getEditablePanelRows(prev, filterKey, BIOCHEMISTRY_TESTS);
      const next = base.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const updated = { ...row, [key]: value };
        if (key === 'result' && (isLftDerivedParameter(row?.parameter) || isRftKftDerivedParameter(row?.parameter) || isLipidProfileDerivedParameter(row?.parameter) || isHbA1cDerivedParameter(row?.parameter) || isElectrolyteDerivedParameter(row?.parameter) || isIronProfileDerivedParameter(row?.parameter) || isCardiacProfileDerivedParameter(row?.parameter) || isBoneProfileDerivedParameter(row?.parameter) || isInfectionInflammatoryProfileDerivedParameter(row?.parameter))) {
          updated.autoDerived = false;
        }
        return updated;
      });
      let withFormulas = next;
      if (isLftPanelTestName(filterKey)) {
        withFormulas = applyLftFormulas(next);
      } else if (isRftKftPanelTestName(filterKey)) {
        withFormulas = applyRftKftFormulas(next, { age: patient?.age, gender: patient?.gender });
      } else if (isLipidProfilePanelTestName(filterKey)) {
        withFormulas = applyLipidProfileFormulas(next);
      } else if (isHbA1cPanelTestName(filterKey)) {
        withFormulas = applyHbA1cFormulas(next);
      } else if (isElectrolytePanelTestName(filterKey)) {
        withFormulas = applyElectrolyteFormulas(next);
      } else if (isIronProfilePanelTestName(filterKey)) {
        withFormulas = applyIronProfileFormulas(next);
      } else if (isCardiacProfilePanelTestName(filterKey)) {
        withFormulas = applyCardiacProfileFormulas(next);
      } else if (isBoneProfilePanelTestName(filterKey)) {
        withFormulas = applyBoneProfileFormulas(next);
      } else if (isInfectionInflammatoryProfilePanelTestName(filterKey)) {
        withFormulas = applyInfectionInflammatoryProfileFormulas(next);
      }
      return { ...prev, [filterKey]: withFormulas };
    });
  };
  const addBiochemistryRow = () => {
    if (!biochemistryFilter) return;
    const filterKey = findCatalogTestName(biochemistryFilter, BIOCHEMISTRY_TESTS);
    setBiochemistryRowsByTest((prev) => {
      const current = getPanelRowsByTest(prev, filterKey, BIOCHEMISTRY_TESTS);
      return { ...prev, [filterKey]: [...current, { parameter: '', result: '', unit: '', referenceRange: '' }] };
    });
  };
  const setHormoneProfileVal = (testKey, index, key, value) => {
    const filterKey = resolveHormoneFilterKey(testKey);
    if (!filterKey) return;
    setHormoneProfileRowsByTest((prev) => {
      const catalog = HORMONE_PROFILE_FIRST_5_TESTS;
      const templateHit = catalog.find((t) => normalizeText(t.name) === normalizeText(filterKey));
      const templateRows = templateHit?.rows?.length ? cloneCatalogRows(templateHit.rows) : [];
      const base = getPanelRowsByTest(prev, filterKey, catalog);
      const rows = mergeHormoneProfileRows(base, templateRows);

      const nextRows = rows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const updated = { ...row, [key]: value };
        if (key === 'result' && (isHormoneFt3Ft4RatioParameter(row?.parameter) || isFertilityHormonalProfileDerivedParameter(row?.parameter))) {
          updated.autoDerived = false;
        }
        return updated;
      });

      let map = { ...prev, [filterKey]: nextRows };
      if (isHormoneFt3TestName(filterKey) || isHormoneFt4TestName(filterKey)) {
        return syncHormoneFt3Ft4Panels(map, catalog);
      }
      if (isFertilityHormonalProfilePanelTestName(filterKey)) {
        map[filterKey] = applyFertilityHormonalProfileFormulas(nextRows);
        return map;
      }
      return map;
    });
  };
  const setMicrobiologyVal = (index, key, value) => {
    if (!microbiologyFilter) return;
    const filterKey = findCatalogTestName(microbiologyFilter, MICROBIOLOGY_TESTS);
    setMicrobiologyRowsByTest((prev) => ({
      ...prev,
      [filterKey]: getEditablePanelRows(prev, filterKey, MICROBIOLOGY_TESTS).map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    }));
  };
  const addMicrobiologyRow = () => {
    if (!microbiologyFilter) return;
    const filterKey = findCatalogTestName(microbiologyFilter, MICROBIOLOGY_TESTS);
    setMicrobiologyRowsByTest((prev) => {
      const current = getPanelRowsByTest(prev, filterKey, MICROBIOLOGY_TESTS);
      return { ...prev, [filterKey]: [...current, { parameter: '', result: '', unit: '', referenceRange: '' }] };
    });
  };
  const setMicrobiologyRemarks = (value) => {
    if (!microbiologyFilter) return;
    const filterKey = findCatalogTestName(microbiologyFilter, MICROBIOLOGY_TESTS);
    setMicrobiologyRemarksByTest((prev) => ({ ...prev, [filterKey]: value }));
  };
  const setSerologyVal = (index, key, value) => {
    if (!serologyFilter) return;
    const filterKey = findCatalogTestName(serologyFilter, SEROLOGY_TESTS);
    setSerologyRowsByTest((prev) => ({
      ...prev,
      [filterKey]: getEditablePanelRows(prev, filterKey, SEROLOGY_TESTS).map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    }));
  };
  const addSerologyRow = () => {
    if (!serologyFilter) return;
    const filterKey = findCatalogTestName(serologyFilter, SEROLOGY_TESTS);
    setSerologyRowsByTest((prev) => {
      const current = getPanelRowsByTest(prev, filterKey, SEROLOGY_TESTS);
      return { ...prev, [filterKey]: [...current, { parameter: '', result: '', unit: '', referenceRange: '' }] };
    });
  };
  const setSerologyRemarks = (value) => {
    if (!serologyFilter) return;
    const filterKey = findCatalogTestName(serologyFilter, SEROLOGY_TESTS);
    setSerologyRemarksByTest((prev) => ({ ...prev, [filterKey]: value }));
  };
  const setClinicalPathologyVal = (index, key, value) => {
    if (!clinicalPathologyFilter) return;
    const catalog = CLINICAL_PATHOLOGY_TESTS.map((name) => ({ name }));
    const filterKey = findCatalogTestName(clinicalPathologyFilter, catalog);
    setClinicalPathologyRowsByTest((prev) => ({
      ...prev,
      [filterKey]: getEditablePanelRows(prev, filterKey, catalog).map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    }));
  };
  const addClinicalPathologyRow = () => {
    if (!clinicalPathologyFilter) return;
    const catalog = CLINICAL_PATHOLOGY_TESTS.map((name) => ({ name }));
    const filterKey = findCatalogTestName(clinicalPathologyFilter, catalog);
    setClinicalPathologyRowsByTest((prev) => {
      const current = getPanelRowsByTest(prev, filterKey, catalog);
      return { ...prev, [filterKey]: [...current, { parameter: '', result: '', unit: '', referenceRange: '' }] };
    });
  };
  const setHepatologyGastroVal = (index, key, value) => {
    const filterKey = String(hepatologyGastroFilter || '').trim();
    if (!filterKey) return;
    setHepatologyGastroRowsByTest((prev) => {
      const currentRows = getHepatologyGastroRowsForFilter(prev, filterKey);
      return {
        ...prev,
        [filterKey]: currentRows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
      };
    });
  };
  const addHepatologyGastroRow = () => {
    const filterKey = String(hepatologyGastroFilter || '').trim();
    if (!filterKey) return;
    setHepatologyGastroRowsByTest((prev) => {
      const currentRows = getHepatologyGastroRowsForFilter(prev, filterKey);
      return {
        ...prev,
        [filterKey]: [...currentRows, { parameter: '', result: '', unit: '', referenceRange: '' }],
      };
    });
  };
  const setInfectiousDiseaseVal = (index, key, value) => {
    if (!infectiousDiseaseFilter) return;
    const filterKey = findCatalogTestName(infectiousDiseaseFilter, INFECTIOUS_DISEASE_MARKERS_TESTS);
    setInfectiousDiseaseRowsByTest((prev) => ({
      ...prev,
      [filterKey]: getEditablePanelRows(prev, filterKey, INFECTIOUS_DISEASE_MARKERS_TESTS).map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    }));
  };
  const addInfectiousDiseaseRow = () => {
    if (!infectiousDiseaseFilter) return;
    const filterKey = findCatalogTestName(infectiousDiseaseFilter, INFECTIOUS_DISEASE_MARKERS_TESTS);
    setInfectiousDiseaseRowsByTest((prev) => {
      const current = getPanelRowsByTest(prev, filterKey, INFECTIOUS_DISEASE_MARKERS_TESTS);
      return { ...prev, [filterKey]: [...current, { parameter: '', result: '', unit: '', referenceRange: '' }] };
    });
  };
  const setOrthopedicsVal = (index, key, value) => {
    if (!orthopedicsFilter) return;
    const catalog = ORTHOPEDICS_PANEL_TESTS.map((name) => ({ name }));
    const filterKey = findCatalogTestName(orthopedicsFilter, catalog);
    setOrthopedicsRowsByTest((prev) => {
      const base = getEditablePanelRows(prev, filterKey, catalog);
      const next = base.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const updated = { ...row, [key]: value };
        if (key === 'result' && isArthritisProfileDerivedParameter(row?.parameter)) {
          updated.autoDerived = false;
        }
        return updated;
      });

      let withFormulas = next;
      if (isArthritisProfilePanelTestName(filterKey)) {
        withFormulas = applyArthritisProfileFormulas(next);
      }
      return { ...prev, [filterKey]: withFormulas };
    });
  };
  const addOrthopedicsRow = () => {
    if (!orthopedicsFilter) return;
    const catalog = ORTHOPEDICS_PANEL_TESTS.map((name) => ({ name }));
    const filterKey = findCatalogTestName(orthopedicsFilter, catalog);
    setOrthopedicsRowsByTest((prev) => {
      const current = getPanelRowsByTest(prev, filterKey, catalog);
      return { ...prev, [filterKey]: [...current, { parameter: '', result: '', unit: '', referenceRange: '' }] };
    });
  };

  const setTumorMarkerVal = (index, key, value) => {
    const filterKey = findCatalogTestName(tumorMarkerFilter, TUMOR_MARKER_TESTS);
    if (!filterKey) return;
    setTumorMarkerRowsByTest((prev) => ({
      ...prev,
      [filterKey]: getEditablePanelRows(prev, filterKey, TUMOR_MARKER_TESTS).map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    }));
  };
  const addTumorMarkerRow = () => {
    const filterKey = String(tumorMarkerFilter || '').trim();
    if (!filterKey) return;
    setTumorMarkerRowsByTest((prev) => {
      const current = getPanelRowsByTest(prev, filterKey, TUMOR_MARKER_TESTS);
      return { ...prev, [filterKey]: [...current, { parameter: '', result: '', unit: '', referenceRange: '' }] };
    });
  };

  const setAutoimmuneCollagenVal = (index, key, value) => {
    const filterKey = findCatalogTestName(autoimmuneCollagenFilter, AUTOIMMUNE_COLLAGEN_MARKERS_TESTS);
    if (!filterKey) return;
    setAutoimmuneCollagenRowsByTest((prev) => ({
      ...prev,
      [filterKey]: getEditablePanelRows(prev, filterKey, AUTOIMMUNE_COLLAGEN_MARKERS_TESTS).map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    }));
  };
  const addAutoimmuneCollagenRow = () => {
    const filterKey = String(autoimmuneCollagenFilter || '').trim();
    if (!filterKey) return;
    setAutoimmuneCollagenRowsByTest((prev) => {
      const current = getPanelRowsByTest(prev, filterKey, AUTOIMMUNE_COLLAGEN_MARKERS_TESTS);
      return { ...prev, [filterKey]: [...current, { parameter: '', result: '', unit: '', referenceRange: '' }] };
    });
  };

  const submit = async () => {
    if (!detail?.id) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const orderTests = Array.isArray(detail?.items) ? detail.items : [];

      const hematologyResults = collectOrderedPanelResults(
        testsForDepartment(orderTests, 'Hematology'),
        HEMATOLOGY_TESTS,
        hematologyRowsByTest,
        ({ filterKey, row }) => ({
          testName: String(row.parameter || '').trim(),
          value: String(row.result || '').trim(),
          unit: String(row.unit || '').trim(),
          referenceRange: String(row.referenceRange || '').trim(),
          remarks: filterKey,
        }),
      );

      const biochemistryResults = collectOrderedPanelResults(
        testsForDepartment(orderTests, 'Biochemistry'),
        BIOCHEMISTRY_TESTS,
        biochemistryRowsByTest,
        ({ filterKey, row }) => ({
          testName: String(row.parameter || '').trim(),
          value: String(row.result || '').trim(),
          unit: String(row.unit || '').trim(),
          referenceRange: String(row.referenceRange || '').trim(),
          remarks: filterKey,
        }),
      );

      const microbiologyResults = collectOrderedPanelResults(
        testsForDepartment(orderTests, 'Microbiology'),
        MICROBIOLOGY_TESTS,
        microbiologyRowsByTest,
        ({ filterKey, row }) => ({
          testName: String(row.parameter || '').trim(),
          value: String(row.result || '').trim(),
          unit: String(row.unit || '').trim(),
          referenceRange: String(row.referenceRange || '').trim(),
          remarks: microbiologyRemarksByTest[filterKey] || '',
          group: filterKey,
        }),
      );

      const serologyResults = collectOrderedPanelResults(
        testsForDepartment(orderTests, 'Serology'),
        SEROLOGY_TESTS,
        serologyRowsByTest,
        ({ filterKey, row }) => ({
          testName: String(row.parameter || '').trim(),
          value: String(row.result || '').trim(),
          unit: String(row.unit || '').trim(),
          referenceRange: String(row.referenceRange || '').trim(),
          remarks: serologyRemarksByTest[filterKey] || '',
          group: filterKey,
        }),
      );

      const clinicalPathologyResults = collectOrderedPanelResults(
        testsForDepartment(orderTests, 'Clinical Pathology'),
        CLINICAL_PATHOLOGY_TESTS.map((name) => ({ name })),
        clinicalPathologyRowsByTest,
        ({ filterKey, row }) => ({
          testName: String(row.parameter || '').trim(),
          value: String(row.result || '').trim(),
          unit: String(row.unit || '').trim(),
          referenceRange: String(row.referenceRange || '').trim(),
          remarks: filterKey,
        }),
      );

      const hormoneProfileResults = collectOrderedPanelResults(
        testsForDepartment(orderTests, 'Hormone Profile'),
        HORMONE_PROFILE_FIRST_5_TESTS,
        hormoneProfileRowsByTest,
        ({ filterKey, row }) => ({
          testName: String(row.parameter || '').trim(),
          value: String(row.result || '').trim(),
          unit: String(row.unit || '').trim(),
          referenceRange: String(row.referenceRange || '').trim(),
          remarks: filterKey,
        }),
      );

      const tumorMarkerResults = collectOrderedPanelResults(
        testsForDepartment(orderTests, 'Tumor Marker'),
        TUMOR_MARKER_TESTS,
        tumorMarkerRowsByTest,
        ({ filterKey, row }) => ({
          testName: String(filterKey || '').trim(),
          value: String(row.result || '').trim(),
          unit: String(row.unit || '').trim(),
          referenceRange: String(row.referenceRange || '').trim(),
          remarks: '',
        }),
      );

      const orthopedicsResults = collectOrderedPanelResults(
        testsForDepartment(orderTests, 'Orthopedics / Arthritis / Collagen Profile Panel'),
        ORTHOPEDICS_PANEL_TESTS.map((name) => ({ name })),
        orthopedicsRowsByTest,
        ({ filterKey, row }) => ({
          testName: String(filterKey || '').trim(),
          value: String(row.result || '').trim(),
          unit: String(row.unit || '').trim(),
          referenceRange: String(row.referenceRange || '').trim(),
          remarks: String(row.result || '').trim(),
        }),
      );

      const infectiousDiseaseResults = collectOrderedPanelResults(
        testsForDepartment(orderTests, 'Infectious Disease Markers'),
        INFECTIOUS_DISEASE_MARKERS_TESTS,
        infectiousDiseaseRowsByTest,
        ({ filterKey, row }) => ({
          testName: String(filterKey || '').trim(),
          value: String(row.result || '').trim(),
          unit: String(row.unit || '').trim(),
          referenceRange: String(row.referenceRange || '').trim(),
          remarks: String(row.result || '').trim(),
        }),
      );

      const hepatologyGastroResults = collectOrderedPanelResults(
        testsForDepartment(orderTests, 'Hepatology & Gastroenterology'),
        HEPATLOGY_GASTROENTEROLOGY_TESTS,
        hepatologyGastroRowsByTest,
        ({ filterKey, row }) => ({
          testName: String(filterKey || '').trim(),
          value: String(row.result || '').trim(),
          unit: String(row.unit || '').trim(),
          referenceRange: String(row.referenceRange || '').trim(),
          remarks: String(row.result || '').trim(),
        }),
      );

      const autoimmuneCollagenResults = collectOrderedPanelResults(
        testsForDepartment(orderTests, 'AUTOIMMUNE & COLLAGEN MARKERS'),
        AUTOIMMUNE_COLLAGEN_MARKERS_TESTS,
        autoimmuneCollagenRowsByTest,
        ({ filterKey, row }) => ({
          testName: String(row.parameter || '').trim(),
          value: String(row.result || '').trim(),
          unit: String(row.unit || '').trim(),
          referenceRange: String(row.referenceRange || '').trim(),
          remarks: String(filterKey || '').trim(),
        }),
      );

      const orthopedicsOtherResults = orderTests

        .filter((test) => {
          const dept = normalizeText(departmentName(test));
          return (
            dept !== 'hematology' &&
            dept !== 'biochemistry' &&
            dept !== 'microbiology' &&
            dept !== 'serology' &&
            dept !== 'clinical pathology' &&
            dept !== 'orthopedics / arthritis / collagen profile panel' &&
            dept !== 'infectious disease markers' &&
            dept !== 'hepatology & gastroenterology' &&
            dept !== 'gastroenterology' &&
            dept !== 'hepatology' &&
            dept !== 'tumor marker' &&
            dept !== 'autoimmune & collagen markers'
          );
        })
        .map((test) => {
          const key = `t_${test.id || resultKey(test.testName)}`;
          return {
            testName: String(values[`${key}_name`] || test.testName || '').trim(),
            value: String(values[`${key}_value`] || '').trim(),
            unit: String(values[`${key}_unit`] || test.unit || '').trim(),
            referenceRange: String(values[`${key}_referenceRange`] || test.referenceRange || '').trim(),
            remarks: String(values[`${key}_remarks`] || '').trim(),
          };
        });

      const results = [
        ...hematologyResults,
        ...biochemistryResults,
        ...microbiologyResults,
        ...serologyResults,
        ...clinicalPathologyResults,
        ...hormoneProfileResults,
        ...tumorMarkerResults,
        ...orthopedicsResults,
        ...infectiousDiseaseResults,
        ...hepatologyGastroResults,
        ...autoimmuneCollagenResults,
        ...orthopedicsOtherResults,
      ];




      const missing = results.find((result) => !result.testName || !String(result.value || '').trim());

      if (!results.length) {
        setError('Please fill at least one test result in the department table before submitting.');
        return;
      }

      if (missing) {
        setError(`Result required for: ${missing.testName || 'selected test'}`);
        return;
      }

      await api.post(`/lab/orders/${encodeURIComponent(detail.id)}/results`, {
        results,
        overallRemarks: values.overallRemarks || '',
        diagnosis: values.diagnosis || '',
        verifiedBy: values.verifiedBy || '',
        approvedBy: values.approvedBy || '',
        reportStatus: values.reportStatus || 'COMPLETED',
      });

      setMessage('Results submitted successfully.');
      setSelectedId('');
      setDetail(null);
      setSearch('');
      setActiveDepartment('');
      setHematologyFilter('');
      setBiochemistryFilter('');
      setMicrobiologyFilter('');
      setSerologyFilter('');
      setMicrobiologyRemarksByTest({});
      setSerologyRemarksByTest({});
      setClinicalPathologyFilter('');
      setHepatologyGastroFilter('');
      setInfectiousDiseaseFilter('');
      setOrthopedicsFilter('');
      setTumorMarkerFilter('');
      setAutoimmuneCollagenFilter('');
      await load();

    } catch (e) {
      setError(e?.response?.data?.message || 'Could not submit results.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full p-4 sm:p-6 space-y-4">
       

        {error ? <div className="pl-miniError">{error}</div> : null}
        {message ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
            <MdCheckCircle className="w-5 h-5" />
            {message}
          </div>
        ) : null}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="relative max-w-4xl">
            <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSuggestionsOpen(true);
              }}
              onFocus={() => setSuggestionsOpen(true)}
              onBlur={() => setTimeout(() => setSuggestionsOpen(false), 140)}
              placeholder="Search patient / UHID / IPD"
              className="w-full h-14 rounded-2xl border border-gray-200 bg-gray-50 pl-12 pr-4 text-base font-semibold text-gray-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />

            {suggestionsOpen ? (
              <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
                <div className="max-h-80 overflow-auto">
                  {loading ? (
                    <div className="px-4 py-4 text-sm font-semibold text-gray-400">Loading...</div>
                  ) : suggestions.length ? (
                    suggestions.map((order) => {
                      const p = order.patient || {};
                      return (
                        <button
                          key={order.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectPatient(order)}
                          className="w-full border-b border-gray-50 px-4 py-3 text-left transition hover:bg-blue-50/60 last:border-b-0"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-extrabold text-gray-900">{displayValue(p.name)}</p>
                              <p className="mt-1 truncate text-xs font-mono font-bold text-blue-700">
                                {displayValue(p.uhid)} / {displayValue(order.ipdNo || order.orderNumber)}
                              </p>
                            </div>
                            <p className="shrink-0 text-xs font-extrabold text-gray-500">{formatAgeGender(p)}</p>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-4 text-sm font-semibold text-gray-500">No pending result patients found.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {!selectedId ? null : detailLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-sm font-semibold text-gray-400">Loading patient details...</div>
        ) : !detail ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-sm font-semibold text-gray-500">Order not found.</div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                {[
                  ['Patient Name', patient?.name],
                  ['UHID/IPD', patient?.uhid || detail.ipdNo || detail.orderNumber],
                  ['Age/Gender', formatAgeGender(patient)],
                  ['Doctor Name', detail.doctor?.user?.name],
                  ['Sample Status', formatStatus(detail.status)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-gray-100 bg-slate-50/70 p-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-500">{label}</p>
                    <p className="mt-1 break-words text-sm font-extrabold text-gray-900">{displayValue(value)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
              <p className="text-xs font-extrabold uppercase tracking-wide text-gray-600">Departments</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {departments.length ? (
                  departments.map((department) => (
                    <button
                      key={department}
                      type="button"
                      onClick={() => setActiveDepartment(department)}
                      className={`rounded-full border px-4 py-2 text-xs font-extrabold transition ${
                        visibleDepartment === department
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                          : 'border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100'
                      }`}
                    >
                      {department}
                    </button>
                  ))
                ) : (
                  <span className="text-sm font-semibold text-gray-500">No department found.</span>
                )}
              </div>

              <div className="mt-4">
                <div className="max-w-sm">
                
                  <select
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-extrabold text-gray-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={visibleDepartment}
                    onChange={(e) => setActiveDepartment(e.target.value)}
                  >
                    {ALL_DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {visibleDepartment ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                {advisedDepartmentTests.length ? (
                  <div className="mb-4 rounded-2xl border border-gray-100 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600">Reception tests</p>
                      <p className="text-[11px] font-extrabold text-gray-500">
                        {advisedDepartmentTests.filter((t) => isDepartmentTestDone(t)).length}/{advisedDepartmentTests.length}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {advisedDepartmentTests.map((name) => {
                        const active = isSameTestName(name, departmentFilterState.filter);
                        const done = isDepartmentTestDone(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => goToDepartmentTest(name)}
                            className={`rounded-full border px-3 py-2 text-xs font-extrabold transition ${
                              active
                                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                : done
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                  : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                            }`}
                            title={name}
                          >
                            <span className="max-w-[220px] inline-block truncate align-middle">{name}</span>
                            <span className={`ml-2 align-middle text-[10px] ${active ? 'text-white/90' : done ? 'text-emerald-700' : 'text-gray-400'}`}>
                              {done ? 'DONE' : 'PENDING'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={goPrevDeptTest}
                        disabled={advisedDepartmentTests.length < 2}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={goNextDeptTest}
                        disabled={advisedDepartmentTests.length < 2}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}

                {isHematologyActive ? (
                  <DepartmentTestFilterSection
                    title="Hematology"
                    tests={departmentFilterDropdownTests}
                    filter={hematologyFilter}
                    onFilterChange={setHematologyFilter}
                    rows={selectedHematologyRows}
                    onRowChange={setHematologyVal}
                    onAddRow={addHematologyRow}
                    receptionAdvisedTests={advisedDepartmentTests}
                    isAutoCalculatedRow={(row) => {
                      const filterKey = findCatalogTestName(hematologyFilter, HEMATOLOGY_TESTS);
                      return (
                        (isCbcName(filterKey) && isCbcDerivedParameter(row?.parameter)) ||
                        (isCoagulationProfilePanelTestName(filterKey) &&
                          isCoagulationProfileDerivedParameter(row?.parameter))
                      );
                    }}
                  />
                ) : null}

                {isBiochemistryActive ? (
                  <DepartmentTestFilterSection
                    title="Biochemistry"
                    tests={departmentFilterDropdownTests}
                    filter={biochemistryFilter}
                    onFilterChange={setBiochemistryFilter}
                    rows={selectedBiochemistryRows}
                    onRowChange={setBiochemistryVal}
                    onAddRow={addBiochemistryRow}
                    receptionAdvisedTests={advisedDepartmentTests}
                    isAutoCalculatedRow={(row) => {
                      const filterKey = findCatalogTestName(biochemistryFilter, BIOCHEMISTRY_TESTS);
                      return (
                        (isLftPanelTestName(filterKey) && isLftDerivedParameter(row?.parameter)) ||
                        (isRftKftPanelTestName(filterKey) && isRftKftDerivedParameter(row?.parameter)) ||
                        (isLipidProfilePanelTestName(filterKey) && isLipidProfileDerivedParameter(row?.parameter)) ||
                        (isHbA1cPanelTestName(filterKey) && isHbA1cDerivedParameter(row?.parameter)) ||
                        (isElectrolytePanelTestName(filterKey) && isElectrolyteDerivedParameter(row?.parameter)) ||
                        (isIronProfilePanelTestName(filterKey) && isIronProfileDerivedParameter(row?.parameter)) ||
                        (isCardiacProfilePanelTestName(filterKey) && isCardiacProfileDerivedParameter(row?.parameter)) ||
                        (isBoneProfilePanelTestName(filterKey) && isBoneProfileDerivedParameter(row?.parameter)) ||
                        (isInfectionInflammatoryProfilePanelTestName(filterKey) &&
                          isInfectionInflammatoryProfileDerivedParameter(row?.parameter))
                      );
                    }}
                  />
                ) : null}

                {isMicrobiologyActive ? (
                  <DepartmentTestFilterSection
                    title="Microbiology"
                    tests={departmentFilterDropdownTests}
                    filter={microbiologyFilter}
                    onFilterChange={setMicrobiologyFilter}
                    rows={selectedMicrobiologyRows}
                    onRowChange={setMicrobiologyVal}
                    onAddRow={addMicrobiologyRow}
                    receptionAdvisedTests={advisedDepartmentTests}
                    placeholder="Select microbiology test"
                    parameterReadOnly={false}
                    remarks={selectedMicrobiologyRemarks}
                    onRemarksChange={setMicrobiologyRemarks}
                  />
                ) : null}

                {isSerologyActive ? (
                  <DepartmentTestFilterSection
                    title="Serology"
                    tests={serologyDropdownTests}
                    filter={serologyFilter}
                    onFilterChange={setSerologyFilter}
                    rows={selectedSerologyRows}
                    onRowChange={setSerologyVal}
                    onAddRow={addSerologyRow}
                    receptionAdvisedTests={advisedDepartmentTests}
                    placeholder="Select serology test"
                    parameterReadOnly={false}
                    remarks={selectedSerologyRemarks}
                    onRemarksChange={setSerologyRemarks}
                  />
                ) : null}

                {isClinicalPathologyActive ? (
                  <DepartmentTestFilterSection
                    title="Clinical Pathology"
                    tests={departmentFilterDropdownTests}
                    filter={clinicalPathologyFilter}
                    onFilterChange={setClinicalPathologyFilter}
                    rows={selectedClinicalPathologyRows}
                    onRowChange={setClinicalPathologyVal}
                    onAddRow={addClinicalPathologyRow}
                    receptionAdvisedTests={advisedDepartmentTests}
                  />
                ) : null}

                {isHormoneProfileActive ? (
                  <HormoneProfileSection
                    filter={hormoneProfileFilter}
                    onFilterChange={setHormoneProfileFilter}
                    rowsByTest={hormoneProfileRowsByTest}
                    onRowChange={setHormoneProfileVal}
                  />
                ) : null}

                {isHepatologyGastroActive ? (
                  <div className="space-y-3">
                    <DepartmentTestFilterSection
                      title={visibleDepartment || 'Gastroenterology'}
                      tests={departmentFilterDropdownTests}
                      filter={hepatologyGastroFilter}
                      onFilterChange={(value) => setHepatologyGastroFilter(String(value || '').trim())}
                      rows={selectedHepatologyGastroRows}
                      onRowChange={setHepatologyGastroVal}
                      onAddRow={addHepatologyGastroRow}
                      receptionAdvisedTests={advisedDepartmentTests}
                    />

                    <div className="text-[11px] font-extrabold text-gray-600">
                      Dropdown total: {departmentFilterDropdownTests?.length || 0} (expected 25)
                    </div>


                  </div>
                ) : null}

                {isTumorMarkerActive ? (
                  <div className="space-y-3">
                    <DepartmentTestFilterSection
                      title="Tumor Marker"
                      tests={departmentFilterDropdownTests}
                      filter={tumorMarkerFilter}
                      onFilterChange={(value) => setTumorMarkerFilter(String(value || '').trim())}
                      rows={selectedTumorMarkerRows}
                      onRowChange={setTumorMarkerVal}
                      onAddRow={addTumorMarkerRow}
                      receptionAdvisedTests={advisedDepartmentTests}
                    />

                    <div className="text-[11px] font-extrabold text-gray-600">
                      Dropdown total: {TUMOR_MARKER_TESTS?.length || 0} (expected 21)
                    </div>
                  </div>
                ) : null}


                {isInfectiousDiseaseActive ? (
                  <DepartmentTestFilterSection
                    title="Infectious Disease Markers"
                    tests={departmentFilterDropdownTests}
                    filter={infectiousDiseaseFilter}
                    onFilterChange={setInfectiousDiseaseFilter}
                    rows={selectedInfectiousDiseaseRows}
                    onRowChange={setInfectiousDiseaseVal}
                    onAddRow={addInfectiousDiseaseRow}
                    receptionAdvisedTests={advisedDepartmentTests}
                  />
                ) : null}

                {isAutoimmuneCollagenActive ? (
                  <DepartmentTestFilterSection
                    title="AUTOIMMUNE & COLLAGEN MARKERS"
                    tests={departmentFilterDropdownTests}
                    filter={autoimmuneCollagenFilter}
                    onFilterChange={(value) => setAutoimmuneCollagenFilter(String(value || '').trim())}
                    rows={selectedAutoimmuneCollagenRows}
                    onRowChange={setAutoimmuneCollagenVal}
                    onAddRow={addAutoimmuneCollagenRow}
                    receptionAdvisedTests={advisedDepartmentTests}
                  />
                ) : null}

                {isOrthopedicsActive ? (
                  <DepartmentTestFilterSection
                    title="Orthopedics"
                    tests={departmentFilterDropdownTests}
                    filter={orthopedicsFilter}
                    onFilterChange={setOrthopedicsFilter}
                    rows={selectedOrthopedicsRows}
                    onRowChange={setOrthopedicsVal}
                    onAddRow={addOrthopedicsRow}
                    isAutoCalculatedRow={(row) => isArthritisProfileDerivedParameter(row?.parameter)}
                    receptionAdvisedTests={advisedDepartmentTests}
                  />
                ) : null}

                {!isHematologyActive &&
                !isBiochemistryActive &&
                !isMicrobiologyActive &&
                !isSerologyActive &&
                !isClinicalPathologyActive &&
                !isHormoneProfileActive &&
                !isHepatologyGastroActive &&
                !isTumorMarkerActive &&
                !isInfectiousDiseaseActive &&
                !isAutoimmuneCollagenActive &&
                !isOrthopedicsActive &&
                visibleOtherTests.length ? (
                  <div className={visibleCbcTest ? 'mt-4 overflow-auto rounded-xl border border-gray-100' : 'overflow-auto rounded-xl border border-gray-100'}>
                    <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="border-b border-gray-100 px-3 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">Parameter</th>
                          <th className="border-b border-gray-100 px-3 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">Result</th>
                          <th className="border-b border-gray-100 px-3 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">Unit</th>
                          <th className="border-b border-gray-100 px-3 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">Range</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleOtherTests.map((test) => {
                          const key = `t_${test.id || resultKey(test.testName)}`;
                          return (
                            <tr key={test.id}>
                              <td className="border-b border-gray-50 px-3 py-2">
                                <input className={inputCls} value={values[`${key}_name`] || test.testName || ''} onChange={(e) => setVal(`${key}_name`, e.target.value)} />
                              </td>
                              <td className="border-b border-gray-50 px-3 py-2">
                                <input className={inputCls} value={values[`${key}_value`] || ''} onChange={(e) => setVal(`${key}_value`, e.target.value)} placeholder="Enter result" />
                              </td>
                              <td className="border-b border-gray-50 px-3 py-2">
                                <input className={inputCls} value={values[`${key}_unit`] || ''} onChange={(e) => setVal(`${key}_unit`, e.target.value)} />
                              </td>
                              <td className="border-b border-gray-50 px-3 py-2">
                                <input className={inputCls} value={values[`${key}_referenceRange`] || ''} onChange={(e) => setVal(`${key}_referenceRange`, e.target.value)} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-gray-600 mb-1.5">Overall remarks</label>
                  <textarea className={inputCls} rows={3} value={values.overallRemarks || ''} onChange={(e) => setVal('overallRemarks', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-gray-600 mb-1.5">Diagnosis / Interpretation</label>
                  <textarea className={inputCls} rows={3} value={values.diagnosis || ''} onChange={(e) => setVal('diagnosis', e.target.value)} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-gray-600 mb-1.5">Verified by</label>
                  <input className={inputCls} value={values.verifiedBy || ''} onChange={(e) => setVal('verifiedBy', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-gray-600 mb-1.5">Approved by (Doctor)</label>
                  <input className={inputCls} value={values.approvedBy || ''} onChange={(e) => setVal('approvedBy', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-gray-600 mb-1.5">Report status</label>
                  <select className="pl-select w-full" value={values.reportStatus || 'COMPLETED'} onChange={(e) => setVal('reportStatus', e.target.value)}>
                    <option value="COMPLETED">Completed</option>
                    <option value="VERIFIED">Verified</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={submit}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #065f46, #059669)' }}
                >
                  <MdCheckCircle className="w-5 h-5" />
                  {saving ? 'Submitting...' : 'Submit Results'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
