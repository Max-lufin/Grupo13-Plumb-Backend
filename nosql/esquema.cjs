// Plumb · Grupo 13 · ICI324 — modelo de documentos en MongoDB.
// Colecciones, validación ($jsonSchema) e índices. Lo usan la migración
// (backend/scripts/migrar-a-mongo.js) y el script de mongosh (01_colecciones.mongodb.js).
//
// 6 tablas → 5 colecciones + 1 técnica:
//   region       → regiones      (catálogo; su nombre se copia en maestros)
//   oficio       → oficios       (mantenedor 2; su nombre se copia en maestros)
//   cliente      → clientes
//   maestro      → maestros      (+ reputación calculada + 5 reseñas recientes)
//   solicitud    → solicitudes   (+ la calificación embebida)
//   calificacion → desaparece: vive dentro de su solicitud (1:0..1)
//   contadores   → técnica: folio correlativo de las solicitudes (no existe en SQL)

const RUT = '^[0-9]{7,8}-[0-9K]$';
const EMAIL = '^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$';
const ESTADOS = ['Pendiente', 'Aceptada', 'Rechazada', 'Finalizada', 'Cancelada'];

const texto = (min, max) => ({ bsonType: 'string', minLength: min, maxLength: max });
const textoONulo = (max) => ({ bsonType: ['string', 'null'], maxLength: max });

// Equivale a ck_*_mayor_edad: $jsonSchema no puede comparar con la fecha actual, $expr con $$NOW sí.
const mayorDeEdad = { $lte: ['$fecha_nacimiento', { $dateSubtract: { startDate: '$$NOW', unit: 'year', amount: 18 } }] };

// Referencias extendidas: el _id para llegar al documento completo y solo los
// campos que las pantallas muestran siempre (que además casi nunca cambian).
const refRegion = {
  bsonType: 'object', required: ['_id', 'nombre'], additionalProperties: false,
  properties: { _id: { bsonType: 'int', minimum: 1, maximum: 16 }, nombre: texto(2, 60) },
};
const refOficio = {
  bsonType: 'object', required: ['_id', 'nombre'], additionalProperties: false,
  properties: { _id: { bsonType: 'objectId' }, nombre: texto(3, 60) },
};

const COLECCIONES = {
  regiones: {
    validador: {
      bsonType: 'object',
      required: ['_id', 'codigo', 'nombre'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'int', minimum: 1, maximum: 16, description: 'Número de la región de norte a sur' },
        codigo: { bsonType: 'string', maxLength: 4 },
        nombre: texto(2, 60),
      },
    },
    indices: [
      { clave: { codigo: 1 }, opciones: { unique: true, name: 'uq_region_codigo' } },
    ],
  },

  oficios: {
    validador: {
      bsonType: 'object',
      required: ['_id', 'nombre'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'objectId' },
        nombre: texto(3, 60),
        descripcion: textoONulo(255),
      },
    },
    indices: [
      { clave: { nombre: 1 }, opciones: { unique: true, name: 'uq_oficio_nombre', collation: { locale: 'es', strength: 2 } } },
    ],
  },

  clientes: {
    validador: {
      bsonType: 'object',
      required: ['_id', 'nombre', 'email', 'fecha_nacimiento', 'fecha_registro'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'string', pattern: RUT, description: 'RUT: clave natural y única' },
        nombre: texto(3, 120),
        email: { bsonType: 'string', pattern: EMAIL, maxLength: 120 },
        telefono: { bsonType: ['string', 'null'], pattern: '^\\+569[0-9]{8}$' },
        fecha_nacimiento: { bsonType: 'date' },
        fecha_registro: { bsonType: 'date' },
      },
    },
    expr: mayorDeEdad,
    indices: [
      { clave: { email: 1 }, opciones: { unique: true, name: 'uq_cliente_email' } },
    ],
  },

  maestros: {
    validador: {
      bsonType: 'object',
      required: ['_id', 'nombre', 'email', 'telefono', 'fecha_nacimiento', 'oficio', 'region',
        'tarifa_hora', 'experiencia_anios', 'disponible', 'fecha_registro', 'reputacion', 'resenas_recientes'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'string', pattern: RUT },
        nombre: texto(3, 120),
        email: { bsonType: 'string', pattern: EMAIL, maxLength: 120 },
        telefono: { bsonType: 'string', pattern: '^\\+569[0-9]{8}$' },
        fecha_nacimiento: { bsonType: 'date' },
        oficio: refOficio,
        region: refRegion,
        tarifa_hora: { bsonType: 'int', minimum: 1, description: 'El tope de $150.000 lo agrega la consulta 2 (collMod)' },
        experiencia_anios: { bsonType: 'int', minimum: 0, maximum: 60 },
        disponible: { bsonType: 'bool' },
        descripcion: textoONulo(500),
        fecha_registro: { bsonType: 'date' },
        // Patrón calculado: el promedio se guarda para poder filtrar y ordenar con índice.
        reputacion: {
          bsonType: 'object', required: ['promedio', 'total', 'suma'], additionalProperties: false,
          properties: {
            promedio: { bsonType: ['double', 'int'], minimum: 0, maximum: 5 },
            total: { bsonType: 'int', minimum: 0 },
            suma: { bsonType: 'int', minimum: 0 },
          },
        },
        // Patrón subconjunto: solo las 5 más recientes (el arreglo no crece sin límite).
        resenas_recientes: {
          bsonType: 'array', maxItems: 5,
          items: {
            bsonType: 'object', required: ['solicitud_id', 'puntuacion', 'cliente', 'fecha'], additionalProperties: false,
            properties: {
              solicitud_id: { bsonType: 'objectId' },
              puntuacion: { bsonType: 'int', minimum: 1, maximum: 5 },
              comentario: textoONulo(500),
              cliente: texto(1, 60),
              fecha: { bsonType: 'date' },
            },
          },
        },
      },
    },
    expr: mayorDeEdad,
    indices: [
      // Q1 catálogo: igualdad (región, oficio) → orden (promedio, tarifa). Regla ESR.
      { clave: { 'region._id': 1, 'oficio._id': 1, 'reputacion.promedio': -1, tarifa_hora: 1 }, opciones: { name: 'ix_catalogo' } },
      // Q5 ranking de destacados: cubre el orden completo, así no hay SORT en memoria
      { clave: { 'reputacion.promedio': -1, 'reputacion.total': -1, nombre: 1 }, opciones: { name: 'ix_ranking' } },
      // Mantenedor de oficios: contar maestros y propagar un cambio de nombre
      { clave: { 'oficio._id': 1 }, opciones: { name: 'ix_maestro_oficio' } },
      { clave: { email: 1 }, opciones: { unique: true, name: 'uq_maestro_email' } },
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
        folio: { bsonType: 'int', minimum: 1, description: 'Número visible de la orden de trabajo' },
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
            puntuacion: { bsonType: 'int', minimum: 1, maximum: 5 },
            comentario: textoONulo(500),
            fecha: { bsonType: 'date' },
          },
        },
      },
    },
    indices: [
      { clave: { folio: 1 }, opciones: { unique: true, name: 'uq_solicitud_folio' } },
      // Q3 bandeja del maestro
      { clave: { 'maestro._id': 1, estado: 1, fecha_solicitud: 1 }, opciones: { name: 'ix_bandeja' } },
      // Q4 historial del cliente
      { clave: { 'cliente._id': 1, fecha_solicitud: -1 }, opciones: { name: 'ix_historial' } },
    ],
  },

  contadores: {
    validador: {
      bsonType: 'object', required: ['_id', 'seq'], additionalProperties: false,
      properties: { _id: { bsonType: 'string' }, seq: { bsonType: 'int', minimum: 0 } },
    },
    indices: [],
  },
};

const validadorDe = (def) => (def.expr ? { $jsonSchema: def.validador, $expr: def.expr } : { $jsonSchema: def.validador });

// Crea (o recrea) cada colección con su validador y sus índices.
async function crearColecciones(db, { borrar = false } = {}) {
  const existentes = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const [nombre, def] of Object.entries(COLECCIONES)) {
    if (borrar && existentes.has(nombre)) await db.collection(nombre).drop();
    if (!borrar && existentes.has(nombre)) {
      await db.command({ collMod: nombre, validator: validadorDe(def), validationLevel: 'strict', validationAction: 'error' });
    } else {
      await db.createCollection(nombre, { validator: validadorDe(def), validationLevel: 'strict', validationAction: 'error' });
    }
    for (const { clave, opciones } of def.indices) await db.collection(nombre).createIndex(clave, opciones);
  }
}

module.exports = { COLECCIONES, ESTADOS, crearColecciones };
