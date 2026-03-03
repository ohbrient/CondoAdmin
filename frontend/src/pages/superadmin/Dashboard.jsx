import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function SuperAdminDashboard() {
  const [condos, setCondos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAdmins, setModalAdmins] = useState(null); // condominio seleccionado
  const [adminSeleccionado, setAdminSeleccionado] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => Promise.all([
    api.get('/condominios'),
    api.get('/usuarios'),
  ]).then(([c, u]) => {
    setCondos(c.data);
    setUsuarios(u.data.filter(u => u.rol === 'admin' || u.rol === 'superadmin'));
  }).catch(console.error).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleAsignarAdmin = async () => {
    if (!adminSeleccionado) return toast.error('Selecciona un administrador');
    setSaving(true);
    try {
      await api.post(`/condominios/${modalAdmins.id}/admins`, { usuario_id: adminSeleccionado });
      toast.success('Administrador asignado correctamente');
      setModalAdmins(null);
      setAdminSeleccionado('');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const totalUnidades = condos.reduce((s,c) => s + parseInt(c.total_unidades||0), 0);
  const totalOcupadas = condos.reduce((s,c) => s + parseInt(c.ocupadas||0), 0);

  return (
    <Layout>
      <div style={{ padding:'32px' }}>
        <div style={{ marginBottom:'32px' }}>
          <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Panel Super Admin</h1>
          <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>Gestión global de todos los condominios</p>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'32px' }}>
          {[
            { label:'Condominios', value: condos.length, color:'var(--blue)' },
            { label:'Admins activos', value: usuarios.filter(u=>u.activo).length, color:'var(--green)' },
            { label:'Total unidades', value: totalUnidades, color:'var(--accent)' },
            { label:'Unidades ocupadas', value: totalOcupadas, color:'var(--yellow)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding:'20px 24px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:s.color }} />
              <div style={{ fontSize:'11px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>{s.label}</div>
              <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'36px', color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Lista condominios */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'20px', margin:0 }}>Condominios Registrados</h2>
          <Link to="/superadmin/condominios">
            <button className="btn btn-primary">+ Nuevo Condominio</button>
          </Link>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>Cargando...</div>
          ) : condos.length === 0 ? (
            <div style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>🏢</div>
              <p>No hay condominios. Crea el primero.</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Condominio</th><th>Ciudad</th><th>Unidades</th><th>Ocupación</th><th>Administrador</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {condos.map(c => {
                  const pct = c.total_unidades > 0 ? Math.round((c.ocupadas/c.total_unidades)*100) : 0;
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight:'700', fontSize:'14px' }}>{c.nombre}</div>
                        <div style={{ fontSize:'11px', color:'var(--text2)' }}>{c.email || '—'}</div>
                      </td>
                      <td style={{ color:'var(--text2)', fontSize:'13px' }}>{c.ciudad || '—'}</td>
                      <td style={{ fontWeight:'600' }}>{c.total_unidades}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <div style={{ flex:1, background:'var(--surface2)', borderRadius:'3px', height:'6px', overflow:'hidden' }}>
                            <div style={{ height:'100%', background:'var(--accent)', borderRadius:'3px', width:`${pct}%` }} />
                          </div>
                          <span style={{ fontSize:'12px', color:'var(--text2)', minWidth:'30px' }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ fontSize:'13px', color:'var(--text2)' }}>
                        {c.admins?.length > 0
                          ? c.admins.map(a => `${a.nombre} ${a.apellido}`).join(', ')
                          : <span style={{ color:'var(--red)', fontStyle:'italic' }}>Sin admin</span>}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:'6px' }}>
                          <Link to="/superadmin/condominios">
                            <button className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:'12px' }}>Ver</button>
                          </Link>
                          <button className="btn btn-primary" style={{ padding:'5px 10px', fontSize:'12px' }}
                            onClick={() => { setModalAdmins(c); setAdminSeleccionado(''); }}>
                            👥 Asignar Admin
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal asignar admin */}
      {modalAdmins && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalAdmins(null)}>
          <div className="modal" style={{ maxWidth:'440px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'22px', marginBottom:'8px' }}>Asignar Administrador</h2>
            <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'24px' }}>Condominio: <strong>{modalAdmins.nombre}</strong></p>

            {modalAdmins.admins?.length > 0 && (
              <div style={{ marginBottom:'20px' }}>
                <div style={{ fontSize:'11px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>Admins actuales</div>
                {modalAdmins.admins.map(a => (
                  <div key={a.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 12px', background:'var(--surface2)', borderRadius:'6px', marginBottom:'6px' }}>
                    <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'700', color:'var(--bg)' }}>
                      {a.nombre?.[0]}{a.apellido?.[0]}
                    </div>
                    <span style={{ fontSize:'13px' }}>{a.nombre} {a.apellido}</span>
                    <span className="badge badge-green" style={{ marginLeft:'auto' }}>Activo</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom:'20px' }}>
              <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>
                Asignar nuevo administrador
              </label>
              <select className="input" value={adminSeleccionado} onChange={e => setAdminSeleccionado(e.target.value)}>
                <option value="">— Seleccionar usuario —</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre} {u.apellido} ({u.email})</option>
                ))}
              </select>
              <p style={{ fontSize:'12px', color:'var(--text2)', marginTop:'6px' }}>
                Si el usuario no aparece, créalo primero en <Link to="/superadmin/usuarios" style={{ color:'var(--accent)' }}>Usuarios</Link> con rol Administrador.
              </p>
            </div>

            <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModalAdmins(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAsignarAdmin} disabled={saving || !adminSeleccionado}>
                {saving ? 'Asignando...' : 'Asignar Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
