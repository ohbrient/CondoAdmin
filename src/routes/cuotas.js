const router = require('express').Router({ mergeParams: true });
const db     = require('../config/db');
const { authenticate, requireCondoAccess } = require('../middleware/auth');

const guard = [authenticate, requireCondoAccess];

// ══ PERÍODOS ════════════════════════════════════════════════

// GET períodos del condominio
router.get('/periodos', ...guard, async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM periodos WHERE condominio_id=$1 ORDER BY anio DESC, mes DESC',
    [req.params.condominioId]
  );
  res.json({ periodos: rows });
});

// POST — crear período y generar cuotas para todas las unidades
router.post('/periodos', ...guard, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { anio, mes } = req.body;

    // Verificar si ya existe
    const ex = await client.query(
      'SELECT id FROM periodos WHERE condominio_id=$1 AND anio=$2 AND mes=$3',
      [req.params.condominioId, anio, mes]
    );
    if (ex.rows.length) return res.status(400).json({ error: 'Período ya existe' });

    // Crear período
    const { rows: [periodo] } = await client.query(
      'INSERT INTO periodos (condominio_id,anio,mes) VALUES ($1,$2,$3) RETURNING *',
      [req.params.condominioId, anio, mes]
    );

    // Obtener cuota base y días de gracia
    const { rows: [condo] } = await client.query(
      'SELECT cuota_base, dias_gracia FROM condominios WHERE id=$1',
      [req.params.condominioId]
    );

    // Generar cuota para cada unidad activa
    const { rows: unidades } = await client.query(
      'SELECT id, COALESCE(cuota_custom,$1) as cuota FROM unidades WHERE condominio_id=$2 AND activa=true',
      [condo.cuota_base, req.params.condominioId]
    );

    const fechaLimite = new Date(anio, mes - 1, condo.dias_gracia || 5);
    for (const u of unidades) {
      await client.query(
        'INSERT INTO cuotas (unidad_id,periodo_id,monto,fecha_limite) VALUES ($1,$2,$3,$4)',
        [u.id, periodo.id, u.cuota, fechaLimite.toISOString().split('T')[0]]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ periodo, cuotas_generadas: unidades.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ══ CUOTAS ═════════════════════════════════════════════════

// GET cuotas del período con estado de pago
router.get('/cuotas', ...guard, async (req, res) => {
  try {
    const { anio, mes } = req.query;
    const now = new Date();
    const q_anio = anio || now.getFullYear();
    const q_mes  = mes  || now.getMonth() + 1;

    const { rows } = await db.query(
      `SELECT cu.*,
              u.numero as unidad_numero, u.tipo as unidad_tipo,
              COALESCE(SUM(pg.monto),0) as pagado,
              (cu.monto + cu.recargo - COALESCE(SUM(pg.monto),0)) as saldo,
              usr.nombre||' '||usr.apellido as propietario_nombre,
              usr.telefono as propietario_telefono,
              EXTRACT(DAY FROM NOW() - cu.fecha_limite)::int as dias_mora
       FROM cuotas cu
       JOIN unidades u ON u.id=cu.unidad_id
       JOIN periodos p ON p.id=cu.periodo_id
       LEFT JOIN residentes r ON r.unidad_id=u.id AND r.tipo_residente='propietario' AND r.activo=true
       LEFT JOIN usuarios usr ON usr.id=r.usuario_id
       LEFT JOIN pagos pg ON pg.cuota_id=cu.id
       WHERE u.condominio_id=$1 AND p.anio=$2 AND p.mes=$3
       GROUP BY cu.id, u.numero, u.tipo, usr.nombre, usr.apellido, usr.telefono
       ORDER BY cu.estado, dias_mora DESC NULLS LAST`,
      [req.params.condominioId, q_anio, q_mes]
    );
    res.json({ cuotas: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET morosos
router.get('/morosos', ...guard, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT cu.id, cu.monto, cu.recargo, cu.fecha_limite, cu.estado,
              u.numero as unidad_numero,
              COALESCE(SUM(pg.monto),0) as pagado,
              (cu.monto + cu.recargo - COALESCE(SUM(pg.monto),0)) as saldo,
              usr.nombre||' '||usr.apellido as propietario_nombre,
              usr.telefono,
              EXTRACT(DAY FROM NOW() - cu.fecha_limite)::int as dias_mora,
              p.anio, p.mes
       FROM cuotas cu
       JOIN unidades u ON u.id=cu.unidad_id
       JOIN periodos p ON p.id=cu.periodo_id
       LEFT JOIN residentes r ON r.unidad_id=u.id AND r.tipo_residente='propietario' AND r.activo=true
       LEFT JOIN usuarios usr ON usr.id=r.usuario_id
       LEFT JOIN pagos pg ON pg.cuota_id=cu.id
       WHERE u.condominio_id=$1 AND cu.estado='pendiente' AND cu.fecha_limite < NOW()
       GROUP BY cu.id, u.numero, usr.nombre, usr.apellido, usr.telefono, p.anio, p.mes
       HAVING (cu.monto + cu.recargo - COALESCE(SUM(pg.monto),0)) > 0
       ORDER BY dias_mora DESC`,
      [req.params.condominioId]
    );
    res.json({ morosos: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══ PAGOS ══════════════════════════════════════════════════

// GET pagos del período
router.get('/pagos', ...guard, async (req, res) => {
  try {
    const { anio, mes } = req.query;
    const now = new Date();
    const { rows } = await db.query(
      `SELECT pg.*, cu.monto as cuota_monto,
              u.numero as unidad_numero,
              usr.nombre||' '||usr.apellido as propietario_nombre,
              reg.nombre||' '||reg.apellido as registrado_por_nombre,
              p.anio, p.mes
       FROM pagos pg
       JOIN cuotas cu ON cu.id=pg.cuota_id
       JOIN unidades u ON u.id=cu.unidad_id
       JOIN periodos p ON p.id=cu.periodo_id
       LEFT JOIN residentes r ON r.unidad_id=u.id AND r.tipo_residente='propietario' AND r.activo=true
       LEFT JOIN usuarios usr ON usr.id=r.usuario_id
       LEFT JOIN usuarios reg ON reg.id=pg.registrado_por
       WHERE u.condominio_id=$1 AND p.anio=$2 AND p.mes=$3
       ORDER BY pg.fecha_pago DESC`,
      [req.params.condominioId, anio||now.getFullYear(), mes||now.getMonth()+1]
    );
    res.json({ pagos: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST registrar pago
router.post('/pagos', ...guard, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { cuota_id, monto, fecha_pago, metodo, referencia, notas, comprobante_url } = req.body;

    // Registrar pago
    const { rows: [pago] } = await client.query(
      `INSERT INTO pagos (cuota_id,registrado_por,monto,fecha_pago,metodo,referencia,notas,comprobante_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [cuota_id, req.user.id, monto, fecha_pago||new Date(), metodo||'efectivo', referencia, notas, comprobante_url]
    );

    // Actualizar estado de cuota
    const { rows: [cuota] } = await client.query(
      `SELECT cu.monto + cu.recargo as total,
              COALESCE(SUM(pg.monto),0) as pagado_total
       FROM cuotas cu LEFT JOIN pagos pg ON pg.cuota_id=cu.id
       WHERE cu.id=$1 GROUP BY cu.monto, cu.recargo`,
      [cuota_id]
    );
    const nuevoEstado = parseFloat(cuota.pagado_total) >= parseFloat(cuota.total) ? 'pagado' : 'parcial';
    await client.query('UPDATE cuotas SET estado=$1 WHERE id=$2', [nuevoEstado, cuota_id]);

    // Crear notificación para el residente
    const { rows: [unidadData] } = await client.query(
      `SELECT u.numero, r.usuario_id FROM cuotas cu
       JOIN unidades u ON u.id=cu.unidad_id
       JOIN residentes r ON r.unidad_id=u.id AND r.tipo_residente='propietario' AND r.activo=true
       WHERE cu.id=$1 LIMIT 1`,
      [cuota_id]
    );
    if (unidadData?.usuario_id) {
      await client.query(
        `INSERT INTO notificaciones (usuario_id,condominio_id,titulo,mensaje,tipo)
         VALUES ($1,$2,'Pago registrado','Se registró un pago de $'||$3||' para la unidad '||$4,'pago')`,
        [unidadData.usuario_id, req.params.condominioId, monto, unidadData.numero]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ pago });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ══ ESTADO DE CUENTA (residente) ═══════════════════════════
router.get('/mi-estado-cuenta', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT cu.id, cu.monto, cu.recargo, cu.estado, cu.fecha_limite,
              COALESCE(SUM(pg.monto),0) as pagado,
              (cu.monto + cu.recargo - COALESCE(SUM(pg.monto),0)) as saldo,
              p.anio, p.mes,
              u.numero as unidad_numero
       FROM cuotas cu
       JOIN periodos p ON p.id=cu.periodo_id
       JOIN unidades u ON u.id=cu.unidad_id
       JOIN residentes r ON r.unidad_id=u.id
       LEFT JOIN pagos pg ON pg.cuota_id=cu.id
       WHERE r.usuario_id=$1 AND r.activo=true AND u.condominio_id=$2
       GROUP BY cu.id, p.anio, p.mes, u.numero
       ORDER BY p.anio DESC, p.mes DESC`,
      [req.user.id, req.params.condominioId]
    );
    res.json({ estado_cuenta: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
