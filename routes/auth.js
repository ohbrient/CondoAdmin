const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { auth } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const { rows } = await db.query(
      'SELECT * FROM usuarios WHERE email = $1 AND activo = true', [email.toLowerCase()]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

    await db.query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id, nombre: user.nombre, apellido: user.apellido,
        email: user.email, rol: user.rol, avatar_url: user.avatar_url
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor', detail: err.message });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.telefono, u.avatar_url, u.created_at,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', c.id, 'nombre', c.nombre, 'logo_url', c.logo_url))
          FILTER (WHERE c.id IS NOT NULL), '[]'
        ) AS condominios
       FROM usuarios u
       LEFT JOIN condominio_admins ca ON ca.usuario_id = u.id AND ca.activo = true
       LEFT JOIN condominios c ON c.id = ca.condominio_id
       WHERE u.id = $1
       GROUP BY u.id`, [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { nombre, apellido, telefono } = req.body;
    const { rows } = await db.query(
      `UPDATE usuarios SET nombre=$1, apellido=$2, telefono=$3, updated_at=NOW()
       WHERE id=$4 RETURNING id, nombre, apellido, email, telefono, avatar_url, rol`,
      [nombre, apellido, telefono, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/password
router.put('/password', auth, async (req, res) => {
  try {
    const { actual, nueva } = req.body;
    const { rows } = await db.query('SELECT password_hash FROM usuarios WHERE id=$1', [req.user.id]);
    const valid = await bcrypt.compare(actual, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

    const hash = await bcrypt.hash(nueva, 10);
    await db.query('UPDATE usuarios SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ message: 'Contraseña actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
