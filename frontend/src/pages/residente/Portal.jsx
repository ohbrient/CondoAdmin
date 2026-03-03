import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function generarFacturaPDF(pago, unidad) {
  const fmt = n => new Intl.NumberFormat('es-DO').format(parseFloat(n)||0);
  const hoy = new Date().toLocaleDateString('es-DO', { day:'numeric', month:'long', year:'numeric' });
  const mesNombre = MESES[(pago.mes||1)-1];
  const moneda = pago.moneda || 'RD$';
  const gasComun = parseFloat(pago.monto_gas_comun||0);
  const totalCobro = parseFloat(pago.monto_cuota||0) + gasComun;
  const saldo = totalCobro - parseFloat(pago.monto_pagado||0);
  const isPagado = pago.estado === 'pagado';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura ${mesNombre} ${pago.anio} — Unidad ${unidad?.numero}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #1a1d2e; background: #fff; }
    .page { width: 680px; margin: 0 auto; padding: 40px; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid #b08a4e; margin-bottom: 28px; }
    .logo-txt { font-size: 28px; font-weight: 700; color: #b08a4e; }
    .logo-sub { font-size: 10px; color: #6b7280; letter-spacing: 3px; text-transform: uppercase; margin-top: 2px; }
    .condo-name { font-size: 14px; font-weight: 600; margin-top: 8px; }
    .condo-addr { font-size: 12px; color: #6b7280; }
    .factura-title { text-align: right; }
    .factura-title h2 { font-size: 20px; font-weight: 700; letter-spacing: 1px; }
    .factura-title p { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .factura-num { color: #b08a4e; font-weight: 700; margin-top: 6px; }

    .estado-banner { padding: 10px 20px; border-radius: 8px; margin-bottom: 24px; font-size: 13px; font-weight: 700; letter-spacing: .5px; text-align: center; text-transform: uppercase; }
    .estado-pagado { background: #dcfce7; color: #16a34a; border: 1px solid #86efac; }
    .estado-pendiente { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
    .estado-parcial { background: #fef9c3; color: #ca8a04; border: 1px solid #fde047; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px; }
    .info-box { background: #f8f9fc; border-radius: 10px; padding: 16px 20px; border: 1px solid #e2e6ef; }
    .info-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; font-weight: 700; margin-bottom: 10px; }
    .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
    .info-row span:first-child { color: #6b7280; }
    .info-row span:last-child { font-weight: 600; }

    .detalle-section { margin-bottom: 28px; }
    .detalle-section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 700; margin-bottom: 12px; }
    .detalle-table { width: 100%; border-collapse: collapse; }
    .detalle-table th { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; padding: 8px 12px; text-align: left; background: #f8f9fc; border-bottom: 2px solid #e2e6ef; }
    .detalle-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #e2e6ef; }
    .detalle-table tr:last-child td { border-bottom: none; }
    .gas-row td { color: #d97706; }
    .total-row td { font-weight: 700; font-size: 15px; background: #1a1d2e; color: #fff; }
    .total-row td:last-child { color: #c9a96e; }

    ${!isPagado ? `.saldo-box { background: #fee2e2; border: 1px solid #fca5a5; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .saldo-label { font-size: 12px; color: #dc2626; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .saldo-monto { font-size: 28px; font-weight: 700; color: #dc2626; }
    .saldo-vence { font-size: 12px; color: #dc2626; margin-top: 4px; }` : ''}

    ${isPagado ? `.pagado-box { background: #dcfce7; border: 1px solid #86efac; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .pagado-check { font-size: 48px; }
    .pagado-info { }
    .pagado-label { font-size: 12px; color: #16a34a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .pagado-monto { font-size: 28px; font-weight: 700; color: #16a34a; }` : ''}

    .firma { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
    .firma-box { text-align: center; padding-top: 36px; border-top: 1px solid #1a1d2e; font-size: 12px; color: #6b7280; }
    .footer { text-align: center; margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e6ef; color: #9ca3af; font-size: 11px; line-height: 1.6; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      <div class="logo-txt">CondoAdmin <span class="logo-sub">PRO</span></div>
      <div class="condo-name">${unidad?.condominio_nombre || 'Condominio'}</div>
      <div class="condo-addr">${unidad?.condominio_direccion || ''}</div>
    </div>
    <div class="factura-title">
      <h2>FACTURA DE MANTENIMIENTO</h2>
      <p>Emisión: ${hoy}</p>
      <div class="factura-num">N° FAC-${(pago.id||'').slice(-8).toUpperCase()}</div>
    </div>
  </div>

  <div class="estado-banner estado-${pago.estado === 'pagado' ? 'pagado' : pago.estado === 'parcial' ? 'parcial' : 'abierta'}">
    ${pago.estado === 'pagado' ? '✓ FACTURA PAGADA' : pago.estado === 'parcial' ? '⚡ PAGO PARCIAL — SALDO PENDIENTE' : '⚠ PENDIENTE DE PAGO'}
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Datos del Residente</h3>
      <div class="info-row"><span>Nombre</span><span>${pago.residente_nombre || unidad?.residente_nombre || '—'}</span></div>
      <div class="info-row"><span>Unidad</span><span>${unidad?.numero || '—'}</span></div>
      <div class="info-row"><span>Tipo</span><span style="text-transform:capitalize">${unidad?.tipo || '—'}</span></div>
      <div class="info-row"><span>Condición</span><span>${unidad?.es_propietario ? 'Propietario' : 'Inquilino'}</span></div>
    </div>
    <div class="info-box">
      <h3>Período de Facturación</h3>
      <div class="info-row"><span>Período</span><span><strong>${mesNombre} ${pago.anio || new Date().getFullYear()}</strong></span></div>
      <div class="info-row"><span>Fecha límite</span><span style="color:${pago.estado !== 'pagado' ? '#dc2626' : 'inherit'}">${pago.fecha_limite ? new Date(pago.fecha_limite).toLocaleDateString('es-DO') : '—'}</span></div>
      ${pago.fecha_pago ? `<div class="info-row"><span>Fecha de pago</span><span>${new Date(pago.fecha_pago).toLocaleDateString('es-DO')}</span></div>` : ''}
      ${pago.metodo_pago ? `<div class="info-row"><span>Método</span><span style="text-transform:capitalize">${pago.metodo_pago}</span></div>` : ''}
    </div>
  </div>

  <div class="detalle-section">
    <h3>Detalle de cargos</h3>
    <table class="detalle-table">
      <thead>
        <tr><th>Concepto</th><th>Descripción</th><th style="text-align:right">Monto</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Cuota de mantenimiento</strong></td>
          <td>${mesNombre} ${pago.anio}</td>
          <td style="text-align:right">${moneda} ${fmt(pago.monto_cuota)}</td>
        </tr>
        ${gasComun > 0 ? `
        <tr class="gas-row">
          <td><strong>🔥 Gas consumido</strong></td>
          <td>Según medidor — ${mesNombre} ${pago.anio}</td>
          <td style="text-align:right">${moneda} ${fmt(gasComun)}</td>
        </tr>` : ''}
        ${parseFloat(pago.monto_recargo||0) > 0 ? `
        <tr style="color:#dc2626">
          <td><strong>Recargo por mora</strong></td>
          <td>Pago fuera de fecha</td>
          <td style="text-align:right">${moneda} ${fmt(pago.monto_recargo)}</td>
        </tr>` : ''}
        <tr class="total-row">
          <td colspan="2">TOTAL A PAGAR</td>
          <td style="text-align:right">${moneda} ${fmt(totalCobro)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${isPagado ? `
  <div class="pagado-box">
    <div class="pagado-check">✅</div>
    <div class="pagado-info">
      <div class="pagado-label">Monto recibido</div>
      <div class="pagado-monto">${moneda} ${fmt(pago.monto_pagado)}</div>
      ${pago.referencia ? `<div style="font-size:12px;color:#16a34a;margin-top:4px;">Ref: ${pago.referencia}</div>` : ''}
    </div>
  </div>` : `
  <div class="saldo-box">
    <div>
      <div class="saldo-label">Saldo pendiente</div>
      <div class="saldo-monto">${moneda} ${fmt(saldo)}</div>
      ${pago.fecha_limite ? `<div class="saldo-vence">Vence: ${new Date(pago.fecha_limite).toLocaleDateString('es-DO')}</div>` : ''}
    </div>
    <div style="font-size:13px;color:#dc2626;max-width:220px;text-align:right;line-height:1.5">
      Por favor realice su pago antes de la fecha límite para evitar recargos por mora.
    </div>
  </div>`}

  ${pago.notas ? `<div style="background:#fef9c3;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:13px;"><strong>Notas:</strong> ${pago.notas}</div>` : ''}

  <div class="firma">
    <div class="firma-box">Firma del Administrador</div>
    <div class="firma-box">Firma del Residente</div>
  </div>

  <div class="footer">
    <p>Factura emitida por <strong>${unidad?.condominio_nombre || 'CondoAdmin PRO'}</strong> · ${hoy}</p>
    <p>Este documento es válido como comprobante de cobro. Guárdelo para sus registros.</p>
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

  const v = window.open('', '_blank', 'width=820,height=950');
  v.document.write(html);
  v.document.close();
}

export default function ResidentePortal() {
  const [unidad, setUnidad] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [anuncios, setAnuncios] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [tab, setTab] = useState('cuenta');
  const [showSolicitud, setShowSolicitud] = useState(false);
  const [formSolicitud, setFormSolicitud] = useState({ tipo:'consulta', asunto:'', descripcion:'' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalComprobante, setModalComprobante] = useState(false);
  const [pagoComprobante, setPagoComprobante] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [archivoSolicitud, setArchivoSolicitud] = useState(null);
  const fileRef = useRef();

  const reloadPagos = () => api.get('/residente/mi-cuenta').then(r => setPagos(r.data));

  useEffect(() => {
    Promise.all([
      api.get('/residente/mi-unidad'),
      api.get('/residente/mi-cuenta'),
    ]).then(([u, p]) => {
      setUnidad(u.data);
      setPagos(p.data);
      if (u.data) {
        api.get(`/condominios/${u.data.condominio_id}/solicitudes`).then(r => setSolicitudes(r.data)).catch(()=>{});
        api.get(`/condominios/${u.data.condominio_id}/anuncios`).then(r => setAnuncios(r.data)).catch(()=>{});
        api.get('/residente/mi-historial-pagos').then(r => setHistorial(r.data)).catch(()=>{});
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSolicitud = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const fd = new FormData();
      fd.append('asunto', formSolicitud.asunto);
      fd.append('descripcion', formSolicitud.descripcion);
      fd.append('tipo', formSolicitud.tipo);
      if (archivoSolicitud) fd.append('archivo', archivoSolicitud);
      // NO poner Content-Type manualmente — axios lo pone con el boundary correcto
      await api.post(`/condominios/${unidad.condominio_id}/solicitudes`, fd);
      toast.success('Solicitud enviada correctamente');
      setShowSolicitud(false);
      setFormSolicitud({ tipo: 'consulta', asunto: '', descripcion: '' });
      setArchivoSolicitud(null);
      api.get(`/condominios/${unidad.condominio_id}/solicitudes`).then(r => setSolicitudes(r.data));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al enviar solicitud');
      console.error('Error solicitud:', err.response?.data || err.message);
    }
    finally { setSaving(false); }
  };

  const handleSubirComprobante = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5*1024*1024) return toast.error('Máximo 5MB');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('comprobante', file);
      await api.post(`/condominios/${unidad.condominio_id}/cuotas/pagos/${pagoComprobante.id}/comprobante`, fd, {
        
      });
      toast.success('Comprobante enviado al administrador');
      setModalComprobante(false);
      reloadPagos();
    } catch { toast.error('Error al subir'); }
    finally { setUploading(false); }
  };

  const fmt = n => new Intl.NumberFormat('es-DO').format(parseFloat(n)||0);
  const estadoColor = { pagado:'badge-green', pendiente:'badge-red', parcial:'badge-yellow', en_revision:'badge-blue' };
  const tipoColor = { reparacion:'badge-red', queja:'badge-yellow', consulta:'badge-blue', sugerencia:'badge-green', emergencia:'badge-red' };
  const ahora = new Date();
  const cuotaMes = pagos.find(p => parseInt(p.mes) === ahora.getMonth()+1 && parseInt(p.anio) === ahora.getFullYear());

  if (loading) return (
    <Layout>
      <div style={{ padding:'32px', textAlign:'center', color:'var(--text2)' }}>Cargando...</div>
    </Layout>
  );

  return (
    <Layout>
      <div style={{ padding:'32px' }}>
        <div style={{ marginBottom:'28px' }}>
          <h1 style={{ fontFamily:'DM Serif Display, serif', fontSize:'28px', margin:0 }}>Mi Portal</h1>
          {unidad && <p style={{ color:'var(--text2)', fontSize:'14px', marginTop:'4px' }}>Unidad {unidad.numero} · {unidad.condominio_nombre}</p>}
        </div>

        {/* Info unidad */}
        {unidad && (
          <div className="card" style={{ padding:'20px 24px', marginBottom:'24px' }}>
            <div style={{ display:'flex', gap:'32px', flexWrap:'wrap' }}>
              {[
                { label:'Unidad', value: unidad.numero, big: true },
                { label:'Tipo', value: unidad.tipo?.charAt(0).toUpperCase()+unidad.tipo?.slice(1) },
                { label:'Condominio', value: unidad.condominio_nombre },
                { label:'Cuota mensual', value: `${unidad.moneda} ${fmt(unidad.cuota_base)}`, accent: true },
                { label:'Condición', badge: unidad.es_propietario ? { label:'Propietario', cls:'badge-gold' } : { label:'Inquilino', cls:'badge-blue' } },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize:'10px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>{item.label}</div>
                  {item.badge ? <span className={`badge ${item.badge.cls}`}>{item.badge.label}</span>
                    : <div style={{ fontFamily: item.big ? 'DM Serif Display, serif' : 'inherit', fontSize: item.big ? '28px' : '15px', fontWeight: item.big ? undefined : '600', color: item.accent ? 'var(--accent)' : 'var(--text)' }}>{item.value}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Anuncios importantes — siempre visibles en el home */}
        {anuncios.filter(a => a.importante).length > 0 && (
          <div style={{ marginBottom:'24px', display:'flex', flexDirection:'column', gap:'10px' }}>
            {anuncios.filter(a => a.importante).map(a => (
              <div key={a.id} style={{ borderRadius:'12px', padding:'16px 20px', background:'#fff7ed', border:'1px solid #fed7aa', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, bottom:0, width:'4px', background:'var(--red)' }} />
                <div style={{ paddingLeft:'8px' }}>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'6px' }}>
                    <span style={{ fontSize:'16px' }}>🚨</span>
                    <span style={{ fontSize:'11px', fontWeight:'700', color:'var(--red)', textTransform:'uppercase', letterSpacing:'1px' }}>Anuncio importante</span>
                    <span style={{ fontSize:'11px', color:'var(--text2)', marginLeft:'auto' }}>
                      {new Date(a.created_at).toLocaleDateString('es-DO', { day:'numeric', month:'short' })}
                    </span>
                  </div>
                  <div style={{ fontWeight:'700', fontSize:'15px', marginBottom:'4px' }}>{a.titulo}</div>
                  <div style={{ fontSize:'13px', color:'var(--text2)', lineHeight:'1.5' }}>{a.contenido}</div>
                  {a.documento_url && (
                    <a href={`http://localhost:4000${a.documento_url}`} target="_blank" rel="noreferrer"
                      style={{ display:'inline-flex', alignItems:'center', gap:'6px', marginTop:'10px', padding:'6px 12px', borderRadius:'8px', background:'#fff', border:'1px solid #fed7aa', textDecoration:'none', color:'#92400e', fontSize:'12px', fontWeight:'600' }}>
                      📎 {a.documento_nombre || 'Ver documento adjunto'} ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Anuncios recientes no importantes (últimos 2) */}
        {anuncios.filter(a => !a.importante).slice(0,2).length > 0 && (
          <div style={{ marginBottom:'24px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
              <span style={{ fontSize:'12px', fontWeight:'700', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px' }}>📢 Últimos anuncios</span>
              <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:'12px', color:'var(--accent)', fontWeight:'600' }}
                onClick={() => setTab('anuncios')}>Ver todos →</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {anuncios.filter(a => !a.importante).slice(0,2).map(a => (
                <div key={a.id} className="card" style={{ padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight:'600', fontSize:'14px' }}>{a.titulo}</div>
                    <div style={{ fontSize:'12px', color:'var(--text2)', marginTop:'2px' }}>
                      {new Date(a.created_at).toLocaleDateString('es-DO', { day:'numeric', month:'long' })}
                      {a.documento_url && <span style={{ marginLeft:'8px' }}>📎</span>}
                    </div>
                  </div>
                  <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:'12px', color:'var(--accent)', fontWeight:'600', whiteSpace:'nowrap' }}
                    onClick={() => setTab('anuncios')}>Leer →</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {cuotaMes && (
          <div className="card" style={{ padding:'20px 28px', marginBottom:'24px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, bottom:0, width:'4px', background: cuotaMes.estado==='pagado' ? 'var(--green)' : cuotaMes.estado==='parcial' ? 'var(--yellow)' : 'var(--red)' }} />
            <div style={{ paddingLeft:'12px' }}>
              <div style={{ fontSize:'11px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Cuota del mes actual</div>
              <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'22px', marginBottom:'4px' }}>{MESES[cuotaMes.mes-1]} {cuotaMes.anio}</div>
              {parseFloat(cuotaMes.monto_gas_comun||0) > 0 && (
                <div style={{ fontSize:'12px', color:'var(--text2)' }}>
                  Mantenimiento: {cuotaMes.moneda} {fmt(cuotaMes.monto_cuota)}
                  <span style={{ marginLeft:'8px', color:'var(--yellow)' }}>🔥 Gas: {cuotaMes.moneda} {fmt(cuotaMes.monto_gas_comun)}</span>
                </div>
              )}
              {cuotaMes.fecha_limite && cuotaMes.estado !== 'pagado' && (
                <div style={{ fontSize:'12px', color:'var(--red)', marginTop:'2px' }}>⚠ Vence: {new Date(cuotaMes.fecha_limite).toLocaleDateString('es-DO')}</div>
              )}
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'8px' }}>
              <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'32px', color: cuotaMes.estado==='pagado' ? 'var(--green)' : 'var(--red)' }}>
                {cuotaMes.moneda} {fmt(cuotaMes.estado==='pagado' ? cuotaMes.monto_pagado : parseFloat(cuotaMes.monto_cuota||0)+parseFloat(cuotaMes.monto_gas_comun||0))}
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                <span className={`badge ${estadoColor[cuotaMes.estado]||'badge-gold'}`}>
                  {cuotaMes.estado === 'pagado' ? '✓ Pagado' : cuotaMes.estado === 'parcial' ? 'Pago parcial' : 'Pendiente'}
                </span>
                <button className="btn btn-ghost" style={{ padding:'5px 12px', fontSize:'12px' }}
                  onClick={() => generarFacturaPDF(cuotaMes, unidad)}>
                  📄 Ver factura
                </button>
                {cuotaMes.estado !== 'pagado' && (
                  <button className="btn btn-primary" style={{ padding:'5px 12px', fontSize:'12px' }}
                    onClick={() => { setPagoComprobante(cuotaMes); setModalComprobante(true); }}>
                    📎 Subir comprobante
                  </button>
                )}
                {cuotaMes.estado === 'en_revision' && (
                  <span style={{ fontSize:'11px', color:'var(--blue)' }}>⏳ En revisión</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'24px' }}>
          {[['cuenta','💰 Estado de cuenta'],['historial','📋 Historial de pagos'],['solicitudes','📩 Solicitudes'],['anuncios','📢 Anuncios']].map(([key,label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding:'8px 16px', borderRadius:'20px', cursor:'pointer', fontWeight:'600', fontSize:'13px',
              border: tab===key ? 'none' : '1px solid var(--border)',
              background: tab===key ? 'var(--accent)' : 'var(--surface)',
              color: tab===key ? '#fff' : 'var(--text2)',
              boxShadow: tab===key ? '0 2px 8px rgba(176,138,78,.3)' : 'none',
            }}>{label}</button>
          ))}
        </div>

        {/* Estado de cuenta */}
        {tab === 'cuenta' && (
          <div className="card">
            <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border)', fontWeight:'600', fontSize:'14px' }}>
              Historial de cuotas
            </div>
            {pagos.length === 0 ? (
              <div style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>
                <div style={{ fontSize:'40px', marginBottom:'12px' }}>💰</div>
                <p>Sin cobros registrados aún.</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Período</th><th>Mantenimiento</th><th>Gas 🔥</th><th>Total</th><th>Pagado</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {pagos.map(p => {
                    const gas = parseFloat(p.monto_gas_comun||0);
                    const total = parseFloat(p.monto_cuota||0) + gas;
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight:'600' }}>{MESES_CORTO[(p.mes||1)-1]} {p.anio}</td>
                        <td>{p.moneda} {fmt(p.monto_cuota)}</td>
                        <td style={{ color: gas > 0 ? 'var(--yellow)' : 'var(--text2)', fontSize:'13px' }}>
                          {gas > 0 ? `${p.moneda} ${fmt(gas)}` : '—'}
                        </td>
                        <td style={{ fontWeight:'700' }}>{p.moneda} {fmt(total)}</td>
                        <td style={{ color: p.estado==='pagado' ? 'var(--green)' : 'var(--text2)', fontWeight: p.estado==='pagado' ? '600' : undefined }}>
                          {p.moneda} {fmt(p.monto_pagado||0)}
                        </td>
                        <td><span className={`badge ${estadoColor[p.estado]||'badge-gold'}`}>{p.estado.replace('_',' ')}</span></td>
                        <td>
                          <div style={{ display:'flex', gap:'6px' }}>
                            <button className="btn btn-ghost" style={{ padding:'4px 10px', fontSize:'11px' }}
                              onClick={() => generarFacturaPDF(p, unidad)}>
                              📄 Factura
                            </button>
                            {p.estado !== 'pagado' && p.estado !== 'en_revision' && (
                              <button className="btn btn-primary" style={{ padding:'4px 10px', fontSize:'11px' }}
                                onClick={() => { setPagoComprobante(p); setModalComprobante(true); }}>
                                📎 Comprobante
                              </button>
                            )}
                            {p.estado === 'en_revision' && (
                              <span className="badge badge-blue">En revisión</span>
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
        )}

        {/* Solicitudes */}
        {/* Historial de pagos */}
        {tab === 'historial' && (
          <div>
            {/* Resumen stats */}
            {historial.length > 0 && (() => {
              const totalPagado = historial.reduce((s,p) => s + parseFloat(p.monto_pagado||0), 0);
              const moneda = historial[0]?.moneda || 'RD$';
              return (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'24px' }}>
                  {[
                    { label:'Pagos realizados', value: historial.length, suffix:' pagos', color:'var(--accent)' },
                    { label:'Total pagado', value: `${moneda} ${fmt(totalPagado)}`, color:'var(--green)' },
                    { label:'Último pago', value: historial[0]?.fecha_pago ? new Date(historial[0].fecha_pago+'T12:00:00').toLocaleDateString('es-DO',{day:'numeric',month:'short',year:'numeric'}) : '—', color:'var(--text)' },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ padding:'16px 20px' }}>
                      <div style={{ fontSize:'11px', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>{s.label}</div>
                      <div style={{ fontFamily:'DM Serif Display, serif', fontSize:'22px', color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="card" style={{ overflow:'hidden' }}>
              <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border)', fontWeight:'700', fontSize:'14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>📋 Historial completo de pagos</span>
                <span style={{ fontSize:'12px', color:'var(--text2)', fontWeight:'400' }}>{historial.length} registros</span>
              </div>

              {historial.length === 0 ? (
                <div style={{ padding:'64px', textAlign:'center', color:'var(--text2)' }}>
                  <div style={{ fontSize:'48px', marginBottom:'12px' }}>💳</div>
                  <p>Aún no tienes pagos registrados.</p>
                </div>
              ) : (
                <div>
                  {historial.map((p, i) => {
                    const gas    = parseFloat(p.monto_gas_comun||0);
                    const total  = parseFloat(p.monto_cuota||0) + gas;
                    const pagado = parseFloat(p.monto_pagado||0);
                    const isParcial = p.estado === 'parcial';
                    const isRevision = p.estado === 'en_revision';
                    return (
                      <div key={p.id} style={{
                        display:'grid', gridTemplateColumns:'3fr 2fr 2fr 2fr auto',
                        alignItems:'center', gap:'16px',
                        padding:'16px 24px',
                        borderBottom: i < historial.length-1 ? '1px solid var(--border)' : 'none',
                        background: i % 2 === 0 ? 'transparent' : 'var(--surface2)',
                      }}>
                        {/* Período */}
                        <div>
                          <div style={{ fontWeight:'700', fontSize:'14px', marginBottom:'3px' }}>
                            {MESES[(p.mes||1)-1]} {p.anio}
                          </div>
                          <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
                            <span className={`badge ${isRevision ? 'badge-blue' : isParcial ? 'badge-yellow' : 'badge-green'}`} style={{ fontSize:'10px' }}>
                              {isRevision ? '⏳ En revisión' : isParcial ? 'Pago parcial' : '✓ Pagado'}
                            </span>
                            {p.metodo_pago && (
                              <span style={{ fontSize:'11px', color:'var(--text2)', textTransform:'capitalize' }}>
                                {{ efectivo:'💵', transferencia:'🏦', tarjeta:'💳', cheque:'📝' }[p.metodo_pago] || '💳'} {p.metodo_pago}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Fecha de pago */}
                        <div>
                          <div style={{ fontSize:'11px', color:'var(--text2)', marginBottom:'2px' }}>Fecha de pago</div>
                          <div style={{ fontSize:'13px', fontWeight:'600' }}>
                            {p.fecha_pago ? new Date(p.fecha_pago+'T12:00:00').toLocaleDateString('es-DO',{day:'numeric',month:'short',year:'numeric'}) : '—'}
                          </div>
                        </div>

                        {/* Montos */}
                        <div>
                          <div style={{ fontSize:'11px', color:'var(--text2)', marginBottom:'2px' }}>Total cobrado</div>
                          <div style={{ fontSize:'14px', fontWeight:'700' }}>{p.moneda} {fmt(total)}</div>
                          {gas > 0 && <div style={{ fontSize:'11px', color:'var(--yellow)' }}>🔥 Gas: {p.moneda} {fmt(gas)}</div>}
                        </div>

                        {/* Monto pagado */}
                        <div>
                          <div style={{ fontSize:'11px', color:'var(--text2)', marginBottom:'2px' }}>Monto pagado</div>
                          <div style={{ fontSize:'14px', fontWeight:'700', color: isParcial ? 'var(--yellow)' : 'var(--green)' }}>
                            {p.moneda} {fmt(pagado)}
                          </div>
                          {isParcial && <div style={{ fontSize:'11px', color:'var(--red)' }}>Pendiente: {p.moneda} {fmt(total - pagado)}</div>}
                        </div>

                        {/* Acciones */}
                        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                          <button className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:'11px', whiteSpace:'nowrap' }}
                            onClick={() => generarFacturaPDF(p, unidad)}>
                            📄 Factura
                          </button>
                          {p.comprobante_url && (
                            <a href={`http://localhost:4000${p.comprobante_url}`} target="_blank" rel="noreferrer"
                              className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:'11px', textDecoration:'none', whiteSpace:'nowrap' }}>
                              🖼 Comprobante
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'solicitudes' && (
          <div>
            {/* Header con botón */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <div>
                <div style={{ fontWeight:'700', fontSize:'16px' }}>Mis solicitudes</div>
                <div style={{ fontSize:'13px', color:'var(--text2)', marginTop:'2px' }}>
                  {solicitudes.length === 0 ? 'Aún no has enviado solicitudes' : `${solicitudes.length} solicitudes enviadas`}
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => { setFormSolicitud({ tipo:'consulta', asunto:'', descripcion:'' }); setShowSolicitud(true); }}>
                + Nueva solicitud
              </button>
            </div>

            {/* Lista de solicitudes */}
            {solicitudes.length === 0 ? (
              <div className="card" style={{ padding:'64px', textAlign:'center' }}>
                <div style={{ fontSize:'52px', marginBottom:'16px' }}>📩</div>
                <div style={{ fontWeight:'700', fontSize:'16px', marginBottom:'8px' }}>Sin solicitudes aún</div>
                <div style={{ color:'var(--text2)', fontSize:'14px', marginBottom:'24px', maxWidth:'320px', margin:'0 auto 24px' }}>
                  ¿Tienes una consulta, reparación o queja? Envíala directamente a la administración.
                </div>
                <button className="btn btn-primary" onClick={() => setShowSolicitud(true)}>Crear primera solicitud</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                {solicitudes.map(s => {
                  const estadoBadge = {
                    abierta:  { cls:'badge-yellow', label:'⏳ Pendiente' },
                    en_proceso: { cls:'badge-blue',   label:'🔄 En proceso' },
                    cerrada:   { cls:'badge-green',  label:'✓ Resuelta' },
                  }[s.estado] || { cls:'badge-yellow', label: s.estado };
                  const tipoIcon = { consulta:'💬', reparacion:'🔧', queja:'😤', sugerencia:'💡', emergencia:'🚨' }[s.tipo] || '📩';
                  const isEmergencia = s.tipo === 'emergencia';

                  return (
                    <div key={s.id} className="card" style={{ padding:'0', overflow:'hidden', border: isEmergencia ? '1px solid rgba(220,38,38,.3)' : undefined }}>
                      {/* Barra de color según estado */}
                      <div style={{ height:'3px', background: s.estado==='cerrada' ? 'var(--green)' : s.estado==='en_proceso' ? 'var(--blue)' : isEmergencia ? 'var(--red)' : 'var(--yellow)' }} />
                      <div style={{ padding:'18px 22px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'16px' }}>
                          <div style={{ flex:1 }}>
                            {/* Tipo + estado */}
                            <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'10px', flexWrap:'wrap' }}>
                              <span style={{ fontSize:'18px' }}>{tipoIcon}</span>
                              <span className={`badge ${tipoColor[s.tipo]||'badge-blue'}`} style={{ textTransform:'capitalize' }}>{s.tipo}</span>
                              <span className={`badge ${estadoBadge.cls}`}>{estadoBadge.label}</span>
                              <span style={{ fontSize:'11px', color:'var(--text2)', marginLeft:'4px' }}>
                                {new Date(s.created_at).toLocaleDateString('es-DO', { day:'numeric', month:'long', year:'numeric' })}
                              </span>
                            </div>
                            {/* Asunto */}
                            <div style={{ fontWeight:'700', fontSize:'15px', marginBottom:'6px' }}>{s.titulo}</div>
                            {/* Descripción */}
                            <div style={{ fontSize:'13px', color:'var(--text2)', lineHeight:'1.6' }}>{s.descripcion}</div>
                          </div>
                        </div>

                        {/* Respuesta del admin */}
                        {s.respuesta && (
                          <div style={{ marginTop:'14px', padding:'12px 16px', background:'#f0fdf4', borderRadius:'10px', borderLeft:'3px solid var(--green)' }}>
                            <div style={{ fontSize:'11px', fontWeight:'700', color:'var(--green)', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                              ✉ Respuesta de administración
                            </div>
                            <div style={{ fontSize:'13px', color:'var(--text)', lineHeight:'1.6' }}>{s.respuesta}</div>
                          </div>
                        )}

                        {/* Sin respuesta aún si está pendiente */}
                        {!s.respuesta && s.estado === 'abierta' && (
                          <div style={{ marginTop:'12px', display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--text2)' }}>
                            <span>⏳</span> Esperando respuesta de la administración...
                          </div>
                        )}

                        {/* Archivo adjunto */}
                        {s.archivo_url && (
                          <a href={`http://localhost:4000${s.archivo_url}`} target="_blank" rel="noreferrer"
                            style={{ display:'inline-flex', alignItems:'center', gap:'6px', marginTop:'12px', padding:'6px 12px', borderRadius:'8px', background:'var(--surface2)', border:'1px solid var(--border)', textDecoration:'none', color:'var(--text)', fontSize:'12px', fontWeight:'600' }}>
                            📎 {s.archivo_nombre || 'Ver adjunto'} ↗
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Anuncios */}
        {tab === 'anuncios' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            {anuncios.length === 0 ? (
              <div className="card" style={{ padding:'48px', textAlign:'center', color:'var(--text2)' }}>
                <div style={{ fontSize:'40px', marginBottom:'12px' }}>📢</div>
                <p>No hay anuncios recientes</p>
              </div>
            ) : anuncios.map(a => (
              <div key={a.id} className="card" style={{ padding:'20px 24px', position:'relative', overflow:'hidden' }}>
                {a.importante && <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'var(--red)' }} />}
                <div style={{ display:'flex', gap:'8px', marginBottom:'10px', alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'16px' }}>
                    {{ general:'📢', mantenimiento:'🔧', evento:'🎉', urgente:'🚨', financiero:'💰' }[a.tipo] || '📢'}
                  </span>
                  <span className={`badge ${{ general:'badge-blue', mantenimiento:'badge-yellow', evento:'badge-green', urgente:'badge-red', financiero:'badge-gold' }[a.tipo]||'badge-blue'}`} style={{ textTransform:'capitalize' }}>{a.tipo}</span>
                  {a.importante && <span className="badge badge-red">⚠ Importante</span>}
                  {a.fecha_evento && (
                    <span style={{ marginLeft:'auto', fontSize:'12px', color:'var(--accent)', fontWeight:'700', display:'flex', alignItems:'center', gap:'4px' }}>
                      📅 {new Date(a.fecha_evento+'T12:00:00').toLocaleDateString('es-DO', { weekday:'short', day:'numeric', month:'long', year:'numeric' })}
                    </span>
                  )}
                </div>
                <div style={{ fontWeight:'700', fontSize:'16px', marginBottom:'8px' }}>{a.titulo}</div>
                <div style={{ color:'var(--text2)', fontSize:'14px', lineHeight:'1.6', marginBottom:'12px' }}>{a.contenido}</div>
                {a.documento_url && (
                  <a href={`http://localhost:4000${a.documento_url}`} target="_blank" rel="noreferrer"
                    style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'8px 14px', borderRadius:'8px', background:'var(--surface2)', border:'1px solid var(--border)', textDecoration:'none', color:'var(--text)', fontSize:'13px', fontWeight:'600' }}>
                    <span style={{ fontSize:'18px' }}>{{ pdf:'📄', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', jpg:'🖼', jpeg:'🖼', png:'🖼' }[a.documento_nombre?.split('.').pop()?.toLowerCase()] || '📎'}</span>
                    {a.documento_nombre || 'Ver documento adjunto'}
                    <span style={{ fontSize:'11px', color:'var(--text2)' }}>↗</span>
                  </a>
                )}
                <div style={{ fontSize:'11px', color:'var(--text2)', marginTop:'12px' }}>
                  Publicado el {new Date(a.created_at).toLocaleDateString('es-DO', { day:'numeric', month:'long', year:'numeric' })}
                  {a.autor && ` · Por ${a.autor}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal subir comprobante */}
      {modalComprobante && pagoComprobante && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalComprobante(false)}>
          <div className="modal" style={{ maxWidth:'460px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'22px', marginBottom:'8px' }}>Subir Comprobante de Pago</h2>
            <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'24px' }}>
              Unidad {unidad?.numero} · {MESES[(pagoComprobante.mes||1)-1]} {pagoComprobante.anio}
            </p>

            {/* Resumen del cobro */}
            <div style={{ background:'var(--surface2)', borderRadius:'10px', padding:'14px 18px', marginBottom:'20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'4px' }}>
                <span style={{ color:'var(--text2)' }}>Cuota de mantenimiento</span>
                <span style={{ fontWeight:'600' }}>{pagoComprobante.moneda} {fmt(pagoComprobante.monto_cuota)}</span>
              </div>
              {parseFloat(pagoComprobante.monto_gas_comun||0) > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'4px' }}>
                  <span style={{ color:'var(--text2)' }}>Gas consumido 🔥</span>
                  <span style={{ color:'var(--yellow)', fontWeight:'600' }}>{pagoComprobante.moneda} {fmt(pagoComprobante.monto_gas_comun)}</span>
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', fontWeight:'700', borderTop:'1px solid var(--border)', paddingTop:'8px', marginTop:'6px' }}>
                <span>Total a pagar</span>
                <span style={{ color:'var(--accent)' }}>{pagoComprobante.moneda} {fmt(parseFloat(pagoComprobante.monto_cuota||0)+parseFloat(pagoComprobante.monto_gas_comun||0))}</span>
              </div>
            </div>

            <div
              style={{ border:'2px dashed var(--border)', borderRadius:'12px', padding:'36px', textAlign:'center', cursor:'pointer', background:'var(--surface2)', transition:'border .2s' }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.background='#fef9f0'; }}
              onDragLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--surface2)'; }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.style.borderColor='var(--border)';
                e.currentTarget.style.background='var(--surface2)';
                const f = e.dataTransfer.files[0];
                if (f) handleSubirComprobante({ target: { files: [f] } });
              }}
            >
              <div style={{ fontSize:'40px', marginBottom:'10px' }}>📎</div>
              <div style={{ fontWeight:'700', fontSize:'15px', marginBottom:'4px' }}>
                {uploading ? 'Enviando...' : 'Arrastra aquí o haz clic para seleccionar'}
              </div>
              <div style={{ color:'var(--text2)', fontSize:'12px' }}>Foto, JPG, PNG o PDF · Máximo 5MB</div>
              <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display:'none' }} onChange={handleSubirComprobante} />
            </div>

            <div style={{ marginTop:'14px', padding:'10px 14px', background:'#dbeafe', borderRadius:'8px', fontSize:'12px', color:'#1d4ed8' }}>
              ℹ️ El administrador recibirá tu comprobante y verificará el pago. El estado cambiará a "en revisión".
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'20px' }}>
              <button className="btn btn-ghost" onClick={() => setModalComprobante(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva solicitud */}
      {showSolicitud && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowSolicitud(false)}>
          <div className="modal" style={{ maxWidth:'520px' }}>
            <h2 style={{ fontFamily:'DM Serif Display, serif', fontSize:'24px', marginBottom:'6px' }}>Nueva Solicitud</h2>
            <p style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'24px' }}>Envía tu consulta, reporte o queja directamente a la administración.</p>

            <form onSubmit={handleSolicitud} style={{ display:'flex', flexDirection:'column', gap:'18px' }}>

              {/* Tipo — visual cards */}
              <div>
                <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'10px' }}>Tipo de solicitud *</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
                  {[
                    { val:'consulta',    icon:'💬', label:'Consulta',    desc:'Preguntas generales' },
                    { val:'reparacion',  icon:'🔧', label:'Reparación',  desc:'Daños o arreglos' },
                    { val:'queja',       icon:'😤', label:'Queja',       desc:'Inconformidad' },
                    { val:'sugerencia',  icon:'💡', label:'Sugerencia',  desc:'Mejoras o ideas' },
                    { val:'emergencia',  icon:'🚨', label:'Emergencia',  desc:'Urgente inmediato' },
                    { val:'otro',        icon:'📋', label:'Otro',        desc:'Otro motivo' },
                  ].map(t => (
                    <div key={t.val} onClick={() => setFormSolicitud(p=>({...p, tipo:t.val}))}
                      style={{ padding:'12px 10px', borderRadius:'10px', border:`2px solid ${formSolicitud.tipo===t.val ? (t.val==='emergencia' ? 'var(--red)' : 'var(--accent)') : 'var(--border)'}`, cursor:'pointer', textAlign:'center', background: formSolicitud.tipo===t.val ? (t.val==='emergencia' ? 'rgba(220,38,38,.05)' : 'rgba(176,138,78,.06)') : 'var(--surface)', transition:'all .15s' }}>
                      <div style={{ fontSize:'22px', marginBottom:'4px' }}>{t.icon}</div>
                      <div style={{ fontSize:'12px', fontWeight:'700', marginBottom:'2px' }}>{t.label}</div>
                      <div style={{ fontSize:'10px', color:'var(--text2)' }}>{t.desc}</div>
                    </div>
                  ))}
                </div>
                {formSolicitud.tipo === 'emergencia' && (
                  <div style={{ marginTop:'8px', padding:'8px 12px', background:'rgba(220,38,38,.06)', borderRadius:'8px', border:'1px solid rgba(220,38,38,.2)', fontSize:'12px', color:'var(--red)' }}>
                    🚨 Las emergencias son atendidas con prioridad máxima. Para situaciones de riesgo inmediato llama directamente al administrador.
                  </div>
                )}
              </div>

              {/* Asunto */}
              <div>
                <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Asunto *</label>
                <input className="input" required maxLength={150}
                  value={formSolicitud.asunto}
                  onChange={e => setFormSolicitud(p=>({...p, asunto:e.target.value}))}
                  placeholder="Ej: Fuga de agua en baño principal" />
              </div>

              {/* Descripción */}
              <div>
                <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'6px' }}>Descripción *</label>
                <textarea className="input" rows={4} required style={{ resize:'vertical' }}
                  value={formSolicitud.descripcion}
                  onChange={e => setFormSolicitud(p=>({...p, descripcion:e.target.value}))}
                  placeholder="Describe el problema con el mayor detalle posible: ubicación, cuándo ocurrió, qué tan seguido pasa, etc." />
              </div>

              {/* Archivo adjunto opcional */}
              <div>
                <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'8px' }}>
                  📎 Documento o foto adjunta — Opcional
                </label>
                {archivoSolicitud ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', background:'#dcfce7', borderRadius:'8px', border:'1px solid #86efac' }}>
                    <span style={{ fontSize:'20px' }}>
                      {['jpg','jpeg','png'].includes(archivoSolicitud.name.split('.').pop().toLowerCase()) ? '🖼' : archivoSolicitud.name.endsWith('.pdf') ? '📄' : '📎'}
                    </span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'13px', fontWeight:'600', color:'#16a34a' }}>{archivoSolicitud.name}</div>
                      <div style={{ fontSize:'11px', color:'#16a34a' }}>{(archivoSolicitud.size/1024).toFixed(0)} KB</div>
                    </div>
                    <button type="button" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)', fontSize:'18px', lineHeight:1 }}
                      onClick={() => setArchivoSolicitud(null)}>✕</button>
                  </div>
                ) : (
                  <div style={{ border:'2px dashed var(--border)', borderRadius:'10px', padding:'18px', textAlign:'center', cursor:'pointer', background:'var(--surface2)' }}
                    onClick={() => document.getElementById('archivo-solicitud-input').click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor='var(--accent)'; }}
                    onDragLeave={e => { e.currentTarget.style.borderColor='var(--border)'; }}
                    onDrop={e => {
                      e.preventDefault(); e.currentTarget.style.borderColor='var(--border)';
                      const f = e.dataTransfer.files[0];
                      if (f && f.size <= 10*1024*1024) setArchivoSolicitud(f);
                      else if (f) toast.error('Máximo 10MB');
                    }}>
                    <div style={{ fontSize:'24px', marginBottom:'4px' }}>📎</div>
                    <div style={{ fontSize:'13px', color:'var(--text2)', fontWeight:'600' }}>Adjunta una foto o documento</div>
                    <div style={{ fontSize:'11px', color:'var(--text2)', marginTop:'2px' }}>JPG, PNG, PDF, Word · Máx. 10MB</div>
                  </div>
                )}
                <input id="archivo-solicitud-input" type="file" accept="image/*,.pdf,.doc,.docx,.xlsx,.xls" style={{ display:'none' }}
                  onChange={e => {
                    const f = e.target.files[0];
                    if (f && f.size <= 10*1024*1024) setArchivoSolicitud(f);
                    else if (f) toast.error('Máximo 10MB');
                  }} />
              </div>

              <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowSolicitud(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: formSolicitud.tipo==='emergencia' ? 'var(--red)' : undefined }}>
                  {saving ? 'Enviando...' : formSolicitud.tipo==='emergencia' ? '🚨 Enviar emergencia' : '📩 Enviar solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
