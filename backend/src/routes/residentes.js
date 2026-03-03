const router = require('express').Router({ mergeParams: true });
const bcrypt = require('bcryptjs');
const db     = require('../config/db');
const { authenticate, requireRole, requireCondoAccess } = require('../middleware/auth');

const guard = [authenticate, requireCondoAccess];

// ══ UNIDADES ══════════════════════════════════════════════

// GET /api/condominios/:condominioId/unidades
router.get('/unidades', ...guard, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.*,
              COALESCE(u.cuota_custom, c.cuota_base) as cuota,
              r.tipo_residente,
              usr.nombre||' '||usr.apellido as propietario_nombre,
              usr.telefono as propietario_telefono,
              usr.email as propietario_email,
              usr.id as usuario_id,
              (SELECT estado FROM cuotas cu
               JOIN periodos p ON p.id=cu.periodo_id
               WHERE cu.unidad_id=u.id AND p.anio=EXTRACT(YEAR FROM NOW())
                 AND p.mes=EXTRACT(MONTH FROM NOW())
               LIMIT 1) as estado_cuota_actual
       FROM unidades u
       JOIN condominios c ON c.id=u.condominio_id
       LEFT JOIN residentes r ON r.unidad_id=u.id AND r.activo=true AND r.tipo_residente='propietario'
       LEFT JOIN usuarios usr ON usr.id=r.usuario_id
       WHERE u.condominio_id=$1 AND u.activa=true
       ORDER BY u.numero`,
      [req.params.condominioId]
    );
    res.json({ unidades: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/condominios/:condominioId/unidades
router.post('/unidades', ...guard, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { numero, tipo, piso, metros2, habitaciones, cuota_custom,
            propietario_nombre, propietario_apellido, propietario_email,
            propietario_telefono, propietario_password } = req.body;

    const { rows: [unidad] } = await client.query(
      `INSERT INTO unidades (condominio_id,numero,tipo,piso,metros2,habitaciones,cuota_custom)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.condominioId, numero, tipo||'apartamento', piso, metros2, habitaciones, cuota_custom]
    );

    // Crear usuario propietario si se proporcionó email
    if (propietario_email) {
      let usuario;
      const ex = await client.query('SELECT id FROM usuarios WHERE email=$1', [propietario_email]);
      if (ex.rows.length) {
        usuario = ex.rows[0];
      } else {
        const pwd = propietario_password || Math.random().toString(36).slice(-8);
        const hash = await bcrypt.hash(pwd, 10);
        const { rows: [u] } = await client.query(
          `INSERT INTO usuarios (nombre,apellido,email,password_hash,telefono,rol)
           VALUES ($1,$2,$3,$4,$5,'residente') RETURNING id`,
          [propietario_nombre, propietario_apellido, propietario_email, hash, propietario_telefono]
        );
        usuario = u;
      }
      await client.query(
        `INSERT INTO residentes (usuario_id,unidad_id,tipo_residente,fecha_inicio)
         VALUES ($1,$2,'propietario',NOW())`,
        [usuario.id, unidad.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ unidad });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/condominios/:condominioId/unidades/:unidadId
router.put('/unidades/:unidadId', ...guard, async (req, res) => {
  try {
    const { numero, tipo, piso, metros2, habitaciones, cuota_custom } = req.body;
    const { rows } = await db.query(
      `UPDATE unidades SET numero=$1,tipo=$2,piso=$3,metros2=$4,habitaciones=$5,cuota_custom=$6
       WHERE id=$7 AND condominio_id=$8 RETURNING *`,
      [numero, tipo, piso, metros2, habitaciones, cuota_custom, req.params.unidadId, req.params.condominioId]
    );
    res.json({ unidad: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/condominios/:condominioId/unidades/:unidadId
router.delete('/unidades/:unidadId', ...guard, async (req, res) => {
  await db.query('UPDATE unidades SET activa=false WHERE id=$1', [req.params.unidadId]);
  res.json({ message: 'Unidad desactivada' });
});

// ══ RESIDENTES ═════════════════════════════════════════════

// GET /api/condominios/:condominioId/residentes
router.get('/residentes', ...guard, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT r.id, r.tipo_residente, r.activo, r.fecha_inicio, r.fecha_fin,
              u.id as usuario_id, u.nombre, u.apellido, u.email, u.telefono, u.foto_url,
              un.numero as unidad_numero, un.id as unidad_id, un.tipo as unidad_tipo
       FROM residentes r
       JOIN usuarios u ON u.id=r.usuario_id
       JOIN unidades un ON un.id=r.unidad_id
       WHERE un.condominio_id=$1 AND r.activo=true
       ORDER BY un.numero`,
      [req.params.condominioId]
    );
    res.json({ residentes: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/condominios/:condominioId/usuarios — crear usuario admin/residente
router.post('/usuarios', authenticate, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { nombre, apellido, email, password, telefono, rol } = req.body;
    const existing = await db.query('SELECT id FROM usuarios WHERE email=$1', [email]);
    if (existing.rows.length) return res.status(400).json({ error: 'Email ya registrado' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO usuarios (nombre,apellido,email,password_hash,telefono,rol)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,nombre,apellido,email,telefono,rol`,
      [nombre, apellido, email, hash, telefono, rol||'residente']
    );
    res.status(201).json({ usuario: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET usuarios del condominio (superadmin)
router.get('/usuarios', authenticate, requireRole('superadmin'), async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.activo, u.created_at
     FROM usuarios u
     WHERE u.rol != 'superadmin'
     ORDER BY u.created_at DESC`
  );
  res.json({ usuarios: rows });
});

module.exports = router;
