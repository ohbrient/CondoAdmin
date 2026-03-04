import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import Login from './pages/Login';
import Profile from './pages/Profile';

import SuperAdminDashboard from './pages/superadmin/Dashboard';
import SACondominios from './pages/superadmin/Condominios';
import SAUsuarios from './pages/superadmin/Usuarios';
import Licencias from './pages/superadmin/Licencias';

import AdminDashboard from './pages/admin/Dashboard';
import Residentes from './pages/admin/Residentes';
import Cuotas from './pages/admin/Cuotas';
import Gastos from './pages/admin/Gastos';
import Empleados from './pages/admin/Empleados';
import Contabilidad from './pages/admin/Contabilidad';
import Solicitudes from './pages/admin/Solicitudes';
import Anuncios from './pages/admin/Anuncios';
import Acuerdos from './pages/admin/Acuerdos';
import Reservas from './pages/admin/Reservas';
import ResidenteReservas from './pages/residente/Reservas';

import ResidentePortal from './pages/residente/Portal';
import ResidenteUnidades from './pages/residente/Unidades';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', color:'var(--accent)' }}>Cargando...</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to="/login" replace />;
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.rol === 'superadmin') return <Navigate to="/superadmin" replace />;
  if (user.rol === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/portal" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: { background:'#1f2332', color:'#e8eaf0', border:'1px solid #2a2f42' }
        }} />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />

          {/* Super Admin */}
          <Route path="/superadmin" element={<ProtectedRoute roles={['superadmin']}><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/superadmin/condominios" element={<ProtectedRoute roles={['superadmin']}><SACondominios /></ProtectedRoute>} />
          <Route path="/superadmin/usuarios" element={<ProtectedRoute roles={['superadmin']}><SAUsuarios /></ProtectedRoute>} />
          <Route path="/superadmin/licencias" element={<ProtectedRoute roles={['superadmin']}><Licencias /></ProtectedRoute>} />
          <Route path="/superadmin/perfil" element={<ProtectedRoute roles={['superadmin']}><Profile /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/residentes" element={<ProtectedRoute roles={['admin']}><Residentes /></ProtectedRoute>} />
          <Route path="/admin/cuotas" element={<ProtectedRoute roles={['admin']}><Cuotas /></ProtectedRoute>} />
          <Route path="/admin/gastos" element={<ProtectedRoute roles={['admin']}><Gastos /></ProtectedRoute>} />
          <Route path="/admin/empleados" element={<ProtectedRoute roles={['admin']}><Empleados /></ProtectedRoute>} />
          <Route path="/admin/contabilidad" element={<ProtectedRoute roles={['admin']}><Contabilidad /></ProtectedRoute>} />
          <Route path="/admin/solicitudes" element={<ProtectedRoute roles={['admin']}><Solicitudes /></ProtectedRoute>} />
          <Route path="/admin/anuncios" element={<ProtectedRoute roles={['admin']}><Anuncios /></ProtectedRoute>} />
          <Route path="/admin/acuerdos" element={<ProtectedRoute roles={['admin']}><Acuerdos /></ProtectedRoute>} />
          <Route path="/admin/reservas" element={<ProtectedRoute roles={['admin']}><Reservas /></ProtectedRoute>} />
          <Route path="/admin/perfil" element={<ProtectedRoute roles={['admin']}><Profile /></ProtectedRoute>} />

          {/* Residente */}
          <Route path="/portal" element={<ProtectedRoute roles={['residente']}><ResidentePortal /></ProtectedRoute>} />
          <Route path="/portal/pagos" element={<ProtectedRoute roles={['residente']}><ResidentePortal /></ProtectedRoute>} />
          <Route path="/portal/solicitudes" element={<ProtectedRoute roles={['residente']}><ResidentePortal /></ProtectedRoute>} />
          <Route path="/portal/anuncios" element={<ProtectedRoute roles={['residente']}><ResidentePortal /></ProtectedRoute>} />
          <Route path="/portal/reservas" element={<ProtectedRoute roles={['residente']}><ResidenteReservas /></ProtectedRoute>} />
          <Route path="/portal/unidades" element={<ProtectedRoute roles={['residente']}><ResidenteUnidades /></ProtectedRoute>} />
          <Route path="/portal/perfil" element={<ProtectedRoute roles={['residente']}><Profile /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
