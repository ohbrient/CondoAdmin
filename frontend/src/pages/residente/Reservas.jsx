import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';

const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES_NOMBRES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function CalendarioResidente({ reservas, anio, mes, onDiaClick }) {
  const primerDia = new Date(anio, mes-1, 1).getDay();
  const diasMes = new Date(anio, mes, 0).getDate();
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split('T')[0];

  const ocupados = {};
  reservas.forEach(r => {
    const k = r.fecha?.split('T')[0] || r.fecha;
    if (!ocupados[k]) ocupados[k] = [];
    ocupados[k].push(r);
  });

  const celdas = [];
  for (let i = 0; i < primerDia; i++) celdas.push(null);
  for (let d = 1; d <= diasMes; d++) celdas.push(d);

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', marginBottom:'4px' }}>
        {DIAS.map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:'11px', fontWeight:'700', color:'var(--text2)', padding:'6px 0', textTransform:'uppercase', letterSpacing:'1px' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px' }}>
        {celdas.map((dia, i) => {
          if (!dia) return <div key={`e-${i}`} />;
          const fechaStr = `${anio}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
          const rsDelDia = ocupados[fechaStr] || [];
          const ocupado = rsDelDia.some(r => r.estado === 'aprobada');
          const pendiente = rsDelDia.some(r => r.estado === 'pendiente');
          const esHoy = fechaStr === hoyStr;
          const pasado = fechaStr < hoyStr;

          let bg = 'var(--surface)';
          let textColor = 'var(--text)';
          let cursor = 'pointer';
          if (pasado) { bg = 'var(--surface2)'; cursor = 'default'; }
          else if (ocupado) { bg = '#fee2e2'; textColor = '#dc2626'; cursor = 'not-allowed'; }
          else if (pendiente) { bg = '#fef9c3'; textColor = '#ca8a04'; }

          return (
            <div key={dia}
              onClick={() => !pasado && !ocupado && onDiaClick(fechaStr)}
              title={ocupado ? 'Día ocupado — no disponible' : pasado ? '' : 'Clic para reservar'}
              style={{
                minHeight:'56px', borderRadius:'8px', padding:'6px', cursor,
                border: esHoy ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: bg, opacity: pasado ? 0.45 : 1, transition:'all .15s',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              }}
              onMouseEnter={e => !pasado && !ocupado && (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => !pasado && !ocupado && (e.currentTarget.style.borderColor = esHoy ? 'var(--accent)' : 'var(--border)')}
            >
              <div style={{ fontSize:'14px', fontWeight: esHoy ? '700' : '500', color: esHoy ? 'var(--accent)' : textColor }}>{dia}</div>
              {ocupado && <div style={{ fontSize:'9px', color:'#dc2626', fontWeight:'700', marginTop:'2px' }}>OCUPADO</div>}
              {pendiente && !ocupado && <div style={{ fontSize:'9px', color:'#ca8a04', fontWeight:'700', marginTop:'2px' }}>PENDIENTE</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ResidenteReservas() {
  const [unidad, setUnidad] = useState(null);
  const [areas, setAreas] = useState([]);
  const [areaActiva, setAreaActiva] = useState(null);
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [misReservas, setMisReservas] = useState([]);
  const [tab, setTab] = useState('reservar');
  const now = new Date();
  const [calMes, setCalMes] = useState(now.getMonth()+1);
  const [calAnio, setCalAnio] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalReservar, setModalReservar] = useState(false);
  const [fechaSeleccionada, setFechaSeleccionada] = useState('');
  const [form, setForm] = useState({ hora_inicio:'09:00', hora_fin:'11:00', motivo:'', num_personas:'' });
  const [horasOcupadas, setHorasOcupadas] = useState([]);

  const fmt = n => new Intl.NumberFormat('es-DO').format(parseFloat(n)||0);

  const loadDisponibilidad = async (condId, area, mes, anio) => {
    const { data } = await api.get(`/condominios/${condId}/reservas/disponibilidad`, { params: { area_id: area.id, mes, anio } });
    setDisponibilidad(data);
  };

  const loadMisReservas = async () => {
    const { data } = await api.get('/residente/mis-reservas');
    setMisReservas(data);
  };

  useEffect(() => {
    Promise.all([
      api.get('/residente/mi-unidad'),
    ]).then(([u]) => {
      setUnidad(u.data);
      if (u.data) {
        return api.get(`/condominios/${u.data.condominio_id}/areas`);
      }
    }).then(r => {
      if (!r) return;
      const areasActivas = r.data.filter(a => a.activa);
      setAreas(areasActivas);
      if (areasActivas.length > 0) setAreaActiva(areasActivas[0]);
    }).catch(console.error).finally(() => setLoading(false));
    loadMisReservas();
  }, []);

  useEffect(() => {
    if (unidad && areaActiva) loadDisponibilidad(unidad.condominio_id, areaActiva, calMes, calAnio);
  }, [areaActiva, calMes, calAnio, unidad]);

  const abrirReservar = (fecha) => {
    setFechaSeleccionada(fecha);
    // Calcular horas ocupadas ese día
    const rsDelDia = disponibilidad.filter(r => (r.fecha?.split('T')[0]||r.fecha) === fecha && r.estado==='aprobada');
    setHorasOcupadas(rsDelDia);
    setForm({ hora_inicio:'09:00', hora_fin:'11:00', motivo:'', num_personas:'' });
    setModalReservar(true);
  };

  const handleReservar = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post(`/condominios/${unidad.condominio_id}/reservas`, {
        area_id: areaActiva.id,
        fecha: fechaSeleccionada,
        ...form
      });
      toast.success('✓ Solicitud enviada — el administrador la revisará');
      setModalReservar(false);
      await loadDisponibilidad(unidad.condominio_id, areaActiva, calMes, calAnio);
      await loadMisReservas();
      setTab('mis-reservas');
    } catch (err) { toast.error(err.response?.data?.error || 'Error al reservar'); }
    finally { setSaving(false); }
  };

  const cancelarReserva = async (id) => {
    if (!confirm('¿Cancelar esta reserva?')) return;
    try {
      await api.delete(`/condominios/${unidad.condominio_id}/reservas/${id}`);
      toast.success('Reserva cancelada');
      await loadMisReservas();
      await loadDisponibilidad(unidad.condominio_id, areaActiva, calMes, calAnio);
    } catch { toast.error('Error al cancelar'); }
  };

  const estadoColor = { pendiente:'badge-yellow', aprobada:'badge-green', rechazada:'badge-red', cancelada:'badge-red' };
  const HORAS = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'];

  if (loading) return <Layout><div style={{ padding:'32px', textAlign:'center', color:'var(--text2)' }}>Cargando...</div></Layout>;

  return (
    <Layout>
      <div style={{ padding:'32px' }}>
        <div style={{ marginBottom:'28px' }}>
          <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Áreas Comunes</h1>
          <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>Reserva espacios disponibles en tu residencial</p>
        </div>

        {areas.length === 0 ? (
          <div className="card" style={{ padding:'64px', textAlign:'center', color:'var(--text2)' }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>🏊</div>
            <p>No hay áreas comunes disponibles por el momento</p>
          </div>
        ) : (
          <>
            {/* Selector de área */}
            <div style={{ display:'flex', gap:'8px', marginBottom:'24px', flexWrap:'wrap' }}>
              {areas.map(a => (
                <button key={a.id} onClick={() => setAreaActiva(a)} style={{
                  padding:'8px 16px', borderRadius:'20px', cursor:'pointer', fontWeight:'600', fontSize:'13px',
                  border: areaActiva?.id===a.id ? 'none' : '1px solid var(--border)',
                  background: areaActiva?.id===a.id ? 'var(--accent)' : 'var(--surface)',
                  color: areaActiva?.id===a.id ? '#fff' : 'var(--text2)',
                  boxShadow: areaActiva?.id===a.id ? '0 2px 8px rgba(176,138,78,.3)' : 'none',
                }}>{a.nombre}</button>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', gap:'8px', marginBottom:'24px' }}>
              {[['reservar','📅 Reservar'],['mis-reservas','📋 Mis reservas']].map(([k,l]) => (
                <button key={k} onClick={() => setTab(k)} style={{
                  padding:'8px 16px', borderRadius:'20px', cursor:'pointer', fontWeight:'600', fontSize:'13px',
                  border: tab===k ? 'none' : '1px solid var(--border)',
                  background: tab===k ? 'var(--accent)' : 'var(--surface)',
                  color: tab===k ? '#fff' : 'var(--text2)',
                }}>{l}</button>
              ))}
            </div>

            {tab === 'reservar' && areaActiva && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:'24px' }}>
                {/* Calendario */}
                <div className="card" style={{ padding:'24px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
                    <button className="btn btn-ghost" style={{ padding:'6px 12px' }}
                      onClick={() => { if(calMes===1){setCalMes(12);setCalAnio(y=>y-1);}else setCalMes(m=>m-1); }}>← Anterior</button>
                    <span style={{ fontFamily:'DM Serif Display, serif', fontSize:'20px' }}>{MESES_NOMBRES[calMes-1]} {calAnio}</span>
                    <button className="btn btn-ghost" style={{ padding:'6px 12px' }}
                      onClick={() => { if(calMes===12){setCalMes(1);setCalAnio(y=>y+1);}else setCalMes(m=>m+1); }}>Siguiente →</button>
                  </div>

                  <CalendarioResidente
                    reservas={disponibilidad}
                    anio={calAnio} mes={calMes}
                    onDiaClick={abrirReservar}
                  />

                  {/* Leyenda */}
                  <div style={{ display:'flex', gap:'16px', marginTop:'16px', paddingTop:'16px', borderTop:'1px solid var(--border)', flexWrap:'wrap' }}>
                    {[
                      { color:'var(--surface)', border:'1px solid var(--border)', label:'Disponible — clic para reservar' },
                      { color:'#fee2e2', label:'Ocupado' },
                      { color:'#fef9c3', label:'Pendiente de aprobación' },
                    ].map(l => (
                      <div key={l.label} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--text2)' }}>
                        <div style={{ width:'12px', height:'12px', borderRadius:'3px', background:l.color, border:l.border||'none' }} />
                        {l.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Info del área */}
                <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                  <div className="card" style={{ padding:'20px' }}>
                    <div style={{ fontWeight:'700', fontSize:'16px', marginBottom:'8px' }}>{areaActiva.nombre}</div>
                    {areaActiva.descripcion && <div style={{ fontSize:'13px', color:'var(--text2)', lineHeight:'1.5', marginBottom:'12px' }}>{areaActiva.descripcion}</div>}
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                      {areaActiva.capacidad && <div style={{ fontSize:'13px' }}>👥 Hasta <strong>{areaActiva.capacidad} personas</strong></div>}
                      {parseFloat(areaActiva.precio_reserva||0) > 0
                        ? <div style={{ fontSize:'13px' }}>💰 Costo: <strong style={{ color:'var(--accent)' }}>RD$ {fmt(areaActiva.precio_reserva)}</strong></div>
                        : <div style={{ fontSize:'13px', color:'var(--green)' }}>✓ Sin costo de reserva</div>
                      }
                      {areaActiva.requiere_deposito && <div style={{ fontSize:'13px' }}>🔒 Depósito: <strong>RD$ {fmt(areaActiva.monto_deposito)}</strong></div>}
                    </div>
                  </div>

                  <div className="card" style={{ padding:'16px 20px', background:'#dbeafe', border:'1px solid #93c5fd' }}>
                    <div style={{ fontSize:'13px', color:'#1d4ed8', lineHeight:'1.6' }}>
                      ℹ️ Selecciona un día disponible en el calendario para solicitar tu reserva. El administrador la revisará y recibirás confirmación.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'mis-reservas' && (
              <div className="card">
                {misReservas.length === 0 ? (
                  <div style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>
                    <div style={{ fontSize:'40px', marginBottom:'12px' }}>📅</div>
                    <p>No tienes reservas registradas</p>
                    <button className="btn btn-primary" style={{ marginTop:'16px' }} onClick={() => setTab('reservar')}>Hacer primera reserva</button>
                  </div>
                ) : (
                  <table className="table">
                    <thead><tr><th>Área</th><th>Fecha</th><th>Horario</th><th>Personas</th><th>Estado</th><th>Notas admin</th><th></th></tr></thead>
                    <tbody>
                      {misReservas.map(r => (
                        <tr key={r.id}>
                          <td style={{ fontWeight:'600' }}>{r.area_nombre}</td>
                          <td style={{ fontSize:'13px' }}>{new Date(r.fecha+'T12:00:00').toLocaleDateString('es-DO', { day:'numeric', month:'short', year:'numeric' })}</td>
                          <td style={{ fontSize:'13px' }}>{r.hora_inicio?.slice(0,5)} – {r.hora_fin?.slice(0,5)}</td>
                          <td style={{ fontSize:'13px', color:'var(--text2)' }}>{r.num_personas || '—'}</td>
                          <td><span className={`badge ${estadoColor[r.estado]||'badge-gold'}`}>{r.estado}</span></td>
                          <td style={{ fontSize:'12px', color: r.notas_admin ? 'var(--text)' : 'var(--text2)' }}>{r.notas_admin || '—'}</td>
                          <td>
                            {(r.estado==='pendiente'||r.estado==='aprobada') && (
                              <button className="btn btn-ghost" style={{ padding:'4px 10px', fontSize:'12px', color:'var(--red)' }}
                                onClick={() => cancelarReserva(r.id)}>✕ Cancelar</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de reserva */}
      {modalReservar && areaActiva && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalReservar(false)}>
          <div className="modal" style={{ maxWidth:'460px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'22px', marginBottom:'4px' }}>Solicitar reserva</h2>
            <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'20px' }}>
              {areaActiva.nombre} · {new Date(fechaSeleccionada+'T12:00:00').toLocaleDateString('es-DO', { weekday:'long', day:'numeric', month:'long' })}
            </p>

            {/* Horarios ocupados ese día */}
            {horasOcupadas.length > 0 && (
              <div style={{ background:'#fef9c3', border:'1px solid #fde047', borderRadius:'8px', padding:'10px 14px', marginBottom:'16px', fontSize:'12px', color:'#92400e' }}>
                ⚠ Horarios ya reservados ese día:
                {horasOcupadas.map(r => <span key={r.id} style={{ marginLeft:'8px', fontWeight:'700' }}>{r.hora_inicio?.slice(0,5)}–{r.hora_fin?.slice(0,5)}</span>)}
              </div>
            )}

            <form onSubmit={handleReservar}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Hora inicio *</label>
                  <select className="input" required value={form.hora_inicio} onChange={e => setForm(f=>({...f,hora_inicio:e.target.value}))}>
                    {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Hora fin *</label>
                  <select className="input" required value={form.hora_fin} onChange={e => setForm(f=>({...f,hora_fin:e.target.value}))}>
                    {HORAS.filter(h => h > form.hora_inicio).map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>N° de personas</label>
                  <input className="input" type="number" min="1" max={areaActiva.capacidad||999} placeholder={areaActiva.capacidad ? `Máx. ${areaActiva.capacidad}` : ''}
                    value={form.num_personas} onChange={e => setForm(f=>({...f,num_personas:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Motivo del evento</label>
                  <input className="input" placeholder="Ej: Cumpleaños, reunión..."
                    value={form.motivo} onChange={e => setForm(f=>({...f,motivo:e.target.value}))} />
                </div>
              </div>

              {parseFloat(areaActiva.precio_reserva||0) > 0 && (
                <div style={{ marginTop:'16px', padding:'12px 16px', background:'#fef9f0', borderRadius:'8px', fontSize:'13px' }}>
                  💰 Costo de reserva: <strong style={{ color:'var(--accent)' }}>RD$ {fmt(areaActiva.precio_reserva)}</strong>
                  {areaActiva.requiere_deposito && <span style={{ marginLeft:'8px', color:'var(--text2)' }}>+ depósito RD$ {fmt(areaActiva.monto_deposito)}</span>}
                </div>
              )}

              <div style={{ marginTop:'12px', padding:'10px 14px', background:'#dbeafe', borderRadius:'8px', fontSize:'12px', color:'#1d4ed8' }}>
                ℹ️ Tu solicitud quedará pendiente hasta que el administrador la apruebe.
              </div>

              <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'20px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalReservar(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enviando...' : 'Enviar solicitud'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
