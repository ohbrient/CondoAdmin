const jwt = require('jsonwebtoken');
const db  = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query(
      `SELECT id, nombre, apellido, email, rol, activo, licencia_hasta
       FROM usuarios WHERE id = $1`,
      [decoded.id]
    );
    const user = rows[0];
    if (!user || !user.activo) return res.status(401).json({ error: 'Usuario inactivo' });

    // Verificar licencia solo para admins
    if (user.rol === 'admin') {
      if (!user.licencia_hasta) {
        return res.status(403).json({
          error: 'licencia_requerida',
          mensaje: 'Tu cuenta no tiene una licencia activa. Contacta al Super Admin.',
        });
      }
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const vence = new Date(user.licencia_hasta); vence.setHours(0, 0, 0, 0);
      const dias = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
      if (dias < 0) {
        return res.status(403).json({
          error: 'licencia_vencida',
          mensaje: `Tu licencia venció el ${new Date(user.licencia_hasta).toLocaleDateString('es-DO')}. Contacta al Super Admin para renovarla.`,
          dias,
          licencia_hasta: user.licencia_hasta,
        });
      }
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.rol)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
};

module.exports = { auth, requireRole };
