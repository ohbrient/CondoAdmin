const router = require('express').Router();
const db = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');

// GET acuerdos de un condominio
router.get('/:condominioId/acuerdos', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.*,
        u.numero AS unidad_numero, u.tipo AS unidad_tipo,
        COALESCE(json_agg(DISTINCT jsonb_build_object('nombre',us.nombre,'apellido',us.apellido))
          FILTER (WHERE us.id IS NOT NULL), '[]') AS residentes,
        (SELECT COALESCE(SUM(ab.monto),0) FROM abonos_acuerdo ab WHERE ab.acuerdo_id = a.id) AS total_abonado
       FROM acuerdos_pago a
       JOIN unidades u ON u.id = a.unidad_id
       LEFT JOIN unidad_residentes ur ON ur.unidad_id = u.id AND ur.activo = true
       LEFT JOIN usuarios us ON us.id = ur.usuario_id
       WHERE a.condominio_id = $1
       GROUP BY a.id, u.numero, u.tipo
       ORDER BY a.created_at DESC`,
      [req.params.condominioId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET deuda pendiente de una unidad (cuotas sin pagar)
router.get('/:condominioId/acuerdos/deuda/:unidadId', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT pc.id, pc.monto_cuota, pc.monto_gas_comun, pc.monto_pagado, pc.estado,
        p.mes, p.anio, p.fecha_limite,
        (pc.monto_cuota + COALESCE(pc.monto_gas_comun,0) - COALESCE(pc.monto_pagado,0)) AS saldo
       FROM pagos_cuota pc
       JOIN periodos_cuota p ON p.id = pc.periodo_id
       WHERE pc.unidad_id = $1 AND pc.estado IN ('pendiente','parcial')
       ORDER BY p.anio ASC, p.mes ASC`,
      [req.params.unidadId]
    );
    const total = rows.reduce((s, r) => s + parseFloat(r.saldo||0), 0);
    res.json({ cuotas: rows, total_deuda: total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST crear acuerdo
router.post('/:condominioId/acuerdos', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { unidad_id, tipo, monto_cuota_acuerdo, num_cuotas, notas } = req.body;

    // Calcular deuda total actual
    const { rows: deuda } = await db.query(
      `SELECT COALESCE(SUM(pc.monto_cuota + COALESCE(pc.monto_gas_comun,0) - COALESCE(pc.monto_pagado,0)),0) AS total
       FROM pagos_cuota pc
       JOIN periodos_cuota p ON p.id = pc.periodo_id
       WHERE pc.unidad_id = $1 AND pc.estado IN ('pendiente','parcial')`,
      [unidad_id]
    );
    const total_deuda = parseFloat(deuda[0].total);
    if (total_deuda <= 0) return res.status(400).json({ error: 'Esta unidad no tiene cuotas pendientes' });

    // Calcular monto por cuota si es por número de cuotas
    const montoCuota = tipo === 'num_cuotas'
      ? parseFloat((total_deuda / parseInt(num_cuotas)).toFixed(2))
      : parseFloat(monto_cuota_acuerdo);

    const numCuotas = tipo === 'num_cuotas'
      ? parseInt(num_cuotas)
      : Math.ceil(total_deuda / montoCuota);

    const { rows: [acuerdo] } = await db.query(
      `INSERT INTO acuerdos_pago (condominio_id, unidad_id, total_deuda, tipo, monto_cuota_acuerdo, num_cuotas, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.condominioId, unidad_id, total_deuda, tipo, montoCuota, numCuotas, notas]
    );
    res.status(201).json(acuerdo);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST registrar abono — distribuye entre cuotas más antiguas primero
router.post('/:condominioId/acuerdos/:acuerdoId/abono', auth, requireRole('superadmin','admin'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { monto, metodo_pago, referencia, notas, fecha_pago } = req.body;
    let montoRestante = parseFloat(monto);

    // Verificar acuerdo
    const { rows: [acuerdo] } = await client.query(
      `SELECT * FROM acuerdos_pago WHERE id=$1`, [req.params.acuerdoId]
    );
    if (!acuerdo) return res.status(404).json({ error: 'Acuerdo no encontrado' });

    // Registrar el abono
    const { rows: [abono] } = await client.query(
      `INSERT INTO abonos_acuerdo (acuerdo_id, monto, metodo_pago, referencia, notas, fecha_pago)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [acuerdo.id, monto, metodo_pago, referencia, notas, fecha_pago || new Date().toISOString().split('T')[0]]
    );

    // Obtener cuotas pendientes ordenadas de más antigua a más nueva
    const { rows: cuotas } = await client.query(
      `SELECT pc.id, pc.monto_cuota, pc.monto_gas_comun, pc.monto_pagado, pc.estado,
        (pc.monto_cuota + COALESCE(pc.monto_gas_comun,0) - COALESCE(pc.monto_pagado,0)) AS saldo
       FROM pagos_cuota pc
       JOIN periodos_cuota p ON p.id = pc.periodo_id
       WHERE pc.unidad_id = $1 AND pc.estado IN ('pendiente','parcial')
       ORDER BY p.anio ASC, p.mes ASC`,
      [acuerdo.unidad_id]
    );

    // Distribuir el monto entre las cuotas
    const cuotasAfectadas = [];
    for (const cuota of cuotas) {
      if (montoRestante <= 0) break;
      const saldo = parseFloat(cuota.saldo);
      const abonoACuota = Math.min(montoRestante, saldo);
      const nuevoPagado = parseFloat(cuota.monto_pagado||0) + abonoACuota;
      const totalCuota = parseFloat(cuota.monto_cuota) + parseFloat(cuota.monto_gas_comun||0);
      const nuevoEstado = nuevoPagado >= totalCuota ? 'pagado' : 'parcial';

      await client.query(
        `UPDATE pagos_cuota SET monto_pagado=$1, estado=$2, metodo_pago=$3, fecha_pago=$4, updated_at=NOW()
         WHERE id=$5`,
        [nuevoPagado, nuevoEstado, metodo_pago, fecha_pago || new Date().toISOString().split('T')[0], cuota.id]
      );
      cuotasAfectadas.push({ id: cuota.id, abonado: abonoACuota, estado: nuevoEstado });
      montoRestante -= abonoACuota;
    }

    // Actualizar estado del acuerdo
    const { rows: [deudaActual] } = await client.query(
      `SELECT COALESCE(SUM(monto),0) AS total_abonado FROM abonos_acuerdo WHERE acuerdo_id=$1`,
      [acuerdo.id]
    );
    const totalAbonado = parseFloat(deudaActual.total_abonado);
    const nuevoEstado = totalAbonado >= parseFloat(acuerdo.total_deuda) ? 'completado' : 'activo';
    const cuotasPagadas = (acuerdo.cuotas_pagadas||0) + 1;

    await client.query(
      `UPDATE acuerdos_pago SET estado=$1, cuotas_pagadas=$2, updated_at=NOW() WHERE id=$3`,
      [nuevoEstado, cuotasPagadas, acuerdo.id]
    );

    await client.query('COMMIT');
    res.json({ abono, cuotas_afectadas: cuotasAfectadas, total_abonado: totalAbonado, estado_acuerdo: nuevoEstado });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// GET historial de abonos de un acuerdo
router.get('/:condominioId/acuerdos/:acuerdoId/abonos', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM abonos_acuerdo WHERE acuerdo_id=$1 ORDER BY fecha_pago DESC, created_at DESC`,
      [req.params.acuerdoId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH cancelar acuerdo
router.patch('/:condominioId/acuerdos/:acuerdoId/cancelar', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE acuerdos_pago SET estado='cancelado', updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.acuerdoId]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
