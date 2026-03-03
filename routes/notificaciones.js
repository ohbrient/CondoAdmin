const router = require('express').Router();
const db = require('../config/database');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM notificaciones WHERE usuario_id=$1 ORDER BY created_at DESC LIMIT 50`, [req.user.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/leer', auth, async (req, res) => {
  try {
    await db.query('UPDATE notificaciones SET leida=true WHERE id=$1 AND usuario_id=$2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/leer-todas', auth, async (req, res) => {
  try {
    await db.query('UPDATE notificaciones SET leida=true WHERE usuario_id=$1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/count', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT COUNT(*) as total FROM notificaciones WHERE usuario_id=$1 AND leida=false', [req.user.id]
    );
    res.json({ count: parseInt(rows[0].total) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
