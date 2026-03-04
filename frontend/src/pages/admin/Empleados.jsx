import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL;

const cargos = ['vigilante','conserje','jardinero','mantenimiento','administrador','recepcionista','otro'];
const EMPTY = {
  // Personal
  nombre:'', apellido:'', telefono:'', cedula:'', direccion:'',
  fecha_nacimiento:'', nacionalidad:'Dominicana', estado_civil:'soltero',
  contacto_emergencia_nombre:'', contacto_emergencia_telefono:'',
  // Laboral
  cargo:'vigilante', departamento:'', tipo_contrato:'indefinido',
  fecha_inicio: new Date().toISOString().split('T')[0],
  fecha_vencimiento_contrato:'', horario:'', estado_empleado:'activo', notas:'',
  // Nómina
  salario:'', modalidad_pago:'mensual', bonificacion:'',
  nss:'', afp:'', ars:'', banco:'', cuenta_bancaria:'',
  vacaciones_dias:'30', dias_vacaciones_tomados:'0',
};
const EMPTY_SAL = { periodo_inicio: new Date().toISOString().split('T')[0], periodo_fin: new Date().toISOString().split('T')[0], monto:'', metodo:'transferencia', referencia:'', notas:'' };

const LBL = { fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' };
const estadoEmpColor = { activo:'badge-green', suspendido:'badge-yellow', licencia:'badge-blue', terminado:'badge-red' };
const estadoEmpIcon  = { activo:'✅', suspendido:'⏸', licencia:'🏖', terminado:'🔴' };

export default function Empleados() {
  const [condoId, setCondoId]     = useState(null);
  const [moneda, setMoneda]       = useState('RD$');
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);
  const [editando, setEditando]   = useState(null);
  const [empSelected, setEmpSel]  = useState(null);
  const [formEmp, setFormEmp]     = useState(EMPTY);
  const [formSal, setFormSal]     = useState(EMPTY_SAL);
  const [saving, setSaving]       = useState(false);
  const [tabModal, setTabModal]   = useState('personal');
  const [fotoFile, setFotoFile]   = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [verEmp, setVerEmp]       = useState(null);
  const [filtro, setFiltro]       = useState('todos');
  const fileRef = useRef();

  const load = (cid) => api.get(`/condominios/${cid}/empleados`).then(r => setEmpleados(r.data)).catch(console.error).finally(() => setLoading(false));

  useEffect(() => {
    api.get('/condominios').then(r => {
      const c = r.data[0]; if (!c) return;
      setCondoId(c.id); setMoneda(c.moneda||'RD$'); load(c.id);
    });
  }, []);

  const openNuevo = () => { setFormEmp(EMPTY); setEditando(null); setFotoFile(null); setFotoPreview(null); setTabModal('personal'); setModal('empleado'); };
  const openEditar = (emp) => {
    setFormEmp({ ...EMPTY, ...emp,
      fecha_inicio: emp.fecha_inicio?.split('T')[0]||'',
      fecha_nacimiento: emp.fecha_nacimiento?.split('T')[0]||'',
      fecha_vencimiento_contrato: emp.fecha_vencimiento_contrato?.split('T')[0]||'',
      bonificacion: emp.bonificacion||'', vacaciones_dias: emp.vacaciones_dias||'30',
      dias_vacaciones_tomados: emp.dias_vacaciones_tomados||'0',
    });
    setEditando(emp); setFotoFile(null); setFotoPreview(emp.foto_url ? `${API_URL}${emp.foto_url}` : null);
    setTabModal('personal'); setModal('empleado');
  };

  const fe = k => ({ value: formEmp[k]||'', onChange: e => setFormEmp(p=>({...p,[k]:e.target.value})) });
  const fs = k => ({ value: formSal[k]||'', onChange: e => setFormSal(p=>({...p,[k]:e.target.value})) });
  const fmt = n => new Intl.NumberFormat('es-DO').format(parseFloat(n)||0);

  const handleSaveEmp = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(formEmp).forEach(([k,v]) => v !== null && v !== undefined && fd.append(k, v));
      if (fotoFile) fd.append('foto', fotoFile);
      if (editando?.foto_url && !fotoFile) fd.append('foto_url_existente', editando.foto_url);

      if (editando) {
        await api.put(`/condominios/${condoId}/empleados/${editando.id}`, fd);
        toast.success('Empleado actualizado');
      } else {
        await api.post(`/condominios/${condoId}/empleados`, fd);
        toast.success('Empleado agregado');
      }
      setModal(null); load(condoId);
    } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const handlePagarSalario = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post(`/condominios/${condoId}/empleados/${empSelected.id}/salario`, formSal);
      toast.success('Salario registrado'); setModal(null); load(condoId);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const nominaMensual = empleados.filter(e=>e.activo).reduce((s,e)=>s+parseFloat(e.salario||0)+parseFloat(e.bonificacion||0),0);
  const activos = empleados.filter(e=>e.activo && e.estado_empleado !== 'terminado').length;

  const filtrados = empleados.filter(e =>
    filtro === 'todos' ? true :
    filtro === 'activo' ? (e.activo && e.estado_empleado !== 'terminado') :
    e.estado_empleado === filtro
  );

  // Tabs del modal
  const tabs = [
    { key:'personal', label:'👤 Personal' },
    { key:'laboral',  label:'💼 Laboral' },
    { key:'nomina',   label:'💰 Nómina' },
    { key:'docs',     label:'📋 Más info' },
  ];

  return (
    <Layout>
      <div style={{ padding:'32px' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'28px' }}>
          <div>
            <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Empleados</h1>
            <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>
              {activos} activos · Nómina: <strong style={{ color:'var(--accent)' }}>{moneda} {fmt(nominaMensual)}</strong>
            </p>
          </div>
          <button className="btn btn-primary" onClick={openNuevo}>+ Agregar Empleado</button>
        </div>

        {/* Filtros */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
          {[['todos','Todos'],['activo','Activos'],['suspendido','Suspendidos'],['licencia','De licencia'],['terminado','Terminados']].map(([v,l]) => (
            <button key={v} onClick={() => setFiltro(v)} style={{
              padding:'6px 14px', borderRadius:'20px', cursor:'pointer', fontWeight:'600', fontSize:'12px',
              border: filtro===v ? 'none' : '1px solid var(--border)',
              background: filtro===v ? 'var(--accent)' : 'transparent',
              color: filtro===v ? 'var(--bg)' : 'var(--text2)',
            }}>{l}</button>
          ))}
        </div>

        {/* Grid de empleados */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'48px', color:'var(--text2)' }}>Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="card" style={{ padding:'64px', textAlign:'center', color:'var(--text2)' }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>👷</div>
            <p>No hay empleados {filtro !== 'todos' ? 'en este estado' : 'registrados'}</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(310px, 1fr))', gap:'20px' }}>
            {filtrados.map(emp => (
              <div key={emp.id} className="card" style={{ position:'relative', overflow:'hidden', opacity: emp.estado_empleado==='terminado' ? 0.6 : 1 }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px',
                  background: emp.estado_empleado==='activo' ? 'var(--green)' : emp.estado_empleado==='suspendido' ? 'var(--yellow)' : emp.estado_empleado==='licencia' ? 'var(--blue)' : 'var(--red)' }} />
                <div style={{ padding:'20px 24px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'14px' }}>
                    {emp.foto_url ? (
                      <img src={`http://localhost:4000${emp.foto_url}`} alt="" style={{ width:'48px', height:'48px', borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                    ) : (
                      <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', fontWeight:'700', color:'var(--bg)', flexShrink:0 }}>
                        {emp.nombre?.[0]}{emp.apellido?.[0]}
                      </div>
                    )}
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:'700', fontSize:'15px' }}>{emp.nombre} {emp.apellido}</div>
                      <div style={{ fontSize:'12px', color:'var(--text2)', textTransform:'capitalize' }}>{emp.cargo}{emp.departamento ? ` · ${emp.departamento}` : ''}</div>
                    </div>
                    <span className={`badge ${estadoEmpColor[emp.estado_empleado]||'badge-green'}`} style={{ fontSize:'10px' }}>
                      {estadoEmpIcon[emp.estado_empleado]} {emp.estado_empleado}
                    </span>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'14px' }}>
                    {[
                      ['Salario', `${moneda} ${fmt(emp.salario)}`],
                      ['Bonificación', emp.bonificacion > 0 ? `${moneda} ${fmt(emp.bonificacion)}` : '—'],
                      ['Modalidad', emp.modalidad_pago],
                      ['Teléfono', emp.telefono || '—'],
                    ].map(([l,v]) => (
                      <div key={l} style={{ background:'var(--surface2)', borderRadius:'6px', padding:'8px 10px' }}>
                        <div style={{ fontSize:'10px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px' }}>{l}</div>
                        <div style={{ fontSize:'13px', fontWeight:'600', textTransform:'capitalize' }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Vacaciones */}
                  {emp.vacaciones_dias > 0 && (
                    <div style={{ marginBottom:'12px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--text2)', marginBottom:'4px' }}>
                        <span>Vacaciones</span>
                        <span>{emp.dias_vacaciones_tomados||0}/{emp.vacaciones_dias} días</span>
                      </div>
                      <div style={{ background:'var(--border)', borderRadius:'99px', height:'4px' }}>
                        <div style={{ height:'100%', borderRadius:'99px', background:'var(--accent)', width:`${Math.min(100,(emp.dias_vacaciones_tomados||0)/emp.vacaciones_dias*100)}%` }} />
                      </div>
                    </div>
                  )}

                  <div style={{ display:'flex', gap:'8px' }}>
                    <button className="btn btn-primary" style={{ flex:1, justifyContent:'center', fontSize:'12px' }}
                      onClick={() => { setEmpSel(emp); setFormSal({...EMPTY_SAL, monto: emp.modalidad_pago==='mensual' ? emp.salario : Math.round(emp.salario/2)}); setModal('salario'); }}>
                      💰 Pagar
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'8px 12px' }}
                      onClick={() => setVerEmp(emp)}>👁 Ver</button>
                    <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'8px 12px' }}
                      onClick={() => openEditar(emp)}>✎</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ver empleado ── */}
      {verEmp && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setVerEmp(null)}>
          <div className="modal" style={{ maxWidth:'600px' }}>
            <div style={{ display:'flex', gap:'20px', marginBottom:'24px', alignItems:'flex-start' }}>
              {verEmp.foto_url ? (
                <img src={`http://localhost:4000${verEmp.foto_url}`} alt="" style={{ width:'80px', height:'80px', borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
              ) : (
                <div style={{ width:'80px', height:'80px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px', fontWeight:'700', color:'var(--bg)', flexShrink:0 }}>
                  {verEmp.nombre?.[0]}{verEmp.apellido?.[0]}
                </div>
              )}
              <div>
                <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', margin:'0 0 4px' }}>{verEmp.nombre} {verEmp.apellido}</h2>
                <div style={{ fontSize:'13px', color:'var(--text2)', textTransform:'capitalize', marginBottom:'8px' }}>{verEmp.cargo} {verEmp.departamento ? `· ${verEmp.departamento}` : ''}</div>
                <span className={`badge ${estadoEmpColor[verEmp.estado_empleado]||'badge-green'}`}>{estadoEmpIcon[verEmp.estado_empleado]} {verEmp.estado_empleado}</span>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
              {[
                ['Cédula', verEmp.cedula],['Teléfono', verEmp.telefono],
                ['Nacimiento', verEmp.fecha_nacimiento?.split('T')[0]],['Nacionalidad', verEmp.nacionalidad],
                ['Estado civil', verEmp.estado_civil],['NSS', verEmp.nss],
                ['AFP', verEmp.afp],['ARS', verEmp.ars],
                ['Banco', verEmp.banco],['Cuenta', verEmp.cuenta_bancaria],
                ['Tipo contrato', verEmp.tipo_contrato],['Horario', verEmp.horario],
                ['Inicio', verEmp.fecha_inicio?.split('T')[0]],['Vence contrato', verEmp.fecha_vencimiento_contrato?.split('T')[0]],
                ['Salario', `${moneda} ${fmt(verEmp.salario)}`],['Bonificación', `${moneda} ${fmt(verEmp.bonificacion||0)}`],
                ['Vacaciones', `${verEmp.dias_vacaciones_tomados||0}/${verEmp.vacaciones_dias||30} días`],['Pagado este mes', `${moneda} ${fmt(verEmp.pagado_mes||0)}`],
              ].filter(([,v]) => v).map(([l,v]) => (
                <div key={l} style={{ background:'var(--surface2)', borderRadius:'8px', padding:'10px 12px' }}>
                  <div style={{ fontSize:'10px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px' }}>{l}</div>
                  <div style={{ fontSize:'13px', fontWeight:'600', textTransform:'capitalize' }}>{v}</div>
                </div>
              ))}
            </div>

            {verEmp.direccion && (
              <div style={{ background:'var(--surface2)', borderRadius:'8px', padding:'10px 12px', marginBottom:'10px' }}>
                <div style={{ fontSize:'10px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px' }}>Dirección</div>
                <div style={{ fontSize:'13px' }}>{verEmp.direccion}</div>
              </div>
            )}

            {(verEmp.contacto_emergencia_nombre || verEmp.contacto_emergencia_telefono) && (
              <div style={{ background:'rgba(220,38,38,.06)', border:'1px solid rgba(220,38,38,.2)', borderRadius:'8px', padding:'10px 14px', marginBottom:'10px' }}>
                <div style={{ fontSize:'11px', color:'var(--red)', fontWeight:'700', marginBottom:'4px' }}>🆘 Contacto de emergencia</div>
                <div style={{ fontSize:'13px' }}>{verEmp.contacto_emergencia_nombre} · {verEmp.contacto_emergencia_telefono}</div>
              </div>
            )}

            {verEmp.notas && (
              <div style={{ background:'var(--surface2)', borderRadius:'8px', padding:'10px 12px', marginBottom:'16px' }}>
                <div style={{ fontSize:'10px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Notas</div>
                <div style={{ fontSize:'13px' }}>{verEmp.notas}</div>
              </div>
            )}

            {/* Historial de salarios */}
            {(verEmp.historial_salarios||[]).length > 0 && (
              <div>
                <div style={{ fontSize:'12px', fontWeight:'700', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>Últimos pagos de salario</div>
                {verEmp.historial_salarios.slice(0,5).map((s,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' }}>
                    <span>{s.periodo_inicio?.split('T')[0]} → {s.periodo_fin?.split('T')[0]}</span>
                    <span style={{ fontWeight:'700', color:'var(--green)' }}>{moneda} {fmt(s.monto)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'flex', gap:'10px', marginTop:'20px', justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setVerEmp(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={() => { setVerEmp(null); openEditar(verEmp); }}>✎ Editar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal crear/editar empleado con pestañas ── */}
      {modal === 'empleado' && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth:'620px', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', margin:'0 0 16px' }}>
              {editando ? 'Editar Empleado' : 'Nuevo Empleado'}
            </h2>

            {/* Tab bar */}
            <div style={{ display:'flex', gap:'4px', background:'var(--surface2)', borderRadius:'10px', padding:'4px', marginBottom:'20px', flexShrink:0 }}>
              {tabs.map(t => (
                <button key={t.key} type="button" onClick={() => setTabModal(t.key)} style={{
                  flex:1, padding:'7px 4px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600', transition:'all .15s',
                  background: tabModal===t.key ? 'var(--card)' : 'transparent',
                  color: tabModal===t.key ? 'var(--text)' : 'var(--text2)',
                  boxShadow: tabModal===t.key ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
                }}>{t.label}</button>
              ))}
            </div>

            <form onSubmit={handleSaveEmp} style={{ flex:1, overflowY:'auto', paddingRight:'4px' }}>
              
              {/* ── TAB PERSONAL ── */}
              {tabModal === 'personal' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                  {/* Foto */}
                  <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
                    <div onClick={() => fileRef.current?.click()} style={{ width:'72px', height:'72px', borderRadius:'50%', background:'var(--surface2)', border:'2px dashed var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, overflow:'hidden', position:'relative' }}>
                      {fotoPreview ? (
                        <img src={fotoPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      ) : (
                        <span style={{ fontSize:'28px' }}>📷</span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight:'600', fontSize:'13px', marginBottom:'4px' }}>Foto del empleado</div>
                      <button type="button" className="btn btn-ghost" style={{ fontSize:'11px', padding:'4px 10px' }} onClick={() => fileRef.current?.click()}>
                        {fotoPreview ? 'Cambiar foto' : 'Subir foto'}
                      </button>
                      {fotoPreview && <button type="button" className="btn btn-ghost" style={{ fontSize:'11px', padding:'4px 10px', marginLeft:'6px', color:'var(--red)' }} onClick={() => { setFotoFile(null); setFotoPreview(null); }}>✕ Quitar</button>}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => {
                      const f = e.target.files[0]; if (!f) return;
                      setFotoFile(f); setFotoPreview(URL.createObjectURL(f));
                    }} />
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                    <div><label style={LBL}>Nombre *</label><input className="input" required {...fe('nombre')} /></div>
                    <div><label style={LBL}>Apellido *</label><input className="input" required {...fe('apellido')} /></div>
                    <div><label style={LBL}>Teléfono</label><input className="input" placeholder="809-000-0000" {...fe('telefono')} /></div>
                    <div><label style={LBL}>Cédula</label><input className="input" placeholder="000-0000000-0" {...fe('cedula')} /></div>
                    <div><label style={LBL}>Fecha de nacimiento</label><input className="input" type="date" {...fe('fecha_nacimiento')} /></div>
                    <div><label style={LBL}>Nacionalidad</label><input className="input" {...fe('nacionalidad')} /></div>
                    <div>
                      <label style={LBL}>Estado civil</label>
                      <select className="input" {...fe('estado_civil')}>
                        {['soltero','casado','unión libre','divorciado','viudo'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn:'1/-1' }}><label style={LBL}>Dirección</label><input className="input" placeholder="Calle, sector, ciudad..." {...fe('direccion')} /></div>
                    <div><label style={LBL}>Contacto de emergencia</label><input className="input" placeholder="Nombre completo" {...fe('contacto_emergencia_nombre')} /></div>
                    <div><label style={LBL}>Teléfono emergencia</label><input className="input" placeholder="809-000-0000" {...fe('contacto_emergencia_telefono')} /></div>
                  </div>
                </div>
              )}

              {/* ── TAB LABORAL ── */}
              {tabModal === 'laboral' && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                  <div>
                    <label style={LBL}>Cargo *</label>
                    <select className="input" {...fe('cargo')}>
                      {cargos.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div><label style={LBL}>Departamento</label><input className="input" placeholder="Seguridad, Limpieza..." {...fe('departamento')} /></div>
                  <div>
                    <label style={LBL}>Tipo de contrato</label>
                    <select className="input" {...fe('tipo_contrato')}>
                      {['indefinido','temporal','por obra','pasantía'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={LBL}>Estado</label>
                    <select className="input" {...fe('estado_empleado')}>
                      {['activo','suspendido','licencia','terminado'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                    </select>
                  </div>
                  <div><label style={LBL}>Fecha de inicio</label><input className="input" type="date" {...fe('fecha_inicio')} /></div>
                  <div><label style={LBL}>Vencimiento contrato</label><input className="input" type="date" {...fe('fecha_vencimiento_contrato')} /></div>
                  <div style={{ gridColumn:'1/-1' }}><label style={LBL}>Horario</label><input className="input" placeholder="Lun-Vie 8:00am-5:00pm" {...fe('horario')} /></div>
                  <div><label style={LBL}>Días vacaciones / año</label><input className="input" type="number" min="0" {...fe('vacaciones_dias')} /></div>
                  <div><label style={LBL}>Días vacaciones tomados</label><input className="input" type="number" min="0" {...fe('dias_vacaciones_tomados')} /></div>
                  <div style={{ gridColumn:'1/-1' }}><label style={LBL}>Notas / Observaciones</label><textarea className="input" rows={3} style={{ resize:'vertical' }} placeholder="Incidencias, observaciones generales..." {...fe('notas')} /></div>
                </div>
              )}

              {/* ── TAB NÓMINA ── */}
              {tabModal === 'nomina' && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                  <div><label style={LBL}>Salario *</label><input className="input" type="number" required step="0.01" placeholder="0.00" {...fe('salario')} /></div>
                  <div>
                    <label style={LBL}>Modalidad de pago</label>
                    <select className="input" {...fe('modalidad_pago')}>
                      <option value="mensual">Mensual</option>
                      <option value="quincenal">Quincenal</option>
                      <option value="semanal">Semanal</option>
                    </select>
                  </div>
                  <div><label style={LBL}>Bonificación fija</label><input className="input" type="number" step="0.01" placeholder="0.00" {...fe('bonificacion')} /></div>
                  <div><label style={LBL}>NSS (Seg. Social)</label><input className="input" placeholder="Número de seguridad social" {...fe('nss')} /></div>
                  <div><label style={LBL}>AFP</label><input className="input" placeholder="Ej: Siembra, Popular..." {...fe('afp')} /></div>
                  <div><label style={LBL}>ARS (Seguro médico)</label><input className="input" placeholder="Ej: ARS Salud Segura..." {...fe('ars')} /></div>
                  <div><label style={LBL}>Banco</label><input className="input" placeholder="Ej: BanReservas, BHD..." {...fe('banco')} /></div>
                  <div><label style={LBL}>Número de cuenta</label><input className="input" placeholder="Cuenta para depósito" {...fe('cuenta_bancaria')} /></div>
                </div>
              )}

              {/* ── TAB DOCS / MÁS INFO ── */}
              {tabModal === 'docs' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                  <div style={{ padding:'16px', background:'var(--surface2)', borderRadius:'10px', border:'1px solid var(--border)' }}>
                    <div style={{ fontWeight:'700', fontSize:'13px', marginBottom:'4px' }}>Documentos (próximamente)</div>
                    <div style={{ fontSize:'12px', color:'var(--text2)' }}>Aquí podrás subir: copia de cédula, contrato firmado y otros documentos del empleado.</div>
                  </div>
                  
                  {editando && (
                    <div style={{ padding:'16px', background:'var(--surface2)', borderRadius:'10px' }}>
                      <div style={{ fontWeight:'700', fontSize:'13px', marginBottom:'12px' }}>Resumen actual</div>
                      {[
                        ['Salario mensual', `${moneda} ${fmt(editando.salario)}`],
                        ['Bonificación', `${moneda} ${fmt(editando.bonificacion||0)}`],
                        ['Pagado este mes', `${moneda} ${fmt(editando.pagado_mes||0)}`],
                        ['Vacaciones usadas', `${editando.dias_vacaciones_tomados||0}/${editando.vacaciones_dias||30} días`],
                      ].map(([l,v]) => (
                        <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' }}>
                          <span style={{ color:'var(--text2)' }}>{l}</span>
                          <span style={{ fontWeight:'600' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display:'flex', gap:'12px', justifyContent:'space-between', marginTop:'24px', paddingTop:'16px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
                <div style={{ display:'flex', gap:'8px' }}>
                  {tabs.map((t, i) => tabModal !== t.key ? null : (
                    <>
                      {i > 0 && <button key="prev" type="button" className="btn btn-ghost" onClick={() => setTabModal(tabs[i-1].key)}>← Anterior</button>}
                      {i < tabs.length-1 && <button key="next" type="button" className="btn btn-ghost" onClick={() => setTabModal(tabs[i+1].key)}>Siguiente →</button>}
                    </>
                  ))}
                </div>
                <div style={{ display:'flex', gap:'10px' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar Empleado'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal pagar salario ── */}
      {modal === 'salario' && empSelected && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth:'480px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'6px' }}>Pagar Salario</h2>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px', padding:'12px 14px', background:'var(--surface2)', borderRadius:'10px' }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:'700', color:'var(--bg)', flexShrink:0 }}>
                {empSelected.nombre?.[0]}{empSelected.apellido?.[0]}
              </div>
              <div>
                <div style={{ fontWeight:'700' }}>{empSelected.nombre} {empSelected.apellido}</div>
                <div style={{ fontSize:'12px', color:'var(--text2)' }}>{empSelected.cargo} · Salario: {moneda} {fmt(empSelected.salario)} {empSelected.modalidad_pago}</div>
              </div>
            </div>
            <form onSubmit={handlePagarSalario}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                <div><label style={LBL}>Período inicio</label><input className="input" type="date" {...fs('periodo_inicio')} /></div>
                <div><label style={LBL}>Período fin</label><input className="input" type="date" {...fs('periodo_fin')} /></div>
                <div><label style={LBL}>Monto *</label><input className="input" type="number" required step="0.01" {...fs('monto')} /></div>
                <div>
                  <label style={LBL}>Método</label>
                  <select className="input" {...fs('metodo')}>
                    {['transferencia','efectivo','cheque'].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}><label style={LBL}>Referencia / Notas</label><input className="input" {...fs('notas')} placeholder="Número de transferencia u observaciones..." /></div>
              </div>
              <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Registrando...' : '💰 Confirmar pago'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
