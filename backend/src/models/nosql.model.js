// Laboratorio NoSQL: el mismo negocio de Plumb, ahora en MongoDB.
//
// Cada consulta se ejecuta en MongoDB y su equivalente SQL en PostgreSQL; la
// API compara ambos resultados para demostrar que el traspaso no perdió
// información. Las escrituras corren en una transacción que se aborta al final
// (el ROLLBACK de MongoDB): la demostración se repite sin alterar los datos.

import { enTransaccionDePrueba } from '../config/db.js';
import { enTransaccionDePruebaMongo, mongo } from '../config/mongo.js';
import { env } from '../config/env.js';
import { cronometro } from '../utils/http.js';
import { aMongosh, Pendiente } from '../utils/mongosh.js';
import { SQL as CALIFICACION } from './calificacion.model.js';
import { SQL as MAESTRO } from './maestro.model.js';
import { SQL as OFICIO } from './oficio.model.js';
import { SQL as SOLICITUD } from './solicitud.model.js';
import { hoyISO } from './reglas.js';

const PEDRO = '7765180-2';
const MARIA = '12588772-4';

// Decisión por tabla (paso 3 de la receta de traspaso). La misma tabla se usa
// en la app, en el README de nosql/ y en el informe.
export const TRASPASO = [
  {
    tabla: 'region',
    destino: 'regiones y copia en maestros.region',
    decision: 'Referencia extendida',
    porque: 'Catálogo fijo de 16 filas. Copiar su nombre en el maestro deja filtrar el catálogo sin $lookup; la lista desplegable lee la colección.',
    consultas: ['Q1', 'Q2', 'Q5'],
  },
  {
    tabla: 'oficio',
    destino: 'oficios y copia en maestros.oficio',
    decision: 'Referencia extendida',
    porque: 'Tiene mantenedor propio. Se copia solo el nombre, que casi nunca cambia; renombrar cuesta un updateMany dentro de una transacción (T3).',
    consultas: ['Q1', 'Q2', 'Q5'],
  },
  {
    tabla: 'cliente',
    destino: 'clientes',
    decision: 'Colección propia',
    porque: 'Se registra y se consulta por separado. Su nombre se copia en cada solicitud para el historial.',
    consultas: ['Q4'],
  },
  {
    tabla: 'maestro',
    destino: 'maestros',
    decision: 'Colección propia (patrones calculado y subconjunto)',
    porque: 'Es lo más leído: catálogo, perfil y ranking. Guarda su reputación ya calculada y sus 5 reseñas más recientes, así el perfil sale de una sola lectura.',
    consultas: ['Q1', 'Q2', 'Q5'],
  },
  {
    tabla: 'solicitud',
    destino: 'solicitudes',
    decision: 'Colección propia con referencias extendidas',
    porque: 'Crece sin límite: embebida en el cliente o en el maestro sería un arreglo sin tope (máximo 16 MB por documento). Copia el nombre de cliente y maestro.',
    consultas: ['Q3', 'Q4'],
  },
  {
    tabla: 'calificacion',
    destino: 'solicitudes.calificacion',
    decision: 'Embebida',
    porque: 'Relación 1:0..1 que se lee junto con su solicitud y muere con ella: el UNIQUE y el ON DELETE CASCADE se cumplen por construcción.',
    consultas: ['Q4', 'T2'],
  },
  {
    tabla: 'v_reputacion_maestro (vista)',
    destino: 'maestros.reputacion',
    decision: 'Patrón calculado',
    porque: 'El catálogo filtra y ordena por promedio. Guardarlo permite usar un índice en vez de recalcular AVG en cada búsqueda; se actualiza al calificar (T2).',
    consultas: ['Q1', 'Q5'],
  },
  {
    tabla: 'SERIAL de id_solicitud',
    destino: 'contadores',
    decision: 'Colección técnica',
    porque: 'MongoDB no tiene secuencias. El folio correlativo que ve el cliente sale de un findOneAndUpdate con $inc, que es atómico.',
    consultas: ['T1'],
  },
];

// El costo de duplicar: qué dato se copia, cuándo cambia y cómo se mantiene al día.
export const DUPLICADOS = [
  { dato: 'Nombre de la región', donde: 'maestros.region.nombre', cambia: 'Nunca: catálogo fijo', mantiene: 'No requiere mantención' },
  { dato: 'Nombre del oficio', donde: 'maestros.oficio.nombre', cambia: 'Al renombrar un oficio (casi nunca)', mantiene: 'updateMany en la misma transacción (T3)' },
  { dato: 'Nombre del cliente y del maestro', donde: 'solicitudes.cliente.nombre, solicitudes.maestro.nombre', cambia: 'Si una persona corrige su nombre (casi nunca)', mantiene: 'updateMany por _id en solicitudes' },
  { dato: 'Reputación (promedio, total, suma)', donde: 'maestros.reputacion', cambia: 'En cada calificación y al moderar una', mantiene: 'Transacción junto con la calificación (T2)' },
  { dato: 'Últimas 5 reseñas', donde: 'maestros.resenas_recientes', cambia: 'En cada calificación', mantiene: '$slice: 5 en la misma transacción (T2); el validador impide un sexto elemento (N6)' },
];

const COLECCIONES = [
  { nombre: 'maestros', origen: ['maestro', 'oficio', 'region', 'calificacion'], resuelve: ['Q1 Catálogo', 'Q2 Perfil', 'Q5 Ranking'], ejemplo: { _id: PEDRO } },
  { nombre: 'solicitudes', origen: ['solicitud', 'calificacion', 'cliente', 'maestro'], resuelve: ['Q3 Bandeja', 'Q4 Historial', 'Q2 Trabajos terminados'], ejemplo: { folio: 1 } },
  { nombre: 'clientes', origen: ['cliente'], resuelve: ['Registro', 'Elegir con quién actuar en la demo'], ejemplo: { _id: MARIA } },
  { nombre: 'oficios', origen: ['oficio'], resuelve: ['Mantenedor de oficios', 'Lista desplegable del catálogo'], ejemplo: { nombre: 'Gasfíter' } },
  { nombre: 'regiones', origen: ['region'], resuelve: ['Lista desplegable del catálogo'], ejemplo: { _id: 6 } },
  { nombre: 'contadores', origen: [], resuelve: ['Folio de cada solicitud nueva (T1)'], ejemplo: { _id: 'solicitudes' } },
];

const primerNombre = (nombre) => nombre.split(' ')[0];
const fechaISO = (iso) => new Date(`${iso}T00:00:00Z`);
function sumarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Promedio con un decimal y la mitad hacia arriba, igual que ROUND(AVG(x), 1)
// de PostgreSQL ($round de MongoDB redondea al par: 4,25 → 4,2).
const promedioRedondeado = {
  $cond: [
    { $eq: ['$reputacion.total', 0] },
    0,
    { $divide: [{ $floor: { $add: [{ $divide: [{ $multiply: ['$reputacion.suma', 10] }, '$reputacion.total'] }, 0.5] } }, 10] },
  ],
};

// Cada consulta: pasos de MongoDB (dependen de los datos que trae preparar y
// de lo que devolvieron los pasos anteriores) y su equivalente SQL.
// La "huella" reduce ambos resultados a una lista comparable.
export const CONSULTAS_NOSQL = [
  {
    codigo: 'Q1',
    tipo: 'lectura',
    titulo: 'Catálogo con filtros',
    pantalla: 'Catálogo',
    indice: 'ix_catalogo',
    porque: 'Región y oficio son igualdades sobre campos copiados en el maestro: no hay $lookup. El índice sigue la regla ESR (igualdad, orden, rango).',
    async preparar(db) {
      const oficio = await db.collection('oficios').findOne({ nombre: 'Gasfíter' });
      return { oficio };
    },
    pasos: [
      ({ oficio }) => ({
        coleccion: 'maestros',
        metodo: 'find',
        filtro: {
          'region._id': 6,
          'oficio._id': oficio._id,
          tarifa_hora: { $lte: 25000 },
          'reputacion.promedio': { $gte: 4 },
          disponible: true,
          experiencia_anios: { $gte: 3 },
        },
        proyeccion: { nombre: 1, 'oficio.nombre': 1, 'region.nombre': 1, tarifa_hora: 1, experiencia_anios: 1, disponible: 1, reputacion: 1 },
        orden: { 'reputacion.promedio': -1, tarifa_hora: 1 },
      }),
    ],
    sql: () => [{ texto: MAESTRO.CATALOGO, valores: [6, 1, 25000, 4, true, 3] }],
    huellaMongo: ([docs]) => docs.map((d) => `${d._id} · ${d.reputacion.promedio}`),
    huellaSql: ([filas]) => filas.map((f) => `${f.rut_maestro} · ${f.promedio}`),
  },
  {
    codigo: 'Q2',
    tipo: 'lectura',
    titulo: 'Perfil del maestro con sus reseñas',
    pantalla: 'Perfil del maestro',
    indice: '_id_',
    porque: 'Una sola lectura por _id trae datos, oficio, región, reputación y las 5 reseñas recientes. En SQL son dos consultas con cuatro JOIN.',
    pasos: [
      () => ({ coleccion: 'maestros', metodo: 'findOne', filtro: { _id: PEDRO }, proyeccion: { email: 0, fecha_nacimiento: 0 } }),
      () => ({ coleccion: 'solicitudes', metodo: 'countDocuments', filtro: { 'maestro._id': PEDRO, estado: 'Finalizada' } }),
    ],
    sql: () => [{ texto: MAESTRO.DETALLE, valores: [PEDRO] }, { texto: MAESTRO.RESENAS, valores: [PEDRO] }],
    huellaMongo: ([[m], [terminados]]) => [
      `promedio ${m.reputacion.promedio}`, `reseñas ${m.reputacion.total}`, `terminados ${terminados}`,
      ...m.resenas_recientes.map((r) => `${r.puntuacion}★ ${r.cliente} ${r.fecha.toISOString()}`),
    ],
    huellaSql: ([[d], resenas]) => [
      `promedio ${d.promedio}`, `reseñas ${d.total_resenas}`, `terminados ${d.trabajos_finalizados}`,
      ...resenas.slice(0, 5).map((r) => `${r.puntuacion}★ ${r.cliente} ${new Date(r.fecha).toISOString()}`),
    ],
  },
  {
    codigo: 'Q3',
    tipo: 'lectura',
    titulo: 'Bandeja del maestro',
    pantalla: 'Mis solicitudes (maestro)',
    indice: 'ix_bandeja',
    porque: 'Dos igualdades (maestro y estado) y un orden por fecha: el índice entrega los documentos ya ordenados.',
    pasos: [
      () => ({
        coleccion: 'solicitudes',
        metodo: 'find',
        filtro: { 'maestro._id': PEDRO, estado: 'Pendiente' },
        proyeccion: { folio: 1, descripcion: 1, direccion: 1, fecha_servicio: 1, fecha_solicitud: 1 },
        orden: { fecha_solicitud: 1 },
      }),
    ],
    sql: () => [{ texto: MAESTRO.BANDEJA, valores: [PEDRO, 'Pendiente'] }],
    huellaMongo: ([docs]) => docs.map((d) => `N° ${d.folio}`),
    huellaSql: ([filas]) => filas.map((f) => `N° ${f.id_solicitud}`),
  },
  {
    codigo: 'Q4',
    tipo: 'lectura',
    titulo: 'Historial del cliente',
    pantalla: 'Mis solicitudes (cliente)',
    indice: 'ix_historial',
    porque: 'El nombre del maestro y la nota viajan dentro de la solicitud: el historial no necesita JOIN.',
    pasos: [
      () => ({
        coleccion: 'solicitudes',
        metodo: 'find',
        filtro: { 'cliente._id': MARIA },
        proyeccion: { folio: 1, fecha_solicitud: 1, fecha_servicio: 1, estado: 1, descripcion: 1, direccion: 1, cliente: 1, maestro: 1, 'calificacion.puntuacion': 1 },
        orden: { fecha_solicitud: -1 },
        limite: 200,
      }),
    ],
    sql: () => [{ texto: SOLICITUD.LISTAR, valores: [MARIA, null, null] }],
    huellaMongo: ([docs]) => docs.map((d) => `N° ${d.folio} ${d.estado} ${d.calificacion?.puntuacion ?? '–'}`),
    huellaSql: ([filas]) => filas.map((f) => `N° ${f.id_solicitud} ${f.estado} ${f.puntuacion ?? '–'}`),
  },
  {
    codigo: 'Q5',
    tipo: 'lectura',
    titulo: 'Ranking de maestros destacados',
    pantalla: 'Inicio',
    indice: 'ix_ranking',
    porque: 'El promedio ya está calculado (patrón calculado): ordenar es recorrer el índice, sin agrupar 67 calificaciones.',
    pasos: [
      () => ({
        coleccion: 'maestros',
        metodo: 'find',
        filtro: { 'reputacion.total': { $gte: 2 } },
        proyeccion: { nombre: 1, 'oficio.nombre': 1, 'region.nombre': 1, tarifa_hora: 1, disponible: 1, reputacion: 1 },
        orden: { 'reputacion.promedio': -1, 'reputacion.total': -1, nombre: 1 },
        limite: 5,
      }),
    ],
    sql: () => [{ texto: MAESTRO.RANKING, valores: [5] }],
    huellaMongo: ([docs]) => docs.map((d) => `${d._id} · ${d.reputacion.promedio} (${d.reputacion.total})`),
    huellaSql: ([filas]) => filas.map((f) => `${f.rut_maestro} · ${f.promedio} (${f.total_resenas})`),
  },
  {
    codigo: 'T1',
    tipo: 'transaccion',
    titulo: 'Crear una solicitud',
    pantalla: 'Perfil del maestro, formulario',
    porque: 'El folio sale de la colección contadores y los nombres se copian al crear (referencia extendida). Sin DEFAULT, la app pone el estado Pendiente.',
    async preparar(db, sesion) {
      const cliente = await db.collection('clientes').findOne({ _id: '13345441-1' }, { projection: { nombre: 1 }, session: sesion });
      const maestro = await db.collection('maestros').findOne({ _id: '16178972-0', disponible: true }, { projection: { nombre: 1 }, session: sesion });
      return { cliente, maestro, fecha: sumarDias(hoyISO(), 2) };
    },
    pasos: [
      () => ({ coleccion: 'contadores', metodo: 'findOneAndUpdate', filtro: { _id: 'solicitudes' }, cambio: { $inc: { seq: 1 } } }),
      ({ cliente, maestro, fecha }, r) => ({
        coleccion: 'solicitudes',
        metodo: 'insertOne',
        documento: {
          folio: r[0]?.[0]?.seq ?? new Pendiente('seq que devolvió el paso 1'),
          cliente: { _id: cliente._id, nombre: cliente.nombre },
          maestro: { _id: maestro._id, nombre: maestro.nombre },
          descripcion: 'El estanque del WC se queda corriendo y sube la cuenta del agua.',
          direccion: 'Av. Libertad 1180, Viña del Mar',
          fecha_servicio: fechaISO(fecha),
          estado: 'Pendiente',
          fecha_solicitud: new Date(),
          calificacion: null,
        },
      }),
    ],
    sql: ({ cliente, maestro, fecha }) => [{
      texto: SOLICITUD.CREAR,
      valores: [cliente._id, maestro._id, 'El estanque del WC se queda corriendo y sube la cuenta del agua.', 'Av. Libertad 1180, Viña del Mar', fecha],
    }],
    huellaMongo: (r) => [`insertada ${r[1][0].acknowledged}`, 'estado Pendiente'],
    huellaSql: ([[fila]]) => [`insertada ${Boolean(fila)}`, `estado ${fila.estado}`],
  },
  {
    codigo: 'T2',
    tipo: 'transaccion',
    titulo: 'Calificar un trabajo terminado',
    pantalla: 'Mis solicitudes, calificar',
    porque: 'Este es el costo de duplicar: la nota vive en la solicitud y su efecto (promedio y reseñas recientes) en el maestro. Las dos escrituras van juntas o no va ninguna.',
    async preparar(db, sesion) {
      const s = await db.collection('solicitudes').findOne(
        { estado: 'Finalizada', calificacion: null },
        { sort: { folio: 1 }, session: sesion },
      );
      return { s, nota: { puntuacion: 5, comentario: 'Llegó a la hora y dejó todo limpio.', fecha: new Date() } };
    },
    pasos: [
      ({ s }) => ({ coleccion: 'maestros', metodo: 'findOne', filtro: { _id: s.maestro._id }, proyeccion: { reputacion: 1 }, nota: 'Antes' }),
      ({ s, nota }) => ({
        coleccion: 'solicitudes',
        metodo: 'updateOne',
        filtro: { _id: s._id, estado: 'Finalizada', calificacion: null },
        cambio: { $set: { calificacion: nota } },
      }),
      ({ s, nota }) => ({
        coleccion: 'maestros',
        metodo: 'updateOne',
        filtro: { _id: s.maestro._id },
        cambio: [
          {
            $set: {
              'reputacion.total': { $add: ['$reputacion.total', 1] },
              'reputacion.suma': { $add: ['$reputacion.suma', nota.puntuacion] },
              // Patrón subconjunto: la nueva reseña entra primero y se conservan 5.
              resenas_recientes: {
                $slice: [{ $concatArrays: [{ $literal: [{ solicitud_id: s._id, ...nota, cliente: primerNombre(s.cliente.nombre) }] }, '$resenas_recientes'] }, 5],
              },
            },
          },
          { $set: { 'reputacion.promedio': promedioRedondeado } },
        ],
      }),
      ({ s }) => ({ coleccion: 'maestros', metodo: 'findOne', filtro: { _id: s.maestro._id }, proyeccion: { reputacion: 1 }, nota: 'Después' }),
    ],
    sql: ({ s, nota }) => [
      { texto: CALIFICACION.CREAR, valores: [s.folio, nota.puntuacion, nota.comentario] },
      { texto: 'SELECT promedio, total_resenas FROM v_reputacion_maestro WHERE rut_maestro = $1', valores: [s.maestro._id] },
    ],
    huellaMongo: (r) => [`promedio ${r[3][0].reputacion.promedio}`, `reseñas ${r[3][0].reputacion.total}`],
    huellaSql: ([, [v]]) => [`promedio ${v.promedio}`, `reseñas ${v.total_resenas}`],
  },
  {
    codigo: 'T3',
    tipo: 'transaccion',
    titulo: 'Cambio hipotético: renombrar un oficio',
    pantalla: 'Administración, oficios',
    porque: 'Copiar el nombre en los maestros tiene un precio: en SQL se cambia 1 fila; en MongoDB, el oficio y cada maestro que lo copia. Como casi nunca pasa, conviene.',
    async preparar(db, sesion) {
      const oficio = await db.collection('oficios').findOne({ nombre: 'Gasfíter' }, { session: sesion });
      return { oficio, nuevo: 'Gasfíter y sanitario' };
    },
    pasos: [
      ({ oficio, nuevo }) => ({ coleccion: 'oficios', metodo: 'updateOne', filtro: { _id: oficio._id }, cambio: { $set: { nombre: nuevo } } }),
      ({ oficio, nuevo }) => ({ coleccion: 'maestros', metodo: 'updateMany', filtro: { 'oficio._id': oficio._id }, cambio: { $set: { 'oficio.nombre': nuevo } } }),
    ],
    sql: ({ oficio, nuevo }) => [
      { texto: OFICIO.ACTUALIZAR, valores: [1, nuevo, oficio.descripcion] },
      { texto: 'SELECT COUNT(*) AS maestros FROM maestro WHERE id_oficio = $1', valores: [1] },
    ],
    huellaMongo: (r) => [`oficio ${r[0][0].modifiedCount}`, `maestros con el nombre nuevo ${r[1][0].modifiedCount}`],
    huellaSql: ([oficio, [conteo]]) => [`oficio ${oficio.length}`, `maestros con el nombre nuevo ${conteo.maestros}`],
  },
];

// Pruebas que deben fallar (o que muestran lo que MongoDB NO protege).
// Son el par de las pruebas R1 a R6 del laboratorio SQL.
export const PRUEBAS_NOSQL = [
  {
    codigo: 'N1',
    regla: '$expr con $$NOW',
    equivalente: 'R1 · ck_cliente_mayor_edad',
    titulo: 'Un menor de edad intenta registrarse',
    esperado: 'rechazo',
    intentar: (db, session) => db.collection('clientes').insertOne({
      _id: '25123456-K', nombre: 'Menor de Edad', email: 'menor@ejemplo.cl', telefono: null,
      fecha_nacimiento: fechaISO(sumarDias(hoyISO(), -15 * 365)), fecha_registro: new Date(),
    }, { session }),
  },
  {
    codigo: 'N2',
    regla: '$jsonSchema · maximum',
    equivalente: 'R5 · ck_calificacion_puntuacion',
    titulo: 'Puntuación fuera del rango 1 a 5',
    esperado: 'rechazo',
    intentar: (db, session) => db.collection('solicitudes').updateOne(
      { estado: 'Finalizada', calificacion: null },
      { $set: { calificacion: { puntuacion: 7, comentario: 'Nota imposible', fecha: new Date() } } },
      { session },
    ),
  },
  {
    codigo: 'N3',
    regla: 'Filtro calificacion: null',
    equivalente: 'R4 · uq_calificacion_solicitud',
    titulo: 'Calificar dos veces el mismo trabajo',
    esperado: 'sin coincidencias',
    async intentar(db, session) {
      const calificada = await db.collection('solicitudes').findOne({ calificacion: { $ne: null } }, { session });
      return db.collection('solicitudes').updateOne(
        { _id: calificada._id, calificacion: null },
        { $set: { calificacion: { puntuacion: 5, comentario: 'Segunda nota', fecha: new Date() } } },
        { session },
      );
    },
  },
  {
    codigo: 'N4',
    regla: 'Índice único',
    equivalente: 'UNIQUE (email)',
    titulo: 'Un maestro con el correo de otro',
    esperado: 'rechazo',
    async intentar(db, session) {
      const { _id, ...otro } = await db.collection('maestros').findOne({ _id: PEDRO }, { session });
      return db.collection('maestros').insertOne({ ...otro, _id: '25123456-K' }, { session });
    },
  },
  {
    codigo: 'N5',
    regla: '$jsonSchema · enum',
    equivalente: 'ck_solicitud_estado',
    titulo: 'Un estado que no existe',
    esperado: 'rechazo',
    intentar: (db, session) => db.collection('solicitudes').updateOne({ folio: 1 }, { $set: { estado: 'Terminada' } }, { session }),
  },
  {
    codigo: 'N6',
    regla: '$jsonSchema · maxItems',
    equivalente: 'no existe; protege el patrón subconjunto',
    titulo: 'Una sexta reseña reciente sin $slice',
    esperado: 'rechazo',
    async intentar(db, session) {
      const m = await db.collection('maestros').findOne({ 'resenas_recientes.4': { $exists: true } }, { session });
      const [ultima] = m.resenas_recientes;
      return db.collection('maestros').updateOne({ _id: m._id }, { $push: { resenas_recientes: ultima } }, { session });
    },
  },
  {
    codigo: 'N7',
    regla: 'No hay claves foráneas',
    equivalente: 'R2 · fk_maestro_oficio (ON DELETE RESTRICT)',
    titulo: 'Borrar un oficio que tiene maestros',
    esperado: 'aceptada',
    leccion: 'Sin claves foráneas, la API debe contar los maestros (countDocuments) antes de borrar: la regla pasa de la base de datos a la aplicación.',
    intentar: async (db, session) => {
      const oficio = await db.collection('oficios').findOne({ nombre: 'Gasfíter' }, { session });
      const maestros = await db.collection('maestros').countDocuments({ 'oficio._id': oficio._id }, { session });
      const r = await db.collection('oficios').deleteOne({ _id: oficio._id }, { session });
      return { ...r, maestrosHuerfanos: maestros };
    },
  },
];

// ── Ejecución ────────────────────────────────────────────────────────────────

function textoDe(op) {
  const c = `db.${op.coleccion}`;
  const f = aMongosh(op.filtro ?? {});
  const p = op.proyeccion ? `, ${aMongosh(op.proyeccion)}` : '';
  switch (op.metodo) {
    case 'find':
      return `${c}.find(${f}${p})${op.orden ? `.sort(${aMongosh(op.orden)})` : ''}${op.limite ? `.limit(${op.limite})` : ''}`;
    case 'findOne': return `${c}.findOne(${f}${p})`;
    case 'countDocuments': return `${c}.countDocuments(${f})`;
    case 'insertOne': return `${c}.insertOne(${aMongosh(op.documento)})`;
    case 'findOneAndUpdate': return `${c}.findOneAndUpdate(${f}, ${aMongosh(op.cambio)}, { returnDocument: 'after' })`;
    default: return `${c}.${op.metodo}(${f}, ${aMongosh(op.cambio)})`;
  }
}

async function correr(db, op, session) {
  const col = db.collection(op.coleccion);
  switch (op.metodo) {
    case 'find':
      return col.find(op.filtro, { projection: op.proyeccion, sort: op.orden, limit: op.limite, session }).toArray();
    case 'findOne': return [await col.findOne(op.filtro, { projection: op.proyeccion, session })];
    case 'countDocuments': return [await col.countDocuments(op.filtro, { session })];
    case 'insertOne': return [await col.insertOne(op.documento, { session })];
    case 'findOneAndUpdate': return [await col.findOneAndUpdate(op.filtro, op.cambio, { returnDocument: 'after', session })];
    case 'updateOne':
    case 'updateMany': {
      const r = await col[op.metodo](op.filtro, op.cambio, { session });
      return [{ matchedCount: r.matchedCount, modifiedCount: r.modifiedCount }];
    }
    default: throw new Error(`Método no soportado: ${op.metodo}`);
  }
}

function etapas(plan, salida = []) {
  if (!plan || typeof plan !== 'object') return salida;
  if (plan.stage) salida.push({ etapa: plan.stage, indice: plan.indexName ?? null });
  for (const hijo of [plan.inputStage, plan.queryPlan, ...(plan.inputStages ?? [])]) etapas(hijo, salida);
  return salida;
}

// Plan de ejecución de la primera lectura: qué índice usó y cuánto revisó.
async function explicar(db, op) {
  if (!['find', 'findOne'].includes(op.metodo)) return null;
  const e = await db.collection(op.coleccion)
    .find(op.filtro, { projection: op.proyeccion, sort: op.orden, limit: op.metodo === 'findOne' ? 1 : op.limite })
    .explain('executionStats');
  const lista = etapas(e.queryPlanner.winningPlan);
  return {
    etapas: lista.map((x) => x.etapa),
    indice: lista.find((x) => x.indice)?.indice ?? null,
    ordenEnMemoria: lista.some((x) => x.etapa === 'SORT'),
    clavesExaminadas: e.executionStats.totalKeysExamined,
    documentosExaminados: e.executionStats.totalDocsExamined,
    devueltos: e.executionStats.nReturned,
  };
}

function comparar(a, b) {
  const orden = (x) => [...x].sort().join('\n');
  return {
    equivalente: orden(a) === orden(b),
    mismoOrden: a.join('\n') === b.join('\n'),
    mongo: a,
    sql: b,
  };
}

const publica = ({ preparar, pasos, sql, huellaMongo, huellaSql, ...resto }) => resto;

async function ejecutarSql(sentencias) {
  return enTransaccionDePrueba(async (pg) => {
    const salida = [];
    for (const s of sentencias) {
      const medir = cronometro();
      const r = await pg.query(s.texto, s.valores);
      salida.push({ ...s, filas: r.rows, ms: medir() });
    }
    return salida;
  });
}

export const Nosql = {
  async estado() {
    const { db } = await mongo();
    const medir = cronometro();
    await db.command({ ping: 1 });
    const latenciaMs = medir();
    const { version } = await db.command({ buildInfo: 1 });
    const enAtlas = /\.mongodb\.net/.test(env.mongodbUri);
    return { conectada: true, motor: `MongoDB ${version}`, alojamiento: enAtlas ? 'MongoDB Atlas' : 'Local (Docker)', baseDeDatos: db.databaseName, latenciaMs };
  },

  async colecciones() {
    const { db } = await mongo();
    const info = new Map((await db.listCollections().toArray()).map((c) => [c.name, c.options]));
    return Promise.all(COLECCIONES.map(async (c) => {
      const col = db.collection(c.nombre);
      const [total, ejemplo, indices] = await Promise.all([
        col.countDocuments(),
        col.findOne(c.ejemplo, { promoteValues: false }),
        col.indexes(),
      ]);
      const opciones = info.get(c.nombre) ?? {};
      return {
        nombre: c.nombre,
        origen: c.origen,
        resuelve: c.resuelve,
        total,
        ejemplo: ejemplo ? aMongosh(ejemplo) : null,
        indices: indices.map((i) => ({ nombre: i.name, clave: aMongosh(i.key), unico: Boolean(i.unique) })),
        validador: opciones.validator ? aMongosh(opciones.validator) : null,
      };
    }));
  },

  // Lista con el texto de cada paso, armado con datos reales (sin ejecutar escrituras).
  async consultas() {
    const { db } = await mongo();
    return Promise.all(CONSULTAS_NOSQL.map(async (c) => {
      const p = c.preparar ? await c.preparar(db) : {};
      return {
        ...publica(c),
        pasos: c.pasos.map((armar) => {
          const op = armar(p, []);
          return { texto: textoDe(op), nota: op.nota ?? null };
        }),
        sql: c.sql(p).map(({ texto, valores }) => ({ texto, valores })),
      };
    }));
  },

  async ejecutar(codigo) {
    const c = CONSULTAS_NOSQL.find((x) => x.codigo === codigo);
    if (!c) return null;

    const correrPasos = async (db, session) => {
      const p = c.preparar ? await c.preparar(db, session) : {};
      const resultados = [];
      const pasos = [];
      const medir = cronometro();
      for (const armar of c.pasos) {
        const op = armar(p, resultados);
        const r = await correr(db, op, session);
        resultados.push(r);
        pasos.push({ texto: textoDe(op), nota: op.nota ?? null, resultado: r.slice(0, 8).map((x) => aMongosh(x)), cantidad: r.length });
      }
      const ms = medir();
      const plan = c.tipo === 'lectura' ? await explicar(db, c.pasos[0](p, [])) : null;
      return { p, resultados, pasos, ms, plan };
    };

    // Las lecturas no necesitan transacción; las escrituras se abortan siempre.
    const mongoRes = c.tipo === 'lectura'
      ? await correrPasos((await mongo()).db)
      : await enTransaccionDePruebaMongo(correrPasos);

    const sql = await ejecutarSql(c.sql(mongoRes.p));
    const comparacion = comparar(c.huellaMongo(mongoRes.resultados), c.huellaSql(sql.map((s) => s.filas)));

    return {
      codigo: c.codigo,
      tipo: c.tipo,
      mongo: { pasos: mongoRes.pasos, ms: mongoRes.ms, plan: mongoRes.plan, transaccion: c.tipo === 'lectura' ? null : 'abortTransaction' },
      sql: sql.map(({ texto, valores, filas, ms }) => ({ texto, valores, filas: filas.length, ms })),
      comparacion,
    };
  },

  pruebas() {
    return PRUEBAS_NOSQL.map(({ intentar, ...resto }) => resto);
  },

  async probar(codigo) {
    const p = PRUEBAS_NOSQL.find((x) => x.codigo === codigo);
    if (!p) return null;
    return enTransaccionDePruebaMongo(async (db, session) => {
      try {
        const r = await p.intentar(db, session);
        const sinEfecto = r.matchedCount === 0 || r.insertedCount === 0;
        return {
          codigo,
          rechazada: false,
          resultado: aMongosh(r),
          cumpleLoEsperado: p.esperado === 'aceptada' || (p.esperado === 'sin coincidencias' && sinEfecto),
          transaccion: 'abortTransaction',
        };
      } catch (error) {
        if (!error.code) throw error;
        return {
          codigo,
          rechazada: true,
          cumpleLoEsperado: p.esperado === 'rechazo',
          codigoMongo: error.code,
          nombreError: error.codeName ?? { 121: 'DocumentValidationFailure', 11000: 'DuplicateKey' }[error.code] ?? null,
          mensaje: error.message,
          motivo: motivoDe(error),
          transaccion: 'abortTransaction',
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
    if (nodo.operatorName === '$expr') hallazgos.push('fecha_nacimiento: $expr (no cumple 18 años a $$NOW)');
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
