const sessionsByTransactionId = new Map();

function cloneJson(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value));
}

function saveHiSession({
  consentId,
  transactionId,
  dateRange,
  dataPushUrl,
  keyMaterial,
  requestId,
  receivedAt,
} = {}) {
  const txnId = String(transactionId || '').trim();
  if (!txnId) {
    return null;
  }

  const session = {
    consentId: String(consentId || '').trim() || null,
    transactionId: txnId,
    dateRange: {
      from: String(dateRange?.from || '').trim() || null,
      to: String(dateRange?.to || '').trim() || null,
    },
    dataPushUrl: String(dataPushUrl || '').trim() || null,
    keyMaterial: cloneJson(keyMaterial),
    requestId: String(requestId || '').trim() || null,
    receivedAt: receivedAt instanceof Date ? receivedAt.toISOString() : receivedAt || new Date().toISOString(),
  };

  sessionsByTransactionId.set(txnId, session);
  return session;
}

function getHiSessionByTransactionId(transactionId) {
  const txnId = String(transactionId || '').trim();
  if (!txnId) return null;
  const session = sessionsByTransactionId.get(txnId);
  return session ? cloneJson(session) : null;
}

module.exports = {
  saveHiSession,
  getHiSessionByTransactionId,
};
