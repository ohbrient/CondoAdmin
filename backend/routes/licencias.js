const router = require('express').Router();
const db = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');

// Auto-migrar columnas de licencia en usuarios
async function migrar() {
  try {
    await db.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS licencia_hasta DATE DEFAULT NULL`);
    await db.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS licencia_notas TEXT DEFAULT NULL`);
  } catch (err) { console.error('Migración licencias:', err.message); }
}
migrar();

// ── Helper: estado de licencia ──────────────────────────────
function estadoLicencia(licencia_hasta) {
  if (!licencia_hasta) return { estado: 'sin_licencia', dias: null, vencida: false, proxima: false };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(licencia_hasta);
  vence.setHours(0, 0, 0, 0);
  const dias = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
  return {
    estado: dias < 0 ? 'vencida' : dias <= 15 ? 'proxima' : 'activa',
    dias,
    vencida: dias < 0,
    proxima: dias >= 0 && dias <= 15,
    fecha: licencia_hasta,
  };
}

// GET /api/licencias/usuarios — lista admins con su estado de licencia
router.get('/usuarios', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.activo,
              u.licencia_hasta, u.licencia_notas,
              COALESCE(
                json_agg(DISTINCT jsonb_build_object('id', c.id, 'nombre', c.nombre))
                FILTER (WHERE c.id IS NOT NULL), '[]'
              ) AS condominios
       FROM usuarios u
       LEFT JOIN condominio_admins ca ON ca.usuario_id = u.id AND ca.activo = true
       LEFT JOIN condominios c ON c.id = ca.condominio_id
       WHERE u.rol = 'admin'
       GROUP BY u.id
       ORDER BY u.nombre`
    );
    const result = rows.map(u => ({
      ...u,
      licencia: estadoLicencia(u.licencia_hasta),
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/licencias/usuarios/:id — asignar/renovar licencia
router.put('/usuarios/:id', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const { licencia_hasta, licencia_notas } = req.body;
    if (!licencia_hasta) return res.status(400).json({ error: 'Fecha de vencimiento requerida' });
    const { rows } = await db.query(
      `UPDATE usuarios SET licencia_hasta=$1, licencia_notas=$2, updated_at=NOW()
       WHERE id=$3 AND rol='admin' RETURNING id, nombre, apellido, email, licencia_hasta, licencia_notas`,
      [licencia_hasta, licencia_notas || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Administrador no encontrado' });
    res.json({ ...rows[0], licencia: estadoLicencia(rows[0].licencia_hasta) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/licencias/usuarios/:id — quitar licencia
router.delete('/usuarios/:id', auth, requireRole('superadmin'), async (req, res) => {
  try {
    await db.query(
      `UPDATE usuarios SET licencia_hasta=NULL, licencia_notas=NULL WHERE id=$1`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/licencias/mi-licencia — el admin consulta su propia licencia
router.get('/mi-licencia', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT licencia_hasta, licencia_notas FROM usuarios WHERE id=$1`,
      [req.user.id]
    );
    const licencia = estadoLicencia(rows[0]?.licencia_hasta);
    res.json({ ...licencia, notas: rows[0]?.licencia_notas });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.estadoLicencia = estadoLicencia;
module.exports = router;
