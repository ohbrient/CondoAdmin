import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import Topbar  from '../../components/layout/Topbar';

const NAV_ITEMS = [
  { type: 'section', label: 'Principal' },
  { path: '',             label: 'Dashboard',     icon: '⬛', end: true },
  { type: 'section', label: 'Gestión' },
  { path: '/residentes',  label: 'Residentes',    icon: '🏠' },
  { path: '/cuotas',      label: 'Cuotas',        icon: '💰' },
  { path: '/gastos',      label: 'Gastos',        icon: '📋' },
  { path: '/empleados',   label: 'Empleados',     icon: '👷' },
  { path: '/solicitudes', label: 'Solicitudes',   icon: '📝' },
  { type: 'section', label: 'Finanzas' },
  { path: '/contabilidad', label: 'Contabilidad', icon: '📊' },
  { type: 'section', label: 'Cuenta' },
  { path: '/perfil',      label: 'Mi Perfil',     icon: '⚙' },
];

const TITLES = {
  '/admin':               { title: 'Dashboard', subtitle: 'Resumen del condominio' },
  '/admin/residentes':    { title: 'Residentes & Propietarios' },
  '/admin/cuotas':        { title: 'Cuotas de Mantenimiento' },
  '/admin/gastos':        { title: 'Registro de Gastos' },
  '/admin/empleados':     { title: 'Empleados & Nómina' },
  '/admin/solicitudes':   { title: 'Solicitudes & Tickets' },
  '/admin/contabilidad':  { title: 'Contabilidad & Reportes' },
  '/admin/perfil':        { title: 'Mi Perfil' },
};

export default function AdminLayout() {
  const loc = useLocation();
  const info = TITLES[loc.pathname] || { title: 'CondoAdmin' };
  return (
    <div className="page-layout">
      <Sidebar items={NAV_ITEMS} prefix="/admin" />
      <div className="main-content">
        <Topbar title={info.title} subtitle={info.subtitle} />
        <main className="page-content fade-in"><Outlet /></main>
      </div>
    </div>
  );
}
