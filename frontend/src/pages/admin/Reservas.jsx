import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';

const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES_NOMBRES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const HORAS = Array.from({length:24}, (_,i) => `${String(i).padStart(2,'0')}:00`);

function Calendario({ reservas, anio, mes, onDiaClick, areaId }) {
  const primerDia = new Date(anio, mes-1, 1).getDay();
  const diasMes = new Date(anio, mes, 0).getDate();
  const hoy = new Date();

  // Agrupar reservas por fecha
  const porFecha = {};
  reservas.forEach(r => {
    const k = r.fecha?.split('T')[0] || r.fecha;
    if (!porFecha[k]) porFecha[k] = [];
    porFecha[k].push(r);
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
          if (!dia) return <div key={`empty-${i}`} />;
          const fechaStr = `${anio}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
          const rsDia = porFecha[fechaStr] || [];
          const tieneReservas = rsDia.length > 0;
          const aprobadas = rsDia.filter(r=>r.estado==='aprobada').length;
          const pendientes = rsDia.filter(r=>r.estado==='pendiente').length;
          const esHoy = hoy.getDate()===dia && hoy.getMonth()===mes-1 && hoy.getFullYear()===anio;
          const pasado = new Date(fechaStr) < new Date(hoy.toISOString().split('T')[0]);

          return (
            <div key={dia}
              onClick={() => !pasado && onDiaClick(fechaStr, rsDia)}
              style={{
                minHeight:'64px', borderRadius:'8px', padding:'6px', cursor: pasado ? 'default' : 'pointer',
                border: esHoy ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: pasado ? 'var(--surface2)' : tieneReservas ? 'rgba(176,138,78,.06)' : 'var(--surface)',
                opacity: pasado ? 0.5 : 1,
                transition: 'all .15s',
              }}
              onMouseEnter={e => !pasado && (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => !pasado && (e.currentTarget.style.borderColor = esHoy ? 'var(--accent)' : 'var(--border)')}
            >
              <div style={{ fontSize:'13px', fontWeight: esHoy ? '700' : '500', color: esHoy ? 'var(--accent)' : 'var(--text)', marginBottom:'4px' }}>{dia}</div>
              {aprobadas > 0 && (
                <div style={{ fontSize:'10px', background:'var(--green)', color:'#fff', borderRadius:'4px', padding:'1px 5px', marginBottom:'2px', display:'inline-block' }}>
                  ✓ {aprobadas}
                </div>
              )}
              {pendientes > 0 && (
                <div style={{ fontSize:'10px', background:'var(--yellow)', color:'#fff', borderRadius:'4px', padding:'1px 5px', display:'inline-block' }}>
                  ⏳ {pendientes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Reservas() {
  const [condominio, setCondominio] = useState(null);
  const [areas, setAreas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [areaActiva, setAreaActiva] = useState(null);
  const [tab, setTab] = useState('calendario');
  const now = new Date();
  const [calMes, setCalMes] = useState(now.getMonth()+1);
  const [calAnio, setCalAnio] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalArea, setModalArea] = useState(false);
  const [editArea, setEditArea] = useState(null);
  const [modalDia, setModalDia] = useState(false);
  const [diaData, setDiaData] = useState({ fecha:'', reservas:[] });
  const [modalReserva, setModalReserva] = useState(false);
  const [reservaSelected, setReservaSelected] = useState(null);

  const [formArea, setFormArea] = useState({ nombre:'', descripcion:'', capacidad:'', precio_reserva:'0', requiere_deposito:false, monto_deposito:'0' });
  const [notasAdmin, setNotasAdmin] = useState('');

  const fmt = n => new Intl.NumberFormat('es-DO').format(parseFloat(n)||0);
  const moneda = condominio?.moneda || 'RD$';

  const loadReservas = async (c, area, mes, anio) => {
    if (!area) return;
    const { data } = await api.get(`/condominios/${c.id}/reservas/disponibilidad`, { params: { area_id: area.id, mes, anio } });
    setReservas(data);
  };

  const loadAll = async (c) => {
    const { data: ar } = await api.get(`/condominios/${c.id}/areas`);
    setAreas(ar);
    if (ar.length > 0) {
      setAreaActiva(ar[0]);
      await loadReservas(c, ar[0], calMes, calAnio);
    }
  };

  useEffect(() => {
    api.get('/condominios').then(r => {
      const c = r.data[0]; if (!c) return;
      setCondominio(c);
      return loadAll(c);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (condominio && areaActiva) loadReservas(condominio, areaActiva, calMes, calAnio);
  }, [calMes, calAnio, areaActiva]);

  const handleSaveArea = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editArea) {
        await api.put(`/condominios/${condominio.id}/areas/${editArea.id}`, { ...formArea, activa: true });
        toast.success('Área actualizada');
      } else {
        await api.post(`/condominios/${condominio.id}/areas`, formArea);
        toast.success('Área creada');
      }
      setModalArea(false); setEditArea(null);
      setFormArea({ nombre:'', descripcion:'', capacidad:'', precio_reserva:'0', requiere_deposito:false, monto_deposito:'0' });
      await loadAll(condominio);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const abrirEditArea = (area) => {
    setEditArea(area);
    setFormArea({ nombre:area.nombre, descripcion:area.descripcion||'', capacidad:area.capacidad||'', precio_reserva:area.precio_reserva||0, requiere_deposito:area.requiere_deposito||false, monto_deposito:area.monto_deposito||0 });
    setModalArea(true);
  };

  const handleEstado = async (reservaId, estado) => {
    try {
      await api.patch(`/condominios/${condominio.id}/reservas/${reservaId}/estado`, { estado, notas_admin: notasAdmin });
      toast.success(estado === 'aprobada' ? '✓ Reserva aprobada' : '✗ Reserva rechazada');
      setModalReserva(false); setNotasAdmin('');
      await loadReservas(condominio, areaActiva, calMes, calAnio);
      // recargar el día si está abierto
      if (modalDia) {
        const { data } = await api.get(`/condominios/${condominio.id}/reservas/disponibilidad`, { params: { area_id: areaActiva.id, mes: calMes, anio: calAnio } });
        setReservas(data);
        const nuevasDia = data.filter(r => (r.fecha?.split('T')[0] || r.fecha) === diaData.fecha);
        setDiaData(d => ({ ...d, reservas: nuevasDia }));
      }
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const pendientes = reservas.filter(r=>r.estado==='pendiente').length;
  const estadoColor = { pendiente:'badge-yellow', aprobada:'badge-green', rechazada:'badge-red', cancelada:'badge-red' };

  return (
    <Layout>
      <div style={{ padding:'32px' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'28px' }}>
          <div>
            <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Áreas Comunes</h1>
            <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>Reservas y disponibilidad de espacios</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditArea(null); setFormArea({ nombre:'', descripcion:'', capacidad:'', precio_reserva:'0', requiere_deposito:false, monto_deposito:'0' }); setModalArea(true); }}>
            + Nueva área
          </button>
        </div>

        {/* Áreas tabs */}
        {areas.length === 0 ? (
          <div className="card" style={{ padding:'64px', textAlign:'center', color:'var(--text2)' }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>🏊</div>
            <p style={{ marginBottom:'16px' }}>No hay áreas comunes configuradas</p>
            <button className="btn btn-primary" onClick={() => setModalArea(true)}>Agregar primera área</button>
          </div>
        ) : (
          <>
            {/* Selector de área */}
            <div style={{ display:'flex', gap:'8px', marginBottom:'24px', flexWrap:'wrap', alignItems:'center' }}>
              {areas.map(a => (
                <button key={a.id} onClick={() => setAreaActiva(a)} style={{
                  padding:'8px 16px', borderRadius:'20px', cursor:'pointer', fontWeight:'600', fontSize:'13px',
                  border: areaActiva?.id===a.id ? 'none' : '1px solid var(--border)',
                  background: areaActiva?.id===a.id ? 'var(--accent)' : 'var(--surface)',
                  color: areaActiva?.id===a.id ? '#fff' : 'var(--text2)',
                  boxShadow: areaActiva?.id===a.id ? '0 2px 8px rgba(176,138,78,.3)' : 'none',
                }}>
                  {a.nombre}
                  {areaActiva?.id===a.id && pendientes > 0 && (
                    <span style={{ marginLeft:'6px', background:'rgba(255,255,255,.3)', borderRadius:'10px', padding:'1px 6px', fontSize:'11px' }}>{pendientes}</span>
                  )}
                </button>
              ))}
              {areaActiva && (
                <button className="btn btn-ghost" style={{ padding:'6px 12px', fontSize:'12px', marginLeft:'auto' }}
                  onClick={() => abrirEditArea(areaActiva)}>✏ Editar área</button>
              )}
            </div>

            {areaActiva && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'24px' }}>
                {/* Calendario */}
                <div className="card" style={{ padding:'24px' }}>
                  {/* Nav mes */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
                    <button className="btn btn-ghost" style={{ padding:'6px 12px' }}
                      onClick={() => { if(calMes===1){setCalMes(12);setCalAnio(y=>y-1);}else setCalMes(m=>m-1); }}>← Anterior</button>
                    <span style={{ fontFamily:'DM Serif Display, serif', fontSize:'20px' }}>{MESES_NOMBRES[calMes-1]} {calAnio}</span>
                    <button className="btn btn-ghost" style={{ padding:'6px 12px' }}
                      onClick={() => { if(calMes===12){setCalMes(1);setCalAnio(y=>y+1);}else setCalMes(m=>m+1); }}>Siguiente →</button>
                  </div>

                  <Calendario
                    reservas={reservas}
                    anio={calAnio} mes={calMes}
                    areaId={areaActiva?.id}
                    onDiaClick={(fecha, rsDelDia) => { setDiaData({ fecha, reservas: rsDelDia }); setModalDia(true); }}
                  />

                  {/* Leyenda */}
                  <div style={{ display:'flex', gap:'16px', marginTop:'16px', paddingTop:'16px', borderTop:'1px solid var(--border)' }}>
                    {[
                      { color:'var(--green)', label:'Aprobada' },
                      { color:'var(--yellow)', label:'Pendiente' },
                      { color:'var(--border)', label:'Disponible' },
                    ].map(l => (
                      <div key={l.label} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--text2)' }}>
                        <div style={{ width:'10px', height:'10px', borderRadius:'2px', background:l.color }} />
                        {l.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Panel derecho — info del área y pendientes */}
                <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                  {/* Info área */}
                  <div className="card" style={{ padding:'20px' }}>
                    <div style={{ fontWeight:'700', fontSize:'16px', marginBottom:'8px' }}>{areaActiva.nombre}</div>
                    {areaActiva.descripcion && <div style={{ fontSize:'13px', color:'var(--text2)', marginBottom:'12px', lineHeight:'1.5' }}>{areaActiva.descripcion}</div>}
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                      {areaActiva.capacidad && (
                        <div style={{ fontSize:'13px' }}>👥 Capacidad: <strong>{areaActiva.capacidad} personas</strong></div>
                      )}
                      {parseFloat(areaActiva.precio_reserva||0) > 0 && (
                        <div style={{ fontSize:'13px' }}>💰 Precio: <strong>{moneda} {fmt(areaActiva.precio_reserva)}</strong></div>
                      )}
                      {areaActiva.requiere_deposito && (
                        <div style={{ fontSize:'13px' }}>🔒 Depósito: <strong>{moneda} {fmt(areaActiva.monto_deposito)}</strong></div>
                      )}
                    </div>
                  </div>

                  {/* Solicitudes pendientes */}
                  <div className="card" style={{ padding:'20px' }}>
                    <div style={{ fontWeight:'700', fontSize:'14px', marginBottom:'12px' }}>
                      Solicitudes pendientes
                      {pendientes > 0 && <span style={{ marginLeft:'8px', background:'var(--yellow)', color:'#fff', borderRadius:'10px', padding:'1px 8px', fontSize:'11px' }}>{pendientes}</span>}
                    </div>
                    {reservas.filter(r=>r.estado==='pendiente').length === 0 ? (
                      <div style={{ fontSize:'13px', color:'var(--text2)', textAlign:'center', padding:'16px 0' }}>Sin solicitudes pendientes ✓</div>
                    ) : (
                      reservas.filter(r=>r.estado==='pendiente').map(r => (
                        <div key={r.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'4px' }}>
                            <strong>Unidad {r.unidad_numero}</strong>
                            <span style={{ color:'var(--text2)' }}>{new Date(r.fecha).toLocaleDateString('es-DO', { day:'numeric', month:'short' })}</span>
                          </div>
                          <div style={{ fontSize:'12px', color:'var(--text2)', marginBottom:'6px' }}>
                            {r.hora_inicio?.slice(0,5)} – {r.hora_fin?.slice(0,5)}
                            {r.motivo && ` · ${r.motivo}`}
                          </div>
                          <div style={{ display:'flex', gap:'6px' }}>
                            <button className="btn btn-ghost" style={{ padding:'4px 10px', fontSize:'11px', color:'var(--green)', border:'1px solid var(--green)' }}
                              onClick={() => handleEstado(r.id, 'aprobada')}>✓ Aprobar</button>
                            <button className="btn btn-ghost" style={{ padding:'4px 10px', fontSize:'11px', color:'var(--red)', border:'1px solid rgba(220,38,38,.3)' }}
                              onClick={() => { setReservaSelected(r); setModalReserva(true); }}>✗ Rechazar</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal detalle del día */}
      {modalDia && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalDia(false)}>
          <div className="modal" style={{ maxWidth:'500px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'22px', marginBottom:'4px' }}>
              {new Date(diaData.fecha+'T12:00:00').toLocaleDateString('es-DO', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            </h2>
            <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'20px' }}>{areaActiva?.nombre}</p>

            {diaData.reservas.length === 0 ? (
              <div style={{ textAlign:'center', padding:'32px', color:'var(--text2)' }}>
                <div style={{ fontSize:'36px', marginBottom:'8px' }}>✅</div>
                <p>Día disponible — sin reservas</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {diaData.reservas.map(r => (
                  <div key={r.id} style={{ padding:'14px', borderRadius:'10px', border:'1px solid var(--border)', background:'var(--surface2)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                      <span style={{ fontWeight:'700' }}>Unidad {r.unidad_numero}</span>
                      <span className={`badge ${estadoColor[r.estado]||'badge-gold'}`}>{r.estado}</span>
                    </div>
                    <div style={{ fontSize:'13px', color:'var(--text2)', marginBottom:'6px' }}>
                      🕐 {r.hora_inicio?.slice(0,5)} – {r.hora_fin?.slice(0,5)}
                      {r.num_personas && ` · 👥 ${r.num_personas} personas`}
                    </div>
                    {r.motivo && <div style={{ fontSize:'12px', color:'var(--text2)' }}>📝 {r.motivo}</div>}
                    {r.estado === 'pendiente' && (
                      <div style={{ display:'flex', gap:'8px', marginTop:'10px' }}>
                        <button className="btn btn-ghost" style={{ padding:'4px 12px', fontSize:'12px', color:'var(--green)', border:'1px solid var(--green)', flex:1 }}
                          onClick={() => handleEstado(r.id, 'aprobada')}>✓ Aprobar</button>
                        <button className="btn btn-ghost" style={{ padding:'4px 12px', fontSize:'12px', color:'var(--red)', border:'1px solid rgba(220,38,38,.3)', flex:1 }}
                          onClick={() => { setReservaSelected(r); setModalReserva(true); }}>✗ Rechazar</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'20px' }}>
              <button className="btn btn-ghost" onClick={() => setModalDia(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal rechazar con nota */}
      {modalReserva && reservaSelected && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalReserva(false)}>
          <div className="modal" style={{ maxWidth:'420px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'22px', marginBottom:'8px' }}>Rechazar Reserva</h2>
            <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'20px' }}>
              Unidad {reservaSelected.unidad_numero} · {new Date(reservaSelected.fecha).toLocaleDateString('es-DO')} · {reservaSelected.hora_inicio?.slice(0,5)}–{reservaSelected.hora_fin?.slice(0,5)}
            </p>
            <div>
              <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Motivo del rechazo (opcional)</label>
              <textarea className="input" rows={3} style={{ resize:'vertical' }} placeholder="Ej: Área en mantenimiento, conflicto de horario..."
                value={notasAdmin} onChange={e => setNotasAdmin(e.target.value)} />
            </div>
            <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'20px' }}>
              <button className="btn btn-ghost" onClick={() => setModalReserva(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background:'var(--red)', borderColor:'var(--red)' }}
                onClick={() => handleEstado(reservaSelected.id, 'rechazada')}>Rechazar reserva</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar área */}
      {modalArea && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalArea(false)}>
          <div className="modal" style={{ maxWidth:'480px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'24px' }}>
              {editArea ? 'Editar área' : 'Nueva área común'}
            </h2>
            <form onSubmit={handleSaveArea}>
              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Nombre del área *</label>
                  <input className="input" required placeholder="Ej: Piscina, Área de eventos, Gimnasio"
                    value={formArea.nombre} onChange={e => setFormArea(f=>({...f,nombre:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Descripción</label>
                  <textarea className="input" rows={2} style={{ resize:'vertical' }} placeholder="Descripción, reglas de uso, etc."
                    value={formArea.descripcion} onChange={e => setFormArea(f=>({...f,descripcion:e.target.value}))} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Capacidad (personas)</label>
                    <input className="input" type="number" min="1" placeholder="Ej: 50"
                      value={formArea.capacidad} onChange={e => setFormArea(f=>({...f,capacidad:e.target.value}))} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Precio de reserva ({moneda})</label>
                    <input className="input" type="number" min="0" step="0.01"
                      value={formArea.precio_reserva} onChange={e => setFormArea(f=>({...f,precio_reserva:e.target.value}))} />
                  </div>
                </div>
                <div>
                  <label style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer' }}>
                    <input type="checkbox" checked={formArea.requiere_deposito} onChange={e => setFormArea(f=>({...f,requiere_deposito:e.target.checked}))} />
                    <span style={{ fontSize:'14px', fontWeight:'600' }}>Requiere depósito de garantía</span>
                  </label>
                  {formArea.requiere_deposito && (
                    <div style={{ marginTop:'10px' }}>
                      <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Monto del depósito ({moneda})</label>
                      <input className="input" type="number" min="0" step="0.01"
                        value={formArea.monto_deposito} onChange={e => setFormArea(f=>({...f,monto_deposito:e.target.value}))} />
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalArea(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : editArea ? 'Guardar cambios' : 'Crear área'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
