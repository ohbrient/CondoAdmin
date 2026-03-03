import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';
import api from '../../services/api';

const superadminLinks = [
  { to: '/superadmin', label: 'Dashboard', icon: '▪', end: true },
  { to: '/superadmin/condominios', label: 'Condominios', icon: '🏢' },
  { to: '/superadmin/usuarios', label: 'Usuarios', icon: '👥' },
];

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: '▪', end: true },
  { to: '/admin/residentes', label: 'Residentes', icon: '🏠' },
  { to: '/admin/cuotas', label: 'Cuotas', icon: '💰' },
  { to: '/admin/gastos', label: 'Gastos', icon: '📋' },
  { to: '/admin/empleados', label: 'Empleados', icon: '👷' },
  { to: '/admin/contabilidad', label: 'Contabilidad', icon: '📊' },
  { to: '/admin/solicitudes', label: 'Solicitudes', icon: '📩', notif: true },
  { to: '/admin/anuncios', label: 'Anuncios', icon: '📢' },
  { to: '/admin/acuerdos', label: 'Acuerdos de Pago', icon: '🤝' },
  { to: '/admin/reservas', label: 'Áreas Comunes', icon: '🏊' },
];

const residenteLinks = [
  { to: '/portal', label: 'Mi Cuenta', icon: '🏠', end: true },
  { to: '/portal/unidades', label: 'Mis Unidades', icon: '🏢' },
  { to: '/portal/solicitudes', label: 'Solicitudes', icon: '📩', notif: true },
  { to: '/portal/anuncios', label: 'Anuncios', icon: '📢' },
  { to: '/portal/reservas', label: 'Áreas Comunes', icon: '🏊' },
];

export default function Sidebar({ condo }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendientes, setPendientes] = useState(0);

  const links = user?.rol === 'superadmin' ? superadminLinks
    : user?.rol === 'admin' ? adminLinks
    : residenteLinks;

  const roleLabel = user?.rol === 'superadmin' ? 'Super Admin'
    : user?.rol === 'admin' ? 'Administrador'
    : 'Residente';

  const fetchPendientes = () => {
    if (!condo?.id) return;
    if (user?.rol === 'admin' || user?.rol === 'superadmin') {
      api.get('/condominios/' + condo.id + '/solicitudes', { params: { estado: 'pendiente' } })
        .then(r => setPendientes(r.data.length))
        .catch(() => {});
    } else if (user?.rol === 'residente') {
      api.get('/condominios/' + condo.id + '/solicitudes')
        .then(r => setPendientes(r.data.filter(s => s.respuesta && s.estado === 'cerrada').length))
        .catch(() => {});
    }
  };

  useEffect(() => {
    fetchPendientes();
    const interval = setInterval(fetchPendientes, 60000);
    return () => clearInterval(interval);
  }, [condo?.id, user?.rol]);

  useEffect(() => {
    if (location.pathname.includes('solicitudes')) setPendientes(0);
  }, [location.pathname]);

  return (
    <aside style={{
      width:'240px', minHeight:'100vh', background:'#1a1d2e',
      borderRight:'1px solid #252a3d', display:'flex', flexDirection:'column',
      position:'fixed', top:0, left:0, zIndex:100
    }}>
      <style>{"@keyframes notif-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.2)} }"}</style>

      <div style={{ padding:'24px 20px 16px', borderBottom:'1px solid #252a3d' }}>
        <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'22px', color:'#c9a96e' }}>CondoAdmin</div>
        <div style={{ fontSize:'10px', color:'#8b90a4', textTransform:'uppercase', letterSpacing:'2px', marginTop:'2px' }}>PRO</div>
      </div>

      {condo && (
        <div style={{ margin:'12px 12px 0', background:'#252a3d', borderRadius:'8px', padding:'10px 12px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:'#e8eaf0' }}>{condo.nombre}</div>
          <div style={{ fontSize:'11px', color:'#8b90a4' }}>{roleLabel}</div>
        </div>
      )}

      <nav style={{ flex:1, padding:'12px 8px', display:'flex', flexDirection:'column', gap:'2px', overflowY:'auto' }}>
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={() => { if (link.notif) setPendientes(0); }}
            style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px',
              borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'500',
              color: isActive ? '#c9a96e' : '#8b90a4',
              background: isActive ? 'rgba(201,169,110,0.12)' : 'transparent',
              textDecoration:'none', transition:'all .15s',
            })}
            onMouseEnter={e => { if (!e.currentTarget.getAttribute('aria-current')) { e.currentTarget.style.background='#252a3d'; e.currentTarget.style.color='#e8eaf0'; }}}
            onMouseLeave={e => { if (!e.currentTarget.getAttribute('aria-current')) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#8b90a4'; }}}
          >
            <span style={{ width:'18px', textAlign:'center', fontSize:'15px' }}>{link.icon}</span>
            <span style={{ flex:1 }}>{link.label}</span>
            {link.notif && pendientes > 0 && (
              <span style={{
                background:'#e05555', color:'#fff', borderRadius:'999px',
                fontSize:'10px', fontWeight:'700', minWidth:'18px', height:'18px',
                display:'flex', alignItems:'center', justifyContent:'center',
                padding:'0 5px', lineHeight:1,
                animation:'notif-pulse 2s ease-in-out infinite',
              }}>
                {pendientes > 99 ? '99+' : pendientes}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding:'12px 8px', borderTop:'1px solid #252a3d' }}>
        <NavLink
          to={user?.rol === 'superadmin' ? '/superadmin/perfil' : user?.rol === 'admin' ? '/admin/perfil' : '/portal/perfil'}
          style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'8px', textDecoration:'none', color:'#8b90a4', fontSize:'14px', fontWeight:'500' }}
        >
          <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#c9a96e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', color:'#1a1d2e', flexShrink:0 }}>
            {user?.nombre?.[0]}{user?.apellido?.[0]}
          </div>
          <div>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'#e8eaf0' }}>{user?.nombre} {user?.apellido}</div>
            <div style={{ fontSize:'11px', color:'#8b90a4' }}>{roleLabel}</div>
          </div>
        </NavLink>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'8px', background:'none', border:'none', cursor:'pointer', fontSize:'14px', color:'#e05555', marginTop:'4px' }}
        >
          <span>🚪</span> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
