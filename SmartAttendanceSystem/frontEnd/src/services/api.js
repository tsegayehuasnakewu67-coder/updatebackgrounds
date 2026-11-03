import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

export const getStoredToken = () => (
  localStorage.getItem('sat_token') || sessionStorage.getItem('sat_token')
);

export const clearStoredToken = () => {
  localStorage.removeItem('sat_token');
  sessionStorage.removeItem('sat_token');
};

export const setStoredToken = (token, remember = true) => {
  clearStoredToken();
  (remember ? localStorage : sessionStorage).setItem('sat_token', token);
};

api.interceptors.request.use(cfg => {
  const t = getStoredToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      clearStoredToken();
      window.dispatchEvent(new Event('sat:unauthorized'));
    }
    const requestError = new Error(err.response?.data?.message || err.message || 'Request failed');
    requestError.response = err.response;
    requestError.code = err.code;
    requestError.config = err.config;
    return Promise.reject(requestError);
  }
);

export default api;
