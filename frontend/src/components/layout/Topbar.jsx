import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notiAPI } from '../../services/api';

export default function Topbar({ title, subtitle }) {
  const { user, condoActual, logout } = useAuth();
  const navigate = useNavigate();
  const [notis, setNotis] = useState([]);
  const [showNoti, setShowNoti] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const notiRef = useRef();
  const userRef = useRef();

  const initials = user ? `${user.nombre[0]}${user.apellido[0]}`.toUpperCase() : '?';
  const prefix = user?.rol === 'superadmin' ? '/superadmin' : user?.rol === 'admin' ? '/admin' : '/portal';

  useEffect(() => {
    if (condoActual?.id) {
      notiAPI.list(condoActual.id)
        .then(r => setNotis(r.data.notificaciones || []))
        .catch(() => {});
    }
  }, [condoActual]);

  const sinLeer = notis.filter(n => !n.leida).length;

  const fechaHoy = new Date().toLocaleDateString('es-DO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <header className="topbar">
      <div>
        <div className="page-title">{title}</div>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text2)' }} className="hide-mobile">
          {fechaHoy}
        </span>

        {/* Notificaciones */}
        {condoActual && (
          <div className="dropdown" ref={notiRef}>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => { setShowNoti(!showNoti); setShowUser(false); }}
              style={{ position: 'relative' }}
            >
              🔔
              {sinLeer > 0 && (
                <span style={{
                  position: 'absolute', top: '2px', right: '2px', width: '8px', height: '8px',
                  background: 'var(--red)', borderRadius: '50%',
                }} />
              )}
            </button>

            {showNoti && (
              <div className="dropdown-menu" style={{ width: '320px', maxHeight: '400px', overflowY: 'auto' }}>
                <div style={{ padding: '8px 12px', fontSize: '13px', fontWeight: '600', color: 'var(--text2)' }}>
                  Notificaciones {sinLeer > 0 && <span className="badge badge-red">{sinLeer}</span>}
                </div>
                <div className="dropdown-divider" />
                {notis.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text2)' }}>
                    Sin notificaciones
                  </div>
                )}
                {notis.slice(0, 8).map(n => (
                  <div key={n.id} className="dropdown-item" style={{
                    opacity: n.leida ? .6 : 1,
                    borderLeft: n.leida ? 'none' : '2px solid var(--accent)',
                    paddingLeft: n.leida ? '12px' : '10px',
                  }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '12px', marginBottom: '2px' }}>{n.titulo}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{n.mensaje}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Avatar / user menu */}
        <div className="dropdown" ref={userRef}>
          <div className="avatar" onClick={() => { setShowUser(!showUser); setShowNoti(false); }}>
            {user?.foto_url ? <img src={user.foto_url} alt="" /> : initials}
          </div>
          {showUser && (
            <div className="dropdown-menu">
              <div style={{ padding: '8px 12px 6px', fontSize: '12px', color: 'var(--text2)' }}>
                {user?.email}
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={() => { navigate(`${prefix}/perfil`); setShowUser(false); }}>
                ⚙ Editar perfil
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item danger" onClick={() => { logout(); navigate('/login'); }}>
                ↩ Cerrar sesión
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
