import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';
import api from '../../services/api';

const superadminLinks = [
  { to: '/superadmin',             label: 'Dashboard',    icon: '▪',  end: true },
  { to: '/superadmin/condominios', label: 'Condominios',  icon: '🏢' },
  { to: '/superadmin/usuarios',    label: 'Usuarios',     icon: '👥' },
];

const adminLinks = [
  { to: '/admin',               label: 'Dashboard',     icon: '▪',  end: true },
  { to: '/admin/residentes',    label: 'Residentes',    icon: '🏠' },
  { to: '/admin/cuotas',        label: 'Cuotas',        icon: '💰' },
  { to: '/admin/gastos',        label: 'Gastos',        icon: '📋' },
  { to: '/admin/empleados',     label: 'Empleados',     icon: '👷' },
  { to: '/admin/contabilidad',  label: 'Contabilidad',  icon: '📊' },
  { to: '/admin/solicitudes',   label: 'Solicitudes',   icon: '📩', notif: true },
  { to: '/admin/anuncios',      label: 'Anuncios',      icon: '📢' },
  { to: '/admin/acuerdos',      label: 'Acuerdos',      icon: '🤝' },
  { to: '/admin/reservas',      label: 'Áreas Comunes', icon: '🏊' },
];

const residenteLinks = [
  { to: '/portal',              label: 'Mi Cuenta',     icon: '🏠', end: true },
  { to: '/portal/unidades',     label: 'Mis Unidades',  icon: '🏢' },
  { to: '/portal/solicitudes',  label: 'Solicitudes',   icon: '📩', notif: true },
  { to: '/portal/anuncios',     label: 'Anuncios',      icon: '📢' },
  { to: '/portal/reservas',     label: 'Áreas Comunes', icon: '🏊' },
];

// Links shown in mobile bottom bar (max 4 + "Más")
const MOBILE_PRIMARY_COUNT = 4;

export default function Sidebar({ condo }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendientes, setPendientes] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const links = user?.rol === 'superadmin' ? superadminLinks
    : user?.rol === 'admin' ? adminLinks
    : residenteLinks;

  const roleLabel = user?.rol === 'superadmin' ? 'Super Admin'
    : user?.rol === 'admin' ? 'Administrador'
    : 'Residente';

  const profileTo = user?.rol === 'superadmin' ? '/superadmin/perfil'
    : user?.rol === 'admin' ? '/admin/perfil'
    : '/portal/perfil';

  const fetchPendientes = () => {
    if (!condo?.id) return;
    if (user?.rol === 'admin' || user?.rol === 'superadmin') {
      api.get('/condominios/' + condo.id + '/solicitudes', { params: { estado: 'pendiente' } })
        .then(r => setPendientes(r.data.length)).catch(() => {});
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
    setMobileMenuOpen(false); // close drawer on navigate
  }, [location.pathname]);

  const primaryLinks = links.slice(0, MOBILE_PRIMARY_COUNT);
  const secondaryLinks = links.slice(MOBILE_PRIMARY_COUNT);
  const hasMore = secondaryLinks.length > 0;

  return (
    <>
      <style>{`
        @keyframes notif-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.2)} }
        @keyframes drawerUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes overlayIn { from{opacity:0} to{opacity:1} }

        /* ── Desktop sidebar ── */
        .sidebar-desktop {
          width: 240px;
          min-height: 100vh;
          background: #1a1d2e;
          border-right: 1px solid #252a3d;
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0; left: 0;
          z-index: 100;
        }

        /* ── Mobile bottom nav ── */
        .sidebar-mobile-bottom {
          display: none;
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: 64px;
          background: #1a1d2e;
          border-top: 1px solid #252a3d;
          z-index: 200;
          padding: 0 4px;
          padding-bottom: env(safe-area-inset-bottom);
        }
        .sidebar-mobile-bottom-inner {
          display: flex;
          align-items: stretch;
          height: 100%;
        }

        .mob-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          cursor: pointer;
          border: none;
          background: none;
          padding: 0;
          position: relative;
          text-decoration: none;
          border-radius: 10px;
          margin: 6px 2px;
          transition: background .15s;
        }
        .mob-nav-item:active { background: rgba(201,169,110,0.1); }
        .mob-nav-item.active { background: rgba(201,169,110,0.12); }
        .mob-nav-icon { font-size: 20px; line-height: 1; }
        .mob-nav-label {
          font-size: 10px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          color: #8b90a4;
          white-space: nowrap;
        }
        .mob-nav-item.active .mob-nav-label { color: #c9a96e; }
        .mob-nav-badge {
          position: absolute;
          top: 2px; right: calc(50% - 18px);
          background: #e05555; color: #fff;
          border-radius: 999px; font-size: 9px; font-weight: 700;
          min-width: 16px; height: 16px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px;
          animation: notif-pulse 2s ease-in-out infinite;
        }

        /* ── Mobile drawer (more menu) ── */
        .mob-drawer-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(10,12,25,0.7);
          z-index: 300;
          animation: overlayIn .2s ease;
          backdrop-filter: blur(3px);
        }
        .mob-drawer-overlay.open { display: block; }
        .mob-drawer {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          background: #1a1d2e;
          border-radius: 20px 20px 0 0;
          border-top: 1px solid #252a3d;
          z-index: 400;
          padding: 0 0 calc(16px + env(safe-area-inset-bottom));
          animation: drawerUp .3s cubic-bezier(0.16,1,0.3,1);
        }
        .mob-drawer-handle {
          width: 40px; height: 4px;
          background: #252a3d; border-radius: 2px;
          margin: 12px auto 20px;
        }
        .mob-drawer-title {
          font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 1.5px;
          color: #4a5060;
          padding: 0 20px 12px;
        }
        .mob-drawer-link {
          display: flex; align-items: center; gap: 14px;
          padding: 13px 20px;
          text-decoration: none;
          color: #8b90a4;
          font-size: 15px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          position: relative;
          transition: background .15s;
        }
        .mob-drawer-link:active, .mob-drawer-link:hover { background: #252a3d; }
        .mob-drawer-link.active-link { color: #c9a96e; background: rgba(201,169,110,0.08); }
        .mob-drawer-link-icon { font-size: 20px; width: 28px; text-align: center; }
        .mob-drawer-divider { height: 1px; background: #252a3d; margin: 8px 0; }
        .mob-drawer-logout {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 20px;
          color: #e05555;
          font-size: 15px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          background: none; border: none; cursor: pointer;
          width: 100%;
        }
        .mob-drawer-user {
          display: flex; align-items: center; gap: 12px;
          padding: 16px 20px 20px;
          border-bottom: 1px solid #252a3d;
          margin-bottom: 8px;
        }
        .mob-drawer-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: #c9a96e; color: #1a1d2e;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; flex-shrink: 0;
        }

        /* ── Responsive breakpoint ── */
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .sidebar-mobile-bottom { display: block; }
          /* push page content above bottom nav */
          .main-content { margin-left: 0 !important; padding-bottom: 80px; }
        }
      `}</style>

      {/* ════════════════════════════════
          DESKTOP SIDEBAR (unchanged)
      ════════════════════════════════ */}
      <aside className="sidebar-desktop">
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
              key={link.to} to={link.to} end={link.end}
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
                }}>{pendientes > 99 ? '99+' : pendientes}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding:'12px 8px', borderTop:'1px solid #252a3d' }}>
          <NavLink to={profileTo} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'8px', textDecoration:'none', color:'#8b90a4', fontSize:'14px', fontWeight:'500' }}>
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

      {/* ════════════════════════════════
          MOBILE BOTTOM NAV
      ════════════════════════════════ */}
      <nav className="sidebar-mobile-bottom">
        <div className="sidebar-mobile-bottom-inner">
          {primaryLinks.map(link => {
            const isActive = link.end
              ? location.pathname === link.to
              : location.pathname.startsWith(link.to);
            return (
              <NavLink
                key={link.to} to={link.to} end={link.end}
                className={`mob-nav-item${isActive ? ' active' : ''}`}
                onClick={() => { if (link.notif) setPendientes(0); }}
              >
                {link.notif && pendientes > 0 && (
                  <span className="mob-nav-badge">{pendientes > 99 ? '99+' : pendientes}</span>
                )}
                <span className="mob-nav-icon">{link.icon}</span>
                <span className="mob-nav-label">{link.label}</span>
              </NavLink>
            );
          })}

          {/* "Más" button — always shown for profile/logout access */}
          <button
            className={`mob-nav-item${mobileMenuOpen ? ' active' : ''}`}
            onClick={() => setMobileMenuOpen(v => !v)}
          >
            <span className="mob-nav-icon">☰</span>
            <span className="mob-nav-label">Más</span>
          </button>
        </div>
      </nav>

      {/* ════════════════════════════════
          MOBILE DRAWER (Más)
      ════════════════════════════════ */}
      <div
        className={`mob-drawer-overlay${mobileMenuOpen ? ' open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {mobileMenuOpen && (
        <div className="mob-drawer">
          <div className="mob-drawer-handle" />

          {/* User info */}
          <div className="mob-drawer-user">
            <div className="mob-drawer-avatar">
              {user?.nombre?.[0]}{user?.apellido?.[0]}
            </div>
            <div>
              <div style={{ fontSize:'14px', fontWeight:'600', color:'#e8eaf0' }}>{user?.nombre} {user?.apellido}</div>
              <div style={{ fontSize:'12px', color:'#8b90a4' }}>{roleLabel}{condo ? ` · ${condo.nombre}` : ''}</div>
            </div>
          </div>

          <div className="mob-drawer-title">Navegación</div>

          {/* Secondary links (overflow) */}
          {secondaryLinks.map(link => {
            const isActive = link.end
              ? location.pathname === link.to
              : location.pathname.startsWith(link.to);
            return (
              <NavLink
                key={link.to} to={link.to}
                className={`mob-drawer-link${isActive ? ' active-link' : ''}`}
                onClick={() => { if (link.notif) setPendientes(0); setMobileMenuOpen(false); }}
              >
                <span className="mob-drawer-link-icon">{link.icon}</span>
                <span style={{ flex:1 }}>{link.label}</span>
                {link.notif && pendientes > 0 && (
                  <span style={{ background:'#e05555', color:'#fff', borderRadius:'999px', fontSize:'10px', fontWeight:'700', minWidth:'18px', height:'18px', display:'flex', alignItems:'center', justifyContent:'center', padding:'0 5px' }}>
                    {pendientes > 99 ? '99+' : pendientes}
                  </span>
                )}
              </NavLink>
            );
          })}

          <div className="mob-drawer-divider" />

          {/* Profile */}
          <NavLink
            to={profileTo}
            className="mob-drawer-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="mob-drawer-link-icon">⚙️</span>
            <span>Mi Perfil</span>
          </NavLink>

          {/* Logout */}
          <button
            className="mob-drawer-logout"
            onClick={() => { logout(); navigate('/login'); }}
          >
            <span style={{ fontSize:'20px', width:'28px', textAlign:'center' }}>🚪</span>
            Cerrar sesión
          </button>
        </div>
      )}
    </>
  );
}