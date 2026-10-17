import axios from 'axios';
import { notifyPatientSessionExpired } from './authSession';

const envBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const baseURL = envBase ? `${envBase}/api` : '/api';

const patientApi = axios.create({ baseURL });

patientApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('patientToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

patientApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('patientToken')) {
      notifyPatientSessionExpired();
    }
    return Promise.reject(error);
  }
);

export default patientApi;
