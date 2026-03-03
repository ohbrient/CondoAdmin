const router = require('express').Router();
const db = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');

router.get('/:condominioId/gastos', auth, async (req, res) => {
  try {
    const { mes, año, categoria } = req.query;
    let q = `SELECT * FROM gastos WHERE condominio_id=$1`;
    const params = [req.params.condominioId];
    if (mes) { params.push(mes); q += ` AND EXTRACT(MONTH FROM fecha)=$${params.length}`; }
    if (año) { params.push(año); q += ` AND EXTRACT(YEAR FROM fecha)=$${params.length}`; }
    if (categoria) { params.push(categoria); q += ` AND categoria=$${params.length}`; }
    q += ' ORDER BY fecha DESC';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:condominioId/gastos', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { concepto, descripcion, categoria, monto, fecha, proveedor, factura_numero } = req.body;
    const { rows } = await db.query(
      `INSERT INTO gastos (condominio_id, concepto, descripcion, categoria, monto, fecha, proveedor, factura_numero, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.condominioId, concepto, descripcion, categoria, monto, fecha||new Date(), proveedor, factura_numero, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:condominioId/gastos/:id', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { concepto, descripcion, categoria, monto, fecha, proveedor, factura_numero } = req.body;
    const { rows } = await db.query(
      `UPDATE gastos SET concepto=$1,descripcion=$2,categoria=$3,monto=$4,fecha=$5,proveedor=$6,factura_numero=$7
       WHERE id=$8 AND condominio_id=$9 RETURNING *`,
      [concepto, descripcion, categoria, monto, fecha, proveedor, factura_numero, req.params.id, req.params.condominioId]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:condominioId/gastos/:id', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM gastos WHERE id=$1 AND condominio_id=$2', [req.params.id, req.params.condominioId]);
    res.json({ message: 'Gasto eliminado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:condominioId/gastos/resumen', auth, async (req, res) => {
  try {
    const { año } = req.query;
    const y = año || new Date().getFullYear();
    const { rows } = await db.query(
      `SELECT categoria, COALESCE(SUM(monto),0) as total, COUNT(*) as cantidad
       FROM gastos WHERE condominio_id=$1 AND EXTRACT(YEAR FROM fecha)=$2
       GROUP BY categoria ORDER BY total DESC`, [req.params.condominioId, y]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
