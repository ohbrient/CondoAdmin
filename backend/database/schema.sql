-- ═══════════════════════════════════════════════════════
--  CondoAdmin PRO — Schema SQL completo
-- ═══════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'residente');
CREATE TYPE unidad_tipo AS ENUM ('apartamento', 'casa', 'local', 'oficina');
CREATE TYPE unidad_estado AS ENUM ('ocupado', 'vacante', 'en_venta');
CREATE TYPE pago_estado AS ENUM ('pagado', 'pendiente', 'parcial', 'en_revision');
CREATE TYPE gasto_categoria AS ENUM ('electricidad','agua','limpieza','reparacion','mantenimiento','nomina','seguros','otros');
CREATE TYPE empleado_cargo AS ENUM ('vigilante','conserje','jardinero','mantenimiento','administrador','otro');
CREATE TYPE pago_modalidad AS ENUM ('mensual','quincenal','semanal');
CREATE TYPE solicitud_estado AS ENUM ('abierta','en_proceso','cerrada','rechazada');
CREATE TYPE solicitud_tipo AS ENUM ('reparacion','queja','consulta','sugerencia','emergencia');
CREATE TYPE notif_tipo AS ENUM ('pago_recibido','mora','anuncio','solicitud','salario','sistema');

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol user_role NOT NULL DEFAULT 'residente',
  telefono VARCHAR(30),
  avatar_url TEXT,
  activo BOOLEAN DEFAULT TRUE,
  ultimo_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE condominios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(150) NOT NULL,
  direccion TEXT NOT NULL,
  ciudad VARCHAR(100),
  pais VARCHAR(80) DEFAULT 'República Dominicana',
  telefono VARCHAR(30),
  email VARCHAR(150),
  logo_url TEXT,
  moneda VARCHAR(10) DEFAULT 'RD$',
  cuota_base NUMERIC(12,2) DEFAULT 0,
  recargo_mora NUMERIC(5,2) DEFAULT 5.00,
  dias_gracia INT DEFAULT 5,
  activo BOOLEAN DEFAULT TRUE,
  superadmin_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE condominio_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(condominio_id, usuario_id)
);

CREATE TABLE unidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  numero VARCHAR(20) NOT NULL,
  tipo unidad_tipo DEFAULT 'apartamento',
  estado unidad_estado DEFAULT 'vacante',
  metros_cuadrados NUMERIC(8,2),
  piso INT,
  cuota_personalizada NUMERIC(12,2),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(condominio_id, numero)
);

CREATE TABLE unidad_residentes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unidad_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  es_propietario BOOLEAN DEFAULT TRUE,
  fecha_inicio DATE DEFAULT CURRENT_DATE,
  fecha_fin DATE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(unidad_id, usuario_id)
);

CREATE TABLE periodos_cuota (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  año INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  cuota_monto NUMERIC(12,2) NOT NULL,
  fecha_limite DATE NOT NULL,
  cerrado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(condominio_id, año, mes)
);

CREATE TABLE pagos_cuota (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  periodo_id UUID NOT NULL REFERENCES periodos_cuota(id),
  unidad_id UUID NOT NULL REFERENCES unidades(id),
  monto_cuota NUMERIC(12,2) NOT NULL,
  monto_pagado NUMERIC(12,2) NOT NULL DEFAULT 0,
  monto_recargo NUMERIC(12,2) DEFAULT 0,
  estado pago_estado DEFAULT 'pendiente',
  fecha_pago TIMESTAMPTZ,
  metodo_pago VARCHAR(50),
  referencia VARCHAR(100),
  comprobante_url TEXT,
  registrado_por UUID REFERENCES usuarios(id),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(periodo_id, unidad_id)
);

CREATE TABLE gastos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  concepto VARCHAR(200) NOT NULL,
  descripcion TEXT,
  categoria gasto_categoria DEFAULT 'otros',
  monto NUMERIC(12,2) NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  proveedor VARCHAR(150),
  factura_numero VARCHAR(80),
  comprobante_url TEXT,
  registrado_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE empleados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  cargo empleado_cargo NOT NULL,
  salario NUMERIC(12,2) NOT NULL,
  modalidad_pago pago_modalidad DEFAULT 'mensual',
  telefono VARCHAR(30),
  cedula VARCHAR(20),
  fecha_inicio DATE DEFAULT CURRENT_DATE,
  fecha_fin DATE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE salarios_pagados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  fecha_pago TIMESTAMPTZ DEFAULT NOW(),
  metodo VARCHAR(50),
  referencia VARCHAR(100),
  estado pago_estado DEFAULT 'pagado',
  registrado_por UUID REFERENCES usuarios(id),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE solicitudes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  unidad_id UUID REFERENCES unidades(id),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  tipo solicitud_tipo DEFAULT 'consulta',
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT NOT NULL,
  estado solicitud_estado DEFAULT 'abierta',
  prioridad INT DEFAULT 2 CHECK (prioridad BETWEEN 1 AND 3),
  imagen_url TEXT,
  respuesta TEXT,
  atendido_por UUID REFERENCES usuarios(id),
  fecha_cierre TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notificaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  condominio_id UUID REFERENCES condominios(id),
  tipo notif_tipo DEFAULT 'sistema',
  titulo VARCHAR(200) NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN DEFAULT FALSE,
  url_destino TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE anuncios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  titulo VARCHAR(200) NOT NULL,
  contenido TEXT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  publicado_por UUID REFERENCES usuarios(id),
  fecha_expira DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fondo_reserva (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  año INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  saldo_inicio NUMERIC(12,2) DEFAULT 0,
  aportes NUMERIC(12,2) DEFAULT 0,
  retiros NUMERIC(12,2) DEFAULT 0,
  saldo_fin NUMERIC(12,2) DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(condominio_id, año, mes)
);

CREATE INDEX idx_pagos_unidad ON pagos_cuota(unidad_id);
CREATE INDEX idx_pagos_periodo ON pagos_cuota(periodo_id);
CREATE INDEX idx_pagos_estado ON pagos_cuota(estado);
CREATE INDEX idx_gastos_condominio ON gastos(condominio_id);
CREATE INDEX idx_notif_usuario ON notificaciones(usuario_id);
CREATE INDEX idx_solicitudes_condo ON solicitudes(condominio_id);
CREATE INDEX idx_unidades_condo ON unidades(condominio_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_updated    BEFORE UPDATE ON usuarios    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_condominios_updated BEFORE UPDATE ON condominios FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_unidades_updated    BEFORE UPDATE ON unidades    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_pagos_updated       BEFORE UPDATE ON pagos_cuota FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_solicitudes_updated BEFORE UPDATE ON solicitudes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Super Admin inicial (password: Admin123! — cambiar en producción)
INSERT INTO usuarios (nombre, apellido, email, password_hash, rol)
VALUES ('Super', 'Admin', 'superadmin@condoadmin.com', crypt('Admin123!', gen_salt('bf', 10)), 'superadmin');
