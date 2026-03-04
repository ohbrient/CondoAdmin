import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [condominios, setCondominios] = useState([]);
  const [condoActual, setCondoActual] = useState(null);
  const [residencia,  setResidencia]  = useState(null);
  const [loading,     setLoading]     = useState(true);

  // Recargar sesión al iniciar
  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token  = localStorage.getItem('token');
    if (stored && token) {
      try {
        const u = JSON.parse(stored);
        setUser(u);
        const condos  = JSON.parse(localStorage.getItem('condominios') || '[]');
        const cActual = JSON.parse(localStorage.getItem('condoActual') || 'null');
        const res     = JSON.parse(localStorage.getItem('residencia')  || 'null');
        setCondominios(condos);
        setCondoActual(cActual || condos[0] || null);
        setResidencia(res);

        // Revalidar token con el servidor en segundo plano
        api.get('/auth/me').then(r => {
          setUser(r.data);
          localStorage.setItem('user', JSON.stringify(r.data));
        }).catch(() => {
          // Solo limpiar si es 401 (token inválido), no por licencia vencida
        });
      } catch {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token',       data.token);
    localStorage.setItem('user',        JSON.stringify(data.user));
    localStorage.setItem('condominios', JSON.stringify(data.condominios || []));
    localStorage.setItem('residencia',  JSON.stringify(data.residencia || null));
    setUser(data.user);
    setCondominios(data.condominios || []);
    setResidencia(data.residencia || null);
    const primera = (data.condominios || [])[0] || null;
    setCondoActual(primera);
    localStorage.setItem('condoActual', JSON.stringify(primera));
    return data.user;
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setCondominios([]);
    setCondoActual(null);
    setResidencia(null);
  };

  const selectCondo = (condo) => {
    setCondoActual(condo);
    localStorage.setItem('condoActual', JSON.stringify(condo));
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{
      user, condominios, condoActual, residencia,
      loading, login, logout, selectCondo, updateUser,
      isSuperAdmin: user?.rol === 'superadmin',
      isAdmin:      user?.rol === 'admin',
      isResidente:  user?.rol === 'residente',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);