import { useState } from 'react';
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

        {/* Edit profile */}
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

        {/* Change password */}
        <div className="card" style={{ padding:'24px' }}>
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
      </div>
    </Layout>
  );
}
