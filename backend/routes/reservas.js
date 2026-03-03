const router = require('express').Router();
const db = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');

// ── ÁREAS COMUNES ──────────────────────────────────────────────────────────

router.get('/:condominioId/areas', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM areas_comunes WHERE condominio_id=$1 ORDER BY nombre`,
      [req.params.condominioId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:condominioId/areas', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { nombre, descripcion, capacidad, precio_reserva, requiere_deposito, monto_deposito } = req.body;
    const { rows } = await db.query(
      `INSERT INTO areas_comunes (condominio_id, nombre, descripcion, capacidad, precio_reserva, requiere_deposito, monto_deposito)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.condominioId, nombre, descripcion, capacidad, precio_reserva||0, requiere_deposito||false, monto_deposito||0]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:condominioId/areas/:areaId', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { nombre, descripcion, capacidad, precio_reserva, requiere_deposito, monto_deposito, activa } = req.body;
    const { rows } = await db.query(
      `UPDATE areas_comunes SET nombre=$1, descripcion=$2, capacidad=$3, precio_reserva=$4,
       requiere_deposito=$5, monto_deposito=$6, activa=$7 WHERE id=$8 RETURNING *`,
      [nombre, descripcion, capacidad, precio_reserva||0, requiere_deposito||false, monto_deposito||0, activa, req.params.areaId]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:condominioId/areas/:areaId', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    await db.query(`UPDATE areas_comunes SET activa=false WHERE id=$1`, [req.params.areaId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── RESERVAS ───────────────────────────────────────────────────────────────

// GET todas las reservas del condominio (admin)
router.get('/:condominioId/reservas', auth, async (req, res) => {
  try {
    const { mes, anio, area_id } = req.query;
    let where = `WHERE a.condominio_id=$1`;
    const params = [req.params.condominioId];
    if (mes && anio) { params.push(anio, mes); where += ` AND EXTRACT(YEAR FROM r.fecha)=$${params.length-1} AND EXTRACT(MONTH FROM r.fecha)=$${params.length}`; }
    if (area_id) { params.push(area_id); where += ` AND r.area_id=$${params.length}`; }

    const { rows } = await db.query(
      `SELECT r.id, r.estado, r.motivo, r.num_personas, r.notas_admin,
        TO_CHAR(r.fecha, 'YYYY-MM-DD') AS fecha,
        TO_CHAR(r.hora_inicio, 'HH24:MI') AS hora_inicio,
        TO_CHAR(r.hora_fin, 'HH24:MI') AS hora_fin,
        a.nombre AS area_nombre, a.capacidad AS area_capacidad,
        u.numero AS unidad_numero,
        us.nombre AS residente_nombre, us.apellido AS residente_apellido
       FROM reservas r
       JOIN areas_comunes a ON a.id = r.area_id
       JOIN unidades u ON u.id = r.unidad_id
       LEFT JOIN usuarios us ON us.id = r.usuario_id
       ${where}
       ORDER BY r.fecha DESC, r.hora_inicio ASC`,
      params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET disponibilidad de un área en un mes (para el calendario)
router.get('/:condominioId/reservas/disponibilidad', auth, async (req, res) => {
  try {
    const { area_id, anio, mes } = req.query;
    const { rows } = await db.query(
      `SELECT r.id, r.estado, r.motivo, r.num_personas, r.notas_admin,
        TO_CHAR(r.fecha, 'YYYY-MM-DD') AS fecha,
        TO_CHAR(r.hora_inicio, 'HH24:MI') AS hora_inicio,
        TO_CHAR(r.hora_fin, 'HH24:MI') AS hora_fin,
        u.numero AS unidad_numero
       FROM reservas r
       JOIN unidades u ON u.id = r.unidad_id
       WHERE r.area_id=$1
         AND EXTRACT(YEAR FROM fecha)=$2
         AND EXTRACT(MONTH FROM fecha)=$3
         AND r.estado IN ('pendiente','aprobada')
       ORDER BY fecha, hora_inicio`,
      [area_id, anio, mes]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST crear reserva (residente o admin)
router.post('/:condominioId/reservas', auth, async (req, res) => {
  try {
    const { area_id, fecha, hora_inicio, hora_fin, motivo, num_personas } = req.body;

    // Verificar que no haya conflicto de horario
    const { rows: conflicto } = await db.query(
      `SELECT id FROM reservas
       WHERE area_id=$1 AND fecha=$2::date AND estado IN ('pendiente','aprobada')
         AND (hora_inicio < $4::time AND hora_fin > $3::time)`,
      [area_id, fecha, hora_inicio, hora_fin]
    );
    if (conflicto.length > 0) return res.status(409).json({ error: 'Ya existe una reserva en ese horario' });

    // Obtener unidad del residente
    let unidad_id = req.body.unidad_id;
    if (!unidad_id) {
      const { rows: ur } = await db.query(
        `SELECT unidad_id FROM unidad_residentes WHERE usuario_id=$1 AND activo=true LIMIT 1`,
        [req.user.id]
      );
      if (!ur.length) return res.status(400).json({ error: 'No tienes una unidad asignada' });
      unidad_id = ur[0].unidad_id;
    }

    const { rows } = await db.query(
      `INSERT INTO reservas (area_id, unidad_id, usuario_id, fecha, hora_inicio, hora_fin, motivo, num_personas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [area_id, unidad_id, req.user.id, fecha, hora_inicio, hora_fin, motivo, num_personas]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH aprobar/rechazar reserva (admin)
router.patch('/:condominioId/reservas/:reservaId/estado', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { estado, notas_admin } = req.body;
    const { rows } = await db.query(
      `UPDATE reservas SET estado=$1, notas_admin=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
      [estado, notas_admin, req.params.reservaId]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE cancelar reserva
router.delete('/:condominioId/reservas/:reservaId', auth, async (req, res) => {
  try {
    await db.query(`UPDATE reservas SET estado='cancelada', updated_at=NOW() WHERE id=$1`, [req.params.reservaId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET reservas del residente actual
router.get('/residente/mis-reservas', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT r.id, r.estado, r.motivo, r.num_personas, r.notas_admin,
        TO_CHAR(r.fecha, 'YYYY-MM-DD') AS fecha,
        TO_CHAR(r.hora_inicio, 'HH24:MI') AS hora_inicio,
        TO_CHAR(r.hora_fin, 'HH24:MI') AS hora_fin,
        a.nombre AS area_nombre, a.capacidad, a.precio_reserva
       FROM reservas r
       JOIN areas_comunes a ON a.id = r.area_id
       WHERE r.usuario_id=$1
       ORDER BY r.fecha DESC, r.hora_inicio ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
