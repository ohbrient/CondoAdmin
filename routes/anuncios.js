const router = require('express').Router();
const db = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Auto-migrar columnas faltantes al arrancar
async function migrarColumnas() {
  try {
    await db.query(`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'general'`);
    await db.query(`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS importante BOOLEAN DEFAULT false`);
    await db.query(`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id)`);
    await db.query(`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS documento_url TEXT`);
    await db.query(`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS documento_nombre TEXT`);
    await db.query(`ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS fecha_evento DATE`);
    console.log('✅ Columnas anuncios verificadas');
  } catch (err) {
    console.error('Error migrando anuncios:', err.message);
  }
}
migrarColumnas();

// Multer para documentos adjuntos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/anuncios');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `anuncio-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.doc','.docx','.jpg','.jpeg','.png','.xlsx','.xls'];
    allowed.includes(path.extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(new Error('Tipo de archivo no permitido'));
  }
});

// GET anuncios
router.get('/:condominioId/anuncios', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.*, u.nombre AS autor FROM anuncios a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.condominio_id=$1
       ORDER BY a.importante DESC, a.created_at DESC`,
      [req.params.condominioId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST crear anuncio
router.post('/:condominioId/anuncios', auth, requireRole('superadmin','admin'), upload.single('documento'), async (req, res) => {
  try {
    const { titulo, contenido, tipo, importante, fecha_evento } = req.body;
    const documento_url    = req.file ? `/uploads/anuncios/${req.file.filename}` : null;
    const documento_nombre = req.file ? Buffer.from(req.file.originalname, 'latin1').toString('utf8') : null;

    const { rows } = await db.query(
      `INSERT INTO anuncios
         (condominio_id, titulo, contenido, tipo, importante, usuario_id, documento_url, documento_nombre, fecha_evento)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        req.params.condominioId, titulo, contenido, tipo || 'general',
        importante === 'true' || importante === true,
        req.user.id,
        documento_url, documento_nombre,
        fecha_evento || null
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creando anuncio:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT editar anuncio
router.put('/:condominioId/anuncios/:id', auth, requireRole('superadmin','admin'), upload.single('documento'), async (req, res) => {
  try {
    const { titulo, contenido, tipo, importante, quitar_documento, fecha_evento } = req.body;

    let doc_url    = undefined;
    let doc_nombre = undefined;
    if (req.file) {
      doc_url    = `/uploads/anuncios/${req.file.filename}`;
      doc_nombre = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    } else if (quitar_documento === 'true') {
      doc_url    = null;
      doc_nombre = null;
    }

    const sets = ['titulo=$1','contenido=$2','tipo=$3','importante=$4','fecha_evento=$5'];
    const vals = [titulo, contenido, tipo, importante==='true'||importante===true, fecha_evento||null];

    if (doc_url !== undefined)    { sets.push(`documento_url=$${vals.length+1}`);    vals.push(doc_url); }
    if (doc_nombre !== undefined) { sets.push(`documento_nombre=$${vals.length+1}`); vals.push(doc_nombre); }

    vals.push(req.params.id, req.params.condominioId);

    const { rows } = await db.query(
      `UPDATE anuncios SET ${sets.join(',')}
       WHERE id=$${vals.length-1} AND condominio_id=$${vals.length} RETURNING *`,
      vals
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error editando anuncio:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE anuncio
router.delete('/:condominioId/anuncios/:id', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    await db.query(`DELETE FROM anuncios WHERE id=$1 AND condominio_id=$2`, [req.params.id, req.params.condominioId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;