const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');

const sign = (user) =>
  jwt.sign({ id: user.id, rol: user.rol }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const { rows } = await db.query(
      'SELECT * FROM usuarios WHERE email=$1 AND activo=true',
      [email.toLowerCase().trim()]
    );
    if (!rows.length)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    // Si es admin, obtener sus condominios
    let condominios = [];
    if (user.rol === 'admin') {
      const c = await db.query(
        `SELECT c.id, c.nombre, c.logo_url FROM condominios c
         JOIN condominio_admins ca ON ca.condominio_id=c.id
         WHERE ca.usuario_id=$1 AND c.activo=true`,
        [user.id]
      );
      condominios = c.rows;
    }

    // Si es residente, obtener su unidad / condominio
    let residencia = null;
    if (user.rol === 'residente') {
      const r = await db.query(
        `SELECT r.id as residente_id, u.id as unidad_id, u.numero,
                c.id as condominio_id, c.nombre as condominio_nombre
         FROM residentes r
         JOIN unidades u ON u.id=r.unidad_id
         JOIN condominios c ON c.id=u.condominio_id
         WHERE r.usuario_id=$1 AND r.activo=true
         LIMIT 1`,
        [user.id]
      );
      residencia = r.rows[0] || null;
    }

    const token = sign(user);
    res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        rol: user.rol,
        foto_url: user.foto_url,
      },
      condominios,
      residencia,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/perfil — editar perfil propio
router.put('/perfil', authenticate, async (req, res) => {
  try {
    const { nombre, apellido, telefono, foto_url } = req.body;
    const { rows } = await db.query(
      `UPDATE usuarios SET nombre=$1, apellido=$2, telefono=$3, foto_url=$4, updated_at=NOW()
       WHERE id=$5 RETURNING id, nombre, apellido, email, telefono, foto_url, rol`,
      [nombre, apellido, telefono, foto_url, req.user.id]
    );
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando perfil' });
  }
});

// PUT /api/auth/cambiar-password
router.put('/cambiar-password', authenticate, async (req, res) => {
  try {
    const { password_actual, password_nuevo } = req.body;
    if (!password_actual || !password_nuevo)
      return res.status(400).json({ error: 'Campos requeridos' });

    const { rows } = await db.query('SELECT password_hash FROM usuarios WHERE id=$1', [req.user.id]);
    const valid = await bcrypt.compare(password_actual, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

    const hash = await bcrypt.hash(password_nuevo, 10);
    await db.query('UPDATE usuarios SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error cambiando contraseña' });
  }
});

module.exports = router;
