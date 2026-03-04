import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Outfit:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .cl-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #EEF0F4;
    font-family: 'Outfit', sans-serif;
    position: relative;
    overflow: hidden;
    padding: 24px;
  }

  /* Background diagonal stripes */
  .cl-root::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      repeating-linear-gradient(
        -55deg,
        transparent,
        transparent 60px,
        rgba(0,0,0,0.018) 60px,
        rgba(0,0,0,0.018) 61px
      );
    pointer-events: none;
  }

  /* Glow spots */
  .cl-glow {
    position: fixed;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(120px);
  }
  .cl-glow-1 {
    width: 600px; height: 600px;
    top: -200px; left: 50%;
    transform: translateX(-50%);
    background: radial-gradient(circle, rgba(180,140,80,0.12) 0%, transparent 70%);
    animation: breathe 7s ease-in-out infinite;
  }
  .cl-glow-2 {
    width: 400px; height: 400px;
    bottom: -150px; left: 10%;
    background: radial-gradient(circle, rgba(200,210,230,0.6) 0%, transparent 70%);
  }

  @keyframes breathe {
    0%, 100% { opacity: 0.6; transform: translateX(-50%) scale(1); }
    50%       { opacity: 1;   transform: translateX(-50%) scale(1.1); }
  }

  /* Card */
  .cl-card {
    width: 100%;
    max-width: 460px;
    background: #FFFFFF;
    border: 1px solid rgba(180,140,80,0.2);
    border-radius: 16px;
    overflow: hidden;
    position: relative;
    z-index: 2;
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.03),
      0 32px 80px rgba(0,0,0,0.1),
      0 8px 24px rgba(0,0,0,0.06);
    animation: cardIn 0.8s cubic-bezier(0.16,1,0.3,1) both;
  }

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(32px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Top accent bar */
  .cl-card-bar {
    height: 3px;
    background: linear-gradient(90deg, #B48C50 0%, #E8C97A 50%, #B48C50 100%);
    background-size: 200% 100%;
    animation: barShimmer 3s linear infinite;
  }
  @keyframes barShimmer {
    from { background-position: 0% center; }
    to   { background-position: 200% center; }
  }

  /* Card header */
  .cl-header {
    padding: 36px 40px 28px;
    text-align: center;
    border-bottom: 1px solid rgba(0,0,0,0.06);
    animation: fadeUp 0.6s ease 0.2s both;
  }
  .cl-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px; height: 56px;
    border-radius: 14px;
    background: linear-gradient(145deg, rgba(180,140,80,0.2), rgba(180,140,80,0.08));
    border: 1px solid rgba(180,140,80,0.3);
    font-size: 26px;
    margin-bottom: 20px;
  }
  .cl-title {
    font-family: 'Libre Baskerville', serif;
    font-size: 26px;
    font-weight: 700;
    color: #1A2332;
    letter-spacing: -0.3px;
    margin-bottom: 6px;
  }
  .cl-subtitle {
    font-size: 13px;
    font-weight: 300;
    color: #8A96A8;
    letter-spacing: 0.2px;
  }

  /* Form body */
  .cl-body {
    padding: 32px 40px 36px;
  }

  .cl-field {
    margin-bottom: 20px;
    animation: fadeUp 0.6s ease both;
  }
  .cl-field:nth-child(1) { animation-delay: 0.3s; }
  .cl-field:nth-child(2) { animation-delay: 0.4s; }

  .cl-label {
    display: block;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: #8A9AAE;
    margin-bottom: 8px;
  }

  .cl-input-wrap {
    position: relative;
  }
  .cl-input {
    width: 100%;
    padding: 13px 44px 13px 16px;
    background: #F5F7FA;
    border: 1px solid #DDE2EA;
    border-radius: 8px;
    color: #1A2332;
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
    font-weight: 400;
    outline: none;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  }
  .cl-input::placeholder { color: rgba(0,0,0,0.22); }
  .cl-input:focus {
    border-color: rgba(180,140,80,0.7);
    background: #FFFFFF;
    box-shadow: 0 0 0 3px rgba(180,140,80,0.12);
  }
  .cl-input:hover:not(:focus) {
    border-color: #C4A36B;
  }
  .cl-pass-btn {
    position: absolute;
    right: 14px; top: 50%;
    transform: translateY(-50%);
    background: none; border: none;
    cursor: pointer;
    font-size: 15px;
    opacity: 0.35;
    transition: opacity 0.2s;
    padding: 0;
    color: #1A2332;
  }
  .cl-pass-btn:hover { opacity: 0.7; }

  /* Row */
  .cl-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
    animation: fadeUp 0.6s ease 0.5s both;
  }
  .cl-remember {
    display: flex; align-items: center; gap: 8px; cursor: pointer;
  }
  .cl-remember input { accent-color: #B48C50; cursor: pointer; }
  .cl-remember span { font-size: 12px; color: #7A8898; }
  .cl-forgot {
    font-size: 12px; font-weight: 500;
    color: #B48C50; background: none; border: none;
    cursor: pointer; font-family: 'Outfit', sans-serif;
    padding: 0; opacity: 0.8;
    transition: opacity 0.2s;
  }
  .cl-forgot:hover { opacity: 1; }

  /* Submit */
  .cl-submit {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #1A2332, #2C3E55, #1A2332);
    background-size: 200% 100%;
    border: none;
    border-radius: 8px;
    color: #FFFFFF;
    font-family: 'Outfit', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: background-position 0.4s, transform 0.15s, box-shadow 0.25s, opacity 0.2s;
    animation: fadeUp 0.6s ease 0.55s both;
  }
  .cl-submit:hover:not(:disabled) {
    background-position: right center;
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(180,140,80,0.3);
  }
  .cl-submit:active:not(:disabled) { transform: translateY(0); }
  .cl-submit:disabled { opacity: 0.4; cursor: not-allowed; }

  .cl-loading-track {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: rgba(15,25,35,0.3);
  }
  .cl-loading-fill {
    height: 100%;
    background: rgba(15,25,35,0.5);
    animation: loadFill 1.2s ease-in-out infinite;
  }
  @keyframes loadFill {
    0%   { width: 0%; margin-left: 0; }
    60%  { width: 70%; margin-left: 0; }
    100% { width: 0%; margin-left: 100%; }
  }

  /* Card footer */
  .cl-card-footer {
    padding: 16px 40px;
    background: #F5F7FA;
    border-top: 1px solid rgba(0,0,0,0.06);
    display: flex;
    align-items: center;
    justify-content: space-between;
    animation: fadeUp 0.6s ease 0.65s both;
  }
  .cl-security {
    display: flex; align-items: center; gap: 7px;
    font-size: 11px; color: #9AAABB; font-weight: 400;
  }
  .cl-security-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #2ECC71;
    box-shadow: 0 0 6px rgba(46,204,113,0.5);
  }
  .cl-version {
    font-size: 11px;
    color: #9AAABB;
  }

  /* Below card */
  .cl-below {
    margin-top: 24px;
    text-align: center;
    font-size: 11px;
    color: #AABBC8;
    animation: fadeUp 0.6s ease 0.75s both;
    position: relative;
    z-index: 2;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="cl-root">
        <div className="cl-glow cl-glow-1" />
        <div className="cl-glow cl-glow-2" />

        <div style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 2 }}>
          <div className="cl-card">
            <div className="cl-card-bar" />

            {/* Header */}
            <div className="cl-header">
              <div className="cl-logo">🏢</div>
              <div className="cl-title">CondoAdmin PRO</div>
              <div className="cl-subtitle">Sistema de Administración de Condominios</div>
            </div>

            {/* Form */}
            <div className="cl-body">
              <div className="cl-field">
                <label className="cl-label">Correo electrónico</label>
                <div className="cl-input-wrap">
                  <input
                    className="cl-input"
                    type="email"
                    placeholder="usuario@condominio.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="cl-field">
                <label className="cl-label">Contraseña</label>
                <div className="cl-input-wrap">
                  <input
                    className="cl-input"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <button className="cl-pass-btn" type="button" onClick={() => setShowPass(v => !v)}>
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <div className="cl-row">
                <label className="cl-remember">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                  <span>Recordar sesión</span>
                </label>
                <button type="button" className="cl-forgot">¿Olvidaste tu contraseña?</button>
              </div>

              <button className="cl-submit" disabled={loading} onClick={handleSubmit}>
                {loading && (
                  <div className="cl-loading-track">
                    <div className="cl-loading-fill" />
                  </div>
                )}
                {loading ? 'Verificando...' : 'Ingresar al sistema'}
              </button>
            </div>

            {/* Footer */}
            <div className="cl-card-footer">
              <div className="cl-security">
                <div className="cl-security-dot" />
                Conexión segura SSL
              </div>
              <div className="cl-version">v2.0</div>
            </div>
          </div>

          <div className="cl-below">
            © {new Date().getFullYear()} CondoAdmin PRO — Todos los derechos reservados
          </div>
        </div>
      </div>
    </>
  );
}