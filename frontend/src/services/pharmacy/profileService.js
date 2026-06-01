import api from '../../utils/api';

const BASE = '/pharmacy/profile';

export async function fetchPharmacyProfile() {
  const res = await api.get(BASE);
  return res.data;
}

export async function updatePharmacyProfile(payload) {
  const res = await api.put(BASE, payload);
  return res.data;
}
