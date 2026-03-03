import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';

const EMPTY_UNIDAD = { numero:'', tipo:'apartamento', metros_cuadrados:'', piso:'', cuota_personalizada:'', notas:'' };
const EMPTY_USER   = { nombre:'', apellido:'', email:'', password:'', telefono:'' };

export default function Residentes() {
  const [condoId, setCondoId]     = useState(null);
  const [moneda, setMoneda]       = useState('RD$');
  const [unidades, setUnidades]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filtro, setFiltro]       = useState('todos');
  const [search, setSearch]       = useState('');
  const [modal, setModal]         = useState(null);
  const [selected, setSelected]   = useState(null);
  const [formUnidad, setFormUnidad] = useState(EMPTY_UNIDAD);
  const [formUser, setFormUser]   = useState(EMPTY_USER);
  const [saving, setSaving]       = useState(false);

  // Para asignar residente existente
  const [modoAsignar, setModoAsignar]               = useState('nuevo'); // 'nuevo' | 'existente'
  const [residentes, setResidentes]                 = useState([]);
  const [searchResidente, setSearchResidente]       = useState('');
  const [selectedResidente, setSelectedResidente]   = useState(null);
  const [esPropietario, setEsPropietario]           = useState(true);

  useEffect(() => {
    api.get('/condominios').then(r => {
      const c = r.data[0]; if (!c) return;
      setCondoId(c.id);
      setMoneda(c.moneda || 'RD$');
      return api.get(`/condominios/${c.id}/unidades`);
    }).then(r => r && setUnidades(r.data))
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  // Cargar lista de residentes existentes cuando se abre el modal
  useEffect(() => {
    if (modal === 'residente') {
      api.get('/usuarios?rol=residente')
        .then(r => setResidentes(r.data))
        .catch(() => {});
    }
  }, [modal]);

  const reload = () => {
    if (!condoId) return;
    api.get(`/condominios/${condoId}/unidades`).then(r => setUnidades(r.data));
  };

  const openAsignar = () => {
    setModoAsignar('nuevo');
    setFormUser(EMPTY_USER);
    setSelectedResidente(null);
    setSearchResidente('');
    setEsPropietario(true);
    setModal('residente');
  };

  const handleSaveUnidad = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (selected?.id && formUnidad.numero) {
        await api.put(`/condominios/${condoId}/unidades/${selected.id}`, formUnidad);
        toast.success('Unidad actualizada');
      } else {
        await api.post(`/condominios/${condoId}/unidades`, formUnidad);
        toast.success('Unidad creada');
      }
      setModal(null); reload();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleAsignarNuevo = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const { data: newUser } = await api.post('/usuarios', { ...formUser, rol:'residente' });
      await api.post(`/condominios/${condoId}/unidades/${selected.id}/asignar-residente`, {
        usuario_id: newUser.id, es_propietario: esPropietario
      });
      toast.success('Residente creado y asignado');
      setModal(null); reload();
    } catch (err) { toast.error(err.response?.data?.error || 'Error al crear residente'); }
    finally { setSaving(false); }
  };

  const handleAsignarExistente = async () => {
    if (!selectedResidente) return toast.error('Selecciona un residente');
    setSaving(true);
    try {
      await api.post(`/condominios/${condoId}/unidades/${selected.id}/asignar-residente`, {
        usuario_id: selectedResidente.id, es_propietario: esPropietario
      });
      toast.success(`${selectedResidente.nombre} asignado a Unidad ${selected.numero}`);
      setModal(null); reload();
    } catch (err) { toast.error(err.response?.data?.error || 'Error al asignar'); }
    finally { setSaving(false); }
  };

  const fu = k => ({ value: formUnidad[k]||'', onChange: e => setFormUnidad(p=>({...p,[k]:e.target.value})) });
  const fr = k => ({ value: formUser[k]||'',   onChange: e => setFormUser(p=>({...p,[k]:e.target.value})) });

  const estadoPago = u => {
    if (!u.estado_pago) return { label:'Sin periodo', cls:'badge-gold' };
    if (u.estado_pago === 'pagado')  return { label:'Al día',  cls:'badge-green' };
    if (u.estado_pago === 'parcial') return { label:'Parcial', cls:'badge-yellow' };
    return { label:'Moroso', cls:'badge-red' };
  };

  const filtradas = unidades.filter(u => {
    const matchFiltro = filtro === 'todos' || u.estado === filtro ||
      (filtro === 'moroso' && u.estado_pago === 'pendiente') ||
      (filtro === 'al-dia' && u.estado_pago === 'pagado');
    const matchSearch = !search || u.numero.toLowerCase().includes(search.toLowerCase()) ||
      (u.residentes||[]).some(r => `${r.nombre} ${r.apellido}`.toLowerCase().includes(search.toLowerCase()));
    return matchFiltro && matchSearch;
  });

  const residentesFiltrados = residentes.filter(r =>
    !searchResidente ||
    `${r.nombre} ${r.apellido}`.toLowerCase().includes(searchResidente.toLowerCase()) ||
    r.email.toLowerCase().includes(searchResidente.toLowerCase())
  );

  const LBL = { fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' };

  return (
    <Layout>
      <div style={{ padding:'32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'32px' }}>
          <div>
            <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Residentes</h1>
            <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>
              {unidades.length} unidades · {unidades.filter(u=>u.estado==='ocupado').length} ocupadas · {unidades.filter(u=>u.estado==='vacante').length} vacantes
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => { setFormUnidad(EMPTY_UNIDAD); setSelected(null); setModal('unidad'); }}>
            + Nueva Unidad
          </button>
        </div>

        <div style={{ display:'flex', gap:'12px', marginBottom:'20px', alignItems:'center', flexWrap:'wrap' }}>
          <input className="input" placeholder="Buscar unidad o residente..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ maxWidth:'260px' }} />
          {[['todos','Todas'],['ocupado','Ocupadas'],['vacante','Vacantes'],['moroso','Morosos'],['al-dia','Al día']].map(([v,l]) => (
            <button key={v} onClick={() => setFiltro(v)} style={{
              padding:'6px 14px', borderRadius:'20px', cursor:'pointer', fontWeight:'600', fontSize:'12px',
              border: filtro===v ? 'none' : '1px solid var(--border)',
              background: filtro===v ? 'var(--accent)' : 'transparent',
              color: filtro===v ? 'var(--bg)' : 'var(--text2)',
            }}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'48px', color:'var(--text2)' }}>Cargando...</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:'16px' }}>
            {filtradas.map(u => {
              const ep = estadoPago(u);
              const residente = u.residentes?.[0];
              const totalRes = (u.residentes||[]).length;
              return (
                <div key={u.id} className="card" style={{ position:'relative', overflow:'hidden', cursor:'pointer' }}
                  onClick={() => { setSelected(u); setModal('ver'); }}>
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'3px',
                    background: u.estado==='vacante' ? 'var(--border)' : ep.cls.includes('green') ? 'var(--green)' : ep.cls.includes('red') ? 'var(--red)' : 'var(--yellow)' }} />
                  <div style={{ padding:'20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'12px' }}>
                      <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px' }}>{u.numero}</div>
                      <span className={`badge ${ep.cls}`}>{ep.label}</span>
                    </div>
                    <div style={{ fontSize:'11px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>{u.tipo}</div>
                    {totalRes > 0 ? (
                      <div>
                        <div style={{ fontSize:'13px', fontWeight:'600' }}>{residente.nombre} {residente.apellido}</div>
                        {totalRes > 1 && <div style={{ fontSize:'11px', color:'var(--accent)', marginTop:'2px' }}>+{totalRes-1} residente{totalRes-1>1?'s':''} más</div>}
                      </div>
                    ) : (
                      <div style={{ fontSize:'13px', color:'var(--text2)', fontStyle:'italic' }}>Sin residente</div>
                    )}
                    {u.monto_cuota && (
                      <div style={{ fontSize:'12px', color:'var(--text2)', marginTop:'4px' }}>
                        {moneda} {parseFloat(u.monto_cuota).toLocaleString()} / mes
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="card" style={{ cursor:'pointer', border:'1px dashed var(--border)', background:'transparent' }}
              onClick={() => { setFormUnidad(EMPTY_UNIDAD); setSelected(null); setModal('unidad'); }}>
              <div style={{ padding:'20px', textAlign:'center', color:'var(--text2)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', minHeight:'120px' }}>
                <div style={{ fontSize:'28px', marginBottom:'8px' }}>+</div>
                <div style={{ fontSize:'13px' }}>Nueva unidad</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal ver unidad */}
      {modal === 'ver' && selected && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px' }}>
              <div>
                <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Unidad {selected.numero}</h2>
                <p style={{ color:'var(--text2)', fontSize:'13px', margin:'4px 0 0' }}>{selected.tipo} · Piso {selected.piso || '—'} · {selected.metros_cuadrados || '—'} m²</p>
              </div>
              <span className={`badge ${estadoPago(selected).cls}`}>{estadoPago(selected).label}</span>
            </div>

            <div style={{ marginBottom:'24px' }}>
              <div style={{ fontSize:'12px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'10px' }}>
                Residentes asignados ({(selected.residentes||[]).length})
              </div>
              {(selected.residentes||[]).length > 0 ? (
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {selected.residentes.map((r,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:'var(--surface2)', borderRadius:'8px' }}>
                      <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'700', color:'var(--bg)', flexShrink:0 }}>
                        {r.nombre?.[0]}{r.apellido?.[0]}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:'600', fontSize:'14px' }}>{r.nombre} {r.apellido}</div>
                        <div style={{ fontSize:'12px', color:'var(--text2)' }}>{r.email}{r.telefono ? ` · ${r.telefono}` : ''}</div>
                      </div>
                      <span className={`badge ${r.es_propietario ? 'badge-gold' : 'badge-blue'}`} style={{ fontSize:'10px' }}>
                        {r.es_propietario ? '🏠 Propietario' : '🔑 Inquilino'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding:'24px', background:'var(--surface2)', borderRadius:'8px', textAlign:'center', color:'var(--text2)' }}>
                  <div style={{ fontSize:'32px', marginBottom:'8px' }}>🏠</div>
                  <p style={{ margin:0, fontSize:'14px' }}>Sin residentes asignados</p>
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:'10px' }}>
              <button className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }}
                onClick={() => { setFormUnidad({...EMPTY_UNIDAD,...selected}); setModal('unidad'); }}>✎ Editar unidad</button>
              <button className="btn btn-primary" style={{ flex:1, justifyContent:'center' }}
                onClick={openAsignar}>+ Asignar residente</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar unidad */}
      {modal === 'unidad' && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'24px' }}>
              {selected?.id ? 'Editar Unidad' : 'Nueva Unidad'}
            </h2>
            <form onSubmit={handleSaveUnidad}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                {[
                  { label:'Número / Identificación *', key:'numero', full:false, required:true, placeholder:'4B, Casa 7...' },
                  { label:'Piso', key:'piso', type:'number' },
                  { label:'Metros cuadrados', key:'metros_cuadrados', type:'number', placeholder:'85' },
                  { label:'Cuota personalizada', key:'cuota_personalizada', type:'number', placeholder:'Dejar vacío = cuota base' },
                ].map(f => (
                  <div key={f.key} style={{ gridColumn: f.full ? '1/-1' : undefined }}>
                    <label style={LBL}>{f.label}</label>
                    <input className="input" type={f.type||'text'} required={f.required} placeholder={f.placeholder||''} {...fu(f.key)} />
                  </div>
                ))}
                <div>
                  <label style={LBL}>Tipo</label>
                  <select className="input" {...fu('tipo')}>
                    {['apartamento','casa','local','oficina'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LBL}>Estado</label>
                  <select className="input" {...fu('estado')}>
                    <option value="vacante">Vacante</option>
                    <option value="ocupado">Ocupado</option>
                    <option value="en_venta">En venta</option>
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={LBL}>Notas</label>
                  <input className="input" placeholder="Observaciones opcionales..." {...fu('notas')} />
                </div>
              </div>
              <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : selected?.id ? 'Guardar cambios' : 'Crear Unidad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal asignar residente */}
      {modal === 'residente' && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth:'520px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'4px' }}>Asignar Residente</h2>
            <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'20px' }}>Unidad {selected?.numero}</p>

            {/* Toggle nuevo / existente */}
            <div style={{ display:'flex', background:'var(--surface2)', borderRadius:'10px', padding:'4px', marginBottom:'24px' }}>
              {[['existente','👤 Residente existente'],['nuevo','✚ Crear nuevo residente']].map(([v,l]) => (
                <button key={v} type="button" onClick={() => setModoAsignar(v)} style={{
                  flex:1, padding:'8px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'600', transition:'all .15s',
                  background: modoAsignar===v ? 'var(--card)' : 'transparent',
                  color: modoAsignar===v ? 'var(--text)' : 'var(--text2)',
                  boxShadow: modoAsignar===v ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
                }}>{l}</button>
              ))}
            </div>

            {/* Rol propietario/inquilino — compartido */}
            <div style={{ marginBottom:'20px' }}>
              <label style={LBL}>Rol en la unidad</label>
              <div style={{ display:'flex', gap:'10px' }}>
                {[['propietario', true, '🏠'],['inquilino', false, '🔑']].map(([lbl, val, icon]) => (
                  <div key={lbl} onClick={() => setEsPropietario(val)} style={{
                    flex:1, padding:'10px 14px', borderRadius:'8px', cursor:'pointer', textAlign:'center',
                    border: `2px solid ${esPropietario===val ? 'var(--accent)' : 'var(--border)'}`,
                    background: esPropietario===val ? 'rgba(176,138,78,.08)' : 'var(--surface)',
                  }}>
                    <div style={{ fontSize:'18px' }}>{icon}</div>
                    <div style={{ fontSize:'12px', fontWeight:'700', marginTop:'2px', textTransform:'capitalize' }}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modo existente */}
            {modoAsignar === 'existente' && (
              <div>
                <label style={LBL}>Buscar residente registrado</label>
                <input className="input" placeholder="Nombre, apellido o email..." value={searchResidente}
                  onChange={e => { setSearchResidente(e.target.value); setSelectedResidente(null); }}
                  style={{ marginBottom:'10px' }} />

                <div style={{ maxHeight:'220px', overflowY:'auto', border:'1px solid var(--border)', borderRadius:'10px' }}>
                  {residentesFiltrados.length === 0 ? (
                    <div style={{ padding:'24px', textAlign:'center', color:'var(--text2)', fontSize:'13px' }}>
                      {searchResidente ? 'No se encontraron residentes' : 'Escribe para buscar...'}
                    </div>
                  ) : residentesFiltrados.map(r => (
                    <div key={r.id} onClick={() => setSelectedResidente(r)} style={{
                      display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', cursor:'pointer',
                      background: selectedResidente?.id===r.id ? 'rgba(176,138,78,.1)' : 'transparent',
                      borderBottom:'1px solid var(--border)',
                      borderLeft: selectedResidente?.id===r.id ? '3px solid var(--accent)' : '3px solid transparent',
                    }}>
                      <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', color:'var(--bg)', flexShrink:0 }}>
                        {r.nombre?.[0]}{r.apellido?.[0]}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:'600', fontSize:'13px' }}>{r.nombre} {r.apellido}</div>
                        <div style={{ fontSize:'11px', color:'var(--text2)' }}>{r.email}</div>
                      </div>
                      {selectedResidente?.id===r.id && <span style={{ color:'var(--accent)', fontWeight:'700' }}>✓</span>}
                    </div>
                  ))}
                </div>

                {selectedResidente && (
                  <div style={{ marginTop:'12px', padding:'10px 14px', background:'rgba(176,138,78,.08)', borderRadius:'8px', border:'1px solid rgba(176,138,78,.2)', fontSize:'13px' }}>
                    ✓ <strong>{selectedResidente.nombre} {selectedResidente.apellido}</strong> será asignado a Unidad {selected?.numero}
                  </div>
                )}

                <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'20px' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                  <button type="button" className="btn btn-primary" disabled={saving || !selectedResidente} onClick={handleAsignarExistente}>
                    {saving ? 'Asignando...' : 'Asignar a esta unidad'}
                  </button>
                </div>
              </div>
            )}

            {/* Modo nuevo */}
            {modoAsignar === 'nuevo' && (
              <form onSubmit={handleAsignarNuevo}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                  {[
                    { label:'Nombre *', key:'nombre', required:true },
                    { label:'Apellido *', key:'apellido', required:true },
                    { label:'Teléfono', key:'telefono', placeholder:'809-000-0000' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={LBL}>{f.label}</label>
                      <input className="input" required={f.required} placeholder={f.placeholder||''} {...fr(f.key)} />
                    </div>
                  ))}
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={LBL}>Email *</label>
                    <input className="input" type="email" required {...fr('email')} placeholder="residente@email.com" />
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={LBL}>Contraseña temporal *</label>
                    <input className="input" type="password" required {...fr('password')} placeholder="El residente podrá cambiarla luego" />
                  </div>
                </div>
                <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'24px' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Creando...' : 'Crear y asignar residente'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}