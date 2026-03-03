import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import Topbar  from '../../components/layout/Topbar';

const NAV_ITEMS = [
  { type: 'section', label: 'Principal' },
  { path: '',         label: 'Dashboard',     icon: '⬛', end: true },
  { type: 'section', label: 'Gestión Global' },
  { path: '/condominios', label: 'Condominios',    icon: '🏢' },
  { path: '/usuarios',    label: 'Usuarios',       icon: '👥' },
  { type: 'section', label: 'Cuenta' },
  { path: '/perfil',      label: 'Mi Perfil',      icon: '⚙' },
];

const TITLES = {
  '/superadmin':            { title: 'Dashboard', subtitle: 'Vista global del sistema' },
  '/superadmin/condominios':{ title: 'Condominios', subtitle: 'Gestión de todos los residenciales' },
  '/superadmin/usuarios':   { title: 'Usuarios', subtitle: 'Administradores y residentes' },
  '/superadmin/perfil':     { title: 'Mi Perfil' },
};

export default function SALayout() {
  const loc = useLocation();
  const info = TITLES[loc.pathname] || { title: 'CondoAdmin' };
  return (
    <div className="page-layout">
      <Sidebar items={NAV_ITEMS} prefix="/superadmin" />
      <div className="main-content">
        <Topbar title={info.title} subtitle={info.subtitle} />
        <main className="page-content fade-in"><Outlet /></main>
      </div>
    </div>
  );
}
