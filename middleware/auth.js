const jwt = require('jsonwebtoken');
const db = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token requerido' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query(
      'SELECT id, nombre, apellido, email, rol, activo FROM usuarios WHERE id = $1',
      [decoded.id]
    );

    if (!rows[0] || !rows[0].activo)
      return res.status(401).json({ error: 'Usuario no válido' });

    req.user = rows[0];
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.rol))
    return res.status(403).json({ error: 'Sin permisos suficientes' });
  next();
};

// Verifica que el admin pertenece al condominio
const requireCondoAccess = async (req, res, next) => {
  if (req.user.rol === 'superadmin') return next();
  const condoId = req.params.condominioId || req.body.condominioId;
  if (!condoId) return res.status(400).json({ error: 'condominioId requerido' });

  const { rows } = await db.query(
    'SELECT id FROM condominio_admins WHERE condominio_id = $1 AND usuario_id = $2 AND activo = true',
    [condoId, req.user.id]
  );
  if (!rows[0]) return res.status(403).json({ error: 'Sin acceso a este condominio' });
  next();
};

module.exports = { auth, requireRole, requireCondoAccess };
