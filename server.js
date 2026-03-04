require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Rutas ──────────────────────────────────────────────
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/usuarios',       require('./routes/usuarios'));
app.use('/api/condominios',    require('./routes/condominios'));
app.use('/api/condominios',    require('./routes/unidades'));
app.use('/api/condominios',    require('./routes/cuotas'));
app.use('/api/condominios',    require('./routes/gastos'));
app.use('/api/condominios',    require('./routes/empleados'));
app.use('/api/condominios',    require('./routes/solicitudes'));
app.use('/api/condominios',    require('./routes/anuncios'));
app.use('/api/condominios',    require('./routes/acuerdos'));
app.use('/api/condominios',    require('./routes/reservas'));
app.use('/api',                require('./routes/reservas'));
app.use('/api/notificaciones', require('./routes/notificaciones'));

// ── Residente: su estado de cuenta ────────────────────
const db = require('./config/database');
const { auth } = require('./middleware/auth');

app.get('/api/residente/mi-cuenta', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT pc.*,
        p.anio, p.mes, p.cuota_monto, p.fecha_limite,
        u.numero AS unidad_numero, u.tipo AS unidad_tipo,
        c.nombre AS condominio_nombre, c.moneda
       FROM pagos_cuota pc
       JOIN periodos_cuota p ON p.id = pc.periodo_id
       JOIN unidades u ON u.id = pc.unidad_id
       JOIN condominios c ON c.id = p.condominio_id
       JOIN unidad_residentes ur ON ur.unidad_id = u.id
       WHERE ur.usuario_id = $1 AND ur.activo = true
       ORDER BY p.anio DESC, p.mes DESC
       LIMIT 12`, [req.user.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/residente/mi-unidad-todas', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.*, c.nombre AS condominio_nombre, c.moneda, c.cuota_base, ur.es_propietario
       FROM unidades u
       JOIN condominios c ON c.id = u.condominio_id
       JOIN unidad_residentes ur ON ur.unidad_id = u.id
       WHERE ur.usuario_id = $1 AND ur.activo = true
       ORDER BY c.nombre, u.numero`, [req.user.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/residente/mi-unidad', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.*, c.nombre AS condominio_nombre, c.moneda, c.logo_url,
        c.cuota_base, c.recargo_mora, ur.es_propietario
       FROM unidades u
       JOIN condominios c ON c.id = u.condominio_id
       JOIN unidad_residentes ur ON ur.unidad_id = u.id
       WHERE ur.usuario_id = $1 AND ur.activo = true LIMIT 1`, [req.user.id]
    );
    res.json(rows[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/residente/mi-historial-pagos', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT pc.id, pc.estado, pc.monto_cuota, pc.monto_gas_comun, pc.monto_pagado,
        pc.metodo_pago, pc.referencia, pc.notas, pc.comprobante_url, pc.fecha_pago,
        pc.updated_at,
        p.anio, p.mes, p.fecha_limite,
        c.moneda
       FROM pagos_cuota pc
       JOIN periodos_cuota p ON p.id = pc.periodo_id
       JOIN unidades u ON u.id = pc.unidad_id
       JOIN condominios c ON c.id = p.condominio_id
       JOIN unidad_residentes ur ON ur.unidad_id = u.id
       WHERE ur.usuario_id = $1 AND ur.activo = true
         AND pc.estado IN ('pagado','parcial','en_revision')
       ORDER BY p.anio DESC, p.mes DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));
app.use((req, res) => res.status(404).json({ error: 'Endpoint no encontrado' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 CondoAdmin API corriendo en http://localhost:${PORT}`));
