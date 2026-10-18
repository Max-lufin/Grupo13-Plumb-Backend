// Laboratorio de consultas: las 13 consultas exigidas en la Etapa I y las
// pruebas de integridad, ejecutables desde la aplicación.
//
// Cada ejecución corre dentro de una transacción que termina en ROLLBACK
// (ver enTransaccionDePrueba), así la demostración se puede repetir sin
// alterar los datos. Las sentencias son las mismas constantes SQL que usan
// los endpoints: no hay una versión "de muestra" distinta a la real.

import { enTransaccionDePrueba } from '../config/db.js';
import { cronometro } from '../utils/http.js';
import { digitoVerificador } from '../validators/rut.js';
import { SQL as CLIENTE } from './cliente.model.js';
import { SQL as MAESTRO } from './maestro.model.js';
import { SQL as OFICIO } from './oficio.model.js';
import { SQL as SOLICITUD } from './solicitud.model.js';
import { MQL } from './mql.js';
import { hoyISO } from './reglas.js';

const SQL_LAB = {
  ALTER_FECHA_RESPUESTA: `
ALTER TABLE solicitud
    ADD COLUMN fecha_respuesta TIMESTAMPTZ NULL`.trim(),

  ALTER_TOPE_TARIFA: `
ALTER TABLE maestro
    ADD CONSTRAINT ck_maestro_tarifa_max CHECK (tarifa_hora <= 150000)`.trim(),

  CREAR_TABLA_CARGA: `
CREATE TABLE IF NOT EXISTS carga_maestros (
    rut     VARCHAR(10),
    nombre  VARCHAR(120),
    oficio  VARCHAR(60),
    region  VARCHAR(60)
);
INSERT INTO carga_maestros VALUES
    ('11111111-1', 'Ejemplo Uno', 'Gasfíter', 'Valparaíso'),
    ('22222222-2', 'Ejemplo Dos', 'Pintor', 'Biobío')`.trim(),

  DROP_CARGA: 'DROP TABLE IF EXISTS carga_maestros',
};

const una = async (db, sql, valores = []) => (await db.query(sql, valores)).rows[0];

const EXISTE_RUT = {
  cliente: 'SELECT 1 FROM cliente WHERE rut_cliente = $1',
  maestro: 'SELECT 1 FROM maestro WHERE rut_maestro = $1',
};

// RUT válido (con dígito verificador) que todavía no está registrado.
// Primero intenta con el RUT que usa 03_consultas.sql, para que la demo y
// el archivo muestren los mismos valores.
async function rutLibre(db, tabla, preferido) {
  if (preferido && !(await una(db, EXISTE_RUT[tabla], [preferido]))) return preferido;
  for (;;) {
    const numero = 20_000_000 + Math.floor(Math.random() * 6_000_000);
    const rut = `${numero}-${digitoVerificador(numero)}`;
    if (!(await una(db, EXISTE_RUT[tabla], [rut]))) return rut;
  }
}

function sumarDias(fechaISO, dias) {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export const CONSULTAS = [
  {
    numero: 1,
    tipo: 'ALTER',
    titulo: 'Registrar cuándo responde el maestro',
    descripcion: 'Agrega fecha_respuesta a SOLICITUD para medir cuánto tarda un maestro en aceptar o rechazar: es el indicador del objetivo de negocio (reducir los tiempos de conexión).',
    trazabilidad: { requisito: 'Objetivo de negocio: menos tiempo de conexión', casoDeUso: 'CU-02 Gestionar solicitud', tablas: ['solicitud'] },
    endpoint: null,
    sql: SQL_LAB.ALTER_FECHA_RESPUESTA,
    verificacion: {
      descripcion: 'La columna existe dentro de la transacción',
      sql: `SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'solicitud' AND column_name = 'fecha_respuesta'`,
    },
  },
  {
    numero: 2,
    tipo: 'ALTER',
    titulo: 'Tope de tarifa por hora',
    descripcion: 'Agrega una restricción CHECK para que nadie publique una tarifa sobre $150.000 por hora por un error de digitación.',
    trazabilidad: { requisito: 'RF-01 Mantenedor de maestros', casoDeUso: 'CU-03 Gestionar maestros', tablas: ['maestro'] },
    endpoint: null,
    sql: SQL_LAB.ALTER_TOPE_TARIFA,
    verificacion: {
      descripcion: 'La restricción quedó registrada en el catálogo de PostgreSQL',
      sql: `SELECT conname AS restriccion, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conname = 'ck_maestro_tarifa_max'`,
    },
  },
  {
    numero: 3,
    tipo: 'SELECT',
    conJoin: true,
    titulo: 'Catálogo de maestros con filtros',
    descripcion: 'Filtros obligatorios: región y oficio. Opcionales: tarifa máxima, calificación mínima, disponibilidad y años de experiencia.',
    trazabilidad: { requisito: 'RF-04 Consulta con filtros', casoDeUso: 'CU-01 Consultar catálogo', tablas: ['maestro', 'oficio', 'region', 'v_reputacion_maestro'] },
    endpoint: 'GET /api/v1/catalogo?region=6&oficio=1&tarifaMax=25000&calificacionMin=4&disponible=true&experienciaMin=3',
    algebra: [
      'REP ← γ rut_maestro; AVG(puntuacion)→promedio, COUNT(*)→total_resenas (CALIFICACION ⨝ SOLICITUD)',
      'π rut_maestro, nombre, oficio, region, tarifa_hora, experiencia_anios, disponible, promedio (',
      '  σ id_region=6 ∧ id_oficio=1 ∧ tarifa_hora≤25000 ∧ promedio≥4 ∧ disponible ∧ experiencia_anios≥3 (',
      '    ((MAESTRO ⨝ OFICIO) ⨝ REGION) ⟕ REP ))',
    ],
    sql: MAESTRO.CATALOGO,
    parametros: async () => ({
      valores: [6, 1, 25000, 4, true, 3],
      etiquetas: ['región', 'oficio', 'tarifa máx.', 'calificación mín.', 'disponible', 'experiencia mín.'],
    }),
  },
  {
    numero: 4,
    tipo: 'SELECT',
    conJoin: true,
    titulo: 'Historial de solicitudes de un cliente',
    descripcion: 'Reúne las tres entidades de la transacción (Solicitud, Cliente y Maestro) y, si existe, la calificación del trabajo.',
    trazabilidad: { requisito: 'RF-03 Transacción y RF-09 Historial', casoDeUso: 'CU-02 Gestionar solicitud', tablas: ['solicitud', 'cliente', 'maestro', 'calificacion'] },
    endpoint: 'GET /api/v1/solicitudes?cliente={rut}',
    algebra: [
      'π id_solicitud, fecha_solicitud, estado, descripcion, cliente, maestro, puntuacion (',
      '  σ rut_cliente=$1 ( ((SOLICITUD ⨝ CLIENTE) ⨝ MAESTRO) ⟕ CALIFICACION ))',
    ],
    sql: SOLICITUD.LISTAR,
    parametros: async (db) => {
      // María González (12588772-4) si tiene historial; si no, el cliente con más solicitudes.
      const fila = await una(db, `SELECT rut_cliente FROM solicitud
        GROUP BY rut_cliente ORDER BY (rut_cliente = '12588772-4') DESC, COUNT(*) DESC, rut_cliente LIMIT 1`);
      return { valores: [fila?.rut_cliente ?? null, null, null], etiquetas: ['cliente', 'maestro', 'estado'] };
    },
  },
  {
    numero: 5,
    tipo: 'SELECT',
    conJoin: false,
    titulo: 'Bandeja de entrada del maestro',
    descripcion: 'Solicitudes que el maestro todavía no responde, de la más antigua a la más reciente.',
    trazabilidad: { requisito: 'RF-08 Bandeja y estados', casoDeUso: 'CU-02 Gestionar solicitud', tablas: ['solicitud'] },
    endpoint: 'GET /api/v1/maestros/{rut}/solicitudes?estado=Pendiente',
    algebra: [
      'π id_solicitud, descripcion, direccion, fecha_servicio, fecha_solicitud (',
      "  σ rut_maestro=$1 ∧ estado='Pendiente' (SOLICITUD))",
    ],
    sql: MAESTRO.BANDEJA,
    parametros: async (db) => {
      // Pedro González (7765180-2) si tiene pendientes; si no, el maestro con más pendientes.
      const fila = await una(db, `SELECT rut_maestro FROM solicitud WHERE estado = 'Pendiente'
        GROUP BY rut_maestro ORDER BY (rut_maestro = '7765180-2') DESC, COUNT(*) DESC, rut_maestro LIMIT 1`);
      return { valores: [fila?.rut_maestro ?? '7765180-2', 'Pendiente'], etiquetas: ['maestro', 'estado'] };
    },
  },
  {
    numero: 6,
    tipo: 'UPDATE',
    titulo: 'El maestro acepta una solicitud',
    descripcion: 'Pasa una solicitud de Pendiente a Aceptada. La condición sobre el estado actual evita aceptar algo que ya fue cancelado.',
    trazabilidad: { requisito: 'RF-03 Transacción', casoDeUso: 'CU-02 Gestionar solicitud', tablas: ['solicitud'] },
    endpoint: 'PATCH /api/v1/solicitudes/{id}',
    sql: SOLICITUD.CAMBIAR_ESTADO,
    parametros: async (db) => {
      let fila = await una(db, `SELECT id_solicitud FROM solicitud WHERE estado = 'Pendiente'
        ORDER BY (id_solicitud = 2) DESC, id_solicitud LIMIT 1`);
      if (!fila) {
        fila = await una(db, `INSERT INTO solicitud (rut_cliente, rut_maestro, descripcion, direccion, fecha_servicio)
          SELECT c.rut_cliente, m.rut_maestro, 'Solicitud de prueba del laboratorio', 'Dirección de prueba', CURRENT_DATE
          FROM cliente c, maestro m LIMIT 1 RETURNING id_solicitud`);
      }
      return { valores: [fila.id_solicitud, 'Aceptada', 'Pendiente'], etiquetas: ['id_solicitud', 'estado nuevo', 'estado esperado'] };
    },
  },
  {
    numero: 7,
    tipo: 'UPDATE',
    titulo: 'Disponibilidad y tarifa de un maestro',
    descripcion: 'Cambio parcial desde el mantenedor: el maestro vuelve a estar disponible y ajusta su tarifa. COALESCE conserva el valor actual del campo que no se envía.',
    trazabilidad: { requisito: 'RF-01 Mantenedor de maestros', casoDeUso: 'CU-03 Gestionar maestros', tablas: ['maestro'] },
    endpoint: 'PATCH /api/v1/maestros/{rut}',
    sql: MAESTRO.ACTUALIZAR_PARCIAL,
    parametros: async (db) => {
      const fila = await una(db, `SELECT rut_maestro FROM maestro
        ORDER BY (rut_maestro = '7559934-K') DESC, disponible, rut_maestro LIMIT 1`);
      return { valores: [fila.rut_maestro, true, 21000], etiquetas: ['maestro', 'disponible', 'tarifa_hora'] };
    },
  },
  {
    numero: 8,
    tipo: 'INSERT',
    titulo: 'Registro de un cliente',
    descripcion: 'Alta de un cliente nuevo. Si fuera menor de 18 años, la restricción ck_cliente_mayor_edad rechazaría la fila.',
    trazabilidad: { requisito: 'RF-05 Registro solo para mayores de 18', casoDeUso: 'CU-05 Registrar cuenta', tablas: ['cliente'] },
    endpoint: 'POST /api/v1/clientes',
    sql: CLIENTE.CREAR,
    parametros: async (db) => {
      const rut = await rutLibre(db, 'cliente', '20345678-6');
      return {
        valores: [rut, 'Tomás Henríquez Salas', rut === '20345678-6' ? 'tomas.henriquez@ejemplo.cl' : `tomas.${rut.slice(0, 4)}@ejemplo.cl`, '+56987654321', '2001-04-22'],
        etiquetas: ['rut', 'nombre', 'email', 'teléfono', 'nacimiento'],
      };
    },
  },
  {
    numero: 9,
    tipo: 'INSERT',
    titulo: 'Alta de un maestro',
    descripcion: 'El administrador agrega un maestro al catálogo con su oficio, región, tarifa y experiencia.',
    trazabilidad: { requisito: 'RF-01 Mantenedor de maestros', casoDeUso: 'CU-03 Gestionar maestros', tablas: ['maestro'] },
    endpoint: 'POST /api/v1/maestros',
    sql: MAESTRO.CREAR,
    parametros: async (db) => {
      const rut = await rutLibre(db, 'maestro', '16234567-2');
      const oficio = await una(db, 'SELECT id_oficio FROM oficio ORDER BY (id_oficio = 4) DESC, id_oficio LIMIT 1');
      return {
        valores: [rut, 'Gabriel Morales Iturra', rut === '16234567-2' ? 'gabriel.morales@ejemplo.cl' : `gabriel.${rut.slice(0, 4)}@ejemplo.cl`, '+56912345678', '1990-09-03',
          oficio.id_oficio, 6, 15000, 7, true, 'Pintura de interiores y fachadas en Viña y Valparaíso.'],
        etiquetas: ['rut', 'nombre', 'email', 'teléfono', 'nacimiento', 'oficio', 'región', 'tarifa', 'experiencia', 'disponible', 'descripción'],
      };
    },
  },
  {
    numero: 10,
    tipo: 'INSERT',
    titulo: 'Nueva solicitud de servicio',
    descripcion: 'La transacción del sistema: relaciona un Cliente y un Maestro en una nueva Solicitud, que nace en estado Pendiente por el valor por defecto de la columna.',
    trazabilidad: { requisito: 'RF-03 Transacción', casoDeUso: 'CU-02 Gestionar solicitud', tablas: ['solicitud', 'cliente', 'maestro'] },
    endpoint: 'POST /api/v1/solicitudes',
    sql: SOLICITUD.CREAR,
    parametros: async (db) => {
      const cliente = await una(db, `SELECT rut_cliente FROM cliente
        ORDER BY (rut_cliente = '13345441-1') DESC, nombre LIMIT 1`);
      const maestro = await una(db, `SELECT rut_maestro FROM maestro WHERE disponible
        ORDER BY (rut_maestro = '16178972-0') DESC, nombre LIMIT 1`);
      return {
        valores: [cliente.rut_cliente, maestro.rut_maestro, 'El estanque del WC se queda corriendo y sube la cuenta del agua.',
          'Av. Libertad 1180, Viña del Mar', sumarDias(hoyISO(), 2)],
        etiquetas: ['cliente', 'maestro', 'descripción', 'dirección', 'fecha servicio'],
      };
    },
  },
  {
    numero: 11,
    tipo: 'DELETE',
    titulo: 'Moderación: eliminar una solicitud falsa',
    descripcion: 'Borra una solicitud ya calificada. Por ON DELETE CASCADE su calificación desaparece en la misma operación y deja de contar en el promedio del maestro.',
    trazabilidad: { requisito: 'RF-10 Moderación', casoDeUso: 'CU-08 Moderar solicitudes y reseñas', tablas: ['solicitud', 'calificacion'] },
    endpoint: 'DELETE /api/v1/solicitudes/{id}',
    sql: SOLICITUD.ELIMINAR,
    parametros: async (db) => {
      const fila = await una(db, `SELECT s.id_solicitud FROM solicitud s
        JOIN calificacion c ON c.id_solicitud = s.id_solicitud
        ORDER BY (s.id_solicitud = 6) DESC, s.id_solicitud DESC LIMIT 1`);
      return { valores: [fila.id_solicitud], etiquetas: ['id_solicitud'] };
    },
    verificacion: {
      descripcion: 'La calificación de esa solicitud se borró en cascada',
      sql: 'SELECT COUNT(*) AS calificaciones_restantes FROM calificacion WHERE id_solicitud = $1',
      valores: (p) => [p[0]],
    },
  },
  {
    numero: 12,
    tipo: 'DELETE',
    titulo: 'Quitar un oficio que nadie ofrece',
    descripcion: 'Elimina un oficio sin maestros asociados. Si tuviera maestros, ON DELETE RESTRICT bloquearía el borrado (ver prueba R2).',
    trazabilidad: { requisito: 'RF-02 Mantenedor de oficios', casoDeUso: 'CU-04 Gestionar oficios', tablas: ['oficio'] },
    endpoint: 'DELETE /api/v1/oficios/{id}',
    sql: OFICIO.ELIMINAR,
    parametros: async (db) => {
      let fila = await una(db, `SELECT o.id_oficio FROM oficio o
        WHERE NOT EXISTS (SELECT 1 FROM maestro m WHERE m.id_oficio = o.id_oficio)
        ORDER BY (o.id_oficio = 10) DESC, o.id_oficio LIMIT 1`);
      if (!fila) fila = await una(db, "INSERT INTO oficio (nombre) VALUES ('Oficio de prueba') RETURNING id_oficio");
      return { valores: [fila.id_oficio], etiquetas: ['id_oficio'] };
    },
  },
  {
    numero: 13,
    tipo: 'DROP',
    titulo: 'Eliminar la tabla de carga temporal',
    descripcion: 'carga_maestros es un área de paso para importar maestros desde una planilla. Una vez copiados a MAESTRO, se elimina.',
    trazabilidad: { requisito: 'RF-01 Mantenedor de maestros', casoDeUso: 'CU-03 Gestionar maestros', tablas: ['carga_maestros'] },
    endpoint: null,
    preparacion: SQL_LAB.CREAR_TABLA_CARGA,
    sql: SQL_LAB.DROP_CARGA,
    verificacion: {
      descripcion: 'La tabla ya no existe',
      sql: "SELECT to_regclass('carga_maestros') IS NULL AS tabla_eliminada",
    },
  },
];

// Pruebas que DEBEN fallar: muestran que la base de datos protege la
// integridad aunque la aplicación tuviera un error.
export const PRUEBAS_INTEGRIDAD = [
  {
    codigo: 'R1',
    regla: 'CHECK',
    titulo: 'Un menor de edad intenta registrarse',
    restriccionEsperada: 'ck_cliente_mayor_edad',
    sql: CLIENTE.CREAR,
    parametros: async (db) => {
      const rut = await rutLibre(db, 'cliente');
      return [rut, 'Menor de Edad', `menor.${rut.slice(0, 4)}@ejemplo.cl`, null, sumarDias(hoyISO(), -15 * 365)];
    },
  },
  {
    codigo: 'R2',
    regla: 'ON DELETE RESTRICT',
    titulo: 'Borrar un oficio que tiene maestros',
    restriccionEsperada: 'fk_maestro_oficio',
    sql: OFICIO.ELIMINAR,
    parametros: async (db) => {
      const fila = await una(db, 'SELECT id_oficio FROM maestro GROUP BY id_oficio ORDER BY COUNT(*) DESC LIMIT 1');
      return [fila.id_oficio];
    },
  },
  {
    codigo: 'R3',
    regla: 'ON DELETE RESTRICT',
    titulo: 'Borrar un cliente con historial de solicitudes',
    restriccionEsperada: 'fk_solicitud_cliente',
    sql: 'DELETE FROM cliente WHERE rut_cliente = $1',
    parametros: async (db) => [(await una(db, 'SELECT rut_cliente FROM solicitud LIMIT 1')).rut_cliente],
  },
  {
    codigo: 'R4',
    regla: 'UNIQUE',
    titulo: 'Calificar dos veces el mismo trabajo',
    restriccionEsperada: 'uq_calificacion_solicitud',
    sql: 'INSERT INTO calificacion (id_solicitud, puntuacion, comentario) VALUES ($1, $2, $3)',
    parametros: async (db) => [(await una(db, 'SELECT id_solicitud FROM calificacion LIMIT 1')).id_solicitud, 5, 'Segunda nota'],
  },
  {
    codigo: 'R5',
    regla: 'CHECK',
    titulo: 'Puntuación fuera del rango 1 a 5',
    restriccionEsperada: 'ck_calificacion_puntuacion',
    sql: 'INSERT INTO calificacion (id_solicitud, puntuacion, comentario) VALUES ($1, $2, $3)',
    parametros: async (db) => {
      const fila = await una(db, `SELECT s.id_solicitud FROM solicitud s
        WHERE NOT EXISTS (SELECT 1 FROM calificacion c WHERE c.id_solicitud = s.id_solicitud) LIMIT 1`);
      return [fila.id_solicitud, 7, 'Nota imposible'];
    },
  },
  {
    codigo: 'R6',
    regla: 'FOREIGN KEY',
    titulo: 'Solicitud para un maestro que no existe',
    restriccionEsperada: 'fk_solicitud_maestro',
    sql: SOLICITUD.CREAR,
    parametros: async (db) => {
      const cliente = await una(db, 'SELECT rut_cliente FROM cliente LIMIT 1');
      return [cliente.rut_cliente, '1-9', 'Trabajo para un maestro inexistente.', 'Calle Falsa 123', hoyISO()];
    },
  },
];

const publica = ({ parametros, preparacion, verificacion, ...resto }) => ({
  ...resto,
  mql: MQL[resto.numero],
  preparacion: preparacion ?? null,
  verificacion: verificacion ? { descripcion: verificacion.descripcion, sql: verificacion.sql } : null,
});

export const Consulta = {
  listar() {
    return {
      consultas: CONSULTAS.map(publica),
      pruebas: PRUEBAS_INTEGRIDAD.map(({ parametros, ...resto }) => resto),
    };
  },

  buscar(numero) {
    const c = CONSULTAS.find((x) => x.numero === numero);
    return c ? publica(c) : null;
  },

  async ejecutar(numero) {
    const c = CONSULTAS.find((x) => x.numero === numero);
    if (!c) return null;
    return enTransaccionDePrueba(async (db) => {
      if (c.preparacion) await db.query(c.preparacion);
      const { valores = [], etiquetas = [] } = c.parametros ? await c.parametros(db) : {};
      const medir = cronometro();
      const r = await db.query(c.sql, valores);
      const ms = medir();
      let verificacion = null;
      if (c.verificacion) {
        const v = await db.query(c.verificacion.sql, c.verificacion.valores ? c.verificacion.valores(valores) : []);
        verificacion = { descripcion: c.verificacion.descripcion, filas: v.rows };
      }
      return {
        numero: c.numero,
        tipo: c.tipo,
        comando: r.command,
        parametros: valores.map((valor, i) => ({ nombre: etiquetas[i] ?? `$${i + 1}`, valor })),
        filas: r.rows ?? [],
        columnas: (r.fields ?? []).map((f) => f.name),
        filasAfectadas: r.rowCount,
        ms,
        verificacion,
        transaccion: 'ROLLBACK',
      };
    });
  },

  async probar(codigo) {
    const p = PRUEBAS_INTEGRIDAD.find((x) => x.codigo === codigo);
    if (!p) return null;
    return enTransaccionDePrueba(async (db) => {
      const valores = await p.parametros(db);
      try {
        await db.query(p.sql, valores);
        return { codigo, rechazada: false, restriccionEsperada: p.restriccionEsperada, parametros: valores };
      } catch (error) {
        if (!error.code) throw error;
        return {
          codigo,
          rechazada: true,
          cumpleLoEsperado: error.constraint === p.restriccionEsperada,
          restriccion: error.constraint ?? null,
          codigoPostgres: error.code,
          mensajePostgres: error.message,
          parametros: valores,
          transaccion: 'ROLLBACK',
        };
      }
    });
  },
};
