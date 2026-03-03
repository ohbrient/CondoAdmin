import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const fmt = n => parseFloat(n||0).toLocaleString('es-DO', { minimumFractionDigits:2, maximumFractionDigits:2 });

export default function ResidenteUnidades() {
  const [unidades, setUnidades] = useState([]);
  const [pagos, setPagos]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/residente/mi-unidad-todas'),
      api.get('/residente/mi-cuenta'),
    ]).then(([u, p]) => {
      // mi-unidad-todas puede devolver array o single — normalizamos
      const arr = Array.isArray(u.data) ? u.data : u.data ? [u.data] : [];
      setUnidades(arr);
      setPagos(p.data || []);
      if (arr.length > 0) setSelected(arr[0]);
    }).catch(() => {
      // fallback: usar mi-unidad (single)
      Promise.all([
        api.get('/residente/mi-unidad'),
        api.get('/residente/mi-cuenta'),
      ]).then(([u, p]) => {
        const arr = u.data ? [u.data] : [];
        setUnidades(arr);
        setPagos(p.data || []);
        if (arr.length > 0) setSelected(arr[0]);
      }).catch(console.error);
    }).finally(() => setLoading(false));
  }, []);

  const pagosDeUnidad = (unidadNumero) =>
    pagos.filter(p => p.unidad_numero === unidadNumero || unidades.length === 1);

  const estadoColor = { pagado:'badge-green', parcial:'badge-yellow', pendiente:'badge-red', en_revision:'badge-blue', abierta:'badge-red' };

  if (loading) return (
    <Layout>
      <div style={{ padding:'32px', textAlign:'center', color:'var(--text2)' }}>Cargando...</div>
    </Layout>
  );

  return (
    <Layout>
      <div style={{ padding:'32px', maxWidth:'960px' }}>
        <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:'0 0 6px' }}>Mis Unidades</h1>
        <p style={{ color:'var(--text2)', fontSize:'14px', marginBottom:'28px' }}>
          {unidades.length === 0 ? 'No tienes unidades asignadas' : `${unidades.length} unidad${unidades.length > 1 ? 'es asignadas' : ' asignada'}`}
        </p>

        {unidades.length === 0 ? (
          <div className="card" style={{ padding:'64px', textAlign:'center' }}>
            <div style={{ fontSize:'52px', marginBottom:'16px' }}>🏢</div>
            <div style={{ fontWeight:'700', fontSize:'16px' }}>Sin unidades asignadas</div>
            <p style={{ color:'var(--text2)', marginTop:'8px' }}>Contacta a la administración para que te asignen tu unidad.</p>
          </div>
        ) : (
          <div style={{ display:'flex', gap:'24px', alignItems:'flex-start' }}>

            {/* Lista de unidades (sidebar si tiene más de 1) */}
            {unidades.length > 1 && (
              <div style={{ width:'200px', flexShrink:0, display:'flex', flexDirection:'column', gap:'10px' }}>
                {unidades.map(u => (
                  <div key={u.id} onClick={() => setSelected(u)}
                    className="card"
                    style={{
                      padding:'14px 16px', cursor:'pointer',
                      border: selected?.id === u.id ? '2px solid var(--accent)' : '2px solid transparent',
                      background: selected?.id === u.id ? 'rgba(176,138,78,.06)' : undefined,
                    }}>
                    <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'22px' }}>{u.numero}</div>
                    <div style={{ fontSize:'12px', color:'var(--text2)', textTransform:'capitalize' }}>{u.tipo}</div>
                    <div style={{ fontSize:'11px', color:'var(--text2)', marginTop:'2px' }}>{u.condominio_nombre}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Detalle de la unidad seleccionada */}
            {selected && (
              <div style={{ flex:1 }}>
                {/* Header card */}
                <div className="card" style={{ padding:'24px 28px', marginBottom:'20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'16px' }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'baseline', gap:'12px', marginBottom:'6px' }}>
                        <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'36px' }}>Unidad {selected.numero}</div>
                        <span className={`badge ${selected.es_propietario ? 'badge-gold' : 'badge-blue'}`}>
                          {selected.es_propietario ? '🏠 Propietario' : '🔑 Inquilino'}
                        </span>
                      </div>
                      <div style={{ color:'var(--text2)', fontSize:'14px' }}>{selected.condominio_nombre}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'11px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Cuota mensual</div>
                      <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', color:'var(--accent)' }}>
                        {selected.moneda} {fmt(selected.cuota_base)}
                      </div>
                    </div>
                  </div>

                  {/* Datos de la unidad */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'12px', marginTop:'20px' }}>
                    {[
                      { label:'Tipo', value: selected.tipo ? selected.tipo.charAt(0).toUpperCase()+selected.tipo.slice(1) : '—' },
                      { label:'Piso', value: selected.piso || '—' },
                      { label:'Área', value: selected.metros_cuadrados ? `${selected.metros_cuadrados} m²` : '—' },
                      { label:'Estado', value: selected.estado ? selected.estado.charAt(0).toUpperCase()+selected.estado.slice(1) : '—' },
                    ].map(d => (
                      <div key={d.label} style={{ background:'var(--surface2)', borderRadius:'8px', padding:'10px 14px' }}>
                        <div style={{ fontSize:'10px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'3px' }}>{d.label}</div>
                        <div style={{ fontWeight:'700', fontSize:'14px' }}>{d.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Historial de pagos de esta unidad */}
                <div className="card" style={{ overflow:'hidden' }}>
                  <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border)', fontWeight:'700', fontSize:'14px' }}>
                    📋 Historial de cobros
                  </div>
                  {pagosDeUnidad(selected.numero).length === 0 ? (
                    <div style={{ padding:'40px', textAlign:'center', color:'var(--text2)' }}>
                      <div style={{ fontSize:'36px', marginBottom:'10px' }}>💰</div>
                      <p>Sin cobros registrados para esta unidad.</p>
                    </div>
                  ) : (
                    pagosDeUnidad(selected.numero).map((p, i) => {
                      const gas   = parseFloat(p.monto_gas_comun||0);
                      const total = parseFloat(p.monto_cuota||0) + gas;
                      const pagado = parseFloat(p.monto_pagado||0);
                      return (
                        <div key={p.id} style={{
                          display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr',
                          alignItems:'center', gap:'16px', padding:'14px 24px',
                          borderBottom: i < pagosDeUnidad(selected.numero).length-1 ? '1px solid var(--border)' : 'none',
                          background: i%2===0 ? 'transparent' : 'var(--surface2)',
                        }}>
                          <div>
                            <div style={{ fontWeight:'700', fontSize:'14px' }}>{MESES[(p.mes||1)-1]} {p.anio}</div>
                            {p.fecha_pago && (
                              <div style={{ fontSize:'11px', color:'var(--text2)' }}>
                                Pagado: {new Date(p.fecha_pago+'T12:00:00').toLocaleDateString('es-DO')}
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize:'11px', color:'var(--text2)', marginBottom:'2px' }}>Total</div>
                            <div style={{ fontWeight:'700' }}>{p.moneda} {fmt(total)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize:'11px', color:'var(--text2)', marginBottom:'2px' }}>Pagado</div>
                            <div style={{ fontWeight:'700', color: p.estado==='pagado' ? 'var(--green)' : 'var(--yellow)' }}>{p.moneda} {fmt(pagado)}</div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <span className={`badge ${estadoColor[p.estado]||'badge-gold'}`} style={{ fontSize:'11px' }}>
                              {p.estado === 'pagado' ? '✓ Pagado' : p.estado === 'parcial' ? 'Parcial' : p.estado === 'en_revision' ? '⏳ Revisión' : 'Pendiente'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
