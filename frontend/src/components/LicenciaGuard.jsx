import { useState, useEffect, createContext, useContext } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const LicenciaContext = createContext(null);

export function useLicencia() {
  return useContext(LicenciaContext);
}

// ── Proveedor global — envuelve la app ──────────────────────
export function LicenciaProvider({ children }) {
  const { user } = useAuth();
  const [licencia, setLicencia] = useState(null);

  useEffect(() => {
    if (user?.rol !== 'admin') return;
    api.get('/licencias/mi-licencia').then(r => setLicencia(r.data)).catch(() => {});
  }, [user]);

  return (
    <LicenciaContext.Provider value={licencia}>
      {children}
    </LicenciaContext.Provider>
  );
}

// ── Banner de aviso (próxima a vencer) ─────────────────────
export function LicenciaBanner() {
  const { user } = useAuth();
  const licencia = useLicencia();
  const [cerrado, setCerrado] = useState(false);

  if (user?.rol !== 'admin') return null;
  if (!licencia || licencia.estado !== 'proxima' || cerrado) return null;

  const color = licencia.dias <= 3 ? '#dc2626' : licencia.dias <= 7 ? '#d97706' : '#2563eb';
  const bg    = licencia.dias <= 3 ? '#fee2e2' : licencia.dias <= 7 ? '#fef3c7' : '#dbeafe';

  return (
    <div style={{
      background: bg, borderBottom: `2px solid ${color}`,
      padding: '10px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: '13px', fontWeight: '500', color,
      position: 'sticky', top: 0, zIndex: 49,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '18px' }}>{licencia.dias <= 3 ? '🚨' : '⚠️'}</span>
        <span>
          {licencia.dias === 0
            ? 'Tu licencia vence hoy. '
            : `Tu licencia vence en ${licencia.dias} día${licencia.dias !== 1 ? 's' : ''}. `}
          Contacta al administrador del sistema para renovarla.
          {licencia.notas && <span style={{ opacity: 0.8 }}> — {licencia.notas}</span>}
        </span>
      </div>
      <button
        onClick={() => setCerrado(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color, padding: '0 4px', opacity: 0.7 }}
      >✕</button>
    </div>
  );
}

// ── Pantalla de bloqueo (vencida o sin licencia) ───────────
export function LicenciaBloqueo() {
  const { user, logout } = useAuth();
  const licencia = useLicencia();

  if (user?.rol !== 'admin') return null;
  if (!licencia) return null;
  if (licencia.estado !== 'vencida' && licencia.estado !== 'sin_licencia') return null;

  const vencida = licencia.estado === 'vencida';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(10, 12, 25, 0.92)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: '#1a1d2e',
        border: '1px solid #252a3d',
        borderRadius: '20px',
        padding: '48px 40px',
        maxWidth: '480px', width: '100%',
        textAlign: 'center',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Icono */}
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: vencida ? 'rgba(220,38,38,0.15)' : 'rgba(180,138,78,0.15)',
          border: `2px solid ${vencida ? '#dc2626' : '#b48a4e'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px', margin: '0 auto 24px',
        }}>
          {vencida ? '🔒' : '⚠️'}
        </div>

        <div style={{
          fontFamily: 'DM Serif Display, serif',
          fontSize: '24px', color: '#e8eaf0', marginBottom: '12px',
        }}>
          {vencida ? 'Licencia Vencida' : 'Sin Licencia Activa'}
        </div>

        <p style={{ color: '#8b90a4', fontSize: '14px', lineHeight: 1.6, marginBottom: '8px' }}>
          {vencida
            ? `Tu licencia de acceso venció el ${new Date(licencia.fecha + 'T12:00:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })}.`
            : 'Tu cuenta no tiene una licencia de acceso activa.'
          }
        </p>

        <p style={{ color: '#8b90a4', fontSize: '14px', lineHeight: 1.6, marginBottom: '32px' }}>
          Contacta al administrador del sistema para renovar o activar tu acceso.
        </p>

        {licencia.notas && (
          <div style={{
            background: '#252a3d', borderRadius: '10px', padding: '12px 16px',
            fontSize: '13px', color: '#c9a96e', marginBottom: '24px',
          }}>
            📝 {licencia.notas}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px', borderRadius: '10px',
              background: '#252a3d', border: '1px solid #353a50',
              color: '#e8eaf0', fontSize: '14px', fontWeight: '600',
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}
          >
            🔄 Verificar nuevamente
          </button>
          <button
            onClick={logout}
            style={{
              padding: '12px', borderRadius: '10px',
              background: 'none', border: '1px solid #353a50',
              color: '#8b90a4', fontSize: '13px',
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
