const PO_STATUSES = ['Draft', 'Pending', 'Approved', 'Partially Delivered', 'Delivered', 'Cancelled'];
const GRN_STATUSES = ['Draft', 'Completed', 'Cancelled'];
const PO_FOR_GRN = ['Approved', 'Partially Delivered'];
const ALLOWED_GST = [0, 5, 12, 18, 28];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = {
  PO_STATUSES,
  GRN_STATUSES,
  PO_FOR_GRN,
  ALLOWED_GST,
  UUID_RE,
};
