const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { auth } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const { rows } = await db.query(
      `SELECT * FROM usuarios WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
    if (!user.activo) return res.status(401).json({ error: 'Usuario inactivo' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign(
      { id: user.id, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        rol: user.rol,
        foto_url: user.foto_url || null,
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { nombre, apellido, email, password, rol } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Campos requeridos faltantes' });

    const existe = await db.query(`SELECT id FROM usuarios WHERE email = $1`, [email.toLowerCase().trim()]);
    if (existe.rows[0]) return res.status(400).json({ error: 'El email ya está registrado' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, apellido, email, rol`,
      [nombre, apellido, email.toLowerCase().trim(), hash, rol || 'residente']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me — obtener usuario actual
router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, nombre, apellido, email, rol, telefono, foto_url, activo, licencia_hasta
       FROM usuarios WHERE id = $1`,
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/profile — actualizar perfil
router.put('/profile', auth, async (req, res) => {
  try {
    const { nombre, apellido, telefono } = req.body;
    const { rows } = await db.query(
      `UPDATE usuarios SET nombre=$1, apellido=$2, telefono=$3, updated_at=NOW()
       WHERE id=$4 RETURNING id, nombre, apellido, email, rol, telefono, foto_url`,
      [nombre, apellido, telefono, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/password — cambiar contraseña
router.put('/password', auth, async (req, res) => {
  try {
    const { actual, nueva } = req.body;
    if (!actual || !nueva) return res.status(400).json({ error: 'Contraseña actual y nueva requeridas' });
    if (nueva.length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });

    const { rows } = await db.query(`SELECT password_hash FROM usuarios WHERE id=$1`, [req.user.id]);
    const valid = await bcrypt.compare(actual, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

    const hash = await bcrypt.hash(nueva, 10);
    await db.query(`UPDATE usuarios SET password_hash=$1, updated_at=NOW() WHERE id=$2`, [hash, req.user.id]);
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;