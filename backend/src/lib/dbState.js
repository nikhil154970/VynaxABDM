let connected = false;

function setDbConnected(value) {
  connected = Boolean(value);
}

function isDbConnected() {
  return connected;
}

module.exports = { setDbConnected, isDbConnected };
