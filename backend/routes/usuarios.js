const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/usuarios — Solo superadmin ve todos
router.get('/', auth, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { rol, search } = req.query;
    let q = `SELECT id, nombre, apellido, email, rol, telefono, avatar_url, activo, created_at FROM usuarios WHERE 1=1`;
    const params = [];
    if (rol) { params.push(rol); q += ` AND rol = $${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND (nombre ILIKE $${params.length} OR email ILIKE $${params.length})`; }
    // Admin solo ve residentes de sus condominios
    if (req.user.rol === 'admin') {
      q += ` AND rol = 'residente'`;
    }
    q += ' ORDER BY created_at DESC';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/usuarios — Crear usuario
router.post('/', auth, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { nombre, apellido, email, password, rol, telefono } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, telefono)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, nombre, apellido, email, rol, telefono, created_at`,
      [nombre, apellido, email.toLowerCase(), hash, rol || 'residente', telefono]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email ya registrado' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/usuarios/:id — Editar usuario
router.put('/:id', auth, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { nombre, apellido, telefono, activo } = req.body;
    const { rows } = await db.query(
      `UPDATE usuarios SET nombre=$1, apellido=$2, telefono=$3, activo=$4, updated_at=NOW()
       WHERE id=$5 RETURNING id, nombre, apellido, email, rol, telefono, activo`,
      [nombre, apellido, telefono, activo, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
