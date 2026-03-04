import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle errors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Solo cerrar sesión en 401 (token inválido/expirado)
    // NO cerrar en 403 (licencia vencida) — el LicenciaGuard maneja eso
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;