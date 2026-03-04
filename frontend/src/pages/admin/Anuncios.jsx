import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL;

const TIPOS = ['general','mantenimiento','evento','urgente','financiero'];
const TIPO_COLOR = { general:'badge-blue', mantenimiento:'badge-yellow', evento:'badge-green', urgente:'badge-red', financiero:'badge-gold' };
const TIPO_ICON  = { general:'📢', mantenimiento:'🔧', evento:'🎉', urgente:'🚨', financiero:'💰' };

function icono_doc(nombre) {
  if (!nombre) return '📎';
  const ext = nombre.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png'].includes(ext)) return '🖼';
  if (ext === 'pdf') return '📄';
  if (['doc','docx'].includes(ext)) return '📝';
  if (['xls','xlsx'].includes(ext)) return '📊';
  return '📎';
}

export default function Anuncios() {
  const [condoId, setCondoId] = useState(null);
  const [anuncios, setAnuncios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [saving, setSaving] = useState(false);
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [quitarDoc, setQuitarDoc] = useState(false);
  const fileRef = useRef();

  const [form, setForm] = useState({ titulo:'', contenido:'', tipo:'general', importante: false, fecha_evento: '' });
  const f = (k) => ({ value: form[k] || '', onChange: e => setForm(p => ({...p, [k]: e.target.value})) });

  const reload = (cid) => api.get(`/condominios/${cid||condoId}/anuncios`).then(r => setAnuncios(r.data));

  useEffect(() => {
    api.get('/condominios').then(r => {
      const c = r.data[0]; if (!c) return;
      setCondoId(c.id);
      return reload(c.id);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ titulo:'', contenido:'', tipo:'general', importante: false, fecha_evento: '' });
    setArchivoSeleccionado(null);
    setQuitarDoc(false);
    setModalAbierto(true);
  };

  const abrirEditar = (a) => {
    setEditando(a);
    setForm({ titulo: a.titulo, contenido: a.contenido, tipo: a.tipo, importante: a.importante, fecha_evento: a.fecha_evento ? a.fecha_evento.split('T')[0] : '' });
    setArchivoSeleccionado(null);
    setQuitarDoc(false);
    setModalAbierto(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const fd = new FormData();
      fd.append('titulo', form.titulo);
      fd.append('contenido', form.contenido);
      fd.append('tipo', form.tipo);
      fd.append('importante', form.importante);
      fd.append('fecha_evento', form.fecha_evento || '');
      if (archivoSeleccionado) fd.append('documento', archivoSeleccionado);
      if (quitarDoc) fd.append('quitar_documento', 'true');

      if (editando) {
        await api.put(`/condominios/${condoId}/anuncios/${editando.id}`, fd, { headers:{'Content-Type':'multipart/form-data'} });
        toast.success('Anuncio actualizado');
      } else {
        await api.post(`/condominios/${condoId}/anuncios`, fd, { headers:{'Content-Type':'multipart/form-data'} });
        toast.success('Anuncio publicado — ya visible para los residentes');
      }
      setModalAbierto(false);
      await reload();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar este anuncio?')) return;
    try {
      await api.delete(`/condominios/${condoId}/anuncios/${id}`);
      toast.success('Anuncio eliminado');
      await reload();
    } catch { toast.error('Error al eliminar'); }
  };

  return (
    <Layout>
      <div style={{ padding:'32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'28px' }}>
          <div>
            <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Anuncios</h1>
            <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>{anuncios.length} anuncios publicados — visibles a todos los residentes</p>
          </div>
          <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo anuncio</button>
        </div>

        {loading ? (
          <div style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>Cargando...</div>
        ) : anuncios.length === 0 ? (
          <div className="card" style={{ padding:'64px', textAlign:'center', color:'var(--text2)' }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>📢</div>
            <p style={{ marginBottom:'16px' }}>No hay anuncios publicados. ¡Crea el primero!</p>
            <button className="btn btn-primary" onClick={abrirNuevo}>Crear anuncio</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            {anuncios.map(a => (
              <div key={a.id} className="card" style={{ padding:'20px 24px', position:'relative', overflow:'hidden' }}>
                {a.importante && <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'var(--red)' }} />}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:'8px', marginBottom:'8px', alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'18px' }}>{TIPO_ICON[a.tipo]||'📢'}</span>
                      <span className={`badge ${TIPO_COLOR[a.tipo]||'badge-blue'}`} style={{ textTransform:'capitalize' }}>{a.tipo}</span>
                      {a.importante && <span className="badge badge-red">⚠ Importante</span>}
                      {a.documento_url && (
                        <span style={{ fontSize:'12px', color:'var(--text2)', display:'flex', alignItems:'center', gap:'4px' }}>
                          {icono_doc(a.documento_nombre)} Documento adjunto
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight:'700', fontSize:'16px', marginBottom:'6px' }}>{a.titulo}</div>
                    <div style={{ color:'var(--text2)', fontSize:'14px', lineHeight:'1.6', marginBottom:'10px' }}>{a.contenido}</div>

                    {/* Documento adjunto */}
                    {a.documento_url && (
                      <a href={`${API_URL}${a.documento_url}`} target="_blank" rel="noreferrer"
                        style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'7px 14px', borderRadius:'8px', background:'var(--surface2)', border:'1px solid var(--border)', textDecoration:'none', color:'var(--text)', fontSize:'13px', fontWeight:'600', transition:'all .15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                        <span style={{ fontSize:'18px' }}>{icono_doc(a.documento_nombre)}</span>
                        <span>{a.documento_nombre || 'Ver documento'}</span>
                        <span style={{ fontSize:'11px', color:'var(--text2)' }}>↗</span>
                      </a>
                    )}

                    <div style={{ fontSize:'11px', color:'var(--text2)', marginTop:'10px' }}>
                      Por {a.autor || 'Administrador'} · {new Date(a.created_at).toLocaleDateString('es-DO', { day:'numeric', month:'long', year:'numeric' })}
                      {a.fecha_evento && (
                        <span style={{ marginLeft:'12px', color:'var(--accent)', fontWeight:'600' }}>
                          📅 {new Date(a.fecha_evento+'T12:00:00').toLocaleDateString('es-DO', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'8px', marginLeft:'16px' }}>
                    <button className="btn btn-ghost" style={{ padding:'5px 12px', fontSize:'12px' }} onClick={() => abrirEditar(a)}>✏ Editar</button>
                    <button className="btn btn-ghost" style={{ padding:'5px 12px', fontSize:'12px', color:'var(--red)' }} onClick={() => handleEliminar(a.id)}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {modalAbierto && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalAbierto(false)}>
          <div className="modal" style={{ maxWidth:'560px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'20px' }}>
              {editando ? 'Editar anuncio' : 'Nuevo anuncio'}
            </h2>
            <form onSubmit={handleGuardar}>
              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 160px', gap:'12px' }}>
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Título *</label>
                    <input className="input" required {...f('titulo')} placeholder="Título del anuncio" />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Tipo</label>
                    <select className="input" {...f('tipo')}>
                      {TIPOS.map(t => <option key={t} value={t}>{TIPO_ICON[t]} {t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                    </select>
                  </div>
                </div>

                {/* Fecha del evento */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>
                      📅 Fecha del evento / vigencia — Opcional
                    </label>
                    <input className="input" type="date" {...f('fecha_evento')} />
                    <div style={{ fontSize:'11px', color:'var(--text2)', marginTop:'4px' }}>Ej: fecha de una reunión, evento o vencimiento</div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Contenido *</label>
                  <textarea className="input" rows={4} required style={{ resize:'vertical' }}
                    {...f('contenido')} placeholder="Escribe el contenido del anuncio..." />
                </div>

                {/* Documento adjunto */}
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>
                    📎 Documento adjunto — Opcional
                  </label>

                  {/* Si hay documento previo en edición */}
                  {editando?.documento_url && !quitarDoc && !archivoSeleccionado && (
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:'#dbeafe', borderRadius:'8px', marginBottom:'8px', border:'1px solid #93c5fd' }}>
                      <span style={{ fontSize:'20px' }}>{icono_doc(editando.documento_nombre)}</span>
                      <span style={{ flex:1, fontSize:'13px', fontWeight:'600', color:'#1d4ed8' }}>{editando.documento_nombre}</span>
                      <button type="button" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)', fontSize:'12px', fontWeight:'600' }}
                        onClick={() => setQuitarDoc(true)}>✕ Quitar</button>
                    </div>
                  )}

                  {archivoSeleccionado ? (
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:'#dcfce7', borderRadius:'8px', border:'1px solid #86efac' }}>
                      <span style={{ fontSize:'20px' }}>{icono_doc(archivoSeleccionado.name)}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'13px', fontWeight:'600', color:'#16a34a' }}>{archivoSeleccionado.name}</div>
                        <div style={{ fontSize:'11px', color:'#16a34a' }}>{(archivoSeleccionado.size/1024).toFixed(0)} KB</div>
                      </div>
                      <button type="button" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)', fontSize:'18px', lineHeight:1 }}
                        onClick={() => setArchivoSeleccionado(null)}>✕</button>
                    </div>
                  ) : (
                    <div
                      style={{ border:'2px dashed var(--border)', borderRadius:'10px', padding:'20px', textAlign:'center', cursor:'pointer', background:'var(--surface2)', transition:'border .2s' }}
                      onClick={() => fileRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor='var(--accent)'; }}
                      onDragLeave={e => { e.currentTarget.style.borderColor='var(--border)'; }}
                      onDrop={e => {
                        e.preventDefault(); e.currentTarget.style.borderColor='var(--border)';
                        const f = e.dataTransfer.files[0];
                        if (f && f.size <= 10*1024*1024) { setArchivoSeleccionado(f); setQuitarDoc(false); }
                        else if (f) toast.error('Máximo 10MB');
                      }}>
                      <div style={{ fontSize:'28px', marginBottom:'6px' }}>📎</div>
                      <div style={{ fontSize:'13px', fontWeight:'600', color:'var(--text2)' }}>Arrastra un documento aquí o haz clic</div>
                      <div style={{ fontSize:'11px', color:'var(--text2)', marginTop:'2px' }}>PDF, Word, Excel, imágenes · Máx. 10MB</div>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" style={{ display:'none' }}
                    onChange={e => {
                      const f = e.target.files[0];
                      if (f && f.size <= 10*1024*1024) { setArchivoSeleccionado(f); setQuitarDoc(false); }
                      else if (f) toast.error('Máximo 10MB');
                    }} />
                </div>

                <label style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', padding:'10px 14px', background: form.importante ? 'rgba(220,38,38,.06)' : 'var(--surface2)', borderRadius:'8px', border: form.importante ? '1px solid rgba(220,38,38,.3)' : '1px solid var(--border)', transition:'all .2s' }}>
                  <input type="checkbox" checked={form.importante||false} onChange={e => setForm(p=>({...p,importante:e.target.checked}))} />
                  <div>
                    <div style={{ fontWeight:'700', fontSize:'14px' }}>⚠ Marcar como importante</div>
                    <div style={{ fontSize:'12px', color:'var(--text2)' }}>Aparecerá destacado en la página principal del residente</div>
                  </div>
                </label>

              </div>
              <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalAbierto(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Publicando...' : editando ? 'Guardar cambios' : '📢 Publicar anuncio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
