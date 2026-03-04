import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function Topbar({ title, subtitle }) {
  const { user, condoActual, logout } = useAuth();
  const navigate = useNavigate();
  const [showUser, setShowUser] = useState(false);
  const userRef = useRef();

  const initials = user ? `${user.nombre?.[0] || ''}${user.apellido?.[0] || ''}`.toUpperCase() : '?';
  const prefix = user?.rol === 'superadmin' ? '/superadmin'
    : user?.rol === 'admin' ? '/admin'
    : '/portal';

  const roleLabel = user?.rol === 'superadmin' ? 'Super Admin'
    : user?.rol === 'admin' ? 'Administrador'
    : 'Residente';

  const fechaHoy = new Date().toLocaleDateString('es-DO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) {
        setShowUser(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      {/* Left: title */}
      <div>
        <div style={{
          fontFamily: 'DM Serif Display, serif',
          fontSize: '22px',
          fontWeight: '700',
          color: 'var(--text)',
          lineHeight: 1.2,
        }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '2px' }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* Right: date + user menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

        {/* Date — hidden on mobile */}
        <span style={{ fontSize: '13px', color: 'var(--text2)' }} className="hide-mobile">
          {fechaHoy}
        </span>

        {/* User dropdown */}
        <div style={{ position: 'relative' }} ref={userRef}>
          <div
            onClick={() => setShowUser(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              cursor: 'pointer', padding: '6px 10px',
              borderRadius: '10px', border: '1px solid var(--border)',
              background: showUser ? 'var(--surface2)' : 'var(--surface)',
              transition: 'background .15s',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: '700', flexShrink: 0,
              overflow: 'hidden',
            }}>
              {user?.foto_url
                ? <img src={user.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
              }
            </div>

            {/* Name + role — hidden on small mobile */}
            <div className="hide-mobile" style={{ lineHeight: 1.3 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                {user?.nombre} {user?.apellido}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{roleLabel}</div>
            </div>

            {/* Chevron */}
            <span style={{
              fontSize: '10px', color: 'var(--text2)',
              transform: showUser ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform .2s',
            }}>▼</span>
          </div>

          {/* Dropdown menu */}
          {showUser && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '12px', minWidth: '220px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              overflow: 'hidden', zIndex: 200,
            }}>
              {/* User info header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
                  {user?.nombre} {user?.apellido}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>
                  {user?.email}
                </div>
              </div>

              {/* Edit profile */}
              <div
                onClick={() => { navigate(`${prefix}/perfil`); setShowUser(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '11px 16px', cursor: 'pointer', fontSize: '14px',
                  color: 'var(--text)', transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>⚙️</span> Editar perfil
              </div>

              <div style={{ height: '1px', background: 'var(--border)' }} />

              {/* Logout */}
              <div
                onClick={() => { logout(); navigate('/login'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '11px 16px', cursor: 'pointer', fontSize: '14px',
                  color: 'var(--red)', transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>↩</span> Cerrar sesión
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}