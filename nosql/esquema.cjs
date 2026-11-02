// Plumb · Grupo 13 · ICI324 — modelo de documentos en MongoDB.
// Colecciones, validación ($jsonSchema) e índices. Lo usa scripts/db-init.js.
//
// 7 tablas del modelo relacional → 3 colecciones de datos + 1 técnica:
//   cliente, maestro, administrador → usuarios     (un documento por persona; el
//                                                   perfil de maestro va embebido)
//   region                          → embebida completa en usuarios.maestro.region
//   oficio                          → oficios      (mantenedor; su nombre se copia
//                                                   en el maestro)
//   solicitud                       → solicitudes  (con la calificación embebida)
//   calificacion                    → solicitudes.calificacion (1:0..1)
//   v_reputacion_maestro (vista)    → usuarios.maestro.reputacion (calculada)
//   SERIAL de solicitud y oficio    → contadores

const RUT = '^[0-9]{7,8}-[0-9K]$';
const EMAIL = '^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$';
const ESTADOS = ['Pendiente', 'Aceptada', 'Rechazada', 'Finalizada', 'Cancelada'];
const ROLES = ['cliente', 'maestro', 'administrador'];

const texto = (min, max) => ({ bsonType: 'string', minLength: min, maxLength: max });
const textoONulo = (max) => ({ bsonType: ['string', 'null'], maxLength: max });
const entero = (min, max) => ({ bsonType: 'int', minimum: min, ...(max === undefined ? {} : { maximum: max }) });

// Equivale a ck_*_mayor_edad: $jsonSchema no puede comparar con la fecha actual, $expr con $$NOW sí.
const mayorDeEdad = { $lte: ['$fecha_nacimiento', { $dateSubtract: { startDate: '$$NOW', unit: 'year', amount: 18 } }] };
// El perfil de maestro existe si y solo si la persona tiene el rol de maestro.
const perfilSegunRol = { $eq: [{ $in: ['maestro', '$roles'] }, { $eq: [{ $type: '$maestro' }, 'object'] }] };

const perfilMaestro = {
  bsonType: 'object',
  required: ['oficio', 'region', 'tarifa_hora', 'experiencia_anios', 'disponible', 'reputacion', 'resenas_recientes'],
  additionalProperties: false,
  properties: {
    // Referencia extendida: el oficio tiene mantenedor propio; se copia solo el nombre.
    oficio: {
      bsonType: 'object', required: ['_id', 'nombre'], additionalProperties: false,
      properties: { _id: entero(1), nombre: texto(3, 60) },
    },
    // Embebida completa: catálogo fijo de 16 regiones que nunca cambia.
    region: {
      bsonType: 'object', required: ['numero', 'codigo', 'nombre'], additionalProperties: false,
      properties: { numero: entero(1, 16), codigo: texto(1, 4), nombre: texto(2, 60) },
    },
    tarifa_hora: { ...entero(1), description: 'Precio por hora en pesos' },
    experiencia_anios: entero(0, 60),
    disponible: { bsonType: 'bool' },
    descripcion: textoONulo(500),
    // Patrón calculado: el promedio se guarda para poder filtrar y ordenar con índice.
    reputacion: {
      bsonType: 'object', required: ['promedio', 'total', 'suma'], additionalProperties: false,
      properties: {
        promedio: { bsonType: ['double', 'int'], minimum: 0, maximum: 5 },
        total: entero(0),
        suma: entero(0),
      },
    },
    // Patrón subconjunto: solo las 5 más recientes (el arreglo no crece sin límite).
    resenas_recientes: {
      bsonType: 'array', maxItems: 5,
      items: {
        bsonType: 'object', required: ['solicitud_id', 'puntuacion', 'cliente', 'fecha'], additionalProperties: false,
        properties: {
          solicitud_id: { bsonType: 'objectId' },
          puntuacion: entero(1, 5),
          comentario: textoONulo(500),
          cliente: texto(1, 60),
          fecha: { bsonType: 'date' },
        },
      },
    },
  },
};

const COLECCIONES = {
  usuarios: {
    validador: {
      bsonType: 'object',
      required: ['_id', 'nombre', 'email', 'fecha_nacimiento', 'contrasena', 'roles', 'fecha_registro'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'string', pattern: RUT, description: 'RUT: clave natural y única' },
        nombre: texto(3, 120),
        email: { bsonType: 'string', pattern: EMAIL, maxLength: 120 },
        telefono: { bsonType: ['string', 'null'], pattern: '^\\+569[0-9]{8}$' },
        fecha_nacimiento: { bsonType: 'date' },
        contrasena: { bsonType: 'string', pattern: '^scrypt\\$', description: 'Hash scrypt con sal; nunca la contraseña' },
        roles: { bsonType: 'array', minItems: 1, uniqueItems: true, items: { enum: ROLES } },
        fecha_registro: { bsonType: 'date' },
        maestro: perfilMaestro,
      },
    },
    expr: { $and: [mayorDeEdad, perfilSegunRol] },
    indices: [
      { clave: { email: 1 }, opciones: { unique: true, name: 'uq_usuario_email' } },
      { clave: { roles: 1, nombre: 1 }, opciones: { name: 'ix_roles' } },
      // Catálogo: igualdad (región, oficio) → orden (promedio, tarifa). Regla ESR.
      { clave: { 'maestro.region.numero': 1, 'maestro.oficio._id': 1, 'maestro.reputacion.promedio': -1, 'maestro.tarifa_hora': 1 }, opciones: { name: 'ix_catalogo' } },
      // Ranking: cubre el orden completo, así no hay SORT en memoria.
      { clave: { 'maestro.reputacion.promedio': -1, 'maestro.reputacion.total': -1, nombre: 1 }, opciones: { name: 'ix_ranking' } },
      // Mantenedor de oficios: contar maestros y propagar un cambio de nombre.
      { clave: { 'maestro.oficio._id': 1 }, opciones: { name: 'ix_maestro_oficio' } },
    ],
  },

  oficios: {
    validador: {
      bsonType: 'object',
      required: ['_id', 'nombre'],
      additionalProperties: false,
      properties: {
        _id: { ...entero(1), description: 'Código numérico corto: aparece en URLs y filtros' },
        nombre: texto(3, 60),
        descripcion: textoONulo(255),
      },
    },
    indices: [
      { clave: { nombre: 1 }, opciones: { unique: true, name: 'uq_oficio_nombre', collation: { locale: 'es', strength: 2 } } },
    ],
  },

  solicitudes: {
    validador: {
      bsonType: 'object',
      required: ['_id', 'folio', 'cliente', 'maestro', 'descripcion', 'direccion', 'fecha_servicio',
        'estado', 'fecha_solicitud', 'calificacion'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'objectId' },
        folio: { ...entero(1), description: 'Número visible de la orden de trabajo' },
        cliente: {
          bsonType: 'object', required: ['_id', 'nombre'], additionalProperties: false,
          properties: { _id: { bsonType: 'string', pattern: RUT }, nombre: texto(3, 120) },
        },
        maestro: {
          bsonType: 'object', required: ['_id', 'nombre'], additionalProperties: false,
          properties: { _id: { bsonType: 'string', pattern: RUT }, nombre: texto(3, 120) },
        },
        descripcion: texto(15, 1000),
        direccion: texto(5, 200),
        fecha_servicio: { bsonType: 'date' },
        estado: { enum: ESTADOS },
        fecha_solicitud: { bsonType: 'date' },
        // La calificación vive dentro de su solicitud: 1:0..1, se lee junto y muere con ella.
        calificacion: {
          bsonType: ['object', 'null'],
          required: ['puntuacion', 'fecha'],
          additionalProperties: false,
          properties: {
            puntuacion: entero(1, 5),
            comentario: textoONulo(500),
            fecha: { bsonType: 'date' },
          },
        },
      },
    },
    indices: [
      { clave: { folio: 1 }, opciones: { unique: true, name: 'uq_solicitud_folio' } },
      // Bandeja del maestro
      { clave: { 'maestro._id': 1, estado: 1, fecha_solicitud: 1 }, opciones: { name: 'ix_bandeja' } },
      // Historial del cliente
      { clave: { 'cliente._id': 1, fecha_solicitud: -1 }, opciones: { name: 'ix_historial' } },
    ],
  },

  contadores: {
    validador: {
      bsonType: 'object', required: ['_id', 'seq'], additionalProperties: false,
      properties: { _id: { bsonType: 'string' }, seq: entero(0) },
    },
    indices: [],
  },
};

const validadorDe = (def) => (def.expr ? { $jsonSchema: def.validador, $expr: def.expr } : { $jsonSchema: def.validador });

// Crea (o recrea) cada colección con su validador y sus índices.
async function crearColecciones(db, { borrar = false } = {}) {
  const existentes = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  if (borrar) {
    for (const nombre of existentes) await db.collection(nombre).drop();
    existentes.clear();
  }
  for (const [nombre, def] of Object.entries(COLECCIONES)) {
    const opciones = { validator: validadorDe(def), validationLevel: 'strict', validationAction: 'error' };
    if (existentes.has(nombre)) await db.command({ collMod: nombre, ...opciones });
    else await db.createCollection(nombre, opciones);
    for (const { clave, opciones: o } of def.indices) await db.collection(nombre).createIndex(clave, o);
  }
}

module.exports = { COLECCIONES, ESTADOS, ROLES, crearColecciones };
