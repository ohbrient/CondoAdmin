import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';

const tipoColor = { reparacion:'badge-red', queja:'badge-yellow', consulta:'badge-blue', sugerencia:'badge-green', emergencia:'badge-red' };
const estadoColor = { abierta:'badge-yellow', en_proceso:'badge-blue', cerrada:'badge-green', rechazada:'badge-red' };

export default function Solicitudes() {
  const [condoId, setCondoId] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filtro, setFiltro] = useState('todos');
  const [respuesta, setRespuesta] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('en_proceso');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/condominios').then(r => {
      const c = r.data[0]; if (!c) return;
      setCondoId(c.id);
      return api.get(`/condominios/${c.id}/solicitudes`);
    }).then(r => r && setSolicitudes(r.data))
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const reload = (cid) => api.get(`/condominios/${cid || condoId}/solicitudes`).then(r => setSolicitudes(r.data));

  const handleResponder = async () => {
    if (!respuesta.trim()) return toast.error('Escribe una respuesta');
    setSaving(true);
    try {
      await api.put(`/condominios/${condoId}/solicitudes/${selected.id}`, {
        estado: nuevoEstado, respuesta_admin: respuesta
      });
      toast.success('Respuesta enviada');
      setSelected(null);
      reload();
    } catch { toast.error('Error al responder'); }
    finally { setSaving(false); }
  };

  const filtradas = solicitudes.filter(s => filtro === 'todos' || s.estado === filtro || s.tipo === filtro);
  const pendientes = solicitudes.filter(s => s.estado === 'abierta').length;
  const emergencias = solicitudes.filter(s => s.tipo === 'emergencia' && s.estado !== 'cerrada').length;

  return (
    <Layout>
      <div style={{ padding:'32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'32px' }}>
          <div>
            <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Solicitudes</h1>
            <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>
              {solicitudes.length} total · <span style={{ color:'var(--yellow)' }}>{pendientes} pendientes</span>
              {emergencias > 0 && <span style={{ color:'var(--red)', marginLeft:'8px' }}>⚠ {emergencias} emergencias</span>}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
          {[['todos','Todas'],['abierta','Pendientes'],['en_proceso','En proceso'],['cerrada','Resueltas'],['emergencia','Emergencias']].map(([v,l]) => (
            <button key={v} onClick={() => setFiltro(v)} style={{
              padding:'6px 14px', borderRadius:'20px', cursor:'pointer', fontWeight:'600', fontSize:'12px',
              border: filtro===v ? 'none' : '1px solid var(--border)',
              background: filtro===v ? 'var(--accent)' : 'transparent',
              color: filtro===v ? 'var(--bg)' : 'var(--text2)',
            }}>{l}</button>
          ))}
        </div>

        <div className="card">
          {loading ? (
            <div style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>Cargando...</div>
          ) : filtradas.length === 0 ? (
            <div style={{ padding:'64px', textAlign:'center', color:'var(--text2)' }}>
              <div style={{ fontSize:'48px', marginBottom:'12px' }}>📋</div>
              <p>No hay solicitudes {filtro !== 'todos' ? 'en esta categoría' : ''}</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Residente</th><th>Unidad</th><th>Tipo</th><th>Asunto</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr>
              </thead>
              <tbody>
                {filtradas.map(s => (
                  <tr key={s.id} style={{ cursor:'pointer' }} onClick={() => { setSelected(s); setRespuesta(s.respuesta||''); setNuevoEstado(s.estado==='abierta' ? 'en_proceso' : s.estado); }}>
                    <td style={{ fontWeight:'600' }}>{s.residente_nombre || '—'}</td>
                    <td style={{ color:'var(--text2)', fontSize:'13px' }}>{s.unidad_numero || '—'}</td>
                    <td><span className={`badge ${tipoColor[s.tipo]||'badge-gold'}`}>{s.tipo}</span></td>
                    <td style={{ maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.titulo}</td>
                    <td style={{ fontSize:'13px', color:'var(--text2)' }}>{new Date(s.created_at).toLocaleDateString('es-DO')}</td>
                    <td><span className={`badge ${estadoColor[s.estado]||'badge-gold'}`}>{s.estado.replace('_',' ')}</span></td>
                    <td>
                      <button className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:'12px' }}
                        onClick={e => { e.stopPropagation(); setSelected(s); setRespuesta(s.respuesta||''); setNuevoEstado(s.estado==='abierta' ? 'en_proceso' : s.estado); }}>
                        Ver / Responder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal responder */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ maxWidth:'560px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
              <div>
                <div style={{ display:'flex', gap:'8px', marginBottom:'6px' }}>
                  <span className={`badge ${tipoColor[selected.tipo]||'badge-gold'}`}>{selected.tipo}</span>
                  <span className={`badge ${estadoColor[selected.estado]||'badge-gold'}`}>{selected.estado.replace('_',' ')}</span>
                </div>
                <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'22px', margin:0 }}>{selected.titulo}</h2>
                <p style={{ color:'var(--text2)', fontSize:'13px', margin:'4px 0 0' }}>
                  {selected.residente_nombre} · Unidad {selected.unidad_numero} · {new Date(selected.created_at).toLocaleDateString('es-DO')}
                </p>
              </div>
            </div>

            <div style={{ background:'var(--surface2)', borderRadius:'8px', padding:'16px', marginBottom:'20px' }}>
              <div style={{ fontSize:'11px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>Mensaje del residente</div>
              <p style={{ margin:0, fontSize:'14px', lineHeight:'1.6' }}>{selected.descripcion}</p>
            </div>

            {selected.estado !== 'cerrada' && (
              <>
                <div style={{ marginBottom:'16px' }}>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Cambiar estado</label>
                  <select className="input" value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}>
                    <option value="en_proceso">En proceso</option>
                    <option value="cerrada">Cerrada / Resuelta</option>
                    <option value="rechazada">Rechazada</option>
                  </select>
                </div>
                <div style={{ marginBottom:'20px' }}>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Respuesta al residente</label>
                  <textarea className="input" rows={4} style={{ resize:'vertical' }}
                    placeholder="Escribe tu respuesta aquí..."
                    value={respuesta} onChange={e => setRespuesta(e.target.value)} />
                </div>
              </>
            )}

            {selected.respuesta && selected.estado === 'cerrada' && (
              <div style={{ background:'var(--surface2)', borderRadius:'8px', padding:'16px', marginBottom:'20px' }}>
                <div style={{ fontSize:'11px', color:'var(--green)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>Respuesta enviada</div>
                <p style={{ margin:0, fontSize:'14px' }}>{selected.respuesta}</p>
              </div>
            )}

            <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Cerrar</button>
              {selected.estado !== 'cerrada' && (
                <button className="btn btn-primary" onClick={handleResponder} disabled={saving}>
                  {saving ? 'Enviando...' : 'Enviar respuesta'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
