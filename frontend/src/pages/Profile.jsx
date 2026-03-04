import { useState, useEffect, useRef } from 'react';
import Layout from '../components/layout/Layout';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ nombre: user?.nombre||'', apellido: user?.apellido||'', telefono: user?.telefono||'' });
  const [pwForm, setPwForm] = useState({ actual:'', nueva:'', confirmar:'' });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPw, setLoadingPw] = useState(false);

  // Sistema config (solo superadmin)
  const [sysConfig, setSysConfig] = useState({ nombre_sistema:'CondoAdmin', subtitulo:'PRO', logo_url:null });
  const [sysForm, setSysForm] = useState({ nombre_sistema:'CondoAdmin', subtitulo:'PRO' });
  const [loadingSys, setLoadingSys] = useState(false);
  const [loadingLogo, setLoadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const logoInputRef = useRef();

  const isSuperAdmin = user?.rol === 'superadmin';

  // Cargar config del sistema
  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get('/sistema/config').then(r => {
      setSysConfig(r.data);
      setSysForm({ nombre_sistema: r.data.nombre_sistema || 'CondoAdmin', subtitulo: r.data.subtitulo || 'PRO' });
      setLogoPreview(r.data.logo_url || null);
    }).catch(() => {});
  }, [isSuperAdmin]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setLoadingProfile(true);
    try {
      const { data } = await api.put('/auth/profile', form);
      updateUser(data);
      toast.success('Perfil actualizado');
    } catch { toast.error('Error al actualizar'); } finally { setLoadingProfile(false); }
  };

  const savePw = async (e) => {
    e.preventDefault();
    if (pwForm.nueva !== pwForm.confirmar) return toast.error('Las contraseñas no coinciden');
    setLoadingPw(true);
    try {
      await api.put('/auth/password', { actual: pwForm.actual, nueva: pwForm.nueva });
      toast.success('Contraseña actualizada');
      setPwForm({ actual:'', nueva:'', confirmar:'' });
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); } finally { setLoadingPw(false); }
  };

  const saveSysConfig = async (e) => {
    e.preventDefault();
    if (!sysForm.nombre_sistema.trim()) return toast.error('El nombre del sistema es requerido');
    setLoadingSys(true);
    try {
      const { data } = await api.put('/sistema/config', sysForm);
      setSysConfig(data);
      toast.success('Configuración del sistema actualizada');
    } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar'); }
    finally { setLoadingSys(false); }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Preview local inmediato
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
    // Subir al servidor
    setLoadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const { data } = await api.post('/sistema/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSysConfig(data);
      setLogoPreview(data.logo_url);
      toast.success('Logo actualizado correctamente');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al subir logo');
      setLogoPreview(sysConfig.logo_url);
    } finally { setLoadingLogo(false); }
  };

  const handleQuitarLogo = async () => {
    setLoadingLogo(true);
    try {
      await api.delete('/sistema/logo');
      setSysConfig(p => ({ ...p, logo_url: null }));
      setLogoPreview(null);
      toast.success('Logo eliminado');
    } catch { toast.error('Error al eliminar logo'); }
    finally { setLoadingLogo(false); }
  };

  return (
    <Layout>
      <div style={{ padding:'32px', maxWidth:'640px' }}>
        <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', marginBottom:'32px' }}>Mi Perfil</h1>

        {/* Avatar */}
        <div className="card" style={{ padding:'24px', marginBottom:'24px', display:'flex', alignItems:'center', gap:'20px' }}>
          <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'26px', fontWeight:'700', color:'var(--bg)', flexShrink:0 }}>
            {user?.nombre?.[0]}{user?.apellido?.[0]}
          </div>
          <div>
            <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'22px' }}>{user?.nombre} {user?.apellido}</div>
            <div style={{ color:'var(--text2)', fontSize:'14px' }}>{user?.email}</div>
            <span className={`badge ${user?.rol==='superadmin'?'badge-gold':user?.rol==='admin'?'badge-blue':'badge-green'}`} style={{ marginTop:'6px', display:'inline-block' }}>{user?.rol}</span>
          </div>
        </div>

        {/* Información personal */}
        <div className="card" style={{ padding:'24px', marginBottom:'24px' }}>
          <h3 style={{ fontSize:'16px', fontWeight:'700', marginBottom:'20px' }}>Información Personal</h3>
          <form onSubmit={saveProfile} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
            {[{ label:'Nombre', key:'nombre' }, { label:'Apellido', key:'apellido' }, { label:'Teléfono', key:'telefono', full:true }].map(f => (
              <div key={f.key} style={{ gridColumn: f.full ? '1/-1' : undefined }}>
                <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>{f.label}</label>
                <input className="input" value={form[f.key]} onChange={e => setForm({...form,[f.key]:e.target.value})} />
              </div>
            ))}
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Email</label>
              <input className="input" value={user?.email} disabled style={{ opacity:0.6 }} />
            </div>
            <div style={{ gridColumn:'1/-1', display:'flex', justifyContent:'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={loadingProfile}>
                {loadingProfile ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>

        {/* Cambiar contraseña */}
        <div className="card" style={{ padding:'24px', marginBottom:'24px' }}>
          <h3 style={{ fontSize:'16px', fontWeight:'700', marginBottom:'20px' }}>Cambiar Contraseña</h3>
          <form onSubmit={savePw} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            {[{ label:'Contraseña actual', key:'actual' }, { label:'Nueva contraseña', key:'nueva' }, { label:'Confirmar nueva contraseña', key:'confirmar' }].map(f => (
              <div key={f.key}>
                <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>{f.label}</label>
                <input className="input" type="password" value={pwForm[f.key]} onChange={e => setPwForm({...pwForm,[f.key]:e.target.value})} required />
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={loadingPw}>
                {loadingPw ? 'Actualizando...' : 'Cambiar contraseña'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Configuración del sistema (solo superadmin) ── */}
        {isSuperAdmin && (
          <div className="card" style={{ padding:'24px', marginBottom:'24px', border:'1px solid rgba(176,138,78,0.3)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'var(--accent)' }} />
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px' }}>
              <span style={{ fontSize:'20px' }}>⚙️</span>
              <div>
                <h3 style={{ fontSize:'16px', fontWeight:'700', margin:0 }}>Configuración del Sistema</h3>
                <p style={{ fontSize:'12px', color:'var(--text2)', margin:0, marginTop:'2px' }}>Personaliza el nombre y logo del sistema</p>
              </div>
              <span className="badge badge-gold" style={{ marginLeft:'auto' }}>Super Admin</span>
            </div>

            {/* Logo */}
            <div style={{ marginBottom:'24px' }}>
              <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'12px' }}>Logo del sistema</label>
              <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
                {/* Preview */}
                <div
                  onClick={() => !loadingLogo && logoInputRef.current?.click()}
                  style={{
                    width:'80px', height:'80px', borderRadius:'14px',
                    border:'2px dashed var(--border)', background:'var(--surface2)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    cursor:'pointer', overflow:'hidden', flexShrink:0,
                    transition:'border-color .2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {loadingLogo ? (
                    <span style={{ fontSize:'20px' }}>⏳</span>
                  ) : logoPreview ? (
                    <img src={logoPreview} alt="Logo" style={{ width:'100%', height:'100%', objectFit:'contain', padding:'6px' }} />
                  ) : (
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'24px' }}>🏢</div>
                      <div style={{ fontSize:'10px', color:'var(--text2)', marginTop:'2px' }}>Subir</div>
                    </div>
                  )}
                </div>

                <div style={{ flex:1 }}>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display:'none' }}
                    onChange={handleLogoChange}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={loadingLogo}
                    style={{ marginBottom:'8px', display:'block' }}
                  >
                    {loadingLogo ? 'Subiendo...' : logoPreview ? '🔄 Cambiar logo' : '📁 Subir logo'}
                  </button>
                  {logoPreview && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={handleQuitarLogo}
                      disabled={loadingLogo}
                      style={{ fontSize:'12px' }}
                    >
                      🗑 Quitar logo
                    </button>
                  )}
                  <p style={{ fontSize:'11px', color:'var(--text2)', marginTop:'8px', margin:'8px 0 0' }}>
                    PNG, JPG, SVG o WebP · Máximo 2MB
                  </p>
                </div>
              </div>
            </div>

            {/* Nombre y subtítulo */}
            <form onSubmit={saveSysConfig} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div>
                <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>
                  Nombre del sistema
                </label>
                <input
                  className="input"
                  value={sysForm.nombre_sistema}
                  onChange={e => setSysForm(p => ({ ...p, nombre_sistema: e.target.value }))}
                  placeholder="CondoAdmin"
                  required
                />
                <p style={{ fontSize:'11px', color:'var(--text2)', marginTop:'4px' }}>
                  Este nombre aparece en el sidebar y en el login.
                </p>
              </div>
              <div>
                <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>
                  Subtítulo / Tagline
                </label>
                <input
                  className="input"
                  value={sysForm.subtitulo}
                  onChange={e => setSysForm(p => ({ ...p, subtitulo: e.target.value }))}
                  placeholder="PRO"
                />
                <p style={{ fontSize:'11px', color:'var(--text2)', marginTop:'4px' }}>
                  Aparece debajo del nombre (ej: PRO, v2.0, Tu empresa).
                </p>
              </div>

              {/* Preview en vivo */}
              <div style={{ padding:'16px', background:'#1a1d2e', borderRadius:'10px', display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ fontSize:'11px', color:'#8b90a4', textTransform:'uppercase', letterSpacing:'1px', marginRight:'4px' }}>Preview:</div>
                {logoPreview && (
                  <img src={logoPreview} alt="logo" style={{ width:'28px', height:'28px', objectFit:'contain', borderRadius:'6px' }} />
                )}
                <div>
                  <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'18px', color:'#c9a96e' }}>
                    {sysForm.nombre_sistema || 'CondoAdmin'}
                  </div>
                  <div style={{ fontSize:'9px', color:'#8b90a4', textTransform:'uppercase', letterSpacing:'2px' }}>
                    {sysForm.subtitulo || 'PRO'}
                  </div>
                </div>
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={loadingSys}>
                  {loadingSys ? 'Guardando...' : '💾 Guardar configuración'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
}