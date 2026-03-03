const jwt = require('jsonwebtoken');
const db  = require('../config/db');

// ── Verifica token JWT ──────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await db.query(
      'SELECT id, nombre, apellido, email, rol, foto_url FROM usuarios WHERE id=$1 AND activo=true',
      [decoded.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'Usuario no encontrado' });

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// ── Fábrica de middleware para roles ───────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.rol)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
};

// ── Verifica que el admin pertenece al condominio ──────────
const requireCondoAccess = async (req, res, next) => {
  try {
    const { condominioId } = req.params;
    if (req.user.rol === 'superadmin') return next();

    const { rows } = await db.query(
      'SELECT 1 FROM condominio_admins WHERE condominio_id=$1 AND usuario_id=$2',
      [condominioId, req.user.id]
    );
    if (!rows.length) return res.status(403).json({ error: 'Sin acceso a este condominio' });
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, requireRole, requireCondoAccess };
