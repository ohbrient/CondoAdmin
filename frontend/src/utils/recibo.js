export function generarRecibo(pago, condominio) {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const fmt = n => new Intl.NumberFormat('es-DO').format(parseFloat(n)||0);
  const hoy = new Date().toLocaleDateString('es-DO', { day:'numeric', month:'long', year:'numeric' });
  const mesNombre = meses[(pago.mes||1)-1];
  const residente = pago.residentes?.[0];
  const moneda = condominio?.moneda || 'RD$';
  const gasComun = parseFloat(pago.monto_gas_comun||0);
  const totalCobrado = parseFloat(pago.monto_cuota||0) + gasComun;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recibo de Pago - Unidad ${pago.unidad_numero}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #1a1d2e; background: #fff; }
    .page { width: 680px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #b08a4e; }
    .logo { font-size: 26px; font-weight: 700; color: #b08a4e; }
    .logo small { display: block; font-size: 10px; letter-spacing: 3px; color: #6b7280; text-transform: uppercase; margin-top: 2px; }
    .recibo-num { text-align: right; }
    .recibo-num h2 { font-size: 16px; font-weight: 700; letter-spacing: 1px; }
    .recibo-num p { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .badge { display: inline-block; padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; }
    .badge-pagado { background: #dcfce7; color: #16a34a; }
    .badge-pendiente { background: #fee2e2; color: #dc2626; }
    .badge-parcial { background: #fef9c3; color: #ca8a04; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .info-box { background: #f8f9fc; border-radius: 10px; padding: 14px 18px; border: 1px solid #e2e6ef; }
    .info-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 8px; font-weight: 700; }
    .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 5px; }
    .info-row span:first-child { color: #6b7280; }
    .info-row span:last-child { font-weight: 600; }
    .monto-box { background: #1a1d2e; color: #fff; border-radius: 12px; padding: 22px 26px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .monto-valor { font-size: 32px; font-weight: 700; color: #c9a96e; }
    .monto-label { font-size: 12px; color: #8b90a4; margin-bottom: 4px; }
    .detalle h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 10px; }
    .detalle-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #e2e6ef; font-size: 13px; }
    .detalle-row.gas { color: #d97706; }
    .detalle-row.total { border-bottom: none; font-weight: 700; font-size: 15px; margin-top: 4px; }
    .detalle-row.saldo { color: #dc2626; border-bottom: none; font-weight: 600; }
    .firma { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
    .firma-box { text-align: center; padding-top: 36px; border-top: 1px solid #1a1d2e; font-size: 12px; color: #6b7280; }
    .footer { text-align: center; margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e6ef; color: #6b7280; font-size: 11px; line-height: 1.6; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">CondoAdmin <small>PRO</small></div>
      <div style="margin-top:8px;font-size:14px;font-weight:600;">${condominio?.nombre || 'Condominio'}</div>
      <div style="font-size:12px;color:#6b7280;">${condominio?.direccion || ''} ${condominio?.ciudad ? '· '+condominio.ciudad : ''}</div>
    </div>
    <div class="recibo-num">
      <h2>RECIBO DE PAGO</h2>
      <p>Fecha de emisión: ${hoy}</p>
      <p style="margin-top:6px;color:#b08a4e;font-weight:700;">N° ${(pago.id||'').slice(-8).toUpperCase()}</p>
    </div>
  </div>

  <span class="badge badge-${pago.estado === 'pagado' ? 'pagado' : pago.estado === 'parcial' ? 'parcial' : 'pendiente'}">
    ${pago.estado === 'pagado' ? '✓ Pago Completado' : pago.estado === 'parcial' ? '⚡ Pago Parcial' : '⏳ Pendiente'}
  </span>

  <div class="info-grid">
    <div class="info-box">
      <h3>Datos del Residente</h3>
      <div class="info-row"><span>Nombre</span><span>${residente ? residente.nombre+' '+residente.apellido : '—'}</span></div>
      <div class="info-row"><span>Unidad</span><span>${pago.unidad_numero}</span></div>
      <div class="info-row"><span>Tipo</span><span style="text-transform:capitalize">${pago.unidad_tipo || 'Apartamento'}</span></div>
    </div>
    <div class="info-box">
      <h3>Período de Cobro</h3>
      <div class="info-row"><span>Período</span><span>${mesNombre} ${pago.anio || new Date().getFullYear()}</span></div>
      <div class="info-row"><span>Fecha límite</span><span>${pago.fecha_limite ? new Date(pago.fecha_limite).toLocaleDateString('es-DO') : '—'}</span></div>
      <div class="info-row"><span>Fecha de pago</span><span>${pago.fecha_pago ? new Date(pago.fecha_pago).toLocaleDateString('es-DO') : '—'}</span></div>
    </div>
  </div>

  <div class="monto-box">
    <div>
      <div class="monto-label">Monto pagado</div>
      <div class="monto-valor">${moneda} ${fmt(pago.monto_pagado)}</div>
    </div>
    <div style="text-align:right">
      <div class="monto-label">Método de pago</div>
      <div style="font-size:16px;font-weight:600;text-transform:capitalize;">${pago.metodo_pago || 'Efectivo'}</div>
      ${pago.referencia ? `<div style="font-size:12px;color:#8b90a4;margin-top:4px;">Ref: ${pago.referencia}</div>` : ''}
    </div>
  </div>

  <div class="detalle">
    <h3>Desglose del cobro</h3>
    <div class="detalle-row"><span>Cuota de mantenimiento — ${mesNombre}</span><span>${moneda} ${fmt(pago.monto_cuota)}</span></div>
    ${gasComun > 0 ? `<div class="detalle-row gas"><span>🔥 Gas común — ${mesNombre}</span><span>${moneda} ${fmt(gasComun)}</span></div>` : ''}
    ${parseFloat(pago.monto_recargo||0) > 0 ? `<div class="detalle-row" style="color:#dc2626"><span>Recargo por mora</span><span>${moneda} ${fmt(pago.monto_recargo)}</span></div>` : ''}
    <div class="detalle-row total"><span>Total cobrado</span><span>${moneda} ${fmt(totalCobrado)}</span></div>
    ${totalCobrado > parseFloat(pago.monto_pagado||0) ? `<div class="detalle-row saldo"><span>Saldo pendiente</span><span>${moneda} ${fmt(totalCobrado - parseFloat(pago.monto_pagado||0))}</span></div>` : ''}
  </div>

  ${pago.notas ? `<div style="background:#fef9c3;border-radius:8px;padding:12px 16px;margin-top:16px;font-size:13px;"><strong>Notas:</strong> ${pago.notas}</div>` : ''}

  <div class="firma">
    <div class="firma-box">Firma del Administrador</div>
    <div class="firma-box">Firma del Residente</div>
  </div>

  <div class="footer">
    <p>Este recibo es un comprobante oficial de pago emitido por <strong>${condominio?.nombre || 'el condominio'}</strong>.</p>
    <p>Generado el ${hoy} · CondoAdmin PRO</p>
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

  const ventana = window.open('', '_blank', 'width=820,height=920');
  ventana.document.write(html);
  ventana.document.close();
}
