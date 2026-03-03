import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';

const EMPTY = { nombre:'', apellido:'', email:'', password:'', rol:'residente', telefono:'' };

const rolColor = { superadmin:'badge-gold', admin:'badge-blue', residente:'badge-green' };
const rolLabel = { superadmin:'Super Admin', admin:'Administrador', residente:'Residente' };

export default function SAUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filtroRol, setFiltroRol] = useState('todos');
  const [search, setSearch] = useState('');

  const load = () => {
    api.get('/usuarios').then(r => setUsuarios(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCrear = () => { setForm(EMPTY); setEditando(null); setShowModal(true); };
  const openEditar = (u) => { setForm({ ...u, password:'' }); setEditando(u); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editando) {
        await api.put(`/usuarios/${editando.id}`, form);
        toast.success('Usuario actualizado');
      } else {
        await api.post('/usuarios', form);
        toast.success('Usuario creado');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const toggleActivo = async (u) => {
    try {
      await api.put(`/usuarios/${u.id}`, { ...u, activo: !u.activo });
      toast.success(u.activo ? 'Usuario desactivado' : 'Usuario activado');
      load();
    } catch { toast.error('Error'); }
  };

  const f = (k) => ({ value: form[k]||'', onChange: e => setForm(p => ({...p, [k]: e.target.value})) });

  const filtrados = usuarios.filter(u => {
    const matchRol = filtroRol === 'todos' || u.rol === filtroRol;
    const matchSearch = !search || `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    return matchRol && matchSearch;
  });

  return (
    <Layout>
      <div style={{ padding:'32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'32px' }}>
          <div>
            <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Usuarios</h1>
            <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>{usuarios.length} usuarios registrados</p>
          </div>
          <button className="btn btn-primary" onClick={openCrear}>+ Nuevo Usuario</button>
        </div>

        {/* Filtros */}
        <div style={{ display:'flex', gap:'12px', marginBottom:'20px', alignItems:'center' }}>
          <input
            className="input" placeholder="Buscar por nombre o email..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ maxWidth:'300px' }}
          />
          {['todos','superadmin','admin','residente'].map(r => (
            <button key={r} onClick={() => setFiltroRol(r)}
              style={{ padding:'6px 14px', borderRadius:'20px', border: filtroRol===r ? 'none' : '1px solid var(--border)', background: filtroRol===r ? 'var(--accent)' : 'transparent', color: filtroRol===r ? 'var(--bg)' : 'var(--text2)', fontWeight:'600', fontSize:'12px', cursor:'pointer', textTransform:'capitalize' }}>
              {r === 'todos' ? 'Todos' : rolLabel[r]}
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div className="card">
          {loading ? (
            <div style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>Cargando...</div>
          ) : filtrados.length === 0 ? (
            <div style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>👥</div>
              <p>No se encontraron usuarios</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Usuario</th><th>Email</th><th>Rol</th><th>Teléfono</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', color:'var(--bg)', flexShrink:0 }}>
                          {u.nombre?.[0]}{u.apellido?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight:'600', fontSize:'14px' }}>{u.nombre} {u.apellido}</div>
                          <div style={{ fontSize:'11px', color:'var(--text2)' }}>Desde {new Date(u.created_at).toLocaleDateString('es-DO')}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color:'var(--text2)', fontSize:'13px' }}>{u.email}</td>
                    <td><span className={`badge ${rolColor[u.rol]||'badge-gold'}`}>{rolLabel[u.rol]||u.rol}</span></td>
                    <td style={{ color:'var(--text2)', fontSize:'13px' }}>{u.telefono || '—'}</td>
                    <td><span className={`badge ${u.activo ? 'badge-green' : 'badge-red'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                      <div style={{ display:'flex', gap:'6px' }}>
                        <button className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:'12px' }} onClick={() => openEditar(u)}>✎ Editar</button>
                        <button
                          className={`btn ${u.activo ? 'btn-danger' : 'btn-ghost'}`}
                          style={{ padding:'5px 10px', fontSize:'12px' }}
                          onClick={() => toggleActivo(u)}
                        >{u.activo ? 'Desactivar' : 'Activar'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'24px' }}>
              {editando ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>
            <form onSubmit={handleSave}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                {[
                  { label:'Nombre', key:'nombre', required:true },
                  { label:'Apellido', key:'apellido', required:true },
                  { label:'Teléfono', key:'telefono' },
                  { label:'Rol', key:'rol', type:'select', options:[['residente','Residente'],['admin','Administrador'],['superadmin','Super Admin']] },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>{field.label}</label>
                    {field.type === 'select' ? (
                      <select className="input" {...f(field.key)}>
                        {field.options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    ) : (
                      <input className="input" required={field.required} {...f(field.key)} />
                    )}
                  </div>
                ))}
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Email *</label>
                  <input className="input" type="email" required {...f('email')} disabled={!!editando} style={{ opacity: editando ? 0.6 : 1 }} />
                </div>
                {!editando && (
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Contraseña *</label>
                    <input className="input" type="password" required {...f('password')} placeholder="Mínimo 8 caracteres" />
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
