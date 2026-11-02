import { MongoClient } from 'mongodb';
import { env } from './env.js';

// Un único cliente para toda la aplicación: las conexiones se reutilizan en vez
// de abrir una por petición. En Vercel cada instancia usa pocas conexiones.
let cliente = null;

export async function mongo() {
  cliente ??= new MongoClient(env.mongodbUri, {
    maxPoolSize: env.produccion ? 3 : 10,
    serverSelectionTimeoutMS: 8000,
    appName: 'plumb-api',
  });
  await cliente.connect();
  return { cliente, db: cliente.db(env.mongodbDb) };
}

export const coleccion = async (nombre) => (await mongo()).db.collection(nombre);

// Ejecuta fn en una transacción multi-documento: o se guardan todas sus
// escrituras o ninguna. withTransaction reintenta si hay un conflicto pasajero.
export async function enTransaccion(fn) {
  const { cliente: c, db } = await mongo();
  const sesion = c.startSession();
  try {
    let resultado;
    await sesion.withTransaction(async () => { resultado = await fn(db, sesion); }, { writeConcern: { w: 'majority' } });
    return resultado;
  } finally {
    await sesion.endSession();
  }
}

// Igual que enTransaccion, pero SIEMPRE la aborta: así el laboratorio de
// consultas puede ejecutar escrituras reales sin dejar cambios.
export async function enTransaccionDePrueba(fn) {
  const { cliente: c, db } = await mongo();
  const sesion = c.startSession();
  try {
    sesion.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    return await fn(db, sesion);
  } finally {
    if (sesion.inTransaction()) await sesion.abortTransaction().catch(() => {});
    await sesion.endSession();
  }
}

// Folio siguiente de una colección (reemplaza al SERIAL del modelo relacional).
export async function siguiente(db, nombre, session) {
  const r = await db.collection('contadores').findOneAndUpdate(
    { _id: nombre }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session },
  );
  return r.seq;
}

export async function cerrarMongo() {
  await cliente?.close();
  cliente = null;
}
