# CondoAdmin PRO — Guía de Instalación

## Estructura del proyecto
```
condoadmin/
├── backend/          → API Node.js + Express
│   ├── server.js     → Punto de entrada
│   ├── routes/       → Todos los endpoints
│   ├── middleware/   → Auth JWT y roles
│   ├── config/       → Conexión DB
│   └── database/
│       └── schema.sql → Esquema PostgreSQL completo
└── frontend/         → React + Vite + TailwindCSS
    └── src/
        ├── pages/
        │   ├── superadmin/  → Panel Super Admin
        │   ├── admin/       → Panel Administrador
        │   └── residente/   → Portal Residente
        ├── contexts/        → Auth Context
        └── services/        → Axios API client
```

## Requisitos
- Node.js 18+
- PostgreSQL 14+

## Instalación paso a paso

### 1. Base de datos
```bash
# Crear la base de datos
createdb condoadmin

# Ejecutar el schema
psql condoadmin -f backend/database/schema.sql
```

### 2. Backend
```bash
cd backend
npm install

# Crear archivo de variables de entorno
cp .env.example .env
# Edita .env con tus credenciales de PostgreSQL

npm run dev
# API disponible en http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
# App disponible en http://localhost:5173
```

## API Endpoints principales

### Autenticación
- POST /api/auth/login
- GET  /api/auth/me
- PUT  /api/auth/profile
- PUT  /api/auth/password

### Super Admin
- GET/POST /api/condominios
- POST     /api/condominios/:id/admins
- GET/POST /api/usuarios

### Administrador (requiere acceso al condominio)
- GET      /api/condominios/:id/dashboard
- GET/POST /api/condominios/:id/unidades
- GET/POST /api/condominios/:id/cuotas/periodo
- PUT      /api/condominios/:id/cuotas/pagos/:pagoId
- GET      /api/condominios/:id/cuotas/morosos
- GET/POST /api/condominios/:id/gastos
- GET/POST /api/condominios/:id/empleados
- POST     /api/condominios/:id/empleados/:id/salario
- GET/PUT  /api/condominios/:id/solicitudes

### Residente
- GET  /api/residente/mi-unidad
- GET  /api/residente/mi-cuenta
- POST /api/condominios/:id/solicitudes
- GET  /api/notificaciones

## Roles y permisos
| Funcionalidad | Super Admin | Admin | Residente |
|---|:---:|:---:|:---:|
| Crear condominios | ✅ | ❌ | ❌ |
| Asignar admins | ✅ | ❌ | ❌ |
| Gestionar unidades | ✅ | ✅ | ❌ |
| Registrar pagos | ✅ | ✅ | ❌ |
| Ver sus pagos | ✅ | ✅ | ✅ |
| Crear solicitudes | ❌ | ❌ | ✅ |
| Atender solicitudes | ✅ | ✅ | ❌ |
| Ver notificaciones | ✅ | ✅ | ✅ |

## Despliegue en producción
Para hospedar la app puedes usar:
- **Railway** — DB PostgreSQL + Node backend en minutos (recomendado para empezar)
- **Render** — Backend gratis con PostgreSQL
- **Vercel** — Frontend (npm run build → subir dist/)
- **VPS (DigitalOcean/Hostinger)** — Control total, costo desde $6/mes
