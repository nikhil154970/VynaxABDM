import api from '../../utils/api';

const BASE = '/pharmacy/dashboard';

export async function fetchPharmacyDashboard() {
  const res = await api.get(BASE);
  return res.data;
}
