require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const path     = require('path');

const app = express();

// ── Middlewares globales ────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Rutas ──────────────────────────────────────────────────
const authRoutes        = require('./routes/auth');
const condominiosRoutes = require('./routes/condominios');
const residentesRoutes  = require('./routes/residentes');
const cuotasRoutes      = require('./routes/cuotas');
const gastosRoutes      = require('./routes/gastos-empleados');
const reportesRoutes    = require('./routes/reportes');
const sistemaRoutes     = require('./routes/sistema');

app.use('/api/auth',        authRoutes);
app.use('/api/condominios', condominiosRoutes);
app.use('/api/sistema',     sistemaRoutes);

// Rutas anidadas por condominio
app.use('/api/condominios/:condominioId', residentesRoutes);
app.use('/api/condominios/:condominioId', cuotasRoutes);
app.use('/api/condominios/:condominioId', gastosRoutes);
app.use('/api/condominios/:condominioId/reportes', reportesRoutes);

// Superadmin: lista de todos los usuarios
app.use('/api', residentesRoutes);

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 CondoAdmin API corriendo en http://localhost:${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
});