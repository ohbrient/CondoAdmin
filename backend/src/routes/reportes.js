const router = require('express').Router({ mergeParams: true });
const db     = require('../config/db');
const { authenticate, requireCondoAccess } = require('../middleware/auth');

const guard = [authenticate, requireCondoAccess];

// GET /api/condominios/:condominioId/reportes/balance
router.get('/balance', ...guard, async (req, res) => {
  try {
    const { anio, mes } = req.query;
    const now = new Date();
    const y = parseInt(anio || now.getFullYear());
    const m = parseInt(mes  || now.getMonth() + 1);

    // Ingresos: suma de pagos en el período
    const ingresos = await db.query(
      `SELECT
        COALESCE(SUM(pg.monto),0) as cuotas_cobradas,
        COUNT(DISTINCT cu.unidad_id) as unidades_pagaron
       FROM pagos pg
       JOIN cuotas cu ON cu.id=pg.cuota_id
       JOIN unidades u ON u.id=cu.unidad_id
       JOIN periodos p ON p.id=cu.periodo_id
       WHERE u.condominio_id=$1 AND p.anio=$2 AND p.mes=$3`,
      [req.params.condominioId, y, m]
    );

    // Cuotas pendientes
    const pendientes = await db.query(
      `SELECT COUNT(*) as cant_morosos,
              COALESCE(SUM(cu.monto + cu.recargo - COALESCE(pag.pagado,0)),0) as monto_pendiente
       FROM cuotas cu
       JOIN unidades u ON u.id=cu.unidad_id
       JOIN periodos p ON p.id=cu.periodo_id
       LEFT JOIN (SELECT cuota_id, SUM(monto) as pagado FROM pagos GROUP BY cuota_id) pag ON pag.cuota_id=cu.id
       WHERE u.condominio_id=$1 AND p.anio=$2 AND p.mes=$3 AND cu.estado != 'pagado'`,
      [req.params.condominioId, y, m]
    );

    // Egresos del mes por categoría
    const egresos = await db.query(
      `SELECT COALESCE(cg.nombre,'Sin categoría') as categoria, cg.icono,
              SUM(g.monto) as total
       FROM gastos g
       LEFT JOIN categorias_gastos cg ON cg.id=g.categoria_id
       WHERE g.condominio_id=$1
         AND EXTRACT(YEAR FROM g.fecha)=$2
         AND EXTRACT(MONTH FROM g.fecha)=$3
       GROUP BY cg.nombre, cg.icono
       ORDER BY total DESC`,
      [req.params.condominioId, y, m]
    );

    const total_egresos = egresos.rows.reduce((s, e) => s + parseFloat(e.total), 0);
    const total_ingresos = parseFloat(ingresos.rows[0].cuotas_cobradas);
    const superavit = total_ingresos - total_egresos;

    // Nómina del mes
    const nomina = await db.query(
      `SELECT COALESCE(SUM(monto),0) as total
       FROM pagos_salarios
       WHERE empleado_id IN (SELECT id FROM empleados WHERE condominio_id=$1)
         AND EXTRACT(YEAR FROM fecha_pago)=$2 AND EXTRACT(MONTH FROM fecha_pago)=$3`,
      [req.params.condominioId, y, m]
    );

    // Fondo de reserva
    const fondo = await db.query(
      `SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE -monto END),0) as total
       FROM fondo_movimientos WHERE condominio_id=$1`,
      [req.params.condominioId]
    );

    res.json({
      periodo: { anio: y, mes: m },
      ingresos: {
        cuotas_cobradas: parseFloat(ingresos.rows[0].cuotas_cobradas),
        unidades_pagaron: parseInt(ingresos.rows[0].unidades_pagaron),
        cuotas_pendientes: parseFloat(pendientes.rows[0].monto_pendiente),
        unidades_morosas: parseInt(pendientes.rows[0].cant_morosos),
      },
      egresos: {
        total: total_egresos,
        por_categoria: egresos.rows,
        nomina: parseFloat(nomina.rows[0].total),
      },
      balance: {
        total_ingresos,
        total_egresos,
        superavit,
        fondo_reserva: parseFloat(fondo.rows[0].total),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET tendencia últimos N meses
router.get('/tendencia', ...guard, async (req, res) => {
  try {
    const meses = parseInt(req.query.meses || 6);
    const { rows } = await db.query(
      `SELECT p.anio, p.mes,
              COALESCE(SUM(pg.monto),0) as ingresos,
              COALESCE((SELECT SUM(g.monto) FROM gastos g
                        WHERE g.condominio_id=p.condominio_id
                          AND EXTRACT(YEAR FROM g.fecha)=p.anio
                          AND EXTRACT(MONTH FROM g.fecha)=p.mes),0) as egresos
       FROM periodos p
       LEFT JOIN cuotas cu ON cu.periodo_id=p.id
       LEFT JOIN pagos pg ON pg.cuota_id=cu.id
       WHERE p.condominio_id=$1
       GROUP BY p.anio, p.mes, p.condominio_id
       ORDER BY p.anio DESC, p.mes DESC
       LIMIT $2`,
      [req.params.condominioId, meses]
    );
    res.json({ tendencia: rows.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET reporte de morosidad
router.get('/morosidad', ...guard, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.numero, u.tipo,
              usr.nombre||' '||usr.apellido as propietario,
              usr.telefono, usr.email,
              COUNT(cu.id) as meses_pendientes,
              SUM(cu.monto + cu.recargo - COALESCE(pag.pagado,0)) as deuda_total,
              MIN(p.anio||'-'||LPAD(p.mes::text,2,'0')) as desde
       FROM unidades u
       JOIN cuotas cu ON cu.unidad_id=u.id
       JOIN periodos p ON p.id=cu.periodo_id
       LEFT JOIN residentes r ON r.unidad_id=u.id AND r.tipo_residente='propietario' AND r.activo=true
       LEFT JOIN usuarios usr ON usr.id=r.usuario_id
       LEFT JOIN (SELECT cuota_id, SUM(monto) as pagado FROM pagos GROUP BY cuota_id) pag ON pag.cuota_id=cu.id
       WHERE u.condominio_id=$1 AND cu.estado='pendiente'
         AND (cu.monto + cu.recargo - COALESCE(pag.pagado,0)) > 0
       GROUP BY u.numero, u.tipo, usr.nombre, usr.apellido, usr.telefono, usr.email
       ORDER BY deuda_total DESC`,
      [req.params.condominioId]
    );
    res.json({ morosos: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET fondo de reserva movimientos
router.get('/fondo', ...guard, async (req, res) => {
  try {
    const movimientos = await db.query(
      `SELECT fm.*, u.nombre||' '||u.apellido as registrado_por_nombre
       FROM fondo_movimientos fm
       LEFT JOIN usuarios u ON u.id=fm.registrado_por
       WHERE fm.condominio_id=$1 ORDER BY fm.fecha DESC LIMIT 50`,
      [req.params.condominioId]
    );
    const saldo = await db.query(
      `SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE -monto END),0) as total
       FROM fondo_movimientos WHERE condominio_id=$1`,
      [req.params.condominioId]
    );
    res.json({ movimientos: movimientos.rows, saldo: parseFloat(saldo.rows[0].total) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fondo', ...guard, async (req, res) => {
  try {
    const { tipo, concepto, monto, fecha } = req.body;
    const { rows } = await db.query(
      `INSERT INTO fondo_movimientos (condominio_id,tipo,concepto,monto,fecha,registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.condominioId, tipo, concepto, monto, fecha||new Date(), req.user.id]
    );
    res.status(201).json({ movimiento: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
