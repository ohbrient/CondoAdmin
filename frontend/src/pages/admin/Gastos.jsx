import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';

const categorias = ['electricidad','agua','limpieza','reparacion','mantenimiento','nomina','seguros','otros'];
const catColor = { electricidad:'badge-yellow', agua:'badge-blue', limpieza:'badge-green', reparacion:'badge-red', mantenimiento:'badge-gold', nomina:'badge-blue', seguros:'badge-green', otros:'badge-gold' };
const EMPTY = { concepto:'', descripcion:'', categoria:'otros', monto:'', fecha: new Date().toISOString().split('T')[0], proveedor:'', factura_numero:'' };

export default function Gastos() {
  const [condoId, setCondoId] = useState(null);
  const [moneda, setMoneda] = useState('RD$');
  const [gastos, setGastos] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth()+1);
  const [filtroAño, setFiltroAño] = useState(new Date().getFullYear());
  const [filtroCateg, setFiltroCateg] = useState('');

  const load = (cid, mes, año, cat) => {
    const params = new URLSearchParams({ mes, año });
    if (cat) params.append('categoria', cat);
    Promise.all([
      api.get(`/condominios/${cid}/gastos?${params}`),
      api.get(`/condominios/${cid}/gastos/resumen?año=${año}`),
    ]).then(([g, r]) => { setGastos(g.data); setResumen(r.data); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get('/condominios').then(r => {
      const c = r.data[0]; if (!c) return;
      setCondoId(c.id); setMoneda(c.moneda||'RD$');
      load(c.id, filtroMes, filtroAño, filtroCateg);
    });
  }, []);

  useEffect(() => { if (condoId) load(condoId, filtroMes, filtroAño, filtroCateg); }, [filtroMes, filtroAño, filtroCateg]);

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editando) {
        await api.put(`/condominios/${condoId}/gastos/${editando.id}`, form);
        toast.success('Gasto actualizado');
      } else {
        await api.post(`/condominios/${condoId}/gastos`, form);
        toast.success('Gasto registrado');
      }
      setShowModal(false);
      load(condoId, filtroMes, filtroAño, filtroCateg);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      await api.delete(`/condominios/${condoId}/gastos/${id}`);
      toast.success('Gasto eliminado');
      load(condoId, filtroMes, filtroAño, filtroCateg);
    } catch { toast.error('Error al eliminar'); }
  };

  const f = k => ({ value: form[k]||'', onChange: e => setForm(p=>({...p,[k]:e.target.value})) });
  const fmt = n => new Intl.NumberFormat('es-DO').format(parseFloat(n)||0);
  const total = gastos.reduce((s,g) => s+parseFloat(g.monto||0), 0);
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  return (
    <Layout>
      <div style={{ padding:'32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'32px' }}>
          <div>
            <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Gastos</h1>
            <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>
              Total {meses[filtroMes-1]} {filtroAño}: <strong style={{ color:'var(--red)' }}>{moneda} {fmt(total)}</strong>
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setEditando(null); setShowModal(true); }}>+ Registrar Gasto</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:'24px' }}>
          {/* Columna principal */}
          <div>
            {/* Filtros */}
            <div style={{ display:'flex', gap:'12px', marginBottom:'20px', alignItems:'center', flexWrap:'wrap' }}>
              <select className="input" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={{ maxWidth:'140px' }}>
                {meses.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select className="input" value={filtroAño} onChange={e => setFiltroAño(e.target.value)} style={{ maxWidth:'100px' }}>
                {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className="input" value={filtroCateg} onChange={e => setFiltroCateg(e.target.value)} style={{ maxWidth:'160px' }}>
                <option value="">Todas las categorías</option>
                {categorias.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select>
            </div>

            <div className="card">
              {loading ? (
                <div style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>Cargando...</div>
              ) : gastos.length === 0 ? (
                <div style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>
                  <div style={{ fontSize:'40px', marginBottom:'12px' }}>📋</div>
                  <p>No hay gastos registrados en este período</p>
                </div>
              ) : (
                <table className="table">
                  <thead><tr><th>Concepto</th><th>Categoría</th><th>Proveedor</th><th>Fecha</th><th>Monto</th><th></th></tr></thead>
                  <tbody>
                    {gastos.map(g => (
                      <tr key={g.id}>
                        <td>
                          <div style={{ fontWeight:'600', fontSize:'14px' }}>{g.concepto}</div>
                          {g.factura_numero && <div style={{ fontSize:'11px', color:'var(--text2)' }}>Fact: {g.factura_numero}</div>}
                        </td>
                        <td><span className={`badge ${catColor[g.categoria]||'badge-gold'}`}>{g.categoria}</span></td>
                        <td style={{ fontSize:'13px', color:'var(--text2)' }}>{g.proveedor || '—'}</td>
                        <td style={{ fontSize:'13px', color:'var(--text2)' }}>{new Date(g.fecha).toLocaleDateString('es-DO')}</td>
                        <td style={{ color:'var(--red)', fontWeight:'700' }}>{moneda} {fmt(g.monto)}</td>
                        <td>
                          <div style={{ display:'flex', gap:'6px' }}>
                            <button className="btn btn-ghost" style={{ padding:'4px 8px', fontSize:'12px' }}
                              onClick={() => { setForm({...EMPTY,...g, fecha: g.fecha?.split('T')[0]}); setEditando(g); setShowModal(true); }}>✎</button>
                            <button className="btn btn-danger" style={{ padding:'4px 8px', fontSize:'12px' }}
                              onClick={() => handleDelete(g.id)}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Columna resumen */}
          <div>
            <div className="card" style={{ marginBottom:'16px' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', fontWeight:'600', fontSize:'14px' }}>Por categoría — {filtroAño}</div>
              <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:'12px' }}>
                {resumen.length === 0 ? (
                  <div style={{ color:'var(--text2)', fontSize:'13px' }}>Sin datos</div>
                ) : resumen.map(r => {
                  const totalAnual = resumen.reduce((s,x) => s+parseFloat(x.total||0),0);
                  const pct = totalAnual > 0 ? Math.round((r.total/totalAnual)*100) : 0;
                  return (
                    <div key={r.categoria}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                        <span style={{ fontSize:'12px' }}>{r.categoria}</span>
                        <span style={{ fontSize:'12px', fontWeight:'700' }}>{moneda} {fmt(r.total)}</span>
                      </div>
                      <div style={{ background:'var(--surface2)', borderRadius:'3px', height:'5px', overflow:'hidden' }}>
                        <div style={{ height:'100%', background:'var(--accent)', borderRadius:'3px', width:`${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'24px' }}>
              {editando ? 'Editar Gasto' : 'Registrar Gasto'}
            </h2>
            <form onSubmit={handleSave}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Concepto *</label>
                  <input className="input" required {...f('concepto')} placeholder="Descripción del gasto" />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Categoría</label>
                  <select className="input" {...f('categoria')}>
                    {categorias.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Monto *</label>
                  <input className="input" type="number" required {...f('monto')} placeholder="0.00" />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Fecha</label>
                  <input className="input" type="date" {...f('fecha')} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Proveedor</label>
                  <input className="input" {...f('proveedor')} placeholder="Nombre del proveedor" />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Nº Factura</label>
                  <input className="input" {...f('factura_numero')} placeholder="Opcional" />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Descripción</label>
                  <input className="input" {...f('descripcion')} placeholder="Detalles adicionales" />
                </div>
              </div>
              <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar Gasto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
