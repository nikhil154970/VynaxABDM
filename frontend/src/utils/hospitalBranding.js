/** Hospital name & address on print slips, invoices, and export HTML. */
export const HOSPITAL_NAME_EN = 'NEW H.T. HOSPITAL';
export const HOSPITAL_NAME_DISPLAY = 'New H.T. Hospital';
export const HOSPITAL_NAME_HI = 'नया एच.टी. हॉस्पिटल';
export const HOSPITAL_ADDRESS_LINE = 'ANAND BIHAR COLONY BHIKHARIPUR BLW, VARANASI, UP';
export const HOSPITAL_ADDRESS_FULL =
  'ANAND BIHAR COLONY, BHIKHARIPUR BLW, VARANASI, U.P - 221004';

/** Standard blue-header block used on OPD, billing, and lab slips. */
export function printSlipHeaderTextHtml() {
  return `
        <h1>${HOSPITAL_NAME_HI}</h1>
        <div class="sub">${HOSPITAL_NAME_EN}</div>
        <div class="addr">${HOSPITAL_ADDRESS_LINE}</div>`;
}
