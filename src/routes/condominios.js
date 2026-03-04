const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db     = require('../config/db');
const { authenticate, requireRole, requireCondoAccess } = require('../middleware/auth');

const isSA = [authenticate, requireRole('superadmin')];
const isAdminOrSA = [authenticate, requireRole('superadmin', 'admin')];

// ── SUPERADMIN: gestión global ─────────────────────────────

// GET /api/condominios — lista todos (superadmin) o los del admin
router.get('/', authenticate, async (req, res) => {
  try {
    let query, params = [];
    if (req.user.rol === 'superadmin') {
      query = `SELECT c.*, u.nombre||' '||u.apellido as admin_nombre,
                      (SELECT COUNT(*) FROM unidades WHERE condominio_id=c.id) as total_unidades
               FROM condominios c
               LEFT JOIN condominio_admins ca ON ca.condominio_id=c.id
               LEFT JOIN usuarios u ON u.id=ca.usuario_id
               ORDER BY c.created_at DESC`;
    } else {
      query = `SELECT c.*,
                      (SELECT COUNT(*) FROM unidades WHERE condominio_id=c.id) as total_unidades
               FROM condominios c
               JOIN condominio_admins ca ON ca.condominio_id=c.id
               WHERE ca.usuario_id=$1 AND c.activo=true
               ORDER BY c.nombre`;
      params = [req.user.id];
    }
    const { rows } = await db.query(query, params);
    res.json({ condominios: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/condominios/:condominioId
router.get('/:condominioId', authenticate, requireCondoAccess, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM unidades WHERE condominio_id=c.id) as total_unidades,
              (SELECT COUNT(*) FROM empleados WHERE condominio_id=c.id AND activo=true) as total_empleados
       FROM condominios c WHERE c.id=$1`,
      [req.params.condominioId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Condominio no encontrado' });
    res.json({ condominio: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/condominios — crear condominio (superadmin)
router.post('/', ...isSA, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { nombre, direccion, ciudad, pais, telefono, email, moneda, cuota_base, recargo_mora, dias_gracia,
            admin_nombre, admin_apellido, admin_email, admin_password } = req.body;

    // Crear condominio
    const { rows: [condo] } = await client.query(
      `INSERT INTO condominios (nombre,direccion,ciudad,pais,telefono,email,moneda,cuota_base,recargo_mora,dias_gracia,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [nombre, direccion, ciudad, pais||'República Dominicana', telefono, email,
       moneda||'DOP', cuota_base||0, recargo_mora||5, dias_gracia||5, req.user.id]
    );

    // Crear admin del condominio si se proporcionaron datos
    if (admin_email && admin_password) {
      let adminUser;
      const existing = await client.query('SELECT id FROM usuarios WHERE email=$1', [admin_email]);
      if (existing.rows.length) {
        adminUser = existing.rows[0];
      } else {
        const hash = await bcrypt.hash(admin_password, 10);
        const { rows: [u] } = await client.query(
          `INSERT INTO usuarios (nombre,apellido,email,password_hash,rol)
           VALUES ($1,$2,$3,$4,'admin') RETURNING id`,
          [admin_nombre, admin_apellido, admin_email, hash]
        );
        adminUser = u;
      }
      await client.query(
        'INSERT INTO condominio_admins (condominio_id,usuario_id) VALUES ($1,$2)',
        [condo.id, adminUser.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ condominio: condo });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/condominios/:condominioId
router.put('/:condominioId', authenticate, requireCondoAccess, async (req, res) => {
  try {
    const { nombre,direccion,ciudad,pais,telefono,email,moneda,cuota_base,recargo_mora,dias_gracia,logo_url } = req.body;
    const { rows } = await db.query(
      `UPDATE condominios SET nombre=$1,direccion=$2,ciudad=$3,pais=$4,telefono=$5,email=$6,
       moneda=$7,cuota_base=$8,recargo_mora=$9,dias_gracia=$10,logo_url=$11,updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [nombre,direccion,ciudad,pais,telefono,email,moneda,cuota_base,recargo_mora,dias_gracia,logo_url,req.params.condominioId]
    );
    res.json({ condominio: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/condominios/:condominioId (soft delete)
router.delete('/:condominioId', ...isSA, async (req, res) => {
  try {
    await db.query('UPDATE condominios SET activo=false WHERE id=$1', [req.params.condominioId]);
    res.json({ message: 'Condominio desactivado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DASHBOARD del condominio ───────────────────────────────
router.get('/:condominioId/dashboard', authenticate, requireCondoAccess, async (req, res) => {
  try {
    const id = req.params.condominioId;
    const now = new Date();
    const anio = now.getFullYear();
    const mes  = now.getMonth() + 1;

    const [unidades, morosos, ingresosMes, egresosMes, fondo, empleados, solicitudes] = await Promise.all([
      db.query('SELECT COUNT(*) FROM unidades WHERE condominio_id=$1', [id]),
      db.query(
        `SELECT COUNT(*) FROM cuotas cu
         JOIN unidades u ON u.id=cu.unidad_id
         JOIN periodos p ON p.id=cu.periodo_id
         WHERE u.condominio_id=$1 AND p.anio=$2 AND p.mes=$3 AND cu.estado='pendiente'`,
        [id, anio, mes]
      ),
      db.query(
        `SELECT COALESCE(SUM(pg.monto),0) as total FROM pagos pg
         JOIN cuotas cu ON cu.id=pg.cuota_id
         JOIN unidades u ON u.id=cu.unidad_id
         JOIN periodos p ON p.id=cu.periodo_id
         WHERE u.condominio_id=$1 AND p.anio=$2 AND p.mes=$3`,
        [id, anio, mes]
      ),
      db.query(
        `SELECT COALESCE(SUM(monto),0) as total FROM gastos
         WHERE condominio_id=$1 AND EXTRACT(YEAR FROM fecha)=$2 AND EXTRACT(MONTH FROM fecha)=$3`,
        [id, anio, mes]
      ),
      db.query(
        `SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE -monto END),0) as total
         FROM fondo_movimientos WHERE condominio_id=$1`,
        [id]
      ),
      db.query('SELECT COUNT(*) FROM empleados WHERE condominio_id=$1 AND activo=true', [id]),
      db.query(
        `SELECT COUNT(*) FROM solicitudes WHERE condominio_id=$1 AND estado IN ('abierto','en_proceso')`,
        [id]
      ),
    ]);

    // Balance últimos 6 meses
    const balanceMeses = await db.query(
      `SELECT p.anio, p.mes,
              COALESCE(SUM(pg.monto),0) as ingresos
       FROM periodos p
       LEFT JOIN cuotas cu ON cu.periodo_id=p.id
       LEFT JOIN pagos pg ON pg.cuota_id=cu.id
       WHERE p.condominio_id=$1
       GROUP BY p.anio, p.mes
       ORDER BY p.anio DESC, p.mes DESC
       LIMIT 6`,
      [id]
    );

    res.json({
      totales: {
        unidades: parseInt(unidades.rows[0].count),
        morosos: parseInt(morosos.rows[0].count),
        ingresos_mes: parseFloat(ingresosMes.rows[0].total),
        egresos_mes: parseFloat(egresosMes.rows[0].total),
        fondo_reserva: parseFloat(fondo.rows[0].total),
        empleados: parseInt(empleados.rows[0].count),
        solicitudes_abiertas: parseInt(solicitudes.rows[0].count),
      },
      balance_meses: balanceMeses.rows.reverse(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMINS del condominio (superadmin) ──────────────────────
router.get('/:condominioId/admins', ...isSA, async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.nombre, u.apellido, u.email, u.activo, ca.created_at as asignado_el
     FROM usuarios u JOIN condominio_admins ca ON ca.usuario_id=u.id
     WHERE ca.condominio_id=$1`,
    [req.params.condominioId]
  );
  res.json({ admins: rows });
});

router.post('/:condominioId/admins', ...isSA, async (req, res) => {
  try {
    const { usuario_id } = req.body;
    await db.query(
      'INSERT INTO condominio_admins (condominio_id,usuario_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.condominioId, usuario_id]
    );
    res.json({ message: 'Admin asignado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
