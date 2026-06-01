/**
 * Seed: 10 test medicines for pharmacy master.
 * Run: node scripts/seed-pharmacy-medicines.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/prisma');

const TEST_MEDICINES = [
  {
    medicineName: 'Paracetamol 650mg',
    genericName: 'Paracetamol',
    brandName: 'Dolo 650',
    category: 'Analgesic',
    dosageForm: 'Tablet',
    strength: '650mg',
    manufacturer: 'Micro Labs',
    hsnCode: '30049099',
    gstPercentage: 12,
    barcode: 'TEST-MED-001',
    defaultMRP: 35,
    defaultPurchasePrice: 22,
    defaultSellingPrice: 30,
    prescriptionRequired: false,
    expiryApplicable: true,
  },
  {
    medicineName: 'Amoxicillin 500mg',
    genericName: 'Amoxicillin',
    brandName: 'Moxikind',
    category: 'Antibiotic',
    dosageForm: 'Capsule',
    strength: '500mg',
    manufacturer: 'Mankind',
    hsnCode: '30041010',
    gstPercentage: 12,
    barcode: 'TEST-MED-002',
    defaultMRP: 120,
    defaultPurchasePrice: 80,
    defaultSellingPrice: 100,
    prescriptionRequired: true,
    expiryApplicable: true,
  },
  {
    medicineName: 'Cetirizine 10mg',
    genericName: 'Cetirizine',
    brandName: 'Okacet',
    category: 'Antihistamine',
    dosageForm: 'Tablet',
    strength: '10mg',
    manufacturer: 'Cipla',
    hsnCode: '30049099',
    gstPercentage: 12,
    barcode: 'TEST-MED-003',
    defaultMRP: 25,
    defaultPurchasePrice: 14,
    defaultSellingPrice: 20,
    prescriptionRequired: false,
    expiryApplicable: true,
  },
  {
    medicineName: 'Omeprazole 20mg',
    genericName: 'Omeprazole',
    brandName: 'Omez',
    category: 'Antacid',
    dosageForm: 'Capsule',
    strength: '20mg',
    manufacturer: 'Dr Reddy\'s',
    hsnCode: '30049099',
    gstPercentage: 12,
    barcode: 'TEST-MED-004',
    defaultMRP: 95,
    defaultPurchasePrice: 58,
    defaultSellingPrice: 78,
    prescriptionRequired: false,
    expiryApplicable: true,
  },
  {
    medicineName: 'Azithromycin 500mg',
    genericName: 'Azithromycin',
    brandName: 'Azee 500',
    category: 'Antibiotic',
    dosageForm: 'Tablet',
    strength: '500mg',
    manufacturer: 'Cipla',
    hsnCode: '30042019',
    gstPercentage: 12,
    barcode: 'TEST-MED-005',
    defaultMRP: 145,
    defaultPurchasePrice: 95,
    defaultSellingPrice: 125,
    prescriptionRequired: true,
    expiryApplicable: true,
  },
  {
    medicineName: 'Metformin 500mg',
    genericName: 'Metformin',
    brandName: 'Glycomet',
    category: 'Antidiabetic',
    dosageForm: 'Tablet',
    strength: '500mg',
    manufacturer: 'USV',
    hsnCode: '30049099',
    gstPercentage: 5,
    barcode: 'TEST-MED-006',
    defaultMRP: 42,
    defaultPurchasePrice: 24,
    defaultSellingPrice: 35,
    prescriptionRequired: true,
    expiryApplicable: true,
  },
  {
    medicineName: 'Pantoprazole 40mg',
    genericName: 'Pantoprazole',
    brandName: 'Pantocid',
    category: 'Antacid',
    dosageForm: 'Tablet',
    strength: '40mg',
    manufacturer: 'Sun Pharma',
    hsnCode: '30049099',
    gstPercentage: 12,
    barcode: 'TEST-MED-007',
    defaultMRP: 110,
    defaultPurchasePrice: 68,
    defaultSellingPrice: 92,
    prescriptionRequired: false,
    expiryApplicable: true,
  },
  {
    medicineName: 'Diclofenac 50mg',
    genericName: 'Diclofenac',
    brandName: 'Voveran 50',
    category: 'Analgesic',
    dosageForm: 'Tablet',
    strength: '50mg',
    manufacturer: 'Novartis',
    hsnCode: '30049099',
    gstPercentage: 12,
    barcode: 'TEST-MED-008',
    defaultMRP: 55,
    defaultPurchasePrice: 32,
    defaultSellingPrice: 45,
    prescriptionRequired: false,
    expiryApplicable: true,
  },
  {
    medicineName: 'ORS Powder',
    genericName: 'Oral Rehydration Salts',
    brandName: 'Electral',
    category: 'Fluid & Electrolyte',
    dosageForm: 'Powder',
    strength: '21.8g sachet',
    manufacturer: 'FDC',
    hsnCode: '30049099',
    gstPercentage: 5,
    barcode: 'TEST-MED-009',
    defaultMRP: 22,
    defaultPurchasePrice: 12,
    defaultSellingPrice: 18,
    prescriptionRequired: false,
    expiryApplicable: true,
  },
  {
    medicineName: 'Ambroxol + Guaiphenesin Syrup',
    genericName: 'Ambroxol, Guaiphenesin',
    brandName: 'Ascoril D Plus',
    category: 'Cough & Cold',
    dosageForm: 'Syrup',
    strength: '100ml',
    manufacturer: 'Glenmark',
    hsnCode: '30049099',
    gstPercentage: 12,
    barcode: 'TEST-MED-010',
    defaultMRP: 165,
    defaultPurchasePrice: 105,
    defaultSellingPrice: 140,
    prescriptionRequired: false,
    expiryApplicable: true,
  },
];

async function main() {
  await prisma.$connect();

  let inserted = 0;
  let skipped = 0;

  for (const doc of TEST_MEDICINES) {
    const exists = await prisma.pharmacyMedicine.findFirst({ where: { barcode: doc.barcode } });
    if (exists) {
      console.log(`Skip (exists): ${doc.medicineName} [${doc.barcode}]`);
      skipped += 1;
      continue;
    }
    await prisma.pharmacyMedicine.create({
      data: { ...doc, status: 'ACTIVE' },
    });
    console.log(`Added: ${doc.medicineName}`);
    inserted += 1;
  }

  const total = await prisma.pharmacyMedicine.count({ where: { status: 'ACTIVE' } });
  console.log(`\nDone. Inserted: ${inserted}, skipped: ${skipped}. Active medicines in DB: ${total}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
