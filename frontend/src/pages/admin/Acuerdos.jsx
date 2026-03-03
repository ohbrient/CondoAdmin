import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function Acuerdos() {
  const [condominio, setCondominio] = useState(null);
  const [acuerdos, setAcuerdos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalAbono, setModalAbono] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [acuerdoSelected, setAcuerdoSelected] = useState(null);
  const [abonos, setAbonos] = useState([]);
  const [deudaUnidad, setDeudaUnidad] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formNuevo, setFormNuevo] = useState({
    unidad_id: '', tipo: 'monto_fijo', monto_cuota_acuerdo: '', num_cuotas: '', notas: ''
  });
  const [formAbono, setFormAbono] = useState({
    monto: '', metodo_pago: 'efectivo', referencia: '', notas: '',
    fecha_pago: new Date().toISOString().split('T')[0]
  });

  const fmt = n => new Intl.NumberFormat('es-DO').format(parseFloat(n)||0);
  const moneda = condominio?.moneda || 'RD$';
  const pct = (abonado, total) => total > 0 ? Math.min(100, Math.round((abonado/total)*100)) : 0;

  const loadAll = async (c) => {
    const [a, u] = await Promise.all([
      api.get(`/condominios/${c.id}/acuerdos`),
      api.get(`/condominios/${c.id}/unidades`),
    ]);
    setAcuerdos(a.data);
    setUnidades(u.data.filter(u => u.estado === 'ocupado'));
  };

  useEffect(() => {
    api.get('/condominios').then(r => {
      const c = r.data[0]; if (!c) return;
      setCondominio(c);
      return loadAll(c);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleUnidadChange = async (unidad_id) => {
    setFormNuevo(f => ({ ...f, unidad_id }));
    if (!unidad_id) { setDeudaUnidad(null); return; }
    try {
      const { data } = await api.get(`/condominios/${condominio.id}/acuerdos/deuda/${unidad_id}`);
      setDeudaUnidad(data);
      setFormNuevo(f => ({ ...f, monto_cuota_acuerdo: '' }));
    } catch { toast.error('Error al cargar deuda'); }
  };

  const handleCrearAcuerdo = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post(`/condominios/${condominio.id}/acuerdos`, formNuevo);
      toast.success('Acuerdo de pago creado correctamente');
      setModalNuevo(false);
      setFormNuevo({ unidad_id:'', tipo:'monto_fijo', monto_cuota_acuerdo:'', num_cuotas:'', notas:'' });
      setDeudaUnidad(null);
      await loadAll(condominio);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleAbono = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const { data } = await api.post(`/condominios/${condominio.id}/acuerdos/${acuerdoSelected.id}/abono`, formAbono);
      toast.success(`Abono de ${moneda} ${fmt(formAbono.monto)} aplicado a ${data.cuotas_afectadas.length} cuota(s)`);
      setModalAbono(false);
      setFormAbono({ monto:'', metodo_pago:'efectivo', referencia:'', notas:'', fecha_pago: new Date().toISOString().split('T')[0] });
      await loadAll(condominio);
      // Refrescar detalle si está abierto
      if (modalDetalle) {
        const r = await api.get(`/condominios/${condominio.id}/acuerdos/${acuerdoSelected.id}/abonos`);
        setAbonos(r.data);
        const ac = await api.get(`/condominios/${condominio.id}/acuerdos`);
        const updated = ac.data.find(a => a.id === acuerdoSelected.id);
        if (updated) setAcuerdoSelected(updated);
      }
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const abrirDetalle = async (acuerdo) => {
    setAcuerdoSelected(acuerdo);
    const r = await api.get(`/condominios/${condominio.id}/acuerdos/${acuerdo.id}/abonos`);
    setAbonos(r.data);
    setModalDetalle(true);
  };

  const cancelarAcuerdo = async (acuerdo) => {
    if (!confirm(`¿Cancelar el acuerdo de la Unidad ${acuerdo.unidad_numero}?`)) return;
    try {
      await api.patch(`/condominios/${condominio.id}/acuerdos/${acuerdo.id}/cancelar`);
      toast.success('Acuerdo cancelado');
      await loadAll(condominio);
    } catch { toast.error('Error al cancelar'); }
  };

  // Calcular cuota sugerida para preview
  const cuotaSugerida = () => {
    if (!deudaUnidad) return 0;
    if (formNuevo.tipo === 'num_cuotas' && formNuevo.num_cuotas > 0)
      return deudaUnidad.total_deuda / formNuevo.num_cuotas;
    if (formNuevo.tipo === 'monto_fijo' && formNuevo.monto_cuota_acuerdo > 0)
      return formNuevo.monto_cuota_acuerdo;
    return 0;
  };
  const cuotasEstimadas = () => {
    if (!deudaUnidad || cuotaSugerida() <= 0) return 0;
    if (formNuevo.tipo === 'num_cuotas') return formNuevo.num_cuotas;
    return Math.ceil(deudaUnidad.total_deuda / cuotaSugerida());
  };

  const estadoColor = { activo:'badge-blue', completado:'badge-green', cancelado:'badge-red' };

  const activos = acuerdos.filter(a => a.estado === 'activo');
  const completados = acuerdos.filter(a => a.estado === 'completado');

  return (
    <Layout>
      <div style={{ padding:'32px' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'32px' }}>
          <div>
            <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Acuerdos de Pago</h1>
            <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>
              Gestiona abonos y planes de pago para residentes morosos
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setModalNuevo(true)}>+ Nuevo acuerdo</button>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'28px' }}>
          {[
            { label:'Acuerdos activos', value: activos.length, color:'var(--blue)' },
            { label:'Completados', value: completados.length, color:'var(--green)' },
            { label:'Deuda total activa', value: `${moneda} ${fmt(activos.reduce((s,a) => s + parseFloat(a.total_deuda||0) - parseFloat(a.total_abonado||0), 0))}`, color:'var(--red)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding:'16px 20px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:s.color }} />
              <div style={{ fontSize:'11px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>{s.label}</div>
              <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'26px', color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Lista de acuerdos */}
        <div className="card">
          {loading ? (
            <div style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>Cargando...</div>
          ) : acuerdos.length === 0 ? (
            <div style={{ padding:'64px', textAlign:'center', color:'var(--text2)' }}>
              <div style={{ fontSize:'48px', marginBottom:'12px' }}>🤝</div>
              <p style={{ marginBottom:'16px' }}>No hay acuerdos de pago registrados</p>
              <button className="btn btn-primary" onClick={() => setModalNuevo(true)}>Crear primer acuerdo</button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Unidad</th><th>Residente</th><th>Deuda total</th><th>Abonado</th><th>Saldo</th><th>Progreso</th><th>Plan</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {acuerdos.map(a => {
                  const totalAbonado = parseFloat(a.total_abonado||0);
                  const saldo = parseFloat(a.total_deuda) - totalAbonado;
                  const progreso = pct(totalAbonado, a.total_deuda);
                  const residente = a.residentes?.[0];
                  return (
                    <tr key={a.id}>
                      <td><strong>{a.unidad_numero}</strong> <span style={{ fontSize:'11px', color:'var(--text2)', textTransform:'capitalize' }}>{a.unidad_tipo}</span></td>
                      <td style={{ fontSize:'13px' }}>{residente ? `${residente.nombre} ${residente.apellido}` : '—'}</td>
                      <td style={{ fontWeight:'600' }}>{moneda} {fmt(a.total_deuda)}</td>
                      <td style={{ color:'var(--green)', fontWeight:'600' }}>{moneda} {fmt(totalAbonado)}</td>
                      <td style={{ color: saldo > 0 ? 'var(--red)' : 'var(--green)', fontWeight:'700' }}>{moneda} {fmt(saldo)}</td>
                      <td style={{ minWidth:'120px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <div style={{ flex:1, height:'6px', background:'var(--surface2)', borderRadius:'3px', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${progreso}%`, background: progreso === 100 ? 'var(--green)' : 'var(--accent)', borderRadius:'3px', transition:'width .3s' }} />
                          </div>
                          <span style={{ fontSize:'11px', color:'var(--text2)', whiteSpace:'nowrap' }}>{progreso}%</span>
                        </div>
                      </td>
                      <td style={{ fontSize:'12px', color:'var(--text2)' }}>
                        {a.tipo === 'num_cuotas' ? `${a.cuotas_pagadas||0}/${a.num_cuotas} cuotas` : `${moneda} ${fmt(a.monto_cuota_acuerdo)}/mes`}
                      </td>
                      <td><span className={`badge ${estadoColor[a.estado]||'badge-gold'}`}>{a.estado}</span></td>
                      <td>
                        <div style={{ display:'flex', gap:'6px' }}>
                          <button className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:'12px' }}
                            onClick={() => abrirDetalle(a)}>📋 Ver</button>
                          {a.estado === 'activo' && (
                            <button className="btn btn-primary" style={{ padding:'5px 10px', fontSize:'12px' }}
                              onClick={() => { setAcuerdoSelected(a); setFormAbono(f => ({...f, monto: a.monto_cuota_acuerdo})); setModalAbono(true); }}>
                              💰 Abonar
                            </button>
                          )}
                          {a.estado === 'activo' && (
                            <button className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:'12px', color:'var(--red)' }}
                              onClick={() => cancelarAcuerdo(a)}>✕</button>
                          )}
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

      {/* Modal nuevo acuerdo */}
      {modalNuevo && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalNuevo(false)}>
          <div className="modal" style={{ maxWidth:'520px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'8px' }}>Nuevo Acuerdo de Pago</h2>
            <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'24px' }}>Define el plan de pago para el residente moroso</p>
            <form onSubmit={handleCrearAcuerdo}>
              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

                {/* Seleccionar unidad */}
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Unidad *</label>
                  <select className="input" required value={formNuevo.unidad_id} onChange={e => handleUnidadChange(e.target.value)}>
                    <option value="">— Seleccionar unidad —</option>
                    {unidades.map(u => <option key={u.id} value={u.id}>Unidad {u.numero} ({u.tipo})</option>)}
                  </select>
                </div>

                {/* Deuda actual */}
                {deudaUnidad && (
                  <div style={{ background:'var(--surface2)', borderRadius:'10px', padding:'14px 18px' }}>
                    <div style={{ fontSize:'11px', fontWeight:'700', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>Deuda actual</div>
                    {deudaUnidad.cuotas.map(c => (
                      <div key={c.id} style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'4px' }}>
                        <span style={{ color:'var(--text2)' }}>{MESES[c.mes-1]} {c.anio}</span>
                        <span style={{ color:'var(--red)', fontWeight:'600' }}>{moneda} {fmt(c.saldo)}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', fontWeight:'700', borderTop:'1px solid var(--border)', paddingTop:'8px', marginTop:'8px' }}>
                      <span>Total deuda</span>
                      <span style={{ color:'var(--red)' }}>{moneda} {fmt(deudaUnidad.total_deuda)}</span>
                    </div>
                    {deudaUnidad.total_deuda <= 0 && (
                      <div style={{ marginTop:'8px', fontSize:'12px', color:'var(--green)' }}>✓ Esta unidad no tiene deudas pendientes</div>
                    )}
                  </div>
                )}

                {/* Tipo de plan */}
                {deudaUnidad && deudaUnidad.total_deuda > 0 && (
                  <>
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'8px' }}>Tipo de plan *</label>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                        {[
                          { val:'monto_fijo', label:'Monto fijo mensual', desc:'Defines cuánto paga cada mes' },
                          { val:'num_cuotas', label:'Número de cuotas', desc:'Defines en cuántos pagos salda' },
                        ].map(opt => (
                          <div key={opt.val}
                            onClick={() => setFormNuevo(f=>({...f, tipo:opt.val, monto_cuota_acuerdo:'', num_cuotas:''}))}
                            style={{ padding:'12px 14px', borderRadius:'10px', cursor:'pointer', border: formNuevo.tipo===opt.val ? '2px solid var(--accent)' : '2px solid var(--border)', background: formNuevo.tipo===opt.val ? 'rgba(176,138,78,.08)' : 'var(--surface)' }}>
                            <div style={{ fontWeight:'700', fontSize:'13px', marginBottom:'2px' }}>{opt.label}</div>
                            <div style={{ fontSize:'11px', color:'var(--text2)' }}>{opt.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {formNuevo.tipo === 'monto_fijo' && (
                      <div>
                        <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Monto mensual ({moneda}) *</label>
                        <input className="input" type="number" min="1" step="0.01" required
                          placeholder={`Mínimo recomendado: ${moneda} ${fmt(deudaUnidad.total_deuda / 12)}`}
                          value={formNuevo.monto_cuota_acuerdo}
                          onChange={e => setFormNuevo(f=>({...f,monto_cuota_acuerdo:e.target.value}))} />
                      </div>
                    )}

                    {formNuevo.tipo === 'num_cuotas' && (
                      <div>
                        <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Número de cuotas *</label>
                        <input className="input" type="number" min="2" max="60" required
                          placeholder="Ej: 3, 6, 12 meses"
                          value={formNuevo.num_cuotas}
                          onChange={e => setFormNuevo(f=>({...f,num_cuotas:e.target.value}))} />
                      </div>
                    )}

                    {/* Preview del plan */}
                    {cuotaSugerida() > 0 && (
                      <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'10px', padding:'14px 18px' }}>
                        <div style={{ fontSize:'11px', fontWeight:'700', color:'#16a34a', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Vista previa del plan</div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'4px' }}>
                          <span style={{ color:'var(--text2)' }}>Pago mensual</span>
                          <span style={{ fontWeight:'700', color:'var(--green)' }}>{moneda} {fmt(cuotaSugerida())}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'4px' }}>
                          <span style={{ color:'var(--text2)' }}>Duración estimada</span>
                          <span style={{ fontWeight:'600' }}>{cuotasEstimadas()} {cuotasEstimadas()===1?'pago':'pagos'}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px' }}>
                          <span style={{ color:'var(--text2)' }}>Deuda total</span>
                          <span style={{ fontWeight:'600' }}>{moneda} {fmt(deudaUnidad.total_deuda)}</span>
                        </div>
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Notas / Observaciones</label>
                      <textarea className="input" rows={2} style={{ resize:'vertical' }}
                        placeholder="Condiciones del acuerdo, fecha de inicio, etc."
                        value={formNuevo.notas} onChange={e => setFormNuevo(f=>({...f,notas:e.target.value}))} />
                    </div>
                  </>
                )}
              </div>

              <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setModalNuevo(false); setDeudaUnidad(null); }}>Cancelar</button>
                {deudaUnidad && deudaUnidad.total_deuda > 0 && (
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear acuerdo'}</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal registrar abono */}
      {modalAbono && acuerdoSelected && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalAbono(false)}>
          <div className="modal" style={{ maxWidth:'460px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'8px' }}>Registrar Abono</h2>
            <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'20px' }}>
              Unidad {acuerdoSelected.unidad_numero} · Saldo pendiente: <strong style={{ color:'var(--red)' }}>{moneda} {fmt(parseFloat(acuerdoSelected.total_deuda) - parseFloat(acuerdoSelected.total_abonado||0))}</strong>
            </p>

            <div style={{ background:'#dbeafe', borderRadius:'8px', padding:'10px 14px', marginBottom:'20px', fontSize:'12px', color:'#1d4ed8' }}>
              💡 El abono se distribuirá automáticamente comenzando por las cuotas más antiguas.
            </div>

            <form onSubmit={handleAbono}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Monto del abono ({moneda}) *</label>
                  <input className="input" type="number" min="1" step="0.01" required autoFocus
                    value={formAbono.monto} onChange={e => setFormAbono(f=>({...f,monto:e.target.value}))} />
                  {acuerdoSelected.monto_cuota_acuerdo && (
                    <div style={{ fontSize:'11px', color:'var(--text2)', marginTop:'4px' }}>
                      Cuota del acuerdo: {moneda} {fmt(acuerdoSelected.monto_cuota_acuerdo)}
                      <button type="button" style={{ marginLeft:'8px', color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'600' }}
                        onClick={() => setFormAbono(f=>({...f, monto:acuerdoSelected.monto_cuota_acuerdo}))}>
                        Usar este monto
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Método</label>
                  <select className="input" value={formAbono.metodo_pago} onChange={e => setFormAbono(f=>({...f,metodo_pago:e.target.value}))}>
                    {['efectivo','transferencia','tarjeta','cheque'].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Fecha de pago</label>
                  <input className="input" type="date" value={formAbono.fecha_pago} onChange={e => setFormAbono(f=>({...f,fecha_pago:e.target.value}))} />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Referencia</label>
                  <input className="input" placeholder="N° de transferencia, recibo, etc." value={formAbono.referencia} onChange={e => setFormAbono(f=>({...f,referencia:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalAbono(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Aplicando...' : 'Registrar abono'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal detalle del acuerdo */}
      {modalDetalle && acuerdoSelected && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalDetalle(false)}>
          <div className="modal" style={{ maxWidth:'560px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
              <div>
                <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'22px', margin:0 }}>
                  Acuerdo — Unidad {acuerdoSelected.unidad_numero}
                </h2>
                <p style={{ color:'var(--text2)', fontSize:'13px', marginTop:'4px' }}>
                  {acuerdoSelected.residentes?.[0] ? `${acuerdoSelected.residentes[0].nombre} ${acuerdoSelected.residentes[0].apellido}` : '—'}
                </p>
              </div>
              <span className={`badge ${estadoColor[acuerdoSelected.estado]||'badge-gold'}`}>{acuerdoSelected.estado}</span>
            </div>

            {/* Resumen */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'20px' }}>
              {[
                { label:'Deuda original', value:`${moneda} ${fmt(acuerdoSelected.total_deuda)}`, color:'var(--red)' },
                { label:'Total abonado', value:`${moneda} ${fmt(acuerdoSelected.total_abonado||0)}`, color:'var(--green)' },
                { label:'Saldo pendiente', value:`${moneda} ${fmt(parseFloat(acuerdoSelected.total_deuda)-parseFloat(acuerdoSelected.total_abonado||0))}`, color:'var(--accent)' },
              ].map(s => (
                <div key={s.label} style={{ background:'var(--surface2)', borderRadius:'8px', padding:'12px 14px' }}>
                  <div style={{ fontSize:'10px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>{s.label}</div>
                  <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'18px', color:s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Barra de progreso */}
            <div style={{ marginBottom:'20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'var(--text2)', marginBottom:'6px' }}>
                <span>Progreso del acuerdo</span>
                <span>{pct(acuerdoSelected.total_abonado||0, acuerdoSelected.total_deuda)}%</span>
              </div>
              <div style={{ height:'8px', background:'var(--surface2)', borderRadius:'4px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct(acuerdoSelected.total_abonado||0, acuerdoSelected.total_deuda)}%`, background:'var(--accent)', borderRadius:'4px', transition:'width .3s' }} />
              </div>
            </div>

            {/* Info del plan */}
            <div style={{ background:'var(--surface2)', borderRadius:'10px', padding:'12px 16px', marginBottom:'20px', fontSize:'13px' }}>
              <div style={{ display:'flex', gap:'24px' }}>
                <div>
                  <span style={{ color:'var(--text2)' }}>Tipo: </span>
                  <span style={{ fontWeight:'600' }}>{acuerdoSelected.tipo === 'num_cuotas' ? 'Por número de cuotas' : 'Monto fijo mensual'}</span>
                </div>
                <div>
                  <span style={{ color:'var(--text2)' }}>Pago acordado: </span>
                  <span style={{ fontWeight:'600' }}>{moneda} {fmt(acuerdoSelected.monto_cuota_acuerdo)}</span>
                </div>
                <div>
                  <span style={{ color:'var(--text2)' }}>Cuotas: </span>
                  <span style={{ fontWeight:'600' }}>{acuerdoSelected.cuotas_pagadas||0}/{acuerdoSelected.num_cuotas}</span>
                </div>
              </div>
              {acuerdoSelected.notas && <div style={{ marginTop:'8px', color:'var(--text2)' }}>📝 {acuerdoSelected.notas}</div>}
            </div>

            {/* Historial de abonos */}
            <div>
              <div style={{ fontWeight:'700', fontSize:'13px', marginBottom:'10px' }}>Historial de abonos</div>
              {abonos.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px', color:'var(--text2)', fontSize:'13px' }}>Sin abonos registrados aún</div>
              ) : (
                <table className="table">
                  <thead><tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Referencia</th></tr></thead>
                  <tbody>
                    {abonos.map(ab => (
                      <tr key={ab.id}>
                        <td style={{ fontSize:'13px' }}>{new Date(ab.fecha_pago).toLocaleDateString('es-DO')}</td>
                        <td style={{ fontWeight:'700', color:'var(--green)' }}>{moneda} {fmt(ab.monto)}</td>
                        <td style={{ fontSize:'13px', textTransform:'capitalize' }}>{ab.metodo_pago||'—'}</td>
                        <td style={{ fontSize:'12px', color:'var(--text2)' }}>{ab.referencia||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'20px' }}>
              {acuerdoSelected.estado === 'activo' && (
                <button className="btn btn-primary"
                  onClick={() => { setModalDetalle(false); setFormAbono(f=>({...f,monto:acuerdoSelected.monto_cuota_acuerdo})); setModalAbono(true); }}>
                  💰 Registrar abono
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setModalDetalle(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
