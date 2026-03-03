import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { generarRecibo } from '../../utils/recibo';

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function Cuotas() {
  const [condominio, setCondominio] = useState(null);
  const [periodos, setPeriodos] = useState([]);
  const [periodoActivo, setPeriodoActivo] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [morosos, setMorosos] = useState([]);
  const [tab, setTab] = useState('pagos');
  const [loading, setLoading] = useState(true);
  const [modalPeriodo, setModalPeriodo] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalPago, setModalPago] = useState(false);
  const [modalComprobante, setModalComprobante] = useState(false);
  const [pagoSelected, setPagoSelected] = useState(null);
  const [gasInput, setGasInput] = useState('');
  const [comprobanteFile, setComprobanteFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef();
  const now = new Date();

  const [formPeriodo, setFormPeriodo] = useState({
    año: now.getFullYear(), mes: now.getMonth()+1,
    cuota_monto:'', fecha_limite:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-05`,
  });
  const [formPago, setFormPago] = useState({
    monto_pagado:'', monto_gas_comun:'', metodo_pago:'efectivo', referencia:'', notas:'', fecha_pago: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    api.get('/condominios').then(r => {
      const c = r.data[0]; if (!c) return;
      setCondominio(c);
      setFormPeriodo(p => ({ ...p, cuota_monto: c.cuota_base||'' }));
      return Promise.all([
        api.get(`/condominios/${c.id}/cuotas`),
        api.get(`/condominios/${c.id}/cuotas/morosos`),
      ]);
    }).then(([p, m]) => {
      if (!p) return;
      setPeriodos(p.data); setMorosos(m.data);
      if (p.data.length > 0) {
        setPeriodoActivo(p.data[0]);
        return api.get(`/condominios/${p.data[0].condominio_id}/cuotas/${p.data[0].id}/pagos`);
      }
    }).then(r => r && setPagos(r.data))
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const loadPagos = (periodo) => {
    setPeriodoActivo(periodo);
    api.get(`/condominios/${condominio.id}/cuotas/${periodo.id}/pagos`).then(r => setPagos(r.data));
  };

  const handleCrearPeriodo = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const { data } = await api.post(`/condominios/${condominio.id}/cuotas/periodo`, formPeriodo);
      const gasMsg = data.gas_por_unidad > 0 ? ` · Gas: ${condominio.moneda} ${fmt(data.gas_por_unidad)}/unidad` : '';
      toast.success(`Período creado — ${data.cobros_generados} cobros generados${gasMsg}`);
      setModalPeriodo(false);
      const r = await api.get(`/condominios/${condominio.id}/cuotas`);
      setPeriodos(r.data); loadPagos(r.data[0]);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleRegistrarPago = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put(`/condominios/${condominio.id}/cuotas/pagos/${pagoSelected.id}`, formPago);
      // Si hay comprobante adjunto, subirlo después del pago
      if (comprobanteFile) {
        const fd = new FormData();
        fd.append('comprobante', comprobanteFile);
        await api.post(`/condominios/${condominio.id}/cuotas/pagos/${pagoSelected.id}/comprobante-admin`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      toast.success('Pago registrado correctamente' + (comprobanteFile ? ' con comprobante' : ''));
      setModalPago(false);
      setComprobanteFile(null);
      loadPagos(periodoActivo);
      const m = await api.get(`/condominios/${condominio.id}/cuotas/morosos`);
      setMorosos(m.data);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleSubirComprobante = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5*1024*1024) return toast.error('El archivo no puede superar 5MB');
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('comprobante', file);
      await api.post(`/condominios/${condominio.id}/cuotas/pagos/${pagoSelected.id}/comprobante`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Comprobante subido correctamente');
      setModalComprobante(false); loadPagos(periodoActivo);
    } catch (err) { toast.error(err.response?.data?.error || 'Error al subir'); }
    finally { setUploadingFile(false); }
  };

  const eliminarFactura = async (pago) => {
    const confirmMsg = `¿Eliminar la factura de la Unidad ${pago.unidad_numero}?\n\nEsto borrará el cobro permanentemente. No se puede deshacer.`;
    if (!confirm(confirmMsg)) return;
    try {
      await api.delete(`/condominios/${condominio.id}/cuotas/pagos/${pago.id}`);
      toast.success('Factura eliminada');
      loadPagos(periodoActivo);
      const m = await api.get(`/condominios/${condominio.id}/cuotas/morosos`);
      setMorosos(m.data);
    } catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar'); }
  };

  const reversarPago = async (pago) => {
    const confirmMsg = `¿Reversar el pago de la Unidad ${pago.unidad_numero}?\n\nEsto eliminará el registro de pago y volverá el estado a "pendiente". El gas consumido se conserva.`;
    if (!confirm(confirmMsg)) return;
    try {
      await api.patch(`/condominios/${condominio.id}/cuotas/pagos/${pago.id}/reversar`);
      toast.success('Pago reversado — estado vuelve a pendiente');
      loadPagos(periodoActivo);
      const m = await api.get(`/condominios/${condominio.id}/cuotas/morosos`);
      setMorosos(m.data);
    } catch (err) { toast.error(err.response?.data?.error || 'Error al reversar'); }
  };

  const abrirEditar = (pago) => {
    setPagoSelected(pago);
    setGasInput(parseFloat(pago.monto_gas_comun||0) > 0 ? pago.monto_gas_comun : '');
    setModalEditar(true);
  };

  const handleGuardarGas = async () => {
    setSaving(true);
    try {
      await api.patch(`/condominios/${condominio.id}/cuotas/pagos/${pagoSelected.id}/gas`, {
        monto_gas_comun: gasInput || 0
      });
      toast.success('Factura actualizada — el residente verá los nuevos montos');
      setModalEditar(false);
      loadPagos(periodoActivo);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const abrirPago = (pago) => {
    setPagoSelected(pago);
    const gasExistente = parseFloat(pago.monto_gas_comun||0);
    const total = parseFloat(pago.monto_cuota||0) + gasExistente;
    setFormPago({ monto_pagado: total, monto_gas_comun: gasExistente || '', metodo_pago:'efectivo', referencia:'', notas:'', fecha_pago: new Date().toISOString().split('T')[0] });
    setModalPago(true);
  };

  const aprobarComprobante = async (pago) => {
    try {
      await api.put(`/condominios/${condominio.id}/cuotas/pagos/${pago.id}`, {
        monto_pagado: parseFloat(pago.monto_cuota||0) + parseFloat(pago.monto_gas_comun||0),
        monto_gas_comun: pago.monto_gas_comun || 0,
        metodo_pago: 'transferencia',
        referencia: pago.referencia || '',
        notas: 'Comprobante verificado por administrador',
        fecha_pago: new Date().toISOString().split('T')[0],
      });
      toast.success('Pago aprobado correctamente');
      loadPagos(periodoActivo);
    } catch { toast.error('Error al aprobar'); }
  };

  const verRecibo = (pago) => {
    const pagoConPeriodo = { ...pago, mes: periodoActivo?.mes, anio: periodoActivo?.anio, fecha_limite: periodoActivo?.fecha_limite };
    generarRecibo(pagoConPeriodo, condominio);
  };

  const fmt = n => new Intl.NumberFormat('es-DO').format(parseFloat(n)||0);
  const moneda = condominio?.moneda || 'RD$';
  const usaGas = condominio?.usa_gas_comun;
  const estadoColor = { pagado:'badge-green', pendiente:'badge-red', parcial:'badge-yellow', en_revision:'badge-blue' };

  const cobrado = pagos.filter(p=>p.estado==='pagado').reduce((s,p)=>s+parseFloat(p.monto_pagado||0),0);
  const pendienteTotal = pagos.filter(p=>p.estado!=='pagado').reduce((s,p)=>s+(parseFloat(p.monto_cuota||0)+parseFloat(p.monto_gas_comun||0)-parseFloat(p.monto_pagado||0)),0);
  const pct = pagos.length ? Math.round((pagos.filter(p=>p.estado==='pagado').length/pagos.length)*100) : 0;
  const pagosFiltrados = pagos.filter(p => tab==='pagos' ? true : tab==='morosos' ? p.estado!=='pagado' : p.estado==='pagado');

  return (
    <Layout>
      <div style={{ padding:'32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'32px' }}>
          <div>
            <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Cuotas de Mantenimiento</h1>
            <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>
              Cuota base: {moneda} {fmt(condominio?.cuota_base)}
              {usaGas && <span style={{ marginLeft:'8px', color:'var(--accent)' }}>· Gas común activo 🔥</span>}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setModalPeriodo(true)}>+ Nuevo Período</button>
        </div>

        {/* Selector de período */}
        {periodos.length > 0 && (
          <div style={{ display:'flex', gap:'8px', marginBottom:'24px', flexWrap:'wrap' }}>
            {periodos.map(p => (
              <button key={p.id} onClick={() => loadPagos(p)} style={{
                padding:'8px 16px', borderRadius:'20px', cursor:'pointer', fontWeight:'600', fontSize:'13px',
                border: periodoActivo?.id===p.id ? 'none' : '1px solid var(--border)',
                background: periodoActivo?.id===p.id ? 'var(--accent)' : 'var(--surface)',
                color: periodoActivo?.id===p.id ? '#fff' : 'var(--text2)',
                boxShadow: periodoActivo?.id===p.id ? '0 2px 8px rgba(176,138,78,.3)' : 'none',
              }}>
                {meses[p.mes-1]} {p.anio}
                {parseFloat(p.cargo_gas_comun||0) > 0 && <span style={{ marginLeft:'4px' }}>🔥</span>}
              </button>
            ))}
          </div>
        )}

        {/* Stats */}
        {periodoActivo && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'24px' }}>
            {[
              { label:'Cobrado', value:`${moneda} ${fmt(cobrado)}`, color:'var(--green)' },
              { label:'Pendiente', value:`${moneda} ${fmt(pendienteTotal)}`, color:'var(--red)' },
              { label:'Recaudación', value:`${pct}%`, color:'var(--accent)' },
              { label:'Morosos', value:morosos.length, color:'var(--yellow)' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding:'16px 20px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:s.color }} />
                <div style={{ fontSize:'11px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>{s.label}</div>
                <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'26px', color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Gas comun del periodo */}
        {periodoActivo && parseFloat(periodoActivo.cargo_gas_comun||0) > 0 && (
          <div style={{ background:'#fef3c7', border:'1px solid #f59e0b', borderRadius:'10px', padding:'12px 18px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'12px' }}>
            <span style={{ fontSize:'20px' }}>🔥</span>
            <div>
              <span style={{ fontWeight:'700', color:'#92400e' }}>Gas Común — {meses[periodoActivo.mes-1]} {periodoActivo.anio}</span>
              <span style={{ color:'#92400e', fontSize:'13px', marginLeft:'12px' }}>
                Total: {moneda} {fmt(periodoActivo.cargo_gas_comun)} · Por unidad: {moneda} {fmt(parseFloat(periodoActivo.cargo_gas_comun) / (pagos.length||1))}
              </span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
          {[['pagos','Todos'],['morosos','Morosos'],['pagados','Pagados']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding:'7px 16px', borderRadius:'20px', cursor:'pointer', fontWeight:'600', fontSize:'13px',
              border: tab===k ? 'none' : '1px solid var(--border)',
              background: tab===k ? 'var(--accent)' : 'var(--surface)',
              color: tab===k ? '#fff' : 'var(--text2)',
            }}>{l}</button>
          ))}
        </div>

        {/* Tabla */}
        <div className="card">
          {loading ? (
            <div style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>Cargando...</div>
          ) : pagos.length === 0 ? (
            <div style={{ padding:'64px', textAlign:'center', color:'var(--text2)' }}>
              <div style={{ fontSize:'48px', marginBottom:'12px' }}>💰</div>
              <p>No hay períodos creados aún.</p>
              <button className="btn btn-primary" style={{ marginTop:'16px' }} onClick={() => setModalPeriodo(true)}>Crear primer período</button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Unidad</th><th>Residente</th><th>Mantenimiento</th>
                  {pagosFiltrados.some(p=>parseFloat(p.monto_gas_comun||0)>0) && <th>Gas Común 🔥</th>}
                  <th>Total</th><th>Pagado</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagosFiltrados.map(p => {
                  const totalCobro = parseFloat(p.monto_cuota||0) + parseFloat(p.monto_gas_comun||0);
                  const hayGas = pagosFiltrados.some(x => parseFloat(x.monto_gas_comun||0) > 0);
                  return (
                    <tr key={p.id}>
                      <td><strong>{p.unidad_numero}</strong> <span style={{ fontSize:'11px', color:'var(--text2)', textTransform:'capitalize' }}>{p.unidad_tipo}</span></td>
                      <td style={{ fontSize:'13px' }}>
                        {p.residentes?.[0] ? `${p.residentes[0].nombre} ${p.residentes[0].apellido}` : <span style={{ color:'var(--text2)' }}>Sin asignar</span>}
                      </td>
                      <td>{moneda} {fmt(p.monto_cuota)}</td>
                      {hayGas && (
                        <td style={{ color: parseFloat(p.monto_gas_comun||0) > 0 ? 'var(--yellow)' : 'var(--text2)' }}>
                          {parseFloat(p.monto_gas_comun||0) > 0 ? `${moneda} ${fmt(p.monto_gas_comun)}` : '—'}
                        </td>
                      )}
                      <td style={{ fontWeight:'700' }}>{moneda} {fmt(totalCobro)}</td>
                      <td style={{ color: p.estado==='pagado' ? 'var(--green)' : 'var(--red)', fontWeight:'600' }}>
                        {moneda} {fmt(p.monto_pagado||0)}
                      </td>
                      <td><span className={`badge ${estadoColor[p.estado]||'badge-gold'}`}>{p.estado.replace('_',' ')}</span></td>
                      <td>
                        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                          {/* Editar factura — siempre disponible si no está pagado */}
                          {p.estado !== 'pagado' && (
                            <button className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:'12px' }}
                              onClick={() => abrirEditar(p)}>
                              ✏ Editar factura
                            </button>
                          )}
                          {/* Registrar pago — solo si ya tiene gas cargado o no usa gas */}
                          {p.estado !== 'pagado' && (
                            <button className="btn btn-primary" style={{ padding:'5px 10px', fontSize:'12px' }}
                              onClick={() => abrirPago(p)}>
                              💰 Registrar pago
                            </button>
                          )}
                          {/* Comprobante enviado por residente */}
                          {p.comprobante_url && (
                            <a href={`http://localhost:4000${p.comprobante_url}`} target="_blank" rel="noreferrer">
                              <button className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:'12px', color:'var(--blue)' }}>
                                🖼 Ver comprobante
                              </button>
                            </a>
                          )}
                          {/* Aprobar comprobante en revisión */}
                          {p.estado === 'en_revision' && (
                            <button className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:'12px', color:'var(--green)', border:'1px solid var(--green)' }}
                              onClick={() => aprobarComprobante(p)}>
                              ✓ Aprobar
                            </button>
                          )}
                          {p.estado === 'pagado' && (
                            <button className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:'12px' }} onClick={() => verRecibo(p)}>🧾 PDF</button>
                          )}
                          {p.estado === 'pagado' && (
                            <button className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:'12px', color:'var(--red)', border:'1px solid rgba(220,38,38,.3)' }}
                              onClick={() => reversarPago(p)}>
                              ↩ Reversar
                            </button>
                          )}
                          {/* Eliminar factura — cualquier estado */}
                          <button className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:'12px', color:'var(--red)' }}
                            onClick={() => eliminarFactura(p)}>
                            🗑
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

      {/* Modal nuevo período */}
      {modalPeriodo && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalPeriodo(false)}>
          <div className="modal">
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'8px' }}>Nuevo Período de Cuota</h2>
            <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'24px' }}>Se generarán cobros para todas las unidades ocupadas</p>
            <form onSubmit={handleCrearPeriodo}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Año</label>
                  <input className="input" type="number" value={formPeriodo.año} onChange={e => setFormPeriodo(p=>({...p,año:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Mes</label>
                  <select className="input" value={formPeriodo.mes} onChange={e => setFormPeriodo(p=>({...p,mes:e.target.value}))}>
                    {meses.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Cuota de mantenimiento *</label>
                  <input className="input" type="number" required value={formPeriodo.cuota_monto} onChange={e => setFormPeriodo(p=>({...p,cuota_monto:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Fecha límite de pago</label>
                  <input className="input" type="date" value={formPeriodo.fecha_limite} onChange={e => setFormPeriodo(p=>({...p,fecha_limite:e.target.value}))} required />
                </div>
              </div>
              <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalPeriodo(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear Período'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar factura (gas) */}
      {modalEditar && pagoSelected && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalEditar(false)}>
          <div className="modal" style={{ maxWidth:'460px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'8px' }}>Editar Factura</h2>
            <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'24px' }}>
              Unidad {pagoSelected.unidad_numero} · {meses[(periodoActivo?.mes||1)-1]} {periodoActivo?.anio}
            </p>

            {/* Vista previa de la factura */}
            <div style={{ background:'var(--surface2)', borderRadius:'12px', padding:'16px 20px', marginBottom:'20px' }}>
              <div style={{ fontSize:'11px', fontWeight:'700', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'12px' }}>
                Vista previa de lo que verá el residente
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'6px' }}>
                <span style={{ color:'var(--text2)' }}>Cuota de mantenimiento</span>
                <span style={{ fontWeight:'600' }}>{moneda} {fmt(pagoSelected.monto_cuota)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'6px' }}>
                <span style={{ color:'var(--yellow)' }}>🔥 Gas consumido</span>
                <span style={{ fontWeight:'600', color:'var(--yellow)' }}>{moneda} {fmt(gasInput || 0)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'15px', fontWeight:'700', borderTop:'1px solid var(--border)', paddingTop:'10px', marginTop:'4px' }}>
                <span>Total a pagar</span>
                <span style={{ color:'var(--accent)' }}>{moneda} {fmt(parseFloat(pagoSelected.monto_cuota||0) + parseFloat(gasInput||0))}</span>
              </div>
            </div>

            <div style={{ marginBottom:'20px' }}>
              <label style={{ fontSize:'11px', fontWeight:'600', color:'#d97706', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>
                🔥 Gas consumido este mes ({moneda})
              </label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                autoFocus
                placeholder="0.00 — dejar en 0 si no aplica"
                value={gasInput}
                onChange={e => setGasInput(e.target.value)}
              />
              <div style={{ fontSize:'12px', color:'var(--text2)', marginTop:'6px' }}>
                Ingresa el consumo según el medidor de esta unidad. El total se actualiza en tiempo real arriba.
              </div>
            </div>

            <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModalEditar(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardarGas} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar y notificar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal registrar pago */}
      {modalPago && pagoSelected && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalPago(false)}>
          <div className="modal">
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'8px' }}>Registrar Pago</h2>
            <div style={{ background:'var(--surface2)', borderRadius:'10px', padding:'14px 18px', marginBottom:'20px' }}>
              <div style={{ fontSize:'13px', fontWeight:'700', marginBottom:'8px' }}>Unidad {pagoSelected.unidad_numero}</div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'4px' }}>
                <span style={{ color:'var(--text2)' }}>Cuota de mantenimiento</span>
                <span style={{ fontWeight:'600' }}>{moneda} {fmt(pagoSelected.monto_cuota)}</span>
              </div>
              {parseFloat(formPago.monto_gas_comun||0) > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'4px' }}>
                  <span style={{ color:'var(--text2)' }}>Gas consumido 🔥</span>
                  <span style={{ color:'var(--yellow)', fontWeight:'600' }}>{moneda} {fmt(formPago.monto_gas_comun)}</span>
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', fontWeight:'700', borderTop:'1px solid var(--border)', paddingTop:'8px', marginTop:'8px' }}>
                <span>Total a cobrar</span>
                <span style={{ color:'var(--accent)' }}>{moneda} {fmt(parseFloat(pagoSelected.monto_cuota||0) + parseFloat(formPago.monto_gas_comun||0))}</span>
              </div>
            </div>
            <form onSubmit={handleRegistrarPago}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'#d97706', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>🔥 Gas consumido este mes ({moneda}) — Opcional</label>
                  <input className="input" type="number" min="0" step="0.01"
                    placeholder="Ingresa el consumo de gas de esta unidad"
                    value={formPago.monto_gas_comun}
                    onChange={e => {
                      const gas = parseFloat(e.target.value)||0;
                      setFormPago(p=>({...p, monto_gas_comun:e.target.value, monto_pagado: parseFloat(pagoSelected.monto_cuota||0) + gas }));
                    }} />
                  <div style={{ fontSize:'11px', color:'var(--text2)', marginTop:'4px' }}>El total se actualiza automáticamente</div>
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Monto recibido *</label>
                  <input className="input" type="number" required value={formPago.monto_pagado} onChange={e => setFormPago(p=>({...p,monto_pagado:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Fecha de pago</label>
                  <input className="input" type="date" value={formPago.fecha_pago} onChange={e => setFormPago(p=>({...p,fecha_pago:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Método</label>
                  <select className="input" value={formPago.metodo_pago} onChange={e => setFormPago(p=>({...p,metodo_pago:e.target.value}))}>
                    {['efectivo','transferencia','tarjeta','cheque'].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Referencia</label>
                  <input className="input" placeholder="Opcional" value={formPago.referencia} onChange={e => setFormPago(p=>({...p,referencia:e.target.value}))} />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Notas</label>
                  <input className="input" placeholder="Observaciones opcionales" value={formPago.notas} onChange={e => setFormPago(p=>({...p,notas:e.target.value}))} />
                </div>

                {/* Comprobante WhatsApp / manual */}
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>
                    📎 Comprobante de pago — Opcional
                  </label>
                  {comprobanteFile ? (
                    <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', background:'#dcfce7', borderRadius:'8px', border:'1px solid #86efac' }}>
                      <span style={{ fontSize:'20px' }}>{comprobanteFile.type.includes('pdf') ? '📄' : '🖼'}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'13px', fontWeight:'600', color:'#16a34a' }}>{comprobanteFile.name}</div>
                        <div style={{ fontSize:'11px', color:'#16a34a' }}>{(comprobanteFile.size/1024).toFixed(0)} KB — listo para subir</div>
                      </div>
                      <button type="button" style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:'18px', lineHeight:1 }}
                        onClick={() => setComprobanteFile(null)}>✕</button>
                    </div>
                  ) : (
                    <div
                      style={{ border:'2px dashed var(--border)', borderRadius:'10px', padding:'20px', textAlign:'center', cursor:'pointer', background:'var(--surface2)', transition:'border .2s' }}
                      onClick={() => document.getElementById('comp-admin-input').click()}
                      onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor='var(--accent)'; }}
                      onDragLeave={e => { e.currentTarget.style.borderColor='var(--border)'; }}
                      onDrop={e => {
                        e.preventDefault(); e.currentTarget.style.borderColor='var(--border)';
                        const f = e.dataTransfer.files[0];
                        if (f && f.size <= 5*1024*1024) setComprobanteFile(f);
                        else if (f) toast.error('Máximo 5MB');
                      }}>
                      <div style={{ fontSize:'28px', marginBottom:'6px' }}>📱</div>
                      <div style={{ fontSize:'13px', fontWeight:'600', color:'var(--text2)' }}>Arrastra el comprobante de WhatsApp aquí</div>
                      <div style={{ fontSize:'11px', color:'var(--text2)', marginTop:'2px' }}>o haz clic · JPG, PNG, PDF · Máx 5MB</div>
                    </div>
                  )}
                  <input id="comp-admin-input" type="file" accept="image/*,.pdf" style={{ display:'none' }}
                    onChange={e => {
                      const f = e.target.files[0];
                      if (f && f.size <= 5*1024*1024) setComprobanteFile(f);
                      else if (f) toast.error('Máximo 5MB');
                    }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalPago(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Registrar Pago'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal subir comprobante */}
      {modalComprobante && pagoSelected && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalComprobante(false)}>
          <div className="modal" style={{ maxWidth:'440px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'8px' }}>Subir Comprobante</h2>
            <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'24px' }}>
              Unidad {pagoSelected.unidad_numero} · {meses[(periodoActivo?.mes||1)-1]} {periodoActivo?.anio}
            </p>
            <div
              style={{ border:'2px dashed var(--border)', borderRadius:'12px', padding:'32px', textAlign:'center', cursor:'pointer', background:'var(--surface2)' }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor='var(--accent)'; }}
              onDragLeave={e => { e.currentTarget.style.borderColor='var(--border)'; }}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor='var(--border)'; const f=e.dataTransfer.files[0]; if(f) handleSubirComprobante({target:{files:[f]}}); }}
            >
              <div style={{ fontSize:'36px', marginBottom:'10px' }}>📎</div>
              <div style={{ fontWeight:'600', fontSize:'14px', marginBottom:'4px' }}>{uploadingFile ? 'Subiendo...' : 'Haz clic o arrastra el archivo'}</div>
              <div style={{ color:'var(--text2)', fontSize:'12px' }}>JPG, PNG, PDF · Máximo 5MB</div>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display:'none' }} onChange={handleSubirComprobante} />
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'20px' }}>
              <button className="btn btn-ghost" onClick={() => setModalComprobante(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
