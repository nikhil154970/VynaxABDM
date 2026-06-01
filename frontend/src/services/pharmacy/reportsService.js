import api from '../../utils/api';

const BASE = '/pharmacy/reports';

function buildParams(filters = {}) {
  const p = {};
  if (filters.datePreset) p.datePreset = filters.datePreset;
  if (filters.datePreset === 'custom') {
    if (filters.dateFrom) p.dateFrom = filters.dateFrom;
    if (filters.dateTo) p.dateTo = filters.dateTo;
  }
  if (filters.page) p.page = filters.page;
  if (filters.limit) p.limit = filters.limit;
  return p;
}

export async function fetchReportOverview(filters) {
  const res = await api.get(`${BASE}/overview`, { params: buildParams(filters) });
  return res.data;
}

export async function fetchSalesReport(filters) {
  const res = await api.get(`${BASE}/sales`, { params: buildParams(filters) });
  return res.data;
}

export async function fetchPurchaseReport(filters) {
  const res = await api.get(`${BASE}/purchase`, { params: buildParams(filters) });
  return res.data;
}

export async function fetchInventoryReport(filters) {
  const res = await api.get(`${BASE}/inventory`, { params: buildParams(filters) });
  return res.data;
}

export async function fetchLowStockReport(filters) {
  const res = await api.get(`${BASE}/low-stock`, { params: buildParams(filters) });
  return res.data;
}

export async function fetchExpiryReport(filters) {
  const res = await api.get(`${BASE}/expiry`, { params: buildParams(filters) });
  return res.data;
}

export async function fetchSupplierReport(filters) {
  const res = await api.get(`${BASE}/suppliers`, { params: buildParams(filters) });
  return res.data;
}

export async function fetchReturnsReport(filters) {
  const res = await api.get(`${BASE}/returns`, { params: buildParams(filters) });
  return res.data;
}

export async function fetchDuesReport(filters) {
  const res = await api.get(`${BASE}/dues`, { params: buildParams(filters) });
  return res.data;
}
