import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function AlertCard({ icon, titulo, cantidad, detalle, color, ruta, urgente }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(ruta)}
      style={{
        background:'var(--surface)', borderRadius:'12px', padding:'18px 20px',
        border: urgente ? `1.5px solid ${color}` : '1px solid var(--border)',
        cursor:'pointer', transition:'all .18s', position:'relative', overflow:'hidden',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 20px ${color}33`; e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = urgente ? color : 'var(--border)'; }}
    >
      <div style={{ position:'absolute', top:0, left:0, bottom:0, width:'4px', background:color, borderRadius:'4px 0 0 4px' }} />
      <div style={{ paddingLeft:'8px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            <span style={{ fontSize:'22px' }}>{icon}</span>
            <div>
              <div style={{ fontSize:'12px', color:'var(--text2)', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.8px' }}>{titulo}</div>
              <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', color, lineHeight:1.1 }}>{cantidad}</div>
            </div>
          </div>
          <span style={{ fontSize:'18px', color:'var(--text2)', marginTop:'4px' }}>→</span>
        </div>
        {detalle && <div style={{ fontSize:'12px', color:'var(--text2)', marginTop:'8px', paddingLeft:'32px' }}>{detalle}</div>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [condo, setCondo] = useState(null);
  const [stats, setStats] = useState(null);
  const [morosos, setMorosos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [reservasPendientes, setReservasPendientes] = useState([]);
  const [acuerdosActivos, setAcuerdosActivos] = useState([]);
  const [comprobantes, setComprobantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fmt = n => new Intl.NumberFormat('es-DO').format(parseFloat(n)||0);
  const now = new Date();

  useEffect(() => {
    api.get('/condominios').then(r => {
      const c = r.data[0]; if (!c) return;
      setCondo(c);
      return Promise.all([
        api.get(`/condominios/${c.id}/dashboard`),
        api.get(`/condominios/${c.id}/cuotas/morosos`),
        api.get(`/condominios/${c.id}/solicitudes`).catch(()=>({data:[]})),
        api.get(`/condominios/${c.id}/reservas`).catch(()=>({data:[]})),
        api.get(`/condominios/${c.id}/acuerdos`).catch(()=>({data:[]})),
        api.get(`/condominios/${c.id}/cuotas/${now.getFullYear()}-${now.getMonth()+1}/pagos-revision`).catch(()=>({data:[]})),
      ]);
    }).then(results => {
      if (!results) return;
      const [d, m, sol, res, ac] = results;
      setStats(d.data);
      setMorosos(m.data);
      setSolicitudes((sol.data||[]).filter(s => s.estado === 'pendiente' || s.estado === 'en_proceso'));
      setReservasPendientes((res.data||[]).filter(r => r.estado === 'pendiente'));
      setAcuerdosActivos((ac.data||[]).filter(a => a.estado === 'activo'));
    }).catch(console.error).finally(() => setLoading(false));

    // Cargar comprobantes en revisión por separado
    api.get('/condominios').then(r => {
      const c = r.data[0]; if (!c) return;
      return api.get(`/condominios/${c.id}/cuotas`).then(async periodos => {
        if (!periodos.data?.length) return;
        const ultimo = periodos.data[0];
        const pagos = await api.get(`/condominios/${c.id}/cuotas/${ultimo.id}/pagos`);
        const enRevision = (pagos.data||[]).filter(p => p.estado === 'en_revision');
        setComprobantes(enRevision);
      });
    }).catch(()=>{});
  }, []);

  const moneda = condo?.moneda || 'RD$';
  const porcentajePagado = condo?.total_unidades > 0
    ? Math.round(((stats?.unidades_pagadas||0) / condo.total_unidades) * 100)
    : 0;

  const alertas = [
    morosos.length > 0 && {
      icon:'⚠️', titulo:'Morosos pendientes', cantidad: morosos.length,
      detalle: `${moneda} ${fmt(morosos.reduce((s,m)=>s+parseFloat(m.monto_cuota||0)+parseFloat(m.monto_gas_comun||0)-parseFloat(m.monto_pagado||0),0))} por cobrar`,
      color:'var(--red)', ruta:'/admin/cuotas', urgente: morosos.length > 3,
    },
    comprobantes.length > 0 && {
      icon:'📎', titulo:'Comprobantes por verificar', cantidad: comprobantes.length,
      detalle: `${comprobantes.map(p=>'Unidad '+p.unidad_numero).join(', ')}`,
      color:'var(--yellow)', ruta:'/admin/cuotas', urgente: true,
    },
    reservasPendientes.length > 0 && {
      icon:'📅', titulo:'Reservas por aprobar', cantidad: reservasPendientes.length,
      detalle: reservasPendientes.slice(0,3).map(r=>`${r.area_nombre||'Área'} · ${r.unidad_numero ? 'Unidad '+r.unidad_numero : ''}`).join(' | '),
      color:'var(--blue)', ruta:'/admin/reservas', urgente: false,
    },
    solicitudes.length > 0 && {
      icon:'📩', titulo:'Solicitudes sin responder', cantidad: solicitudes.length,
      detalle: solicitudes.slice(0,2).map(s=>s.asunto).join(' · '),
      color:'var(--accent)', ruta:'/admin/solicitudes', urgente: solicitudes.some(s=>s.tipo==='emergencia'),
    },
    acuerdosActivos.length > 0 && {
      icon:'🤝', titulo:'Acuerdos de pago activos', cantidad: acuerdosActivos.length,
      detalle: `${moneda} ${fmt(acuerdosActivos.reduce((s,a)=>s+parseFloat(a.total_deuda||0)-parseFloat(a.total_abonado||0),0))} en saldo pendiente`,
      color:'var(--green)', ruta:'/admin/acuerdos', urgente: false,
    },
  ].filter(Boolean);

  return (
    <Layout>
      <div style={{ padding:'32px' }}>

        {/* Header */}
        <div style={{ marginBottom:'28px', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
          <div>
            <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'30px', margin:0 }}>{condo?.nombre || 'Dashboard'}</h1>
            <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>
              {now.toLocaleDateString('es-DO', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            </p>
          </div>
          {!loading && alertas.length === 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'#dcfce7', borderRadius:'20px', padding:'8px 16px' }}>
              <span>✅</span>
              <span style={{ fontSize:'13px', color:'#16a34a', fontWeight:'600' }}>Todo al día</span>
            </div>
          )}
        </div>

        {/* Stats principales */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'28px' }}>
          {[
            { label:'Ingresos del mes', val:`${moneda} ${fmt(stats?.ingresos_mes)}`, sub:'Cuotas cobradas', color:'var(--accent)', ruta:'/admin/cuotas' },
            { label:'Pagados', val:`${stats?.unidades_pagadas||0} / ${condo?.total_unidades||0}`, sub:`${porcentajePagado}% del total`, color:'var(--green)', ruta:'/admin/cuotas' },
            { label:'Gastos del mes', val:`${moneda} ${fmt(stats?.gastos_mes)}`, sub:'Total egresos', color:'var(--blue)', ruta:'/admin/gastos' },
            { label:'Empleados activos', val:stats?.empleados_activos||0, sub:'En nómina', color:'var(--text2)', ruta:'/admin/empleados' },
          ].map(s => (
            <div key={s.label} className="card" onClick={() => navigate(s.ruta)}
              style={{ padding:'18px 22px', cursor:'pointer', position:'relative', overflow:'hidden', transition:'all .15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:s.color }} />
              <div style={{ fontSize:'11px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>{s.label}</div>
              <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', color:s.color }}>{loading ? '...' : s.val}</div>
              <div style={{ fontSize:'12px', color:'var(--text2)', marginTop:'2px' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Barra de cobro del mes */}
        {!loading && condo && (
          <div className="card" style={{ padding:'18px 24px', marginBottom:'28px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
              <span style={{ fontWeight:'600', fontSize:'14px' }}>Recaudación del mes</span>
              <span style={{ fontSize:'13px', color:'var(--text2)' }}>{stats?.unidades_pagadas||0} de {condo.total_unidades} unidades</span>
            </div>
            <div style={{ height:'10px', background:'var(--surface2)', borderRadius:'5px', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${porcentajePagado}%`, background: porcentajePagado >= 80 ? 'var(--green)' : porcentajePagado >= 50 ? 'var(--accent)' : 'var(--red)', borderRadius:'5px', transition:'width .5s' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:'8px', fontSize:'12px', color:'var(--text2)' }}>
              <span style={{ color: porcentajePagado >= 80 ? 'var(--green)' : 'var(--accent)', fontWeight:'600' }}>{porcentajePagado}% cobrado</span>
              <span>Meta: 100%</span>
            </div>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px' }}>

          {/* Alertas y pendientes */}
          <div>
            <div style={{ fontWeight:'700', fontSize:'14px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span>🔔</span> Pendientes de atención
              {alertas.length > 0 && <span style={{ background:'var(--red)', color:'#fff', borderRadius:'10px', padding:'1px 8px', fontSize:'11px' }}>{alertas.length}</span>}
            </div>
            {loading ? (
              <div style={{ color:'var(--text2)', fontSize:'13px', padding:'20px 0' }}>Cargando...</div>
            ) : alertas.length === 0 ? (
              <div className="card" style={{ padding:'32px', textAlign:'center', color:'var(--text2)' }}>
                <div style={{ fontSize:'36px', marginBottom:'8px' }}>✅</div>
                <p style={{ fontSize:'14px', fontWeight:'600', color:'var(--green)' }}>¡Sin pendientes!</p>
                <p style={{ fontSize:'12px', marginTop:'4px' }}>Todo está al día hoy.</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {alertas.map((a, i) => <AlertCard key={i} {...a} />)}
              </div>
            )}
          </div>

          {/* Panel derecho */}
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

            {/* Morosos recientes */}
            <div className="card">
              <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:'600', fontSize:'14px' }}>Morosos del mes</span>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <span className="badge badge-red">{morosos.length}</span>
                  <button className="btn btn-ghost" style={{ padding:'3px 10px', fontSize:'11px' }} onClick={() => navigate('/admin/cuotas')}>Ver todos →</button>
                </div>
              </div>
              {morosos.length === 0 ? (
                <div style={{ padding:'20px', textAlign:'center', color:'var(--text2)', fontSize:'13px' }}>✅ Sin morosos este mes</div>
              ) : (
                morosos.slice(0,5).map((m, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 20px', borderBottom:'1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight:'600', fontSize:'13px' }}>Unidad {m.numero}</div>
                      <div style={{ fontSize:'11px', color:'var(--text2)' }}>{m.residentes?.[0]?.nombre} {m.residentes?.[0]?.apellido}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'13px', fontWeight:'700', color:'var(--red)' }}>
                        {moneda} {fmt(parseFloat(m.monto_cuota||0)+parseFloat(m.monto_gas_comun||0)-parseFloat(m.monto_pagado||0))}
                      </div>
                      <span className={`badge ${m.dias_atraso > 0 ? (m.dias_atraso > 30 ? 'badge-red' : 'badge-yellow') : 'badge-blue'}`} style={{ fontSize:'10px' }}>
                        {m.dias_atraso > 0 ? `${m.dias_atraso}d vencido` : m.estado === 'en_revision' ? 'En revisión' : 'Por vencer'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reservas próximas aprobadas */}
            <div className="card">
              <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:'600', fontSize:'14px' }}>Reservas próximas</span>
                <button className="btn btn-ghost" style={{ padding:'3px 10px', fontSize:'11px' }} onClick={() => navigate('/admin/reservas')}>Ver calendario →</button>
              </div>
              {reservasPendientes.length === 0 ? (
                <div style={{ padding:'20px', textAlign:'center', color:'var(--text2)', fontSize:'13px' }}>Sin reservas pendientes ✓</div>
              ) : (
                reservasPendientes.slice(0,4).map(r => (
                  <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 20px', borderBottom:'1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight:'600', fontSize:'13px' }}>{r.area_nombre}</div>
                      <div style={{ fontSize:'11px', color:'var(--text2)' }}>
                        Unidad {r.unidad_numero} · {r.hora_inicio?.slice(0,5)}–{r.hora_fin?.slice(0,5)}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'12px', color:'var(--text2)' }}>
                        {r.fecha ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-DO',{day:'numeric',month:'short'}) : '—'}
                      </div>
                      <span className="badge badge-yellow" style={{ fontSize:'10px' }}>Pendiente</span>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>

        {/* Módulos rápidos */}
        <div style={{ marginTop:'24px' }}>
          <div style={{ fontWeight:'700', fontSize:'14px', marginBottom:'14px' }}>Accesos rápidos</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'10px' }}>
            {[
              { icon:'💰', label:'Cuotas', ruta:'/admin/cuotas' },
              { icon:'📋', label:'Gastos', ruta:'/admin/gastos' },
              { icon:'👷', label:'Empleados', ruta:'/admin/empleados' },
              { icon:'📊', label:'Contabilidad', ruta:'/admin/contabilidad' },
              { icon:'📩', label:'Solicitudes', ruta:'/admin/solicitudes' },
              { icon:'📢', label:'Anuncios', ruta:'/admin/anuncios' },
              { icon:'🤝', label:'Acuerdos', ruta:'/admin/acuerdos' },
              { icon:'🏊', label:'Áreas', ruta:'/admin/reservas' },
              { icon:'🏠', label:'Residentes', ruta:'/admin/residentes' },
            ].map(m => (
              <div key={m.ruta} onClick={() => navigate(m.ruta)}
                className="card"
                style={{ padding:'14px 10px', textAlign:'center', cursor:'pointer', transition:'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background='var(--accent)'; e.currentTarget.querySelector('div').style.color='#fff'; e.currentTarget.querySelector('span').style.color='#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background='var(--surface)'; e.currentTarget.querySelector('div').style.color='var(--text2)'; e.currentTarget.querySelector('span').style.color='inherit'; }}>
                <span style={{ fontSize:'24px', display:'block', marginBottom:'6px' }}>{m.icon}</span>
                <div style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', transition:'color .15s' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </Layout>
  );
}
