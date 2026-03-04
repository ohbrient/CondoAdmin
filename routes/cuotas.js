const router = require('express').Router();
const db = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── PERÍODOS ────────────────────────────────────────────────────────────────

// GET todos los periodos
router.get('/:condominioId/cuotas', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM periodos_cuota WHERE condominio_id=$1 ORDER BY anio DESC, mes DESC`,
      [req.params.condominioId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST crear periodo
router.post('/:condominioId/cuotas/periodo', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { año, mes, cuota_monto, fecha_limite } = req.body;
    const { rows: unidades } = await db.query(
      `SELECT id FROM unidades WHERE condominio_id=$1 AND estado='ocupado'`,
      [req.params.condominioId]
    );
    const { rows: [periodo] } = await db.query(
      `INSERT INTO periodos_cuota (condominio_id, anio, mes, cuota_monto, fecha_limite, cargo_gas_comun)
       VALUES ($1,$2,$3,$4,$5,0) RETURNING *`,
      [req.params.condominioId, año, mes, cuota_monto, fecha_limite]
    );
    for (const u of unidades) {
      await db.query(
        `INSERT INTO pagos_cuota (periodo_id, unidad_id, monto_cuota, monto_gas_comun, estado)
         VALUES ($1,$2,$3,0,'pendiente') ON CONFLICT DO NOTHING`,
        [periodo.id, u.id, cuota_monto]
      );
    }
    res.status(201).json({ ...periodo, cobros_generados: unidades.length });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Ya existe un período para ese mes y año' });
    res.status(500).json({ error: err.message });
  }
});

// GET morosos — va ANTES de /:periodoId para evitar conflictos
router.get('/:condominioId/cuotas/morosos', auth, async (req, res) => {
  try {
    // Usar el período más reciente, no forzar mes actual
    const { rows: periodos } = await db.query(
      `SELECT id FROM periodos_cuota WHERE condominio_id=$1 ORDER BY anio DESC, mes DESC LIMIT 1`,
      [req.params.condominioId]
    );
    if (!periodos.length) return res.json([]);
    const periodoId = periodos[0].id;

    const { rows } = await db.query(
      `SELECT u.numero, u.tipo,
        pc.monto_cuota, pc.monto_gas_comun, pc.monto_pagado, pc.estado,
        GREATEST(0, CURRENT_DATE - p.fecha_limite) AS dias_atraso,
        p.fecha_limite,
        COALESCE(json_agg(DISTINCT jsonb_build_object('nombre',us.nombre,'apellido',us.apellido))
          FILTER (WHERE us.id IS NOT NULL), '[]') AS residentes
       FROM pagos_cuota pc
       JOIN periodos_cuota p ON p.id = pc.periodo_id
       JOIN unidades u ON u.id = pc.unidad_id
       LEFT JOIN unidad_residentes ur ON ur.unidad_id = u.id AND ur.activo = true
       LEFT JOIN usuarios us ON us.id = ur.usuario_id
       WHERE pc.periodo_id=$1 AND pc.estado IN ('pendiente','parcial','en_revision')
       GROUP BY u.numero, u.tipo, pc.monto_cuota, pc.monto_gas_comun, pc.monto_pagado, pc.estado, p.fecha_limite
       ORDER BY pc.estado DESC, u.numero ASC`,
      [periodoId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET pagos de un periodo — va DESPUÉS de /morosos
router.get('/:condominioId/cuotas/:periodoId/pagos', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT pc.*,
        u.numero AS unidad_numero, u.tipo AS unidad_tipo,
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'nombre', us.nombre, 'apellido', us.apellido
        )) FILTER (WHERE us.id IS NOT NULL), '[]') AS residentes
       FROM pagos_cuota pc
       JOIN unidades u ON u.id = pc.unidad_id
       LEFT JOIN unidad_residentes ur ON ur.unidad_id = u.id AND ur.activo = true
       LEFT JOIN usuarios us ON us.id = ur.usuario_id
       WHERE pc.periodo_id = $1
       GROUP BY pc.id, u.numero, u.tipo
       ORDER BY u.numero`,
      [req.params.periodoId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── OPERACIONES SOBRE UN PAGO ───────────────────────────────────────────────

// PATCH — actualizar solo el gas (editar factura)
router.patch('/:condominioId/cuotas/pagos/:pagoId/gas', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE pagos_cuota SET monto_gas_comun=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [parseFloat(req.body.monto_gas_comun)||0, req.params.pagoId]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH — reversar pago (volver a pendiente)
router.patch('/:condominioId/cuotas/pagos/:pagoId/reversar', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE pagos_cuota
       SET monto_pagado=0, estado='pendiente', metodo_pago=NULL, referencia=NULL,
           notas=NULL, fecha_pago=NULL, comprobante_url=NULL, updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.pagoId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT — registrar pago
router.put('/:condominioId/cuotas/pagos/:pagoId', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { monto_pagado, monto_gas_comun, metodo_pago, referencia, notas, fecha_pago } = req.body;
    const gas   = parseFloat(monto_gas_comun||0);
    const monto = parseFloat(monto_pagado);
    const { rows: [pago] } = await db.query(`SELECT * FROM pagos_cuota WHERE id=$1`, [req.params.pagoId]);
    const totalACobrar = parseFloat(pago.monto_cuota) + gas;
    const totalPagado  = parseFloat(pago.monto_pagado||0) + monto;
    const estado = totalPagado >= totalACobrar ? 'pagado' : 'parcial';
    const { rows } = await db.query(
      `UPDATE pagos_cuota SET monto_pagado=$1, monto_gas_comun=$2, estado=$3, metodo_pago=$4,
         referencia=$5, notas=$6, fecha_pago=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [totalPagado, gas, estado, metodo_pago, referencia, notas, fecha_pago, req.params.pagoId]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE — eliminar factura
router.delete('/:condominioId/cuotas/pagos/:pagoId', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    await db.query(`DELETE FROM pagos_cuota WHERE id=$1`, [req.params.pagoId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── COMPROBANTE ─────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/comprobantes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `pago-${req.params.pagoId}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/:condominioId/cuotas/pagos/:pagoId/comprobante', auth, upload.single('comprobante'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    const url = `/uploads/comprobantes/${req.file.filename}`;
    await db.query(
      `UPDATE pagos_cuota SET comprobante_url=$1, estado='en_revision' WHERE id=$2`,
      [url, req.params.pagoId]
    );
    res.json({ url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST comprobante subido por el admin (no cambia estado a en_revision)
router.post('/:condominioId/cuotas/pagos/:pagoId/comprobante-admin', auth, requireRole('superadmin','admin'), upload.single('comprobante'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    const url = `/uploads/comprobantes/${req.file.filename}`;
    await db.query(`UPDATE pagos_cuota SET comprobante_url=$1 WHERE id=$2`, [url, req.params.pagoId]);
    res.json({ url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
