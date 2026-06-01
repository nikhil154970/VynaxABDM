// Backwards-compatible re-export for older imports.
const { authMiddleware } = require('./authMiddleware');
const { roleMiddleware } = require('./roleMiddleware');

module.exports = {
  authenticate: authMiddleware,
  authorize: roleMiddleware,
};
