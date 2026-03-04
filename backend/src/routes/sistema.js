const router = require('express').Router();
const db = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Auto-migrar tabla de configuración del sistema
async function migrar() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS sistema_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        nombre_sistema TEXT DEFAULT 'CondoAdmin',
        subtitulo TEXT DEFAULT 'PRO',
        logo_url TEXT,
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT solo_una_fila CHECK (id = 1)
      )
    `);
    // Insertar fila por defecto si no existe
    await db.query(`
      INSERT INTO sistema_config (id, nombre_sistema, subtitulo)
      VALUES (1, 'CondoAdmin', 'PRO')
      ON CONFLICT (id) DO NOTHING
    `);
  } catch (err) { console.error('Migración sistema_config:', err.message); }
}
migrar();

// Multer para logo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/logos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-sistema-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.svg', '.webp'];
    allowed.includes(path.extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(new Error('Solo se permiten imágenes (jpg, png, svg, webp)'));
  }
});

// GET /api/sistema/config — público (para que el frontend cargue el nombre/logo)
router.get('/config', async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM sistema_config WHERE id = 1`);
    res.json(rows[0] || { nombre_sistema: 'CondoAdmin', subtitulo: 'PRO', logo_url: null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/sistema/config — solo superadmin
router.put('/config', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const { nombre_sistema, subtitulo } = req.body;
    const { rows } = await db.query(
      `UPDATE sistema_config SET nombre_sistema=$1, subtitulo=$2, updated_at=NOW()
       WHERE id=1 RETURNING *`,
      [nombre_sistema || 'CondoAdmin', subtitulo || 'PRO']
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sistema/logo — subir logo, solo superadmin
router.post('/logo', auth, requireRole('superadmin'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
    const logo_url = `/uploads/logos/${req.file.filename}`;
    const { rows } = await db.query(
      `UPDATE sistema_config SET logo_url=$1, updated_at=NOW() WHERE id=1 RETURNING *`,
      [logo_url]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/sistema/logo — quitar logo, solo superadmin
router.delete('/logo', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE sistema_config SET logo_url=NULL, updated_at=NOW() WHERE id=1 RETURNING *`
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
