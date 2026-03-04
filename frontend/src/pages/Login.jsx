import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Bienvenido, ${user.nombre}!`);
      if (user.rol === 'superadmin') navigate('/superadmin');
      else if (user.rol === 'admin') navigate('/admin');
      else navigate('/portal');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Credenciales incorrectas');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ position:'fixed', top:'-200px', right:'-200px', width:'600px', height:'600px', borderRadius:'50%', background:'radial-gradient(circle, rgba(201,169,110,0.06) s0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ width:'100%', maxWidth:'420px' }}>
        <div style={{ textAlign:'center', marginBottom:'40px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'60px', height:'60px', borderRadius:'16px', background:'rgba(201,169,110,0.15)', border:'1px solid rgba(201,169,110,0.3)', marginBottom:'20px', fontSize:'28px' }}>🏢</div>
          <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'32px', color:'var(--accent)', margin:0 }}>CondoAdmin v2</h1>
          <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'6px' }}>Sistema de Administración de Condominios</p>
        </div>
        <div className="card" style={{ padding:'32px' }}>
          <h2 style={{ fontSize:'20px', fontWeight:'700', marginBottom:'4px' }}>Iniciar sesión</h2>
          <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'28px' }}>Ingresa tus credenciales para continuar</p>
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Correo electrónico</label>
              <input className="input" type="email" placeholder="usuario@condominio.com" value={form.email} onChange={e => setForm({...form, email:e.target.value})} required />
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Contraseña</label>
              <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({...form, password:e.target.value})} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width:'100%', justifyContent:'center', padding:'12px', marginTop:'8px', fontSize:'15px' }}>
              {loading ? 'Ingresando...' : 'Ingresar →'}
            </button>
          </form>
          <div style={{ marginTop:'20px', padding:'16px', background:'var(--surface2)', borderRadius:'8px', fontSize:'12px', color:'var(--text2)' }}>
            <strong style={{ color:'var(--text)' }}>Demo Super Admin:</strong><br />
            superadmin@condoadmin.com / Admin123!
          </div>
        </div>
        <p style={{ textAlign:'center', fontSize:'12px', color:'var(--text2)', marginTop:'24px' }}>CondoAdmin PRO © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
