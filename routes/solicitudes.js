const router = require('express').Router();
const db = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Auto-migrar columnas faltantes
async function migrar() {
  try {
    await db.query(`ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS archivo_url TEXT`);
    await db.query(`ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS archivo_nombre TEXT`);
  } catch (err) { console.error('Migración solicitudes:', err.message); }
}
migrar();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/solicitudes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `solicitud-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.doc','.docx','.jpg','.jpeg','.png','.xlsx','.xls'];
    allowed.includes(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(new Error('Tipo no permitido'));
  }
});

// GET solicitudes
router.get('/:condominioId/solicitudes', auth, async (req, res) => {
  try {
    const isResidente = req.user.rol === 'residente';
    const { estado } = req.query;
    let q = `SELECT s.*,
      u.nombre || ' ' || u.apellido AS residente_nombre,
      un.numero AS unidad_numero
      FROM solicitudes s
      LEFT JOIN usuarios u ON u.id = s.usuario_id
      LEFT JOIN unidad_residentes ur ON ur.usuario_id = s.usuario_id AND ur.activo = true
      LEFT JOIN unidades un ON un.id = ur.unidad_id
      WHERE s.condominio_id = $1
      ${isResidente ? 'AND s.usuario_id = $2' : estado ? 'AND s.estado = $2' : ''}
      ORDER BY s.created_at DESC`;
    const params = isResidente
      ? [req.params.condominioId, req.user.id]
      : estado ? [req.params.condominioId, estado] : [req.params.condominioId];
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST crear solicitud — usa columnas reales: titulo, descripcion
router.post('/:condominioId/solicitudes', auth, upload.single('archivo'), async (req, res) => {
  try {
    const { asunto, descripcion, tipo } = req.body;
    const archivo_url    = req.file ? `/uploads/solicitudes/${req.file.filename}` : null;
    const archivo_nombre = req.file ? Buffer.from(req.file.originalname, 'latin1').toString('utf8') : null;

    const { rows } = await db.query(
      `INSERT INTO solicitudes (condominio_id, usuario_id, titulo, descripcion, tipo, archivo_url, archivo_nombre)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.condominioId, req.user.id, asunto, descripcion, tipo||'consulta', archivo_url, archivo_nombre]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creando solicitud:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT admin responde — usa columna real: respuesta
router.put('/:condominioId/solicitudes/:id', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { estado, respuesta_admin } = req.body;
    const { rows } = await db.query(
      `UPDATE solicitudes SET estado=$1, respuesta=$2, updated_at=NOW()
       WHERE id=$3 AND condominio_id=$4 RETURNING *`,
      [estado, respuesta_admin, req.params.id, req.params.condominioId]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
