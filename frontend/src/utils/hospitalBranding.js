/** Hospital name & address on print slips, invoices, and export HTML. */
export const HOSPITAL_NAME_EN = 'NEW HI Hospital';
export const HOSPITAL_NAME_DISPLAY = 'NEW HI Hospital';
export const HOSPITAL_NAME_HI = 'NEW HI Hospital';
export const HOSPITAL_ADDRESS_LINE = 'ANAND BIHAR COLONY BHIKHARIPUR BLW, VARANASI, UP';
export const HOSPITAL_ADDRESS_FULL =
  'ANAND BIHAR COLONY, BHIKHARIPUR BLW, VARANASI, U.P - 221004';

export const BILLING_SLIP_NAME = 'VyanX Hospital Management System';
export const BILLING_SLIP_LOGO = '/mqe_logo.png';
export const APPOINTMENT_SLIP_NAME = 'VyanX Hospital Management System';
export const APPOINTMENT_SLIP_LOGO = '/mqe_logo.png';

/** Standard blue-header block used on OPD, billing, and lab slips. */
export function printSlipHeaderTextHtml() {
  return `
        <h1>${HOSPITAL_NAME_HI}</h1>
        <div class="sub">${HOSPITAL_NAME_EN}</div>
        <div class="addr">${HOSPITAL_ADDRESS_LINE}</div>`;
}

/** Billing slip header uses the VyanX branding requested by the user. */
export function printBillingSlipHeaderHtml() {
  return `
        <h1>${BILLING_SLIP_NAME}</h1>
        <div class="addr">${HOSPITAL_ADDRESS_LINE}</div>`;
}

/** Appointment / OPD slip header uses the same VyanX branding. */
export function printAppointmentSlipHeaderHtml() {
  return `
        <h1>${APPOINTMENT_SLIP_NAME}</h1>
        <div class="addr">${HOSPITAL_ADDRESS_LINE}</div>`;
}
