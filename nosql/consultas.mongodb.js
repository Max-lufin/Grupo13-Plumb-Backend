// Plumb · Grupo 13 · ICI324 — las 13 consultas de la Etapa I en MQL.
// Cada bloque es exactamente el que muestra el laboratorio (/consultas), sobre
// el modelo de documentos de esquema.cjs. Después de cada uno se imprime una
// comprobación, como en el laboratorio SQL.
//
// No deja cambios: las escrituras (6 a 12) corren en una transacción que se
// aborta, y los collMod (1 y 2) se revierten al terminar.
//
//   mongosh "$MONGODB_URI" --file nosql/consultas.mongodb.js
//   docker cp nosql/consultas.mongodb.js plumb-mongo:/tmp/ && docker exec plumb-mongo mongosh plumb --quiet --file /tmp/consultas.mongodb.js

db = db.getSiblingDB('plumb');
const titulo = (n, texto) => print(`\n── Consulta ${n} · ${texto}`);
const validadorDe = (coleccion) => db.getCollectionInfos({ name: coleccion })[0].options.validator;
const originales = { solicitudes: validadorDe('solicitudes'), maestros: validadorDe('maestros') };

// ── ALTER → collMod (no se permiten dentro de una transacción) ─────────────
titulo(1, 'ALTER · Registrar cuándo responde el maestro');
{
// Con additionalProperties: false, un campo nuevo exige ampliar el
// validador: este collMod es el equivalente real del ADD COLUMN.
const v1 = db.getCollectionInfos({ name: 'solicitudes' })[0]
  .options.validator;
v1.$jsonSchema.properties.fecha_respuesta = {
  bsonType: ['date', 'null']
};
db.runCommand({ collMod: 'solicitudes', validator: v1 });
  printjson(validadorDe('solicitudes').$jsonSchema.properties.fecha_respuesta);
}

titulo(2, 'ALTER · Tope de tarifa por hora');
{
const v2 = db.getCollectionInfos({ name: 'maestros' })[0]
  .options.validator;
v2.$jsonSchema.properties.tarifa_hora.maximum = 150000;
db.runCommand({
  collMod: 'maestros', validator: v2, validationLevel: 'strict'
});
  printjson({ tarifa_hora: validadorDe('maestros').$jsonSchema.properties.tarifa_hora });
}

// ── SELECT → find ──────────────────────────────────────────────────────────
titulo(3, 'SELECT con JOIN · Catálogo de maestros con filtros');
{
const gasfiter = db.oficios.findOne({ nombre: 'Gasfíter' });
db.maestros.find(
  { 'region._id': 6, 'oficio._id': gasfiter._id,
    tarifa_hora: { $lte: 25000 }, 'reputacion.promedio': { $gte: 4 },
    disponible: true, experiencia_anios: { $gte: 3 } },
  { nombre: 1, 'oficio.nombre': 1, 'region.nombre': 1, tarifa_hora: 1,
    experiencia_anios: 1, disponible: 1, reputacion: 1 }
).sort({ 'reputacion.promedio': -1, tarifa_hora: 1 })
  .forEach((m) => print(m._id, m.nombre, m.reputacion.promedio, m.tarifa_hora));
}

titulo(4, 'SELECT con JOIN · Historial de solicitudes de un cliente');
{
// Sin JOIN: el maestro y la nota viajan dentro de la solicitud.
db.solicitudes.find(
  { 'cliente._id': '12588772-4' },
  { folio: 1, fecha_solicitud: 1, fecha_servicio: 1, estado: 1,
    descripcion: 1, direccion: 1, cliente: 1, maestro: 1,
    'calificacion.puntuacion': 1 }
).sort({ fecha_solicitud: -1 }).limit(200)
  .forEach((s) => print('N°', s.folio, s.estado, s.maestro.nombre, s.calificacion?.puntuacion ?? '–'));
}

titulo(5, 'SELECT · Bandeja de entrada del maestro');
{
db.solicitudes.find(
  { 'maestro._id': '7765180-2', estado: 'Pendiente' },
  { folio: 1, descripcion: 1, direccion: 1, fecha_servicio: 1,
    fecha_solicitud: 1 }
).sort({ fecha_solicitud: 1 })
  .forEach((s) => print('N°', s.folio, s.fecha_solicitud.toISOString().slice(0, 10), s.descripcion));
}

// ── UPDATE, INSERT y DELETE dentro de una transacción que se aborta ────────
const sesion = db.getMongo().startSession();
sesion.startTransaction();
const real = db;
db = sesion.getDatabase('plumb');

titulo(6, 'UPDATE · El maestro acepta una solicitud');
{
db.solicitudes.updateOne(
  { folio: 2, estado: 'Pendiente' },
  { $set: { estado: 'Aceptada' } }
);
  printjson(db.solicitudes.findOne({ folio: 2 }, { _id: 0, folio: 1, estado: 1 }));
}

titulo(7, 'UPDATE · Disponibilidad y tarifa de un maestro');
{
// $set cambia solo lo que se envía: no hace falta el COALESCE de SQL.
db.maestros.updateOne(
  { _id: '7559934-K' },
  { $set: { disponible: true, tarifa_hora: 21000 } }
);
  printjson(db.maestros.findOne({ _id: '7559934-K' }, { disponible: 1, tarifa_hora: 1 }));
}

titulo(8, 'INSERT · Registro de un cliente');
{
// Un menor de 18 lo rechazaría el $expr del validador (prueba N1).
db.clientes.insertOne({
  _id: '20345678-6',
  nombre: 'Tomás Henríquez Salas',
  email: 'tomas.henriquez@ejemplo.cl',
  telefono: '+56987654321',
  fecha_nacimiento: ISODate('2001-04-22'),
  fecha_registro: new Date()
});
  printjson(db.clientes.findOne({ _id: '20345678-6' }, { nombre: 1, fecha_nacimiento: 1 }));
}

titulo(9, 'INSERT · Alta de un maestro');
{
const pintor = db.oficios.findOne({ nombre: 'Pintor' });
db.maestros.insertOne({
  _id: '16234567-2',
  nombre: 'Gabriel Morales Iturra',
  email: 'gabriel.morales@ejemplo.cl',
  telefono: '+56912345678',
  fecha_nacimiento: ISODate('1990-09-03'),
  oficio: { _id: pintor._id, nombre: pintor.nombre },
  region: { _id: 6, nombre: 'Valparaíso' },
  tarifa_hora: 15000,
  experiencia_anios: 7,
  disponible: true,
  descripcion: 'Pintura de interiores y fachadas en Viña.',
  fecha_registro: new Date(),
  reputacion: { promedio: 0, total: 0, suma: 0 },
  resenas_recientes: []
});
  printjson(db.maestros.findOne({ _id: '16234567-2' }, { nombre: 1, oficio: 1, region: 1 }));
}

titulo(10, 'INSERT · Nueva solicitud de servicio');
{
// Sin SERIAL ni DEFAULT: el folio sale de contadores y el estado
// inicial lo pone la aplicación.
const juan = db.clientes.findOne(
  { _id: '13345441-1' }, { nombre: 1 });
const claudia = db.maestros.findOne(
  { _id: '16178972-0', disponible: true }, { nombre: 1 });
const { seq } = db.contadores.findOneAndUpdate(
  { _id: 'solicitudes' }, { $inc: { seq: 1 } },
  { returnDocument: 'after' });
db.solicitudes.insertOne({
  folio: seq,
  cliente: { _id: juan._id, nombre: juan.nombre },
  maestro: { _id: claudia._id, nombre: claudia.nombre },
  descripcion: 'El estanque del WC se queda corriendo.',
  direccion: 'Av. Libertad 1180, Viña del Mar',
  fecha_servicio: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  estado: 'Pendiente',
  fecha_solicitud: new Date(),
  calificacion: null
});
  printjson(db.solicitudes.findOne({ folio: seq }, { _id: 0, folio: 1, estado: 1, cliente: 1, maestro: 1 }));
}

titulo(11, 'DELETE · Moderación: eliminar una solicitud falsa');
{
// La calificación vive dentro de la solicitud y se borra con ella
// (el CASCADE sale gratis). A mano: sacarla de la reputación.
const borrada = db.solicitudes.findOneAndDelete({ folio: 6 });
const nota = borrada.calificacion.puntuacion;
const recientes = db.solicitudes
  .find({ 'maestro._id': borrada.maestro._id,
          calificacion: { $ne: null } })
  .sort({ 'calificacion.fecha': -1 }).limit(5).toArray()
  .map((s) => ({ solicitud_id: s._id, ...s.calificacion,
                 cliente: s.cliente.nombre.split(' ')[0] }));
// Un decimal con la mitad hacia arriba, como ROUND de PostgreSQL.
const promedio = { $divide: [{ $floor: { $add: [{ $divide: [
  { $multiply: ['$reputacion.suma', 10] }, '$reputacion.total'] },
  0.5] } }, 10] };
db.maestros.updateOne({ _id: borrada.maestro._id }, [
  { $set: {
      'reputacion.total': { $subtract: ['$reputacion.total', 1] },
      'reputacion.suma': { $subtract: ['$reputacion.suma', nota] },
      resenas_recientes: { $literal: recientes } } },
  { $set: { 'reputacion.promedio': {
      $cond: [{ $eq: ['$reputacion.total', 0] }, 0, promedio] } } }
]);
  printjson({ solicitud_6: db.solicitudes.findOne({ folio: 6 }), reputacion: db.maestros.findOne({ _id: borrada.maestro._id }).reputacion });
}

titulo(12, 'DELETE · Quitar un oficio que nadie ofrece');
{
// MongoDB no tiene ON DELETE RESTRICT: la regla la cumple quien
// borra (prueba N7).
const vidriero = db.oficios.findOne({ nombre: 'Vidriero' });
const maestros = db.maestros.countDocuments(
  { 'oficio._id': vidriero._id });
if (maestros === 0) {
  db.oficios.deleteOne({ _id: vidriero._id });
};
  printjson({ vidrieros_que_quedan: db.oficios.countDocuments({ nombre: 'Vidriero' }) });
}

sesion.abortTransaction();
sesion.endSession();
db = real;

// ── DROP → drop ────────────────────────────────────────────────────────────
titulo(13, 'DROP · Eliminar la tabla de carga temporal');
{
// La colección nace con el primer insert; drop() la elimina junto
// con sus índices.
db.carga_maestros.insertMany([
  { rut: '11111111-1', nombre: 'Ejemplo Uno',
    oficio: 'Gasfíter', region: 'Valparaíso' },
  { rut: '22222222-2', nombre: 'Ejemplo Dos',
    oficio: 'Pintor', region: 'Biobío' }
]);
db.carga_maestros.drop();
  printjson({ carga_maestros_existe: db.getCollectionNames().includes('carga_maestros') });
}

// ── Se deja todo como estaba ───────────────────────────────────────────────
for (const [coleccion, validator] of Object.entries(originales)) db.runCommand({ collMod: coleccion, validator });
print('\nListo: la transacción se abortó y los validadores volvieron a su versión original.');
