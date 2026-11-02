// Deja la base MongoDB como recién instalada: recrea las colecciones con sus
// validadores e índices y carga los datos de ejemplo de nosql/datos/.
// Uso: npm run db:init   (lee MONGODB_URI y MONGODB_DB del .env)
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { BSON } from 'mongodb';

const require = createRequire(import.meta.url);
const { crearColecciones } = require('../../nosql/esquema.cjs');
const DATOS = new URL('../../nosql/datos/', import.meta.url);

export async function cargarDatos(db) {
  await crearColecciones(db, { borrar: true });
  const conteo = {};
  for (const nombre of ['oficios', 'usuarios', 'solicitudes', 'contadores']) {
    // Extended JSON conserva los tipos: ObjectId, fechas, enteros y decimales.
    const docs = BSON.EJSON.parse(await readFile(new URL(`${nombre}.json`, DATOS), 'utf8'), { relaxed: false });
    await db.collection(nombre).insertMany(docs);
    conteo[nombre] = docs.length;
  }
  return conteo;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { mongo, cerrarMongo } = await import('../src/config/mongo.js');
  const { db } = await mongo();
  console.log('Base de datos lista:', await cargarDatos(db));
  await cerrarMongo();
}
