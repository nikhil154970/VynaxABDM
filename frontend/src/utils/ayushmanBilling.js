export const AYUSHMAN_PAYMENT_LABEL = 'PAID BY AYUSHMAN';

export function isAyushmanSponsor(sponsor) {
  const s = String(sponsor || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  return s === 'AYUSHMAN' || s === 'AYUSHMAN BHARAT' || s.includes('AYUSHMAN');
}

export function sponsorDisplayLabel(sponsor) {
  return isAyushmanSponsor(sponsor) ? 'Ayushman' : '';
}

function escHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function slipSponsorBannerHtml(sponsor) {
  if (!isAyushmanSponsor(sponsor)) return '';
  return `<div class="row-line" style="justify-content:flex-start;"><b>Patient Type:</b> ${escHtml('Ayushman')} &nbsp;&nbsp; <b>Sponsor:</b> ${escHtml('Ayushman')}</div>`;
}

/** Reserved — green banner removed; slips use Paid row + sponsor line only. */
export function slipAyushmanHighlightHtml() {
  return '';
}

export function applyAyushmanMoneyDisplay(amount, sponsor) {
  return amount;
}

export function ayushmanPaymentStatusLabel(sponsor, fallback = 'Pending') {
  return isAyushmanSponsor(sponsor) ? 'Paid' : fallback;
}

export const AYUSHMAN_BILLING_NOTICE =
  'यह मरीज Ayushman (आयुष्मान) के तहत है। Bill normal charges के साथ बनेगी; payment slip पर PAID BY AYUSHMAN दिखेगा — patient से due नहीं।';

export function ayushmanFormDefaults() {
  return { fee: '', registrationFee: '', paymentStatus: 'Paid', paymentMode: AYUSHMAN_PAYMENT_LABEL };
}
