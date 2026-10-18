// Traspaso de PostgreSQL a MongoDB: lee las 6 tablas y escribe las colecciones
// según las decisiones del modelo de documentos (nosql/README.md).
//
// Uso:  MONGODB_URI=mongodb://... npm run mongo:migrar
//       (lee DATABASE_URL para PostgreSQL; MONGODB_DB por defecto "plumb")
// Además exporta un documento de ejemplo por colección en nosql/ejemplos/.
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BSON, Double, MongoClient, ObjectId } from 'mongodb';
import { pool } from '../src/config/db.js';

const { EJSON } = BSON;

const require = createRequire(import.meta.url);
const { crearColecciones } = require('../../nosql/esquema.cjs');
const aqui = path.dirname(fileURLToPath(import.meta.url));

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Falta MONGODB_URI. Revisa .env.example.');

// DATE de PostgreSQL llega como 'AAAA-MM-DD': se guarda como fecha UTC a medianoche.
const fecha = (iso) => new Date(`${iso}T00:00:00Z`);
const filas = async (sql) => (await pool.query(sql)).rows;

const [regiones, oficios, clientes, maestros, solicitudes, calificaciones] = await Promise.all([
  filas('SELECT id_region, codigo, nombre FROM region ORDER BY id_region'),
  filas('SELECT id_oficio, nombre, descripcion FROM oficio ORDER BY id_oficio'),
  filas('SELECT * FROM cliente ORDER BY rut_cliente'),
  filas('SELECT * FROM maestro ORDER BY rut_maestro'),
  filas('SELECT * FROM solicitud ORDER BY id_solicitud'),
  filas('SELECT * FROM calificacion ORDER BY id_solicitud'),
]);

// Las PK numéricas de PostgreSQL pasan a ObjectId deterministas: 4 bytes de
// fecha (la de creación, como un ObjectId real) y el id original al final.
// Así cada migración produce los mismos _id y los ejemplos no cambian.
const objectId = (fecha, id) => new ObjectId(
  Math.floor(new Date(fecha).getTime() / 1000).toString(16).padStart(8, '0') + id.toString(16).padStart(16, '0'),
);
const idOficio = new Map(oficios.map((o) => [o.id_oficio, objectId('2026-03-02T12:00:00Z', o.id_oficio)]));
const idSolicitud = new Map(solicitudes.map((s) => [s.id_solicitud, objectId(s.fecha_solicitud, s.id_solicitud)]));
const nombreRegion = new Map(regiones.map((r) => [r.id_region, r.nombre]));
const oficioDe = new Map(oficios.map((o) => [o.id_oficio, o.nombre]));
const clientePorRut = new Map(clientes.map((c) => [c.rut_cliente, c]));
const maestroPorRut = new Map(maestros.map((m) => [m.rut_maestro, m]));
const calificacionDe = new Map(calificaciones.map((c) => [c.id_solicitud, c]));

const docsRegiones = regiones.map((r) => ({ _id: r.id_region, codigo: r.codigo, nombre: r.nombre }));

const docsOficios = oficios.map((o) => ({ _id: idOficio.get(o.id_oficio), nombre: o.nombre, descripcion: o.descripcion }));

const docsClientes = clientes.map((c) => ({
  _id: c.rut_cliente,
  nombre: c.nombre,
  email: c.email,
  telefono: c.telefono,
  fecha_nacimiento: fecha(c.fecha_nacimiento),
  fecha_registro: c.fecha_registro,
}));

const docsSolicitudes = solicitudes.map((s) => {
  const k = calificacionDe.get(s.id_solicitud);
  return {
    _id: idSolicitud.get(s.id_solicitud),
    folio: s.id_solicitud,
    cliente: { _id: s.rut_cliente, nombre: clientePorRut.get(s.rut_cliente).nombre },
    maestro: { _id: s.rut_maestro, nombre: maestroPorRut.get(s.rut_maestro).nombre },
    descripcion: s.descripcion,
    direccion: s.direccion,
    fecha_servicio: fecha(s.fecha_servicio),
    estado: s.estado,
    fecha_solicitud: s.fecha_solicitud,
    calificacion: k ? { puntuacion: k.puntuacion, comentario: k.comentario, fecha: k.fecha } : null,
  };
});

const docsMaestros = maestros.map((m) => {
  const notas = docsSolicitudes
    .filter((s) => s.maestro._id === m.rut_maestro && s.calificacion)
    .sort((a, b) => b.calificacion.fecha - a.calificacion.fecha);
  const suma = notas.reduce((t, s) => t + s.calificacion.puntuacion, 0);
  return {
    _id: m.rut_maestro,
    nombre: m.nombre,
    email: m.email,
    telefono: m.telefono,
    fecha_nacimiento: fecha(m.fecha_nacimiento),
    oficio: { _id: idOficio.get(m.id_oficio), nombre: oficioDe.get(m.id_oficio) },
    region: { _id: m.id_region, nombre: nombreRegion.get(m.id_region) },
    tarifa_hora: m.tarifa_hora,
    experiencia_anios: m.experiencia_anios,
    disponible: m.disponible,
    descripcion: m.descripcion,
    fecha_registro: m.fecha_registro,
    // Double explícito (un 5 sigue siendo decimal) y redondeo mitad hacia arriba, como ROUND(AVG, 1).
    reputacion: { promedio: new Double(notas.length ? Math.round((suma * 10) / notas.length) / 10 : 0), total: notas.length, suma },
    resenas_recientes: notas.slice(0, 5).map((s) => ({
      solicitud_id: s._id,
      puntuacion: s.calificacion.puntuacion,
      comentario: s.calificacion.comentario,
      cliente: s.cliente.nombre.split(' ')[0],
      fecha: s.calificacion.fecha,
    })),
  };
});

const cliente = new MongoClient(uri);
await cliente.connect();
const db = cliente.db(process.env.MONGODB_DB || 'plumb');
await crearColecciones(db, { borrar: true });

await db.collection('regiones').insertMany(docsRegiones);
await db.collection('oficios').insertMany(docsOficios);
await db.collection('clientes').insertMany(docsClientes);
await db.collection('maestros').insertMany(docsMaestros);
await db.collection('solicitudes').insertMany(docsSolicitudes);
await db.collection('contadores').insertOne({ _id: 'solicitudes', seq: Math.max(...solicitudes.map((s) => s.id_solicitud)) });

const conteo = {};
for (const nombre of ['regiones', 'oficios', 'clientes', 'maestros', 'solicitudes', 'contadores']) {
  conteo[nombre] = await db.collection(nombre).countDocuments();
}
console.log('MongoDB listo:', conteo);

// Un documento real por colección, en Extended JSON (válido para mongoimport).
// Las pruebas migran con --sin-ejemplos para no reescribir estos archivos.
const ejemplos = process.argv.includes('--sin-ejemplos') ? {} : {
  regiones: { _id: 6 },
  oficios: { nombre: 'Gasfíter' },
  clientes: { _id: '12588772-4' },
  maestros: { _id: '7765180-2' },
  solicitudes: { folio: 1 },
  contadores: { _id: 'solicitudes' },
};
const carpeta = path.resolve(aqui, '../../nosql/ejemplos');
await mkdir(carpeta, { recursive: true });
for (const [nombre, filtro] of Object.entries(ejemplos)) {
  const doc = await db.collection(nombre).findOne(filtro);
  await writeFile(path.join(carpeta, `${nombre}.json`), `${EJSON.stringify(doc, null, 2, { relaxed: true })}\n`);
}
if (Object.keys(ejemplos).length) console.log('Ejemplos exportados en nosql/ejemplos/');

await cliente.close();
await pool.end();
