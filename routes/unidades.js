const router = require('express').Router();
const db = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');

router.get('/:condominioId/unidades', auth, async (req, res) => {
  try {
    const { estado } = req.query;
    const anio = new Date().getFullYear();
    const mes = new Date().getMonth() + 1;

    let q = `SELECT u.*,
      COALESCE(json_agg(DISTINCT jsonb_build_object(
        'id', us.id, 'nombre', us.nombre, 'apellido', us.apellido,
        'email', us.email, 'telefono', us.telefono, 'es_propietario', ur.es_propietario
      )) FILTER (WHERE us.id IS NOT NULL), '[]') AS residentes,
      pc.estado AS estado_pago,
      pc.monto_pagado, pc.monto_cuota
      FROM unidades u
      LEFT JOIN unidad_residentes ur ON ur.unidad_id = u.id AND ur.activo = true
      LEFT JOIN usuarios us ON us.id = ur.usuario_id
      LEFT JOIN periodos_cuota p ON p.condominio_id = u.condominio_id
        AND p.anio = $2 AND p.mes = $3
      LEFT JOIN pagos_cuota pc ON pc.unidad_id = u.id AND pc.periodo_id = p.id
      WHERE u.condominio_id = $1 ${estado ? 'AND u.estado = $4' : ''}
      GROUP BY u.id, pc.estado, pc.monto_pagado, pc.monto_cuota
      ORDER BY u.numero`;

    const params = estado ? [req.params.condominioId, anio, mes, estado] : [req.params.condominioId, anio, mes];
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error('Error unidades:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:condominioId/unidades', auth, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    // Verificar límite de unidades si está definido
    const { rows: condoRows } = await db.query(
      `SELECT max_unidades, (SELECT COUNT(*) FROM unidades WHERE condominio_id=$1) AS total FROM condominios WHERE id=$1`,
      [req.params.condominioId]
    );
    const condo = condoRows[0];
    if (condo?.max_unidades && parseInt(condo.total) >= parseInt(condo.max_unidades)) {
      return res.status(400).json({ error: `Límite de unidades alcanzado (${condo.max_unidades} máx). Contacta al super administrador para ampliar el límite.` });
    }

    const { numero, tipo, metros_cuadrados, piso, cuota_personalizada, notas, estado } = req.body;
    const { rows } = await db.query(
      `INSERT INTO unidades (condominio_id, numero, tipo, metros_cuadrados, piso, cuota_personalizada, notas, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.condominioId, numero, tipo||'apartamento', metros_cuadrados||null, piso||null, cuota_personalizada||null, notas||null, estado||'vacante']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Número de unidad ya existe' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:condominioId/unidades/:id', auth, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { numero, tipo, estado, metros_cuadrados, piso, cuota_personalizada, notas } = req.body;
    const { rows } = await db.query(
      `UPDATE unidades SET numero=$1,tipo=$2,estado=$3,metros_cuadrados=$4,piso=$5,cuota_personalizada=$6,notas=$7,updated_at=NOW()
       WHERE id=$8 AND condominio_id=$9 RETURNING *`,
      [numero, tipo, estado, metros_cuadrados||null, piso||null, cuota_personalizada||null, notas||null, req.params.id, req.params.condominioId]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:condominioId/unidades/:id/asignar-residente', auth, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { usuario_id, es_propietario } = req.body;
    await db.query(
      `INSERT INTO unidad_residentes (unidad_id, usuario_id, es_propietario)
       VALUES ($1,$2,$3) ON CONFLICT (unidad_id, usuario_id) DO UPDATE SET activo=true`,
      [req.params.id, usuario_id, es_propietario !== false]
    );
    await db.query(`UPDATE unidades SET estado='ocupado' WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Residente asignado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;