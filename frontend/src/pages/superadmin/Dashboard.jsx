import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';

const EMPTY = {
  nombre:'', direccion:'', ciudad:'', telefono:'', email:'',
  moneda:'RD$', cuota_base:'', recargo_mora:'5', dias_gracia:'5', max_unidades:'',
};

export default function SACondominios() {
  const [condos, setCondos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  // Modal admins
  const [modalAdmins, setModalAdmins] = useState(null);
  const [adminSeleccionado, setAdminSeleccionado] = useState('');
  const [savingAdmin, setSavingAdmin] = useState(false);

  const load = () => {
    Promise.all([
      api.get('/condominios'),
      api.get('/usuarios'),
    ]).then(([c, u]) => {
      setCondos(c.data.map(condo => ({
        ...condo,
        admins: typeof condo.admins === 'string' ? JSON.parse(condo.admins) : (condo.admins || []),
      })));
      setUsuarios(u.data.filter(u => u.rol === 'admin' || u.rol === 'superadmin' || u.rol === 'residente'));
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCrear = () => { setForm(EMPTY); setEditando(null); setShowModal(true); };
  const openEditar = (c) => { setForm({ ...EMPTY, ...c }); setEditando(c); setShowModal(true); };
  const openAdmins = (c) => { setModalAdmins(c); setAdminSeleccionado(''); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editando) {
        await api.put(`/condominios/${editando.id}`, form);
        toast.success('Condominio actualizado');
      } else {
        await api.post('/condominios', form);
        toast.success('Condominio creado');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleAsignarAdmin = async () => {
    if (!adminSeleccionado) return toast.error('Selecciona un administrador');
    setSavingAdmin(true);
    try {
      await api.post(`/condominios/${modalAdmins.id}/admins`, { usuario_id: adminSeleccionado });
      toast.success('Administrador asignado correctamente');
      setModalAdmins(null);
      setAdminSeleccionado('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al asignar');
    } finally { setSavingAdmin(false); }
  };

  const f = (k) => ({ value: form[k]||'', onChange: e => setForm(p => ({...p, [k]: e.target.value})) });

  return (
    <Layout>
      <div style={{ padding:'32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'32px' }}>
          <div>
            <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Condominios</h1>
            <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>{condos.length} condominios registrados</p>
          </div>
          <button className="btn btn-primary" onClick={openCrear}>+ Nuevo Condominio</button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'48px', color:'var(--text2)' }}>Cargando...</div>
        ) : condos.length === 0 ? (
          <div style={{ textAlign:'center', padding:'64px', color:'var(--text2)' }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>🏢</div>
            <p>No hay condominios. ¡Crea el primero!</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'20px' }}>
            {condos.map(c => (
              <div key={c.id} className="card" style={{ position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background: c.activo ? 'var(--accent)' : 'var(--border)' }} />
                <div style={{ padding:'24px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
                    <div>
                      <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'20px', marginBottom:'4px' }}>{c.nombre}</div>
                      <div style={{ fontSize:'12px', color:'var(--text2)' }}>{c.ciudad || 'Sin ciudad'} · {c.email || '—'}</div>
                    </div>
                    <span className={`badge ${c.activo ? 'badge-green' : 'badge-red'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span>
                  </div>

                  {/* Admins asignados */}
                  <div style={{ marginBottom:'14px', padding:'10px 12px', background:'var(--surface2)', borderRadius:'8px' }}>
                    <div style={{ fontSize:'10px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Administradores</div>
                    {c.admins?.length > 0 ? (
                      c.admins.map(a => (
                        <div key={a.id} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                          <div style={{ width:'22px', height:'22px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'700', color:'#fff', flexShrink:0 }}>
                            {a.nombre?.[0]}{a.apellido?.[0]}
                          </div>
                          <span style={{ fontSize:'13px', fontWeight:'500' }}>{a.nombre} {a.apellido}</span>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize:'12px', color:'var(--red)', fontStyle:'italic' }}>Sin administrador asignado</span>
                    )}
                  </div>

                  {/* Barra de uso de unidades */}
                  {c.max_unidades && (
                    <div style={{ marginBottom:'14px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'5px' }}>
                        <span style={{ color:'var(--text2)' }}>Unidades usadas</span>
                        <span style={{ fontWeight:'700' }}>
                          {c.total_unidades || 0}
                          <span style={{ color:'var(--text2)', fontWeight:'400' }}> / {c.max_unidades}</span>
                        </span>
                      </div>
                      <div style={{ background:'var(--border)', borderRadius:'99px', height:'6px', overflow:'hidden' }}>
                        <div style={{
                          height:'100%', borderRadius:'99px', transition:'width .4s',
                          width: `${Math.min(100, ((c.total_unidades||0) / c.max_unidades) * 100)}%`,
                          background: ((c.total_unidades||0) / c.max_unidades) >= 0.9 ? 'var(--red)'
                            : ((c.total_unidades||0) / c.max_unidades) >= 0.7 ? 'var(--yellow)'
                            : 'var(--green)',
                        }} />
                      </div>
                      {(c.total_unidades||0) >= c.max_unidades && (
                        <div style={{ fontSize:'11px', color:'var(--red)', marginTop:'4px', fontWeight:'600' }}>⚠ Límite de unidades alcanzado</div>
                      )}
                    </div>
                  )}

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'20px' }}>
                    {[
                      ['Unidades', `${c.total_unidades || 0}${c.max_unidades ? ' / ' + c.max_unidades : ''}`],
                      ['Cuota base', `${c.moneda} ${parseFloat(c.cuota_base||0).toLocaleString()}`],
                      ['Recargo mora', `${c.recargo_mora}%`],
                      ['Días de gracia', c.dias_gracia],
                    ].map(([lbl, val]) => (
                      <div key={lbl} style={{ background:'var(--surface2)', borderRadius:'8px', padding:'10px 12px' }}>
                        <div style={{ fontSize:'10px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px' }}>{lbl}</div>
                        <div style={{ fontSize:'15px', fontWeight:'700' }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display:'flex', gap:'8px' }}>
                    <button className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }} onClick={() => openEditar(c)}>✎ Editar</button>
                    <button className="btn btn-primary" style={{ flex:1, justifyContent:'center' }} onClick={() => openAdmins(c)}>👥 Admins</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal Crear/Editar Condominio ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'24px' }}>
              {editando ? 'Editar Condominio' : 'Nuevo Condominio'}
            </h2>
            <form onSubmit={handleSave}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Nombre del condominio *</label>
                  <input className="input" required {...f('nombre')} placeholder="Torres del Parque" />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Dirección</label>
                  <input className="input" {...f('direccion')} placeholder="Calle, número..." />
                </div>
                {[
                  { label:'Ciudad', key:'ciudad', placeholder:'Santo Domingo Este' },
                  { label:'Teléfono', key:'telefono', placeholder:'809-000-0000' },
                  { label:'Email de contacto', key:'email', placeholder:'admin@torres.com' },
                  { label:'Moneda', key:'moneda', type:'select', options:['RD$','USD','EUR','MXN'] },
                  { label:'Cuota base mensual', key:'cuota_base', type:'number', placeholder:'2500' },
                  { label:'Recargo por mora (%)', key:'recargo_mora', type:'number', placeholder:'5' },
                  { label:'Límite máximo de unidades', key:'max_unidades', type:'number', placeholder:'Ej: 50 (dejar vacío = sin límite)' },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>{field.label}</label>
                    {field.type === 'select' ? (
                      <select className="input" {...f(field.key)}>
                        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input className="input" type={field.type || 'text'} {...f(field.key)} placeholder={field.placeholder} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear Condominio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Asignar Admins ── */}
      {modalAdmins && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalAdmins(null)}>
          <div className="modal" style={{ maxWidth:'460px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'22px', marginBottom:'4px' }}>Administradores</h2>
            <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'24px' }}>
              Condominio: <strong>{modalAdmins.nombre}</strong>
            </p>

            {/* Admins actuales */}
            {modalAdmins.admins?.length > 0 && (
              <div style={{ marginBottom:'24px' }}>
                <div style={{ fontSize:'11px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'10px', fontWeight:'600' }}>
                  Admins actuales
                </div>
                {modalAdmins.admins.map(a => (
                  <div key={a.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:'var(--surface2)', borderRadius:'8px', marginBottom:'6px' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', color:'#fff', flexShrink:0 }}>
                      {a.nombre?.[0]}{a.apellido?.[0]}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'13px', fontWeight:'600' }}>{a.nombre} {a.apellido}</div>
                      <div style={{ fontSize:'11px', color:'var(--text2)' }}>{a.email}</div>
                    </div>
                    <span className="badge badge-green">Activo</span>
                  </div>
                ))}
              </div>
            )}

            {/* Asignar nuevo */}
            <div style={{ marginBottom:'24px' }}>
              <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'8px' }}>
                Asignar nuevo administrador
              </label>
              <select className="input" value={adminSeleccionado} onChange={e => setAdminSeleccionado(e.target.value)}>
                <option value="">— Seleccionar usuario —</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} {u.apellido} · {u.email} ({u.rol})
                  </option>
                ))}
              </select>
              <p style={{ fontSize:'12px', color:'var(--text2)', marginTop:'6px' }}>
                Si el usuario no aparece, créalo primero en la sección Usuarios.
              </p>
            </div>

            <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModalAdmins(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={handleAsignarAdmin} disabled={savingAdmin || !adminSeleccionado}>
                {savingAdmin ? 'Asignando...' : 'Asignar Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}