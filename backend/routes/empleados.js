const router = require('express').Router();
const db = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Auto-migrar columnas nuevas
async function migrar() {
  const cols = [
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS direccion TEXT`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS nacionalidad VARCHAR(80)`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS estado_civil VARCHAR(30)`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre VARCHAR(120)`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono VARCHAR(30)`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS tipo_contrato VARCHAR(40)`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS departamento VARCHAR(60)`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS horario VARCHAR(100)`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_vencimiento_contrato DATE`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS nss VARCHAR(30)`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS afp VARCHAR(60)`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS ars VARCHAR(60)`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS banco VARCHAR(80)`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS cuenta_bancaria VARCHAR(40)`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS bonificacion NUMERIC(12,2) DEFAULT 0`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS vacaciones_dias INTEGER DEFAULT 0`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS dias_vacaciones_tomados INTEGER DEFAULT 0`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS estado_empleado VARCHAR(30) DEFAULT 'activo'`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS notas TEXT`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS foto_url TEXT`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS cedula VARCHAR(20)`,
    `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_inicio DATE`,
  ];
  for (const q of cols) {
    await db.query(q).catch(e => console.error('Migración empleados:', e.message));
  }
}
migrar();

// Multer para foto
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/empleados');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `emp-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => ['.jpg','.jpeg','.png','.webp'].includes(path.extname(file.originalname).toLowerCase()) ? cb(null,true) : cb(new Error('Solo imágenes'))
});

// GET todos los empleados
router.get('/:condominioId/empleados', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT e.*,
        COALESCE((SELECT SUM(monto) FROM salarios_pagados WHERE empleado_id=e.id AND fecha_pago > NOW()-INTERVAL '30 days'),0) AS pagado_mes,
        COALESCE((SELECT json_agg(json_build_object('id',sp.id,'monto',sp.monto,'periodo_inicio',sp.periodo_inicio,'periodo_fin',sp.periodo_fin,'metodo',sp.metodo,'notas',sp.notas,'fecha_pago',sp.fecha_pago) ORDER BY sp.fecha_pago DESC) FROM salarios_pagados sp WHERE sp.empleado_id=e.id),'[]') AS historial_salarios
       FROM empleados e WHERE e.condominio_id=$1 ORDER BY e.activo DESC, e.nombre`,
      [req.params.condominioId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST crear empleado
router.post('/:condominioId/empleados', auth, requireRole('superadmin','admin'), upload.single('foto'), async (req, res) => {
  try {
    const d = req.body;
    const foto_url = req.file ? `/uploads/empleados/${req.file.filename}` : null;
    const { rows } = await db.query(
      `INSERT INTO empleados (condominio_id,nombre,apellido,cargo,salario,modalidad_pago,telefono,cedula,fecha_inicio,
        direccion,fecha_nacimiento,nacionalidad,estado_civil,contacto_emergencia_nombre,contacto_emergencia_telefono,
        tipo_contrato,departamento,horario,fecha_vencimiento_contrato,nss,afp,ars,banco,cuenta_bancaria,
        bonificacion,vacaciones_dias,estado_empleado,notas,foto_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
       RETURNING *`,
      [req.params.condominioId, d.nombre, d.apellido, d.cargo, d.salario, d.modalidad_pago||'mensual',
       d.telefono||null, d.cedula||null, d.fecha_inicio||null,
       d.direccion||null, d.fecha_nacimiento||null, d.nacionalidad||null, d.estado_civil||null,
       d.contacto_emergencia_nombre||null, d.contacto_emergencia_telefono||null,
       d.tipo_contrato||null, d.departamento||null, d.horario||null, d.fecha_vencimiento_contrato||null,
       d.nss||null, d.afp||null, d.ars||null, d.banco||null, d.cuenta_bancaria||null,
       parseFloat(d.bonificacion)||0, parseInt(d.vacaciones_dias)||0,
       d.estado_empleado||'activo', d.notas||null, foto_url]
    );
    res.status(201).json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// PUT actualizar empleado
router.put('/:condominioId/empleados/:id', auth, requireRole('superadmin','admin'), upload.single('foto'), async (req, res) => {
  try {
    const d = req.body;
    let foto_url = d.foto_url_existente || null;
    if (req.file) foto_url = `/uploads/empleados/${req.file.filename}`;

    const { rows } = await db.query(
      `UPDATE empleados SET
        nombre=$1,apellido=$2,cargo=$3,salario=$4,modalidad_pago=$5,telefono=$6,cedula=$7,fecha_inicio=$8,
        activo=$9,direccion=$10,fecha_nacimiento=$11,nacionalidad=$12,estado_civil=$13,
        contacto_emergencia_nombre=$14,contacto_emergencia_telefono=$15,
        tipo_contrato=$16,departamento=$17,horario=$18,fecha_vencimiento_contrato=$19,
        nss=$20,afp=$21,ars=$22,banco=$23,cuenta_bancaria=$24,
        bonificacion=$25,vacaciones_dias=$26,dias_vacaciones_tomados=$27,
        estado_empleado=$28,notas=$29,foto_url=$30,updated_at=NOW()
       WHERE id=$31 AND condominio_id=$32 RETURNING *`,
      [d.nombre, d.apellido, d.cargo, d.salario, d.modalidad_pago, d.telefono||null, d.cedula||null, d.fecha_inicio||null,
       d.activo !== 'false' && d.activo !== false,
       d.direccion||null, d.fecha_nacimiento||null, d.nacionalidad||null, d.estado_civil||null,
       d.contacto_emergencia_nombre||null, d.contacto_emergencia_telefono||null,
       d.tipo_contrato||null, d.departamento||null, d.horario||null, d.fecha_vencimiento_contrato||null,
       d.nss||null, d.afp||null, d.ars||null, d.banco||null, d.cuenta_bancaria||null,
       parseFloat(d.bonificacion)||0, parseInt(d.vacaciones_dias)||0, parseInt(d.dias_vacaciones_tomados)||0,
       d.estado_empleado||'activo', d.notas||null, foto_url,
       req.params.id, req.params.condominioId]
    );
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// POST pagar salario
router.post('/:condominioId/empleados/:id/salario', auth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { periodo_inicio, periodo_fin, monto, metodo, referencia, notas } = req.body;
    const { rows } = await db.query(
      `INSERT INTO salarios_pagados (empleado_id,periodo_inicio,periodo_fin,monto,metodo,referencia,notas,registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, periodo_inicio, periodo_fin, monto, metodo, referencia, notas, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
