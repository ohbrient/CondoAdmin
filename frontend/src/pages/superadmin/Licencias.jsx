import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function BadgeLicencia({ licencia }) {
  if (!licencia) return null;
  if (licencia.estado === 'activa') return (
    <span style={{ background:'#dcfce7', color:'#16a34a', borderRadius:'999px', fontSize:'11px', fontWeight:'700', padding:'3px 10px' }}>
      ✓ Activa · {licencia.dias}d
    </span>
  );
  if (licencia.estado === 'proxima') return (
    <span style={{ background: licencia.dias <= 3 ? '#fee2e2' : '#fef9c3', color: licencia.dias <= 3 ? '#dc2626' : '#ca8a04', borderRadius:'999px', fontSize:'11px', fontWeight:'700', padding:'3px 10px' }}>
      ⚠ Vence en {licencia.dias}d
    </span>
  );
  if (licencia.estado === 'vencida') return (
    <span style={{ background:'#fee2e2', color:'#dc2626', borderRadius:'999px', fontSize:'11px', fontWeight:'700', padding:'3px 10px' }}>
      🔒 Vencida hace {Math.abs(licencia.dias)}d
    </span>
  );
  return (
    <span style={{ background:'#f3f4f6', color:'#6b7280', borderRadius:'999px', fontSize:'11px', fontWeight:'700', padding:'3px 10px' }}>
      Sin licencia
    </span>
  );
}

export default function Licencias() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // admin seleccionado
  const [form, setForm] = useState({ licencia_hasta: '', licencia_notas: '', meses: '1' });
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState('todos');

  const load = () => {
    api.get('/licencias/usuarios').then(r => setAdmins(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openModal = (admin) => {
    const hoy = new Date();
    // Si tiene licencia activa, extender desde la fecha actual de vencimiento
    const base = admin.licencia?.estado === 'activa' || admin.licencia?.estado === 'proxima'
      ? new Date(admin.licencia_hasta)
      : hoy;
    // Default: +1 mes desde base
    const nueva = new Date(base);
    nueva.setMonth(nueva.getMonth() + 1);
    setForm({
      licencia_hasta: nueva.toISOString().split('T')[0],
      licencia_notas: admin.licencia_notas || '',
      meses: '1',
    });
    setModal(admin);
  };

  const aplicarMeses = (meses) => {
    const hoy = new Date();
    const base = modal?.licencia?.estado === 'activa' || modal?.licencia?.estado === 'proxima'
      ? new Date(modal.licencia_hasta)
      : hoy;
    const nueva = new Date(base);
    nueva.setMonth(nueva.getMonth() + parseInt(meses));
    setForm(p => ({ ...p, meses, licencia_hasta: nueva.toISOString().split('T')[0] }));
  };

  const handleSave = async () => {
    if (!form.licencia_hasta) return toast.error('Selecciona una fecha');
    setSaving(true);
    try {
      await api.put(`/licencias/usuarios/${modal.id}`, {
        licencia_hasta: form.licencia_hasta,
        licencia_notas: form.licencia_notas,
      });
      toast.success(`Licencia actualizada para ${modal.nombre}`);
      setModal(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleQuitar = async () => {
    if (!confirm(`¿Quitar licencia de ${modal.nombre}? El administrador quedará bloqueado.`)) return;
    setSaving(true);
    try {
      await api.delete(`/licencias/usuarios/${modal.id}`);
      toast.success('Licencia eliminada');
      setModal(null);
      load();
    } catch (err) { toast.error('Error'); }
    finally { setSaving(false); }
  };

  const filtrados = admins.filter(a => {
    if (filtro === 'todos') return true;
    return a.licencia?.estado === filtro;
  });

  const stats = {
    activas:  admins.filter(a => a.licencia?.estado === 'activa').length,
    proximas: admins.filter(a => a.licencia?.estado === 'proxima').length,
    vencidas: admins.filter(a => a.licencia?.estado === 'vencida').length,
    sin:      admins.filter(a => a.licencia?.estado === 'sin_licencia').length,
  };

  return (
    <Layout>
      <div style={{ padding:'32px' }}>
        <div style={{ marginBottom:'28px' }}>
          <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Gestión de Licencias</h1>
          <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>Control de acceso y caducidad para administradores</p>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'28px' }}>
          {[
            { label:'Activas', value: stats.activas, color:'var(--green)', icon:'✓', filtro:'activa' },
            { label:'Por vencer', value: stats.proximas, color:'var(--yellow)', icon:'⚠', filtro:'proxima' },
            { label:'Vencidas', value: stats.vencidas, color:'var(--red)', icon:'🔒', filtro:'vencida' },
            { label:'Sin licencia', value: stats.sin, color:'var(--text2)', icon:'—', filtro:'sin_licencia' },
          ].map(s => (
            <div key={s.label} className="card"
              onClick={() => setFiltro(filtro === s.filtro ? 'todos' : s.filtro)}
              style={{ padding:'16px 20px', cursor:'pointer', position:'relative', overflow:'hidden', border: filtro === s.filtro ? `1.5px solid ${s.color}` : undefined, transition:'all .15s' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:s.color }} />
              <div style={{ fontSize:'11px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>{s.label}</div>
              <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'32px', color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabla */}
        <div className="card">
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:'600', fontSize:'14px' }}>
              Administradores {filtro !== 'todos' ? `· ${filtro}` : ''}
              <span style={{ marginLeft:'8px', fontSize:'12px', color:'var(--text2)', fontWeight:'400' }}>({filtrados.length})</span>
            </span>
            {filtro !== 'todos' && (
              <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px' }} onClick={() => setFiltro('todos')}>
                Ver todos
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>Cargando...</div>
          ) : filtrados.length === 0 ? (
            <div style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>
              <div style={{ fontSize:'36px', marginBottom:'12px' }}>👥</div>
              <p>No hay administradores{filtro !== 'todos' ? ' en esta categoría' : ''}.</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Administrador</th>
                  <th>Condominios</th>
                  <th>Estado</th>
                  <th>Vencimiento</th>
                  <th>Notas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(admin => (
                  <tr key={admin.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', color:'#fff', flexShrink:0 }}>
                          {admin.nombre?.[0]}{admin.apellido?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight:'600', fontSize:'13px' }}>{admin.nombre} {admin.apellido}</div>
                          <div style={{ fontSize:'11px', color:'var(--text2)' }}>{admin.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize:'12px', color:'var(--text2)' }}>
                      {admin.condominios?.length > 0
                        ? admin.condominios.map(c => c.nombre).join(', ')
                        : <span style={{ fontStyle:'italic' }}>Sin condominio</span>
                      }
                    </td>
                    <td><BadgeLicencia licencia={admin.licencia} /></td>
                    <td style={{ fontSize:'13px', color:'var(--text2)' }}>
                      {admin.licencia_hasta
                        ? new Date(admin.licencia_hasta + 'T12:00:00').toLocaleDateString('es-DO', { day:'numeric', month:'short', year:'numeric' })
                        : '—'
                      }
                    </td>
                    <td style={{ fontSize:'12px', color:'var(--text2)', maxWidth:'160px' }}>
                      <span style={{ display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {admin.licencia_notas || '—'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-primary"
                        style={{ padding:'5px 12px', fontSize:'12px' }}
                        onClick={() => openModal(admin)}
                      >
                        {admin.licencia_hasta ? '🔄 Renovar' : '➕ Asignar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal asignar/renovar ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth:'480px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'22px', marginBottom:'4px' }}>
              {modal.licencia_hasta ? 'Renovar Licencia' : 'Asignar Licencia'}
            </h2>
            <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'24px' }}>
              {modal.nombre} {modal.apellido} · {modal.email}
            </p>

            {/* Estado actual */}
            {modal.licencia_hasta && (
              <div style={{ marginBottom:'20px', padding:'12px 16px', background:'var(--surface2)', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:'11px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'4px' }}>Licencia actual</div>
                  <div style={{ fontSize:'13px', fontWeight:'600' }}>
                    Vence: {new Date(modal.licencia_hasta + 'T12:00:00').toLocaleDateString('es-DO', { day:'numeric', month:'long', year:'numeric' })}
                  </div>
                </div>
                <BadgeLicencia licencia={modal.licencia} />
              </div>
            )}

            {/* Acceso rápido por meses */}
            <div style={{ marginBottom:'16px' }}>
              <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'8px' }}>
                Extender por
              </label>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {[
                  { label:'1 mes', val:'1' },
                  { label:'3 meses', val:'3' },
                  { label:'6 meses', val:'6' },
                  { label:'1 año', val:'12' },
                ].map(op => (
                  <button key={op.val} type="button"
                    onClick={() => aplicarMeses(op.val)}
                    style={{
                      padding:'7px 14px', borderRadius:'8px', fontSize:'13px', fontWeight:'600',
                      border: form.meses === op.val ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: form.meses === op.val ? 'rgba(176,138,78,0.1)' : 'var(--surface2)',
                      color: form.meses === op.val ? 'var(--accent)' : 'var(--text)',
                      cursor:'pointer', transition:'all .15s',
                    }}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fecha manual */}
            <div style={{ marginBottom:'16px' }}>
              <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>
                Fecha de vencimiento
              </label>
              <input
                className="input"
                type="date"
                value={form.licencia_hasta}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm(p => ({ ...p, licencia_hasta: e.target.value, meses: '' }))}
              />
            </div>

            {/* Notas */}
            <div style={{ marginBottom:'24px' }}>
              <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>
                Notas (opcional)
              </label>
              <input
                className="input"
                value={form.licencia_notas}
                onChange={e => setForm(p => ({ ...p, licencia_notas: e.target.value }))}
                placeholder="Ej: Plan mensual, pago recibido..."
              />
            </div>

            <div style={{ display:'flex', gap:'10px', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                {modal.licencia_hasta && (
                  <button type="button" className="btn btn-danger" style={{ fontSize:'12px' }} onClick={handleQuitar} disabled={saving}>
                    🗑 Quitar licencia
                  </button>
                )}
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.licencia_hasta}>
                  {saving ? 'Guardando...' : modal.licencia_hasta ? '🔄 Renovar' : '✓ Asignar licencia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
