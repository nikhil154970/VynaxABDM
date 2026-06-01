-- Default catalog: common hospital lab tests with indicative prices (INR).
-- Runs only when LabTest is empty (safe for re-run / existing DBs).

DO $$
BEGIN
  IF (SELECT COUNT(*)::int FROM "LabTest") > 0 THEN
    RETURN;
  END IF;

  INSERT INTO "LabTest" ("name", "category", "price", "isActive", "createdAt", "updatedAt") VALUES
  -- Blood — hematology / general
  ('CBC (Complete Blood Count)', 'Blood', 400, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ESR', 'Blood', 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Blood Group & Rh', 'Blood', 180, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Peripheral Smear', 'Blood', 350, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Reticulocyte Count', 'Blood', 280, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- Blood — biochemistry
  ('Fasting Blood Sugar (FBS)', 'Blood', 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Post Prandial Blood Sugar (PPBS)', 'Blood', 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Random Blood Sugar (RBS)', 'Blood', 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('HbA1c', 'Blood', 550, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Lipid Profile', 'Blood', 650, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Liver Function Test (LFT)', 'Blood', 800, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Kidney Function Test (KFT / RFT)', 'Blood', 700, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Serum Creatinine', 'Blood', 200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Blood Urea Nitrogen (BUN)', 'Blood', 200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Serum Electrolytes (Na, K, Cl)', 'Blood', 550, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Serum Calcium', 'Blood', 250, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Serum Uric Acid', 'Blood', 250, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Serum Bilirubin (Total / Direct)', 'Blood', 300, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Serum Protein / Albumin', 'Blood', 350, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('TSH', 'Blood', 400, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('T3', 'Blood', 250, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('T4', 'Blood', 250, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Thyroid Profile (T3, T4, TSH)', 'Blood', 900, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Vitamin D3 (25-OH)', 'Blood', 1500, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Vitamin B12', 'Blood', 1000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Serum Ferritin', 'Blood', 650, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Iron / TIBC', 'Blood', 550, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('CRP (Quantitative)', 'Blood', 450, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('D-Dimer', 'Blood', 1800, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PT / INR', 'Blood', 350, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('APTT', 'Blood', 400, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- Blood — serology / infectious
  ('HIV Screening', 'Blood', 500, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('HBsAg (Hepatitis B)', 'Blood', 350, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Anti-HCV (Hepatitis C)', 'Blood', 600, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('VDRL / RPR', 'Blood', 200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Dengue NS1 Antigen', 'Blood', 750, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Dengue IgG / IgM', 'Blood', 900, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Typhoid (Widal)', 'Blood', 250, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Malaria Parasite (MP)', 'Blood', 200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Blood Culture & Sensitivity', 'Blood', 1100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- Urine
  ('Urine Routine / Microscopy', 'Urine', 200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Urine Culture & Sensitivity', 'Urine', 600, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('24-Hour Urine Protein', 'Urine', 450, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- Radiology
  ('X-Ray Chest (PA View)', 'Radiology', 350, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('X-Ray KUB', 'Radiology', 450, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('X-Ray Spine (L/S or C/S)', 'Radiology', 450, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('X-Ray PNS (Waters View)', 'Radiology', 400, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Ultrasound Whole Abdomen', 'Radiology', 1000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Ultrasound Pelvis', 'Radiology', 900, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Ultrasound Obstetric (NT / Anomaly)', 'Radiology', 1200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Ultrasound Neck / Thyroid', 'Radiology', 850, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- Other (ECG, etc.)
  ('ECG (12-Lead)', 'Other', 200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Hb Electrophoresis', 'Other', 900, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PSA', 'Other', 750, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Beta HCG (Quantitative)', 'Blood', 550, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
END $$;
