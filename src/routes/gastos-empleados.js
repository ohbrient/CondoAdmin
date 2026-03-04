const router = require('express').Router({ mergeParams: true });
const db     = require('../config/db');
const { authenticate, requireCondoAccess } = require('../middleware/auth');

const guard = [authenticate, requireCondoAccess];

// ══ GASTOS ═════════════════════════════════════════════════

router.get('/gastos', ...guard, async (req, res) => {
  try {
    const { anio, mes } = req.query;
    const now = new Date();
    const { rows } = await db.query(
      `SELECT g.*, cg.nombre as categoria_nombre, cg.color, cg.icono,
              p.nombre as proveedor_nombre,
              u.nombre||' '||u.apellido as registrado_por_nombre
       FROM gastos g
       LEFT JOIN categorias_gastos cg ON cg.id=g.categoria_id
       LEFT JOIN proveedores p ON p.id=g.proveedor_id
       LEFT JOIN usuarios u ON u.id=g.registrado_por
       WHERE g.condominio_id=$1
         AND EXTRACT(YEAR FROM g.fecha)=$2
         AND EXTRACT(MONTH FROM g.fecha)=$3
       ORDER BY g.fecha DESC`,
      [req.params.condominioId, anio||now.getFullYear(), mes||now.getMonth()+1]
    );
    res.json({ gastos: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/gastos', ...guard, async (req, res) => {
  try {
    const { categoria_id, proveedor_id, concepto, monto, fecha, notas, comprobante_url } = req.body;
    const { rows } = await db.query(
      `INSERT INTO gastos (condominio_id,categoria_id,proveedor_id,concepto,monto,fecha,notas,comprobante_url,registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.condominioId, categoria_id, proveedor_id, concepto, monto,
       fecha||new Date(), notas, comprobante_url, req.user.id]
    );
    res.status(201).json({ gasto: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/gastos/:id', ...guard, async (req, res) => {
  try {
    const { categoria_id, proveedor_id, concepto, monto, fecha, notas } = req.body;
    const { rows } = await db.query(
      `UPDATE gastos SET categoria_id=$1,proveedor_id=$2,concepto=$3,monto=$4,fecha=$5,notas=$6
       WHERE id=$7 AND condominio_id=$8 RETURNING *`,
      [categoria_id, proveedor_id, concepto, monto, fecha, notas, req.params.id, req.params.condominioId]
    );
    res.json({ gasto: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/gastos/:id', ...guard, async (req, res) => {
  await db.query('DELETE FROM gastos WHERE id=$1 AND condominio_id=$2', [req.params.id, req.params.condominioId]);
  res.json({ message: 'Gasto eliminado' });
});

// Categorías de gastos
router.get('/categorias-gastos', authenticate, async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM categorias_gastos WHERE condominio_id=$1 OR condominio_id IS NULL ORDER BY nombre',
    [req.params.condominioId]
  );
  res.json({ categorias: rows });
});

// Proveedores
router.get('/proveedores', ...guard, async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM proveedores WHERE condominio_id=$1 AND activo=true ORDER BY nombre',
    [req.params.condominioId]
  );
  res.json({ proveedores: rows });
});

router.post('/proveedores', ...guard, async (req, res) => {
  const { nombre, contacto, telefono, email, servicio } = req.body;
  const { rows } = await db.query(
    'INSERT INTO proveedores (condominio_id,nombre,contacto,telefono,email,servicio) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [req.params.condominioId, nombre, contacto, telefono, email, servicio]
  );
  res.status(201).json({ proveedor: rows[0] });
});

// ══ EMPLEADOS ══════════════════════════════════════════════

router.get('/empleados', ...guard, async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM empleados WHERE condominio_id=$1 AND activo=true ORDER BY cargo, nombre',
    [req.params.condominioId]
  );
  res.json({ empleados: rows });
});

router.post('/empleados', ...guard, async (req, res) => {
  try {
    const { nombre, apellido, cargo, telefono, email, salario, modalidad_pago, turno, fecha_inicio } = req.body;
    const { rows } = await db.query(
      `INSERT INTO empleados (condominio_id,nombre,apellido,cargo,telefono,email,salario,modalidad_pago,turno,fecha_inicio)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.params.condominioId, nombre, apellido, cargo, telefono, email, salario, modalidad_pago||'mensual', turno||'completo', fecha_inicio]
    );
    res.status(201).json({ empleado: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/empleados/:id', ...guard, async (req, res) => {
  try {
    const { nombre, apellido, cargo, telefono, email, salario, modalidad_pago, turno } = req.body;
    const { rows } = await db.query(
      `UPDATE empleados SET nombre=$1,apellido=$2,cargo=$3,telefono=$4,email=$5,salario=$6,modalidad_pago=$7,turno=$8
       WHERE id=$9 AND condominio_id=$10 RETURNING *`,
      [nombre, apellido, cargo, telefono, email, salario, modalidad_pago, turno, req.params.id, req.params.condominioId]
    );
    res.json({ empleado: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pagos de salarios
router.get('/empleados/:id/salarios', ...guard, async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM pagos_salarios WHERE empleado_id=$1 ORDER BY created_at DESC LIMIT 20',
    [req.params.id]
  );
  res.json({ salarios: rows });
});

router.post('/salarios', ...guard, async (req, res) => {
  try {
    const { empleado_id, periodo_inicio, periodo_fin, monto, metodo, estado, fecha_pago, notas } = req.body;
    const { rows } = await db.query(
      `INSERT INTO pagos_salarios (empleado_id,periodo_inicio,periodo_fin,monto,metodo,estado,fecha_pago,registrado_por,notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [empleado_id, periodo_inicio, periodo_fin, monto, metodo||'efectivo', estado||'pagado', fecha_pago, req.user.id, notas]
    );
    res.status(201).json({ salario: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══ SOLICITUDES ════════════════════════════════════════════

router.get('/solicitudes', authenticate, async (req, res) => {
  try {
    const { estado } = req.query;
    let whereExtra = '';
    const params = [req.params.condominioId];
    if (estado) { params.push(estado); whereExtra = ` AND s.estado=$${params.length}`; }

    // Si es residente, solo ve las suyas
    if (req.user.rol === 'residente') {
      params.push(req.user.id);
      whereExtra += ` AND r.usuario_id=$${params.length}`;
    }

    const { rows } = await db.query(
      `SELECT s.*, u.numero as unidad_numero,
              usr.nombre||' '||usr.apellido as residente_nombre,
              rep.nombre||' '||rep.apellido as respondido_por_nombre
       FROM solicitudes s
       LEFT JOIN unidades u ON u.id=s.unidad_id
       LEFT JOIN residentes r ON r.unidad_id=u.id AND r.activo=true
       LEFT JOIN usuarios usr ON usr.id=r.usuario_id
       LEFT JOIN usuarios rep ON rep.id=s.respondido_por
       WHERE s.condominio_id=$1${whereExtra}
       ORDER BY s.created_at DESC`,
      params
    );
    res.json({ solicitudes: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/solicitudes', authenticate, async (req, res) => {
  try {
    const { unidad_id, tipo, asunto, descripcion, prioridad, foto_url } = req.body;
    const { rows: [sol] } = await db.query(
      `INSERT INTO solicitudes (condominio_id,unidad_id,tipo,asunto,descripcion,prioridad,foto_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.condominioId, unidad_id, tipo||'mantenimiento', asunto, descripcion, prioridad||'normal', foto_url]
    );

    // Notificar a los admins del condominio
    const { rows: admins } = await db.query(
      'SELECT usuario_id FROM condominio_admins WHERE condominio_id=$1',
      [req.params.condominioId]
    );
    for (const admin of admins) {
      await db.query(
        `INSERT INTO notificaciones (usuario_id,condominio_id,titulo,mensaje,tipo)
         VALUES ($1,$2,'Nueva solicitud','Se recibió una solicitud: '||$3,'solicitud')`,
        [admin.usuario_id, req.params.condominioId, asunto]
      );
    }

    res.status(201).json({ solicitud: sol });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/solicitudes/:id', ...guard, async (req, res) => {
  try {
    const { estado, respuesta } = req.body;
    const { rows } = await db.query(
      `UPDATE solicitudes SET estado=$1, respuesta=$2, respondido_por=$3, updated_at=NOW()
       WHERE id=$4 AND condominio_id=$5 RETURNING *`,
      [estado, respuesta, req.user.id, req.params.id, req.params.condominioId]
    );
    res.json({ solicitud: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══ NOTIFICACIONES ═════════════════════════════════════════

router.get('/notificaciones', authenticate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM notificaciones WHERE usuario_id=$1 AND (condominio_id=$2 OR condominio_id IS NULL)
     ORDER BY created_at DESC LIMIT 30`,
    [req.user.id, req.params.condominioId]
  );
  res.json({ notificaciones: rows });
});

router.put('/notificaciones/:id/leer', authenticate, async (req, res) => {
  await db.query('UPDATE notificaciones SET leida=true WHERE id=$1 AND usuario_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

router.put('/notificaciones/leer-todas', authenticate, async (req, res) => {
  await db.query('UPDATE notificaciones SET leida=true WHERE usuario_id=$1 AND condominio_id=$2', [req.user.id, req.params.condominioId]);
  res.json({ ok: true });
});

module.exports = router;
