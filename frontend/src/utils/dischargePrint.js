import { printDischargeSummaryTemplate } from './printDischargeSummaryTemplate';
import { printLamaForm } from './printLamaForm';
import { printDeathCertificate } from './printDeathCertificate';

/** @typedef {'normal'|'lama'|'death'} DischargeType */

/**
 * Print the correct discharge document based on saved dischargeType.
 * @param {{ summary: object, billing?: object|null }} opts
 */
export function printDischargeByType({ summary, billing = null, admission = null, printWindow = null } = {}) {
  if (!summary) return false;
  const type = String(summary.dischargeType || 'normal').toLowerCase();
  if (type === 'lama') {
    printLamaForm({ summary });
    return true;
  }
  if (type === 'death') {
    printDeathCertificate({ summary });
    return true;
  }
  return printDischargeSummaryTemplate({ summary, billing, admission, printWindow }) !== false;
}

export function dischargeTypeLabel(type) {
  const t = String(type || 'normal').toLowerCase();
  if (t === 'lama') return 'LAMA';
  if (t === 'death') return 'Death certificate';
  return 'Normal discharge';
}
