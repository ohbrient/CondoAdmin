import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function Layout({ children }) {
  const { user } = useAuth();
  const [condo, setCondo] = useState(null);

  useEffect(() => {
    if (user?.rol !== 'superadmin') {
      api.get('/condominios').then(r => setCondo(r.data[0])).catch(() => {});
    }
  }, [user]);

  return (
    <div style={{ display:'flex' }}>
      <Sidebar condo={condo} />
      <main style={{ marginLeft:'240px', flex:1, minHeight:'100vh', background:'var(--bg)' }}>
        {children}
      </main>
    </div>
  );
}
