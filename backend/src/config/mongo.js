import { MongoClient } from 'mongodb';
import { ErrorHttp } from '../utils/http.js';
import { env } from './env.js';

// Un único cliente para toda la aplicación (igual que el pool de PostgreSQL).
// Se crea la primera vez que alguien lo pide: si MongoDB no está configurado,
// el resto de la API ni se entera.
let cliente = null;

export async function mongo() {
  if (!env.mongodbUri) {
    throw new ErrorHttp(503, 'SIN_MONGODB', 'MongoDB no está configurado en este entorno (falta MONGODB_URI).');
  }
  cliente ??= new MongoClient(env.mongodbUri, {
    maxPoolSize: env.produccion ? 3 : 10,
    serverSelectionTimeoutMS: 8000,
    appName: 'plumb-api',
  });
  await cliente.connect();
  return { cliente, db: cliente.db(env.mongodbDb) };
}

// Ejecuta fn dentro de una transacción multi-documento y SIEMPRE la aborta:
// es el equivalente del ROLLBACK del laboratorio SQL.
export async function enTransaccionDePruebaMongo(fn) {
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

export async function cerrarMongo() {
  await cliente?.close();
  cliente = null;
}
