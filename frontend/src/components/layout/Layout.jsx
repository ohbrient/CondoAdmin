import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { LicenciaProvider, LicenciaBanner, LicenciaBloqueo } from '../LicenciaGuard';

const TITLES = {
  '/admin':              { title: 'Dashboard',       subtitle: 'Resumen general del condominio' },
  '/admin/residentes':   { title: 'Residentes',      subtitle: 'Gestión de propietarios e inquilinos' },
  '/admin/cuotas':       { title: 'Cuotas',          subtitle: 'Control de pagos y cobros' },
  '/admin/gastos':       { title: 'Gastos',          subtitle: 'Registro de egresos' },
  '/admin/empleados':    { title: 'Empleados',       subtitle: 'Personal del condominio' },
  '/admin/contabilidad': { title: 'Contabilidad',    subtitle: 'Estados financieros' },
  '/admin/solicitudes':  { title: 'Solicitudes',     subtitle: 'Gestión de solicitudes' },
  '/admin/anuncios':     { title: 'Anuncios',        subtitle: 'Comunicaciones a residentes' },
  '/admin/acuerdos':     { title: 'Acuerdos de Pago', subtitle: 'Planes de pago activos' },
  '/admin/reservas':     { title: 'Áreas Comunes',   subtitle: 'Reservas y disponibilidad' },
  '/admin/perfil':       { title: 'Mi Perfil' },
  '/superadmin':             { title: 'Dashboard',    subtitle: 'Vista global del sistema' },
  '/superadmin/condominios': { title: 'Condominios',  subtitle: 'Gestión de todos los residenciales' },
  '/superadmin/usuarios':    { title: 'Usuarios',     subtitle: 'Administradores y residentes' },
  '/superadmin/licencias':   { title: 'Licencias',    subtitle: 'Control de acceso y caducidad' },
  '/superadmin/perfil':      { title: 'Mi Perfil' },
  '/portal':             { title: 'Mi Cuenta',       subtitle: 'Estado de cuenta y pagos' },
  '/portal/unidades':    { title: 'Mis Unidades',    subtitle: 'Propiedades registradas' },
  '/portal/solicitudes': { title: 'Solicitudes',     subtitle: 'Mis solicitudes enviadas' },
  '/portal/anuncios':    { title: 'Anuncios',        subtitle: 'Avisos del condominio' },
  '/portal/reservas':    { title: 'Áreas Comunes',   subtitle: 'Reservar espacios' },
  '/portal/perfil':      { title: 'Mi Perfil' },
};

export default function Layout({ children }) {
  const { user } = useAuth();
  const [condo, setCondo] = useState(null);
  const location = useLocation();
  const info = TITLES[location.pathname] || { title: 'CondoAdmin' };

  useEffect(() => {
    if (user?.rol !== 'superadmin') {
      api.get('/condominios').then(r => setCondo(r.data[0])).catch(() => {});
    }
  }, [user]);

  return (
    <LicenciaProvider>
      <LicenciaBloqueo />
      <div style={{ display: 'flex' }}>
        <Sidebar condo={condo} />
        <main style={{ marginLeft: '240px', flex: 1, minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
          <LicenciaBanner />
          <Topbar title={info.title} subtitle={info.subtitle} condoActual={condo} />
          <div style={{ flex: 1 }}>{children}</div>
        </main>
      </div>
    </LicenciaProvider>
  );
}
