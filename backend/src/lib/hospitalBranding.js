/** Shared hospital identity for API print payloads (bills, GRN, PO, etc.). */
const HOSPITAL_PRINT = {
  nameEn: 'NEW H.T. HOSPITAL',
  nameHi: 'नया एच.टी. हॉस्पिटल',
  address: 'ANAND BIHAR COLONY, BHIKHARIPUR BLW, VARANASI, U.P - 221004',
  phone: '+91 75410 31287',
  email: 'naitikhospital@gmail.com',
};

function getHospitalPrintMeta() {
  return { ...HOSPITAL_PRINT };
}

module.exports = { HOSPITAL_PRINT, getHospitalPrintMeta };
