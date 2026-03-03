const router = require('express').Router();
const db = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');

// Auto-migrar columna max_unidades
db.query(`ALTER TABLE condominios ADD COLUMN IF NOT EXISTS max_unidades INTEGER DEFAULT NULL`)
  .catch(err => console.error('Migración max_unidades:', err.message));


// GET /api/condominios
router.get('/', auth, async (req, res) => {
  try {
    let query, params = [];
    if (req.user.rol === 'superadmin') {
      query = `SELECT c.*,
        (SELECT COUNT(*) FROM unidades u WHERE u.condominio_id = c.id) AS total_unidades,
        (SELECT COUNT(*) FROM unidades u WHERE u.condominio_id = c.id AND u.estado = 'ocupado') AS ocupadas,
        u.nombre || ' ' || u.apellido AS superadmin_nombre
        FROM condominios c LEFT JOIN usuarios u ON u.id = c.superadmin_id
        ORDER BY c.created_at DESC`;
    } else if (req.user.rol === 'admin') {
      query = `SELECT c.*,
        (SELECT COUNT(*) FROM unidades u WHERE u.condominio_id = c.id) AS total_unidades,
        (SELECT COUNT(*) FROM unidades u WHERE u.condominio_id = c.id AND u.estado = 'ocupado') AS ocupadas
        FROM condominios c
        JOIN condominio_admins ca ON ca.condominio_id = c.id
        WHERE ca.usuario_id = $1 AND ca.activo = true
        ORDER BY c.nombre`;
      params = [req.user.id];
    } else {
      query = `SELECT c.id, c.nombre, c.direccion, c.logo_url, c.moneda, c.telefono, c.email, c.cuota_base, c.recargo_mora
        FROM condominios c
        JOIN unidades u ON u.condominio_id = c.id
        JOIN unidad_residentes ur ON ur.unidad_id = u.id
        WHERE ur.usuario_id = $1 AND ur.activo = true LIMIT 1`;
      params = [req.user.id];
    }
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/condominios
router.post('/', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const { nombre, direccion, ciudad, telefono, email, moneda, cuota_base, recargo_mora, dias_gracia, max_unidades } = req.body;
    const { rows } = await db.query(
      `INSERT INTO condominios (nombre, direccion, ciudad, telefono, email, moneda, cuota_base, recargo_mora, dias_gracia, superadmin_id, max_unidades)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [nombre, direccion, ciudad, telefono, email, moneda||'RD$', cuota_base||0, recargo_mora||5, dias_gracia||5, req.user.id, max_unidades||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/condominios/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM unidades WHERE condominio_id = c.id) AS total_unidades,
        (SELECT COUNT(*) FROM unidades WHERE condominio_id = c.id AND estado='ocupado') AS ocupadas,
        (SELECT COUNT(*) FROM empleados WHERE condominio_id = c.id AND activo=true) AS total_empleados,
        COALESCE((SELECT json_agg(json_build_object('id',u.id,'nombre',u.nombre,'apellido',u.apellido,'email',u.email))
          FROM condominio_admins ca JOIN usuarios u ON u.id=ca.usuario_id
          WHERE ca.condominio_id=c.id AND ca.activo=true), '[]') AS admins
       FROM condominios c WHERE c.id = $1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Condominio no encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/condominios/:id
router.put('/:id', auth, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { nombre, direccion, ciudad, telefono, email, moneda, cuota_base, recargo_mora, dias_gracia, max_unidades } = req.body;
    const { rows } = await db.query(
      `UPDATE condominios SET nombre=$1,direccion=$2,ciudad=$3,telefono=$4,email=$5,
       moneda=$6,cuota_base=$7,recargo_mora=$8,dias_gracia=$9,max_unidades=$10,updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [nombre, direccion, ciudad, telefono, email, moneda, cuota_base, recargo_mora, dias_gracia, max_unidades||null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/condominios/:id/admins — Asignar admin
router.post('/:id/admins', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const { usuario_id } = req.body;
    await db.query(
      `INSERT INTO condominio_admins (condominio_id, usuario_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.params.id, usuario_id]
    );
    await db.query(`UPDATE usuarios SET rol='admin' WHERE id=$1 AND rol='residente'`, [usuario_id]);
    res.json({ message: 'Admin asignado correctamente' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/condominios/:condominioId/dashboard
router.get('/:condominioId/dashboard', auth, async (req, res) => {
  try {
    const { condominioId } = req.params;
    const anio = new Date().getFullYear();
    const mes  = new Date().getMonth() + 1;

    // Usar el período más reciente creado (no forzar mes actual)
    const ultimoPeriodo = await db.query(
      `SELECT * FROM periodos_cuota WHERE condominio_id=$1 ORDER BY anio DESC, mes DESC LIMIT 1`,
      [condominioId]
    );
    const periodo = ultimoPeriodo.rows[0];

    // Si no hay período, devolver ceros
    if (!periodo) {
      return res.json({
        periodo: null, ingresos_mes: 0, unidades_pagadas: 0,
        gastos_mes: 0, morosos: 0, empleados_activos: 0,
      });
    }

    const [pagos, gastos_mes, morosos, empleados] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(monto_pagado),0) AS cobrado,
                COUNT(*) FILTER(WHERE estado='pagado') AS pagados
         FROM pagos_cuota pc
         JOIN periodos_cuota p ON p.id = pc.periodo_id
         WHERE p.id = $1`,
        [periodo.id]
      ),
      db.query(
        `SELECT COALESCE(SUM(monto),0) AS total FROM gastos
         WHERE condominio_id=$1
           AND EXTRACT(MONTH FROM fecha)=$2
           AND EXTRACT(YEAR FROM fecha)=$3`,
        [condominioId, parseInt(periodo.mes), parseInt(periodo.anio)]
      ),
      db.query(
        `SELECT COUNT(*) AS total FROM pagos_cuota pc
         JOIN periodos_cuota p ON p.id = pc.periodo_id
         WHERE p.id=$1 AND pc.estado IN ('pendiente','parcial','en_revision')`,
        [periodo.id]
      ),
      db.query(
        `SELECT COUNT(*) AS total FROM empleados WHERE condominio_id=$1 AND activo=true`,
        [condominioId]
      ),
    ]);

    res.json({
      periodo,
      ingresos_mes:     parseFloat(pagos.rows[0].cobrado),
      unidades_pagadas: parseInt(pagos.rows[0].pagados),
      gastos_mes:       parseFloat(gastos_mes.rows[0].total),
      morosos:          parseInt(morosos.rows[0].total),
      empleados_activos:parseInt(empleados.rows[0].total),
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
