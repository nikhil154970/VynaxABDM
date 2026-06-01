/** Hospital contact shown on OPD, lab, and billing print slips (header MO row). */
export const HOSPITAL_PHONE_PRIMARY = '+91 75410 31287';
export const HOSPITAL_PHONE_SECONDARY = '9559988876';

/** HTML for slip header row (right-aligned MO block). */
export function hospitalMobileSlipHtml() {
  return `<div style="text-align:right;line-height:1.35"><b>MO:</b><br/>${HOSPITAL_PHONE_PRIMARY}<br/>${HOSPITAL_PHONE_SECONDARY}</div>`;
}
