// Laboratorio de consultas: las 13 consultas exigidas en la Etapa I, convertidas
// de SQL a MQL y ejecutables desde la aplicación sobre MongoDB.
//
// Para cada consulta se guarda el SQL de la Etapa I (solo como referencia de la
// conversión) y las operaciones de MongoDB que la reemplazan. El texto MQL que
// muestra la aplicación se genera a partir de esas mismas operaciones, así lo que
// se ve es exactamente lo que se ejecuta. Las escrituras corren en una
// transacción que se aborta, y los cambios de estructura se revierten al final.

import { enTransaccionDePrueba, mongo } from '../config/mongo.js';
import { hashContrasena } from '../utils/credenciales.js';
import { digitoVerificador } from '../validators/rut.js';
import { cronometro } from '../utils/http.js';
import { aMongosh, Pendiente } from '../utils/mongosh.js';
import { CONSULTAS_MAESTRO } from './maestro.model.js';
import { regionPorNumero } from './region.model.js';
import { aFecha, hoyISO } from './reglas.js';
import { pipelineHistorial } from './solicitud.model.js';

const ETAPA1 = {
  1: `ALTER TABLE solicitud
    ADD COLUMN fecha_respuesta TIMESTAMPTZ NULL;`,
  2: `ALTER TABLE maestro
    ADD CONSTRAINT ck_maestro_tarifa_max CHECK (tarifa_hora <= 150000);`,
  3: `SELECT m.rut_maestro, m.nombre, o.nombre AS oficio, r.nombre AS region,
       m.tarifa_hora, m.experiencia_anios, m.disponible,
       COALESCE(v.promedio, 0) AS promedio
FROM maestro m
JOIN oficio o ON o.id_oficio = m.id_oficio
JOIN region r ON r.id_region = m.id_region
LEFT JOIN v_reputacion_maestro v ON v.rut_maestro = m.rut_maestro
WHERE m.id_region = 6 AND m.id_oficio = 1
  AND m.tarifa_hora <= 25000 AND COALESCE(v.promedio, 0) >= 4
  AND m.disponible = TRUE AND m.experiencia_anios >= 3
ORDER BY promedio DESC, m.tarifa_hora;`,
  4: `SELECT s.id_solicitud, s.fecha_solicitud, s.estado, s.descripcion,
       c.nombre AS cliente, m.nombre AS maestro, k.puntuacion
FROM solicitud s
JOIN cliente c ON c.rut_cliente = s.rut_cliente
JOIN maestro m ON m.rut_maestro = s.rut_maestro
LEFT JOIN calificacion k ON k.id_solicitud = s.id_solicitud
WHERE s.rut_cliente = '12588772-4'
ORDER BY s.fecha_solicitud DESC;`,
  5: `SELECT id_solicitud, descripcion, direccion, fecha_servicio, fecha_solicitud
FROM solicitud
WHERE rut_maestro = '7765180-2' AND estado = 'Pendiente'
ORDER BY fecha_solicitud;`,
  6: `UPDATE solicitud
SET estado = 'Aceptada'
WHERE id_solicitud = 2 AND estado = 'Pendiente';`,
  7: `UPDATE maestro
SET disponible = TRUE, tarifa_hora = 21000
WHERE rut_maestro = '7559934-K';`,
  8: `INSERT INTO cliente (rut_cliente, nombre, email, telefono,
                     fecha_nacimiento, contrasena_hash)
VALUES ('20345678-6', 'Tomás Henríquez Salas', 'tomas.henriquez@ejemplo.cl',
        '+56987654321', '2001-04-22', 'scrypt$…');`,
  9: `INSERT INTO maestro (rut_maestro, nombre, email, telefono, fecha_nacimiento,
                     contrasena_hash, id_oficio, id_region, tarifa_hora,
                     experiencia_anios, disponible, descripcion)
VALUES ('16234567-2', 'Gabriel Morales Iturra', 'gabriel.morales@ejemplo.cl',
        '+56912345678', '1990-09-03', 'scrypt$…', 4, 6, 15000, 7, TRUE,
        'Pintura de interiores y fachadas en Viña.');`,
  10: `INSERT INTO solicitud (rut_cliente, rut_maestro, descripcion, direccion, fecha_servicio)
VALUES ('13345441-1', '16178972-0',
        'El estanque del WC se queda corriendo.',
        'Av. Libertad 1180, Viña del Mar', CURRENT_DATE + 2);`,
  11: `DELETE FROM solicitud
WHERE id_solicitud = 6;
-- ON DELETE CASCADE borra también su calificación`,
  12: `DELETE FROM oficio
WHERE id_oficio = 10;
-- ON DELETE RESTRICT lo impide si hay maestros con ese oficio`,
  13: `CREATE TABLE carga_maestros (rut VARCHAR(10), nombre VARCHAR(120),
                             oficio VARCHAR(60), region VARCHAR(60));
DROP TABLE carga_maestros;`,
};

const CLIENTE_HISTORIAL = '12588772-4';

// RUT válido que todavía no está registrado. Primero intenta con el preferido,
// así la demostración muestra siempre los mismos datos.
async function rutLibre(db, preferido, session) {
  const usado = async (rut) => db.collection('usuarios').countDocuments({ _id: rut }, { limit: 1, session });
  if (!(await usado(preferido))) return preferido;
  for (;;) {
    const numero = 20_000_000 + Math.floor(Math.random() * 6_000_000);
    const rut = `${numero}-${digitoVerificador(numero)}`;
    if (!(await usado(rut))) return rut;
  }
}
const correoPara = (rut, preferido, base) => (rut === preferido ? base : base.replace('@', `.${rut.slice(0, 4)}@`));
const MAESTRO_BANDEJA = '7765180-2';

// Cambios de estructura: MongoDB no tiene ALTER TABLE; el equivalente es
// modificar el validador de la colección con collMod. Se revierte al final.
const cambioDeValidador = (coleccion, descripcion, aplicar, leer) => ({
  coleccion, descripcion, aplicar, leer,
  texto: `const v = db.getCollectionInfos({ name: '${coleccion}' })[0].options.validator;\n${descripcion}\ndb.runCommand({ collMod: '${coleccion}', validator: v })`,
});

export const CONSULTAS = [
  {
    numero: 1,
    tipo: 'ALTER',
    titulo: 'Registrar cuándo responde el maestro',
    descripcion: 'Agrega el campo fecha_respuesta a las solicitudes para medir cuánto tarda un maestro en aceptar o rechazar. Como el validador rechaza campos no declarados, agregar uno exige ampliar el validador con collMod.',
    trazabilidad: { requisito: 'Objetivo de negocio: menos tiempo de conexión', casoDeUso: 'CU-02 Gestionar solicitud', colecciones: ['solicitudes'] },
    conversion: 'ALTER TABLE ADD COLUMN → collMod con el validador ampliado',
    modo: 'estructura',
    estructura: cambioDeValidador('solicitudes',
      "v.$jsonSchema.properties.fecha_respuesta = { bsonType: ['date', 'null'] };",
      (v) => { v.$jsonSchema.properties.fecha_respuesta = { bsonType: ['date', 'null'] }; },
      (v) => ({ fecha_respuesta: v.$jsonSchema.properties.fecha_respuesta ?? null })),
  },
  {
    numero: 2,
    tipo: 'ALTER',
    titulo: 'Tope de tarifa por hora',
    descripcion: 'Agrega la regla de que nadie publique una tarifa sobre $150.000 por hora. En MongoDB la regla vive en el validador de la colección.',
    trazabilidad: { requisito: 'RF-01 Mantenedor de maestros', casoDeUso: 'CU-03 Gestionar maestros', colecciones: ['usuarios'] },
    conversion: 'ALTER TABLE ADD CHECK → collMod con maximum en $jsonSchema',
    modo: 'estructura',
    estructura: cambioDeValidador('usuarios',
      'v.$jsonSchema.properties.maestro.properties.tarifa_hora.maximum = 150000;',
      (v) => { v.$jsonSchema.properties.maestro.properties.tarifa_hora.maximum = 150000; },
      (v) => ({ tarifa_hora: v.$jsonSchema.properties.maestro.properties.tarifa_hora })),
  },
  {
    numero: 3,
    tipo: 'SELECT',
    conJoin: true,
    titulo: 'Catálogo de maestros con filtros',
    descripcion: 'Filtros obligatorios: región y oficio. Opcionales: tarifa máxima, calificación mínima, disponibilidad y años de experiencia. Los JOIN con oficio y región desaparecen porque esos datos están copiados en el perfil del maestro.',
    trazabilidad: { requisito: 'RF-04 Consulta con filtros', casoDeUso: 'CU-01 Consultar catálogo', colecciones: ['usuarios'] },
    endpoint: 'GET /api/v1/catalogo?region=6&oficio=1&tarifaMax=25000&calificacionMin=4&disponible=true&experienciaMin=3',
    conversion: 'SELECT con 3 JOIN y vista → find con operadores $lte, $gte sobre un solo documento',
    modo: 'lectura',
    algebra: [
      'REP ← γ rut_maestro; AVG(puntuacion)→promedio (CALIFICACION ⨝ SOLICITUD)',
      'π rut_maestro, nombre, oficio, region, tarifa_hora, experiencia_anios, disponible, promedio (',
      '  σ id_region=6 ∧ id_oficio=1 ∧ tarifa_hora≤25000 ∧ promedio≥4 ∧ disponible ∧ experiencia_anios≥3 (',
      '    ((MAESTRO ⨝ OFICIO) ⨝ REGION) ⟕ REP ))',
    ],
    pasos: [() => {
      const { filtro, proyeccion, orden } = CONSULTAS_MAESTRO.catalogo({ region: 6, oficio: 1, tarifaMax: 25000, calificacionMin: 4, disponible: true, experienciaMin: 3 });
      return { coleccion: 'usuarios', metodo: 'find', filtro, proyeccion, orden };
    }],
  },
  {
    numero: 4,
    tipo: 'SELECT',
    conJoin: true,
    titulo: 'Historial de solicitudes de un cliente',
    descripcion: 'Los nombres de cliente y maestro y la nota viajan dentro de la solicitud. Lo único que se trae con $lookup (el JOIN de MongoDB) es el teléfono del maestro, que no se copia porque cambia y solo se muestra cuando aceptó el trabajo.',
    trazabilidad: { requisito: 'RF-03 Transacción y RF-09 Historial', casoDeUso: 'CU-02 Gestionar solicitud', colecciones: ['solicitudes', 'usuarios'] },
    endpoint: `GET /api/v1/solicitudes?cliente=${CLIENTE_HISTORIAL}`,
    conversion: 'SELECT con JOIN y LEFT JOIN → aggregate con $match, $sort y $lookup',
    modo: 'lectura',
    algebra: [
      'π id_solicitud, fecha_solicitud, estado, descripcion, cliente, maestro, puntuacion (',
      `  σ rut_cliente='${CLIENTE_HISTORIAL}' ( ((SOLICITUD ⨝ CLIENTE) ⨝ MAESTRO) ⟕ CALIFICACION ))`,
    ],
    pasos: [() => ({ coleccion: 'solicitudes', metodo: 'aggregate', pipeline: pipelineHistorial({ cliente: CLIENTE_HISTORIAL }) })],
  },
  {
    numero: 5,
    tipo: 'SELECT',
    conJoin: false,
    titulo: 'Bandeja de entrada del maestro',
    descripcion: 'Solicitudes que el maestro todavía no responde, de la más antigua a la más reciente. El índice ix_bandeja entrega los documentos ya ordenados.',
    trazabilidad: { requisito: 'RF-08 Bandeja y estados', casoDeUso: 'CU-02 Gestionar solicitud', colecciones: ['solicitudes'] },
    endpoint: `GET /api/v1/maestros/${MAESTRO_BANDEJA}/solicitudes?estado=Pendiente`,
    conversion: 'SELECT con WHERE y ORDER BY → find con filtro y sort',
    modo: 'lectura',
    algebra: [
      'π id_solicitud, descripcion, direccion, fecha_servicio, fecha_solicitud (',
      `  σ rut_maestro='${MAESTRO_BANDEJA}' ∧ estado='Pendiente' (SOLICITUD))`,
    ],
    pasos: [() => ({
      coleccion: 'solicitudes', metodo: 'find',
      filtro: { 'maestro._id': MAESTRO_BANDEJA, estado: 'Pendiente' },
      proyeccion: { folio: 1, descripcion: 1, direccion: 1, fecha_servicio: 1, fecha_solicitud: 1 },
      orden: { fecha_solicitud: 1 },
    })],
  },
  {
    numero: 6,
    tipo: 'UPDATE',
    titulo: 'El maestro acepta una solicitud',
    descripcion: 'Pasa una solicitud de Pendiente a Aceptada. Igual que en SQL, la condición sobre el estado actual evita aceptar algo que ya fue cancelado.',
    trazabilidad: { requisito: 'RF-03 Transacción', casoDeUso: 'CU-02 Gestionar solicitud', colecciones: ['solicitudes'] },
    endpoint: 'PATCH /api/v1/solicitudes/{id}',
    conversion: 'UPDATE … WHERE → updateOne con $set',
    modo: 'escritura',
    porDefecto: { folio: 2 },
    async preparar(db, session) {
      const s = await db.collection('solicitudes').findOne({ estado: 'Pendiente' }, { sort: { folio: 1 }, projection: { folio: 1 }, session });
      return { folio: s?.folio ?? 2 };
    },
    pasos: [
      ({ folio }) => ({ coleccion: 'solicitudes', metodo: 'updateOne', filtro: { folio, estado: 'Pendiente' }, cambio: { $set: { estado: 'Aceptada' } } }),
      ({ folio }) => ({ coleccion: 'solicitudes', metodo: 'findOne', filtro: { folio }, proyeccion: { _id: 0, folio: 1, estado: 1 }, nota: 'Comprobación' }),
    ],
  },
  {
    numero: 7,
    tipo: 'UPDATE',
    titulo: 'Disponibilidad y tarifa de un maestro',
    descripcion: 'Cambio parcial desde el mantenedor: el maestro vuelve a estar disponible y ajusta su tarifa. $set cambia solo los campos indicados, sin el COALESCE que usaba SQL.',
    trazabilidad: { requisito: 'RF-01 Mantenedor de maestros', casoDeUso: 'CU-03 Gestionar maestros', colecciones: ['usuarios'] },
    endpoint: 'PATCH /api/v1/maestros/{rut}',
    conversion: 'UPDATE con COALESCE → updateOne con $set sobre campos del perfil embebido',
    modo: 'escritura',
    pasos: [
      () => ({ coleccion: 'usuarios', metodo: 'updateOne', filtro: { _id: '7559934-K', roles: 'maestro' }, cambio: { $set: { 'maestro.disponible': true, 'maestro.tarifa_hora': 21000 } } }),
      () => ({ coleccion: 'usuarios', metodo: 'findOne', filtro: { _id: '7559934-K' }, proyeccion: { nombre: 1, 'maestro.disponible': 1, 'maestro.tarifa_hora': 1 }, nota: 'Comprobación' }),
    ],
  },
  {
    numero: 8,
    tipo: 'INSERT',
    titulo: 'Registro de un cliente',
    descripcion: 'Alta de un cliente nuevo con su contraseña cifrada. Si fuera menor de 18 años, el validador de la colección rechazaría el documento.',
    trazabilidad: { requisito: 'RF-05 Registro solo para mayores de 18', casoDeUso: 'CU-05 Registrar cuenta', colecciones: ['usuarios'] },
    endpoint: 'POST /api/v1/clientes',
    conversion: 'INSERT INTO cliente → insertOne en usuarios con el rol cliente',
    modo: 'escritura',
    porDefecto: { hash: new Pendiente('hash scrypt de la contraseña'), rut: '20345678-6' },
    async preparar(db, session) {
      const rut = await rutLibre(db, '20345678-6', session);
      return { hash: await hashContrasena('plumb2026'), rut };
    },
    pasos: [
      ({ hash, rut }) => ({
        coleccion: 'usuarios', metodo: 'insertOne', documento: {
          _id: rut, nombre: 'Tomás Henríquez Salas', email: correoPara(rut, '20345678-6', 'tomas.henriquez@ejemplo.cl'), telefono: '+56987654321',
          fecha_nacimiento: aFecha('2001-04-22'), contrasena: hash, roles: ['cliente'], fecha_registro: new Date(),
        },
      }),
      ({ rut }) => ({ coleccion: 'usuarios', metodo: 'findOne', filtro: { _id: rut }, proyeccion: { nombre: 1, roles: 1, fecha_nacimiento: 1 }, nota: 'Comprobación' }),
    ],
  },
  {
    numero: 9,
    tipo: 'INSERT',
    titulo: 'Alta de un maestro',
    descripcion: 'El administrador agrega un maestro. Su perfil se guarda dentro del mismo documento, con el nombre del oficio y la región completa copiados.',
    trazabilidad: { requisito: 'RF-01 Mantenedor de maestros', casoDeUso: 'CU-03 Gestionar maestros', colecciones: ['usuarios', 'oficios'] },
    endpoint: 'POST /api/v1/maestros',
    conversion: 'INSERT INTO maestro → insertOne en usuarios con el perfil de maestro embebido',
    modo: 'escritura',
    porDefecto: { hash: new Pendiente('hash scrypt de la contraseña'), oficio: { _id: 4, nombre: 'Pintor' }, rut: '16234567-2' },
    async preparar(db, session) {
      const pintor = await db.collection('oficios').findOne({ _id: 4 }, { session });
      const rut = await rutLibre(db, '16234567-2', session);
      return { hash: await hashContrasena('plumb2026'), oficio: { _id: pintor?._id ?? 4, nombre: pintor?.nombre ?? 'Pintor' }, rut };
    },
    pasos: [
      ({ hash, oficio, rut }) => ({
        coleccion: 'usuarios', metodo: 'insertOne', documento: {
          _id: rut, nombre: 'Gabriel Morales Iturra', email: correoPara(rut, '16234567-2', 'gabriel.morales@ejemplo.cl'), telefono: '+56912345678',
          fecha_nacimiento: aFecha('1990-09-03'), contrasena: hash, roles: ['maestro'], fecha_registro: new Date(),
          maestro: {
            oficio, region: regionPorNumero(6), tarifa_hora: 15000, experiencia_anios: 7, disponible: true,
            descripcion: 'Pintura de interiores y fachadas en Viña.',
            reputacion: { promedio: 0, total: 0, suma: 0 }, resenas_recientes: [],
          },
        },
      }),
      ({ rut }) => ({ coleccion: 'usuarios', metodo: 'findOne', filtro: { _id: rut }, proyeccion: { nombre: 1, 'maestro.oficio': 1, 'maestro.region': 1 }, nota: 'Comprobación' }),
    ],
  },
  {
    numero: 10,
    tipo: 'INSERT',
    titulo: 'Nueva solicitud de servicio',
    descripcion: 'La transacción del sistema: relaciona un cliente y un maestro en una nueva solicitud. MongoDB no tiene SERIAL ni DEFAULT: el folio sale de la colección contadores y el estado Pendiente lo pone la API.',
    trazabilidad: { requisito: 'RF-03 Transacción', casoDeUso: 'CU-02 Gestionar solicitud', colecciones: ['contadores', 'solicitudes'] },
    endpoint: 'POST /api/v1/solicitudes',
    conversion: 'INSERT con SERIAL y DEFAULT → findOneAndUpdate con $inc + insertOne',
    modo: 'escritura',
    pasos: [
      () => ({ coleccion: 'contadores', metodo: 'findOneAndUpdate', filtro: { _id: 'solicitudes' }, cambio: { $inc: { seq: 1 } } }),
      (p, r) => ({
        coleccion: 'solicitudes', metodo: 'insertOne', documento: {
          folio: r[0]?.[0]?.seq ?? new Pendiente('seq que devolvió el paso 1'),
          cliente: { _id: '13345441-1', nombre: 'Juan Pérez López' },
          maestro: { _id: '16178972-0', nombre: 'Claudia Rojas Fuentes' },
          descripcion: 'El estanque del WC se queda corriendo.',
          direccion: 'Av. Libertad 1180, Viña del Mar',
          fecha_servicio: aFecha(hoyISO()),
          estado: 'Pendiente',
          fecha_solicitud: new Date(),
          calificacion: null,
        },
      }),
    ],
  },
  {
    numero: 11,
    tipo: 'DELETE',
    titulo: 'Moderación: eliminar una solicitud falsa',
    descripcion: 'Borra una solicitud ya calificada. Su calificación está dentro del documento y se va con él (el CASCADE sale gratis). Lo que hay que hacer a mano es recalcular la reputación del maestro: $group suma sus notas restantes, como el GROUP BY de la vista de la Etapa I.',
    trazabilidad: { requisito: 'RF-10 Moderación', casoDeUso: 'CU-08 Moderar solicitudes y reseñas', colecciones: ['solicitudes', 'usuarios'] },
    endpoint: 'DELETE /api/v1/solicitudes/{id}',
    conversion: 'DELETE con ON DELETE CASCADE → findOneAndDelete + aggregate con $group + updateOne',
    modo: 'escritura',
    pasos: [
      () => ({ coleccion: 'solicitudes', metodo: 'findOneAndDelete', filtro: { folio: 6 } }),
      (p, r) => {
        const rut = r[0]?.[0]?.maestro._id ?? new Pendiente('rut del maestro de la solicitud borrada');
        return {
          coleccion: 'solicitudes', metodo: 'aggregate', nota: 'Reputación recalculada',
          pipeline: [
            { $match: { 'maestro._id': rut, calificacion: { $ne: null } } },
            { $group: { _id: '$maestro._id', total: { $sum: 1 }, suma: { $sum: '$calificacion.puntuacion' }, promedio: { $avg: '$calificacion.puntuacion' } } },
          ],
        };
      },
      (p, r) => {
        const rut = r[0]?.[0]?.maestro._id ?? new Pendiente('rut del maestro');
        const g = r[1]?.[0];
        const reputacion = g ? { promedio: Math.round((g.suma * 10) / g.total) / 10, total: g.total, suma: g.suma }
          : (r[1] ? { promedio: 0, total: 0, suma: 0 } : new Pendiente('resultado del paso 2'));
        return {
          coleccion: 'usuarios', metodo: 'updateOne', filtro: { _id: rut },
          cambio: { $set: { 'maestro.reputacion': reputacion }, $pull: { 'maestro.resenas_recientes': { solicitud_id: r[0]?.[0]?._id ?? new Pendiente('_id de la solicitud borrada') } } },
        };
      },
    ],
  },
  {
    numero: 12,
    tipo: 'DELETE',
    titulo: 'Quitar un oficio que nadie ofrece',
    descripcion: 'MongoDB no tiene ON DELETE RESTRICT: antes de borrar, la API cuenta los maestros que ejercen el oficio y solo borra si no hay ninguno.',
    trazabilidad: { requisito: 'RF-02 Mantenedor de oficios', casoDeUso: 'CU-04 Gestionar oficios', colecciones: ['usuarios', 'oficios'] },
    endpoint: 'DELETE /api/v1/oficios/{id}',
    conversion: 'DELETE con RESTRICT → countDocuments y, si da 0, deleteOne',
    modo: 'escritura',
    pasos: [
      () => ({ coleccion: 'usuarios', metodo: 'countDocuments', filtro: { 'maestro.oficio._id': 10 }, nota: 'Maestros con el oficio' }),
      () => ({ coleccion: 'oficios', metodo: 'deleteOne', filtro: { _id: 10 }, cuando: (r) => r[0]?.[0] === 0, nota: 'Solo si el conteo dio 0' }),
    ],
  },
  {
    numero: 13,
    tipo: 'DROP',
    titulo: 'Eliminar la colección de carga temporal',
    descripcion: 'carga_maestros es un área de paso para importar maestros desde una planilla. En MongoDB la colección nace con el primer insert; drop() la elimina junto con sus índices.',
    trazabilidad: { requisito: 'RF-01 Mantenedor de maestros', casoDeUso: 'CU-03 Gestionar maestros', colecciones: ['carga_maestros'] },
    conversion: 'CREATE TABLE + DROP TABLE → insertMany + drop',
    modo: 'estructura',
    pasos: [
      () => ({
        coleccion: 'carga_maestros', metodo: 'insertMany', documentos: [
          { rut: '11111111-1', nombre: 'Ejemplo Uno', oficio: 'Gasfíter', region: 'Valparaíso' },
          { rut: '22222222-2', nombre: 'Ejemplo Dos', oficio: 'Pintor', region: 'Biobío' },
        ],
      }),
      () => ({ coleccion: 'carga_maestros', metodo: 'drop' }),
    ],
  },
];

// Pruebas que deben fallar: muestran qué protege el validador de MongoDB y qué
// regla de la Etapa I pasa a la API porque MongoDB no la tiene.
export const PRUEBAS_INTEGRIDAD = [
  {
    codigo: 'N1', regla: '$expr con $$NOW', equivalente: 'R1 · CHECK mayor de edad',
    titulo: 'Un menor de edad intenta registrarse', esperado: 'rechazo',
    async intentar(db, session) {
      const quince = new Date(); quince.setFullYear(quince.getFullYear() - 15);
      return db.collection('usuarios').insertOne({
        _id: '25123456-K', nombre: 'Menor de Edad', email: 'menor@ejemplo.cl', telefono: null, fecha_nacimiento: quince,
        contrasena: 'scrypt$x$y', roles: ['cliente'], fecha_registro: new Date(),
      }, { session });
    },
  },
  {
    codigo: 'N2', regla: '$jsonSchema · maximum', equivalente: 'R5 · CHECK puntuación de 1 a 5',
    titulo: 'Puntuación fuera del rango 1 a 5', esperado: 'rechazo',
    intentar: (db, session) => db.collection('solicitudes').updateOne(
      { estado: 'Finalizada', calificacion: null },
      { $set: { calificacion: { puntuacion: 7, comentario: 'Nota imposible', fecha: new Date() } } }, { session }),
  },
  {
    codigo: 'N3', regla: 'Filtro calificacion: null', equivalente: 'R4 · UNIQUE una nota por solicitud',
    titulo: 'Calificar dos veces el mismo trabajo', esperado: 'sin coincidencias',
    async intentar(db, session) {
      const calificada = await db.collection('solicitudes').findOne({ calificacion: { $ne: null } }, { session });
      return db.collection('solicitudes').updateOne({ _id: calificada._id, calificacion: null },
        { $set: { calificacion: { puntuacion: 5, comentario: 'Segunda nota', fecha: new Date() } } }, { session });
    },
  },
  {
    codigo: 'N4', regla: 'Índice único', equivalente: 'UNIQUE (email)',
    titulo: 'Una cuenta con el correo de otra', esperado: 'rechazo',
    async intentar(db, session) {
      const { _id, ...otra } = await db.collection('usuarios').findOne({ _id: CLIENTE_HISTORIAL }, { session });
      return db.collection('usuarios').insertOne({ ...otra, _id: '25123456-K' }, { session });
    },
  },
  {
    codigo: 'N5', regla: '$jsonSchema · enum', equivalente: 'CHECK estado de la solicitud',
    titulo: 'Un estado que no existe', esperado: 'rechazo',
    intentar: (db, session) => db.collection('solicitudes').updateOne({ folio: 1 }, { $set: { estado: 'Terminada' } }, { session }),
  },
  {
    codigo: 'N6', regla: '$jsonSchema · maxItems', equivalente: 'No existe en SQL: protege el patrón subconjunto',
    titulo: 'Una sexta reseña reciente', esperado: 'rechazo',
    async intentar(db, session) {
      const m = await db.collection('usuarios').findOne({ 'maestro.resenas_recientes.4': { $exists: true } }, { session });
      return db.collection('usuarios').updateOne({ _id: m._id }, { $push: { 'maestro.resenas_recientes': m.maestro.resenas_recientes[0] } }, { session });
    },
  },
  {
    codigo: 'N7', regla: '$expr sobre roles', equivalente: 'No existe en SQL: protege el documento polimórfico',
    titulo: 'Un perfil de maestro en una cuenta que no es maestro', esperado: 'rechazo',
    async intentar(db, session) {
      const maestro = await db.collection('usuarios').findOne({ _id: MAESTRO_BANDEJA }, { session });
      return db.collection('usuarios').updateOne({ _id: CLIENTE_HISTORIAL }, { $set: { maestro: maestro.maestro } }, { session });
    },
  },
  {
    codigo: 'N8', regla: 'No hay claves foráneas', equivalente: 'R2 · ON DELETE RESTRICT',
    titulo: 'Borrar un oficio que tiene maestros', esperado: 'aceptada',
    leccion: 'Sin claves foráneas, la API debe contar los maestros (countDocuments) antes de borrar: la regla pasa de la base de datos a la aplicación.',
    async intentar(db, session) {
      const maestros = await db.collection('usuarios').countDocuments({ 'maestro.oficio._id': 1 }, { session });
      const r = await db.collection('oficios').deleteOne({ _id: 1 }, { session });
      return { ...r, maestrosQueQuedaronSinOficio: maestros };
    },
  },
];

// ── Motor: arma el texto mongosh de cada operación y la ejecuta ─────────────

function textoDe(op) {
  const c = `db.${op.coleccion}`;
  const f = aMongosh(op.filtro ?? {});
  const p = op.proyeccion ? `, ${aMongosh(op.proyeccion)}` : '';
  switch (op.metodo) {
    case 'find': return `${c}.find(${f}${p})${op.orden ? `.sort(${aMongosh(op.orden)})` : ''}${op.limite ? `.limit(${op.limite})` : ''}`;
    case 'findOne': return `${c}.findOne(${f}${p})`;
    case 'countDocuments': return `${c}.countDocuments(${f})`;
    case 'aggregate': return `${c}.aggregate(${aMongosh(op.pipeline)})`;
    case 'insertOne': return `${c}.insertOne(${aMongosh(op.documento)})`;
    case 'insertMany': return `${c}.insertMany(${aMongosh(op.documentos)})`;
    case 'findOneAndUpdate': return `${c}.findOneAndUpdate(${f}, ${aMongosh(op.cambio)}, { returnDocument: 'after' })`;
    case 'findOneAndDelete': return `${c}.findOneAndDelete(${f})`;
    case 'deleteOne': return `${c}.deleteOne(${f})`;
    case 'drop': return `${c}.drop()`;
    default: return `${c}.${op.metodo}(${f}, ${aMongosh(op.cambio)})`;
  }
}

async function correr(db, op, session) {
  const col = db.collection(op.coleccion);
  const o = { session };
  switch (op.metodo) {
    case 'find': return col.find(op.filtro, { projection: op.proyeccion, sort: op.orden, limit: op.limite, session }).toArray();
    case 'findOne': return [await col.findOne(op.filtro, { projection: op.proyeccion, session })];
    case 'countDocuments': return [await col.countDocuments(op.filtro, o)];
    case 'aggregate': return col.aggregate(op.pipeline, o).toArray();
    case 'insertOne': return [await col.insertOne(op.documento, o)];
    case 'insertMany': { const r = await col.insertMany(op.documentos, o); return [{ insertedCount: r.insertedCount }]; }
    case 'findOneAndUpdate': return [await col.findOneAndUpdate(op.filtro, op.cambio, { returnDocument: 'after', session })];
    case 'findOneAndDelete': return [await col.findOneAndDelete(op.filtro, o)];
    case 'deleteOne': { const r = await col.deleteOne(op.filtro, o); return [{ deletedCount: r.deletedCount }]; }
    case 'drop': return [await col.drop()];
    case 'updateOne':
    case 'updateMany': { const r = await col[op.metodo](op.filtro, op.cambio, o); return [{ matchedCount: r.matchedCount, modifiedCount: r.modifiedCount }]; }
    default: throw new Error(`Método no soportado: ${op.metodo}`);
  }
}

function etapas(plan, salida = []) {
  if (!plan || typeof plan !== 'object') return salida;
  if (plan.stage) salida.push({ etapa: plan.stage, indice: plan.indexName ?? null });
  for (const hijo of [plan.inputStage, plan.queryPlan, plan.innerStage, plan.outerStage, ...(plan.inputStages ?? [])]) etapas(hijo, salida);
  return salida;
}

// Plan de ejecución de una lectura: qué índice usó y cuántos documentos revisó.
async function explicar(db, op) {
  const col = db.collection(op.coleccion);
  const e = op.metodo === 'aggregate'
    ? await col.aggregate(op.pipeline).explain('executionStats')
    : await col.find(op.filtro, { projection: op.proyeccion, sort: op.orden, limit: op.limite }).explain('executionStats');
  const qp = e.queryPlanner ?? e.stages?.[0]?.$cursor?.queryPlanner;
  const es = e.executionStats ?? e.stages?.[0]?.$cursor?.executionStats;
  if (!qp || !es) return null;
  const lista = etapas(qp.winningPlan);
  return {
    etapas: lista.map((x) => x.etapa),
    indice: lista.find((x) => x.indice)?.indice ?? null,
    ordenEnMemoria: lista.some((x) => x.etapa === 'SORT'),
    clavesExaminadas: es.totalKeysExamined,
    documentosExaminados: es.totalDocsExamined,
    devueltos: es.nReturned,
  };
}

function textoMql(c, p = {}) {
  if (c.estructura) return c.estructura.texto;
  const r = [];
  return c.pasos.map((armar) => {
    const op = armar(p, r);
    return `${op.cuando ? '// solo si el paso anterior dio 0\n' : ''}${textoDe(op)}`;
  }).join(';\n\n');
}

const publica = ({ pasos, preparar, estructura, porDefecto, ...resto }) => ({ ...resto, sql: ETAPA1[resto.numero], mql: textoMql({ pasos, estructura }, porDefecto) });

async function ejecutarPasos(c, db, session) {
  const p = c.preparar ? await c.preparar(db, session) : {};
  const resultados = [];
  const pasos = [];
  for (const armar of c.pasos) {
    const op = armar(p, resultados);
    if (op.cuando && !op.cuando(resultados)) {
      resultados.push([]);
      pasos.push({ texto: textoDe(op), nota: `${op.nota ?? ''} (no se ejecutó: el conteo no dio 0)`.trim(), resultado: [], cantidad: 0 });
      continue;
    }
    const r = await correr(db, op, session);
    resultados.push(r);
    pasos.push({ texto: textoDe(op), nota: op.nota ?? null, resultado: r.slice(0, 8).map((x) => aMongosh(x)), cantidad: r.length });
  }
  return { p, pasos };
}

// Los cambios de validador no se pueden hacer dentro de una transacción: se
// aplican, se leen y se restaura el validador original pase lo que pase.
async function ejecutarCambioDeValidador(db, e) {
  const original = (await db.listCollections({ name: e.coleccion }).next()).options.validator;
  const nuevo = structuredClone(original);
  e.aplicar(nuevo.$jsonSchema ? nuevo : { $jsonSchema: nuevo });
  try {
    await db.command({ collMod: e.coleccion, validator: nuevo });
    const leido = (await db.listCollections({ name: e.coleccion }).next()).options.validator;
    return [{ texto: e.texto, nota: null, resultado: [aMongosh({ ok: 1 })], cantidad: 1 },
      { texto: `db.getCollectionInfos({ name: '${e.coleccion}' })[0].options.validator`, nota: 'Comprobación', resultado: [aMongosh(e.leer(leido))], cantidad: 1 }];
  } finally {
    await db.command({ collMod: e.coleccion, validator: original });
  }
}

export const Consulta = {
  listar() {
    return {
      consultas: CONSULTAS.map(publica),
      pruebas: PRUEBAS_INTEGRIDAD.map(({ intentar, ...resto }) => resto),
    };
  },

  buscar(numero) {
    const c = CONSULTAS.find((x) => x.numero === numero);
    return c ? publica(c) : null;
  },

  async ejecutar(numero) {
    const c = CONSULTAS.find((x) => x.numero === numero);
    if (!c) return null;
    const { db } = await mongo();
    const medir = cronometro();
    let pasos;
    let plan = null;
    let cierre;
    if (c.estructura) {
      pasos = await ejecutarCambioDeValidador(db, c.estructura);
      cierre = 'Validador restaurado';
    } else if (c.modo === 'lectura') {
      ({ pasos } = await ejecutarPasos(c, db));
      plan = await explicar(db, c.pasos[0]({}, []));
      cierre = null;
    } else if (c.modo === 'estructura') {
      ({ pasos } = await ejecutarPasos(c, db));
      cierre = 'Colección temporal eliminada';
    } else {
      ({ pasos } = await enTransaccionDePrueba((d, s) => ejecutarPasos(c, d, s)));
      cierre = 'abortTransaction';
    }
    return { numero: c.numero, tipo: c.tipo, modo: c.modo, pasos, ms: medir(), plan, cierre };
  },

  async probar(codigo) {
    const p = PRUEBAS_INTEGRIDAD.find((x) => x.codigo === codigo);
    if (!p) return null;
    return enTransaccionDePrueba(async (db, session) => {
      try {
        const r = await p.intentar(db, session);
        const sinEfecto = r.matchedCount === 0;
        return {
          codigo, rechazada: false, resultado: aMongosh(r),
          cumpleLoEsperado: p.esperado === 'aceptada' || (p.esperado === 'sin coincidencias' && sinEfecto),
          transaccion: 'abortTransaction',
        };
      } catch (error) {
        if (!error.code) throw error;
        return {
          codigo, rechazada: true, cumpleLoEsperado: p.esperado === 'rechazo',
          codigoMongo: error.code, nombreError: error.codeName ?? { 121: 'DocumentValidationFailure', 11000: 'DuplicateKey' }[error.code] ?? null,
          mensaje: error.message, motivo: motivoDe(error), transaccion: 'abortTransaction',
        };
      }
    });
  },
};

// Resume errInfo de un DocumentValidationFailure en "campo: regla".
function motivoDe(error) {
  if (error.code === 11000) return `índice único ${Object.keys(error.keyPattern ?? {}).join(', ')}`;
  const hallazgos = [];
  const recorrer = (nodo, ruta = []) => {
    if (!nodo || typeof nodo !== 'object') return;
    if (Array.isArray(nodo)) return nodo.forEach((x) => recorrer(x, ruta));
    const aqui = nodo.propertyName ? [...ruta, nodo.propertyName] : ruta;
    if (nodo.operatorName === '$expr') hallazgos.push('documento: $expr (mayoría de edad o perfil según rol)');
    else if (nodo.operatorName && !['properties', 'allOf', 'items', '$jsonSchema', '$and'].includes(nodo.operatorName) && !nodo.propertiesNotSatisfied && !nodo.details) {
      const v = Object.values(nodo.specifiedAs ?? {})[0];
      const corto = v !== undefined && (typeof v !== 'object' || (Array.isArray(v) && JSON.stringify(v).length < 80));
      hallazgos.push(`${aqui.join('.') || 'documento'}: ${nodo.operatorName}${corto ? ` ${JSON.stringify(v)}` : ''}`);
    }
    for (const valor of Object.values(nodo)) recorrer(valor, aqui);
  };
  recorrer(error.errInfo?.details);
  return [...new Set(hallazgos)].slice(0, 3).join(' · ') || null;
}
