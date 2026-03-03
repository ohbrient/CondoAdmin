import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function Contabilidad() {
  const [condoId, setCondoId]   = useState(null);
  const [moneda, setMoneda]     = useState('RD$');
  const [condoNombre, setCondoNombre] = useState('');
  const [mes, setMes]           = useState(new Date().getMonth() + 1);
  const [año, setAño]           = useState(new Date().getFullYear());
  const [stats, setStats]       = useState(null);
  const [gastos, setGastos]     = useState([]);
  const [resumen, setResumen]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [exportando, setExportando] = useState(false);

  const load = async (cid, m, y) => {
    setLoading(true);
    try {
      const [d, g, r] = await Promise.all([
        api.get(`/condominios/${cid}/dashboard`),
        api.get(`/condominios/${cid}/gastos?mes=${m}&año=${y}`),
        api.get(`/condominios/${cid}/gastos/resumen?año=${y}`),
      ]);
      setStats(d.data);
      setGastos(g.data);
      setResumen(r.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.get('/condominios').then(r => {
      const c = r.data[0]; if (!c) return;
      setCondoId(c.id);
      setMoneda(c.moneda || 'RD$');
      setCondoNombre(c.nombre || '');
      load(c.id, mes, año);
    });
  }, []);

  useEffect(() => { if (condoId) load(condoId, mes, año); }, [mes, año]);

  const fmt = n => new Intl.NumberFormat('es-DO').format(parseFloat(n) || 0);
  const totalGastos = gastos.reduce((s, g) => s + parseFloat(g.monto || 0), 0);
  const ingresos    = parseFloat(stats?.ingresos_mes || 0);
  const superavit   = ingresos - totalGastos;

  // Gastos agrupados por categoría
  const gastosPorCategoria = Object.entries(
    gastos.reduce((acc, g) => {
      acc[g.categoria] = (acc[g.categoria] || 0) + parseFloat(g.monto || 0);
      return acc;
    }, {})
  );

  // ──────────────────────────────────────────────
  // EXPORTAR PDF — genera HTML y abre ventana de impresión
  // ──────────────────────────────────────────────
  const exportarPDF = () => {
    setExportando(true);

    const totalAnual = resumen.reduce((s, x) => s + parseFloat(x.total || 0), 0);
    const mesNombre  = meses[mes - 1];
    const fechaGen   = new Date().toLocaleDateString('es-DO', { year:'numeric', month:'long', day:'numeric' });

    const filasGastos = gastosPorCategoria.length
      ? gastosPorCategoria.map(([cat, total]) => `
          <tr>
            <td style="text-transform:capitalize;">${cat}</td>
            <td style="text-align:right; color:#c0392b; font-weight:600;">${moneda} ${fmt(total)}</td>
          </tr>`).join('')
      : `<tr><td colspan="2" style="color:#999; font-style:italic;">Sin gastos registrados</td></tr>`;

    const filasResumen = resumen.slice(0, 6).map(r => {
      const pct = totalAnual > 0 ? Math.round(parseFloat(r.total) / totalAnual * 100) : 0;
      return `
        <tr>
          <td style="text-transform:capitalize;">${r.categoria}</td>
          <td style="text-align:right;">${moneda} ${fmt(r.total)}</td>
          <td style="text-align:right;">${pct}%</td>
        </tr>`;
    }).join('');

    const colorResultado = superavit >= 0 ? '#27ae60' : '#e74c3c';
    const labelResultado = superavit >= 0 ? 'Superávit del período' : 'Déficit del período';
    const signo          = superavit >= 0 ? '+' : '-';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Balance Contable — ${mesNombre} ${año}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 36px 44px; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 18px; border-bottom: 3px solid #1a1d2e; }
    .brand { font-size: 22px; font-weight: 800; color: #1a1d2e; letter-spacing: -0.5px; }
    .brand span { color: #b8860b; }
    .brand-sub { font-size: 11px; color: #888; margin-top: 2px; }
    .header-right { text-align: right; font-size: 11px; color: #666; line-height: 1.6; }
    .header-right strong { font-size: 13px; color: #1a1d2e; }

    /* Resultado banner */
    .resultado { background: #1a1d2e; color: #fff; border-radius: 10px; padding: 22px 28px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: center; }
    .resultado-label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.6; margin-bottom: 4px; }
    .resultado-valor { font-size: 36px; font-weight: 800; color: ${colorResultado}; }
    .resultado-tipo  { font-size: 13px; opacity: 0.7; margin-top: 4px; }
    .resultado-stats { display: flex; gap: 28px; }
    .stat-box { text-align: center; }
    .stat-box .val { font-size: 22px; font-weight: 700; }
    .stat-box .lbl { font-size: 10px; opacity: 0.6; text-transform: uppercase; margin-top: 2px; }

    /* Grid 2 cols */
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .card { border: 1px solid #e8e8e8; border-radius: 8px; overflow: hidden; }
    .card-header { background: #f5f5f5; padding: 11px 18px; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #444; border-bottom: 1px solid #e8e8e8; }
    .card table { width: 100%; border-collapse: collapse; }
    .card table td { padding: 9px 18px; border-bottom: 1px solid #f0f0f0; font-size: 12.5px; }
    .card table tr:last-child td { border-bottom: none; }
    .total-row td { font-weight: 700 !important; background: #fafafa; font-size: 13px !important; padding-top: 12px !important; }

    /* Resumen anual */
    .anual-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .anual-stat { border: 1px solid #e8e8e8; border-radius: 8px; padding: 14px 16px; }
    .anual-stat .as-label { font-size: 11px; color: #888; margin-bottom: 4px; }
    .anual-stat .as-val   { font-size: 26px; font-weight: 800; }

    /* Tabla detalle gastos */
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #444; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #f0f0f0; }
    table.detalle { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.detalle thead th { background: #1a1d2e; color: #fff; padding: 9px 14px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    table.detalle tbody tr:nth-child(even) { background: #fafafa; }
    table.detalle tbody td { padding: 8px 14px; border-bottom: 1px solid #f0f0f0; }
    table.detalle tfoot td { background: #f0f0f0; font-weight: 700; padding: 10px 14px; }

    /* Footer */
    .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e8e8e8; display: flex; justify-content: space-between; font-size: 10px; color: #aaa; }
    .footer strong { color: #888; }

    @media print {
      body { padding: 20px 28px; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>

  <!-- ENCABEZADO -->
  <div class="header">
    <div>
      <div class="brand">Condo<span>Admin</span> <span style="font-size:12px; background:#b8860b; color:#fff; padding:2px 7px; border-radius:4px; vertical-align:middle;">PRO</span></div>
      <div class="brand-sub">Sistema de Administración de Condominios</div>
    </div>
    <div class="header-right">
      <strong>${condoNombre || 'Condominio'}</strong><br/>
      Balance Financiero — ${mesNombre} ${año}<br/>
      Generado el ${fechaGen}
    </div>
  </div>

  <!-- RESULTADO BANNER -->
  <div class="resultado">
    <div>
      <div class="resultado-label">Resultado ${mesNombre} ${año}</div>
      <div class="resultado-valor">${signo} ${moneda} ${fmt(Math.abs(superavit))}</div>
      <div class="resultado-tipo">${labelResultado}</div>
    </div>
    <div class="resultado-stats">
      <div class="stat-box">
        <div class="val" style="color:#27ae60;">${moneda} ${fmt(ingresos)}</div>
        <div class="lbl">Total ingresos</div>
      </div>
      <div class="stat-box">
        <div class="val" style="color:#e74c3c;">${moneda} ${fmt(totalGastos)}</div>
        <div class="lbl">Total egresos</div>
      </div>
    </div>
  </div>

  <!-- INGRESOS / EGRESOS -->
  <div class="grid2">
    <div class="card">
      <div class="card-header">📈 Ingresos</div>
      <table>
        <tr><td>Cuotas cobradas</td><td style="text-align:right; color:#27ae60; font-weight:600;">${moneda} ${fmt(ingresos)}</td></tr>
        <tr><td>Multas / recargos</td><td style="text-align:right; color:#27ae60;">${moneda} 0</td></tr>
        <tr><td>Otros ingresos</td><td style="text-align:right; color:#27ae60;">${moneda} 0</td></tr>
        <tr class="total-row"><td>Total ingresos</td><td style="text-align:right; color:#27ae60;">${moneda} ${fmt(ingresos)}</td></tr>
      </table>
    </div>
    <div class="card">
      <div class="card-header">📉 Egresos</div>
      <table>
        ${filasGastos}
        <tr class="total-row"><td>Total egresos</td><td style="text-align:right; color:#c0392b;">${moneda} ${fmt(totalGastos)}</td></tr>
      </table>
    </div>
  </div>

  <!-- RESUMEN ANUAL KPIs -->
  <div class="section-title">Resumen Anual ${año}</div>
  <div class="anual-grid" style="margin-bottom:24px;">
    <div class="anual-stat">
      <div class="as-label">Morosos activos</div>
      <div class="as-val" style="color:#e74c3c;">${stats?.morosos || 0}</div>
    </div>
    <div class="anual-stat">
      <div class="as-label">Unidades pagadas (mes)</div>
      <div class="as-val" style="color:#27ae60;">${stats?.unidades_pagadas || 0}</div>
    </div>
    <div class="anual-stat">
      <div class="as-label">Empleados activos</div>
      <div class="as-val" style="color:#2980b9;">${stats?.empleados_activos || 0}</div>
    </div>
  </div>

  <!-- DETALLE GASTOS DEL MES -->
  <div class="section-title">Detalle de Gastos — ${mesNombre} ${año}</div>
  ${gastos.length === 0 ? '<p style="color:#aaa; font-style:italic; margin-bottom:20px;">No hay gastos registrados para este período.</p>' : `
  <table class="detalle" style="margin-bottom:24px;">
    <thead>
      <tr>
        <th>Descripción</th>
        <th>Categoría</th>
        <th style="text-align:right;">Monto</th>
        <th>Fecha</th>
      </tr>
    </thead>
    <tbody>
      ${gastos.map(g => `
        <tr>
          <td>${g.descripcion || '—'}</td>
          <td style="text-transform:capitalize;">${g.categoria || '—'}</td>
          <td style="text-align:right; color:#c0392b; font-weight:600;">${moneda} ${fmt(g.monto)}</td>
          <td style="color:#888;">${g.fecha ? new Date(g.fecha).toLocaleDateString('es-DO') : '—'}</td>
        </tr>`).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2">Total</td>
        <td style="text-align:right; color:#c0392b;">${moneda} ${fmt(totalGastos)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>`}

  <!-- DISTRIBUCIÓN ANUAL DE GASTOS -->
  ${resumen.length > 0 ? `
  <div class="section-title">Distribución de Gastos Anual ${año}</div>
  <table class="detalle">
    <thead>
      <tr>
        <th>Categoría</th>
        <th style="text-align:right;">Total ${año}</th>
        <th style="text-align:right;">% del total</th>
      </tr>
    </thead>
    <tbody>${filasResumen}</tbody>
    <tfoot>
      <tr>
        <td>Total anual</td>
        <td style="text-align:right;">${moneda} ${fmt(totalAnual)}</td>
        <td style="text-align:right;">100%</td>
      </tr>
    </tfoot>
  </table>` : ''}

  <!-- FOOTER -->
  <div class="footer">
    <span><strong>CondoAdmin PRO</strong> — Sistema de Administración de Condominios</span>
    <span>Balance ${mesNombre} ${año} · Página 1</span>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</body>
</html>`;

    const ventana = window.open('', '_blank', 'width=900,height=700');
    ventana.document.write(html);
    ventana.document.close();

    setTimeout(() => setExportando(false), 1000);
  };

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────
  return (
    <Layout>
      <div style={{ padding: '32px' }}>
        {/* Encabezado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '28px', margin: 0 }}>Contabilidad</h1>
            <p style={{ color: 'var(--text2)', fontSize: '14px', marginTop: '4px' }}>Balance financiero del condominio</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select className="input" value={mes} onChange={e => setMes(e.target.value)} style={{ maxWidth: '150px' }}>
              {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className="input" value={año} onChange={e => setAño(e.target.value)} style={{ maxWidth: '100px' }}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            {/* BOTÓN EXPORTAR PDF */}
            <button
              onClick={exportarPDF}
              disabled={loading || exportando}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: exportando ? '#888' : 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '14px',
                cursor: loading || exportando ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              <span style={{ fontSize: '16px' }}>📄</span>
              {exportando ? 'Generando...' : 'Exportar PDF'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text2)' }}>Cargando...</div>
        ) : (
          <>
            {/* Resultado del mes */}
            <div className="card" style={{ padding: '32px', marginBottom: '24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: superavit >= 0 ? 'var(--green)' : 'var(--red)' }} />
              <div style={{ fontSize: '12px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>
                Resultado {meses[mes - 1]} {año}
              </div>
              <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '52px', color: superavit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {superavit >= 0 ? '+' : ''}{moneda} {fmt(Math.abs(superavit))}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text2)', marginTop: '8px' }}>
                {superavit >= 0 ? 'Superávit del período' : 'Déficit del período'}
              </div>
            </div>

            {/* 3 columnas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>

              {/* Ingresos */}
              <div className="card">
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>Ingresos</div>
                </div>
                <div style={{ padding: '20px 24px' }}>
                  {[
                    { label: 'Cuotas cobradas',  val: ingresos, color: 'var(--green)' },
                    { label: 'Multas / recargos', val: 0,        color: 'var(--green)' },
                    { label: 'Otros ingresos',    val: 0,        color: 'var(--green)' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text2)' }}>{row.label}</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: row.color }}>{moneda} {fmt(row.val)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 0', marginTop: '4px' }}>
                    <span style={{ fontWeight: '700', fontSize: '14px' }}>Total ingresos</span>
                    <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '22px', color: 'var(--green)' }}>{moneda} {fmt(ingresos)}</span>
                  </div>
                </div>
              </div>

              {/* Egresos */}
              <div className="card">
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>Egresos</div>
                </div>
                <div style={{ padding: '20px 24px' }}>
                  {gastosPorCategoria.length === 0 ? (
                    <div style={{ color: 'var(--text2)', fontSize: '13px', padding: '16px 0' }}>Sin gastos registrados</div>
                  ) : (
                    gastosPorCategoria.map(([cat, total]) => (
                      <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text2)', textTransform: 'capitalize' }}>{cat}</span>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--red)' }}>{moneda} {fmt(total)}</span>
                      </div>
                    ))
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 0', marginTop: '4px' }}>
                    <span style={{ fontWeight: '700', fontSize: '14px' }}>Total egresos</span>
                    <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '22px', color: 'var(--red)' }}>{moneda} {fmt(totalGastos)}</span>
                  </div>
                </div>
              </div>

              {/* Resumen anual */}
              <div className="card">
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>Resumen anual {año}</div>
                </div>
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {[
                    { label: 'Morosos activos',    val: stats?.morosos            || 0, color: 'var(--red)'   },
                    { label: 'Unidades pagadas',   val: stats?.unidades_pagadas   || 0, color: 'var(--green)' },
                    { label: 'Empleados activos',  val: stats?.empleados_activos  || 0, color: 'var(--blue)'  },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--surface2)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '13px' }}>{row.label}</span>
                      <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '24px', color: row.color }}>{row.val}</span>
                    </div>
                  ))}

                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Gastos por categoría ({año})
                    </div>
                    {resumen.slice(0, 5).map(r => {
                      const totalAnual = resumen.reduce((s, x) => s + parseFloat(x.total || 0), 0);
                      const pct = totalAnual > 0 ? Math.round(parseFloat(r.total) / totalAnual * 100) : 0;
                      return (
                        <div key={r.categoria} style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                            <span style={{ textTransform: 'capitalize', color: 'var(--text2)' }}>{r.categoria}</span>
                            <span style={{ fontWeight: '600' }}>{pct}%</span>
                          </div>
                          <div style={{ background: 'var(--surface2)', borderRadius: '3px', height: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '3px', width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}