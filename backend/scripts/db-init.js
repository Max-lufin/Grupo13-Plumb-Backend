// Crea las tablas y carga los datos de ejemplo en la BD de DATABASE_URL.
// Uso: npm run db:init            (lee ../bd)
//      BD_DIR=/otra/ruta npm run db:init
//
// OJO: 01_esquema.sql borra y recrea las tablas. Úsalo para dejar la BD
// como recién instalada (por ejemplo, antes de una presentación).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/config/db.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const carpeta = process.env.BD_DIR ?? path.resolve(aqui, '../../bd');

for (const archivo of ['01_esquema.sql', '02_datos.sql']) {
  const sql = await readFile(path.join(carpeta, archivo), 'utf8');
  process.stdout.write(`Ejecutando ${archivo}... `);
  await pool.query(sql);
  console.log('listo');
}

const { rows } = await pool.query(`
  SELECT (SELECT COUNT(*) FROM maestro) AS maestros,
         (SELECT COUNT(*) FROM solicitud) AS solicitudes,
         (SELECT COUNT(*) FROM calificacion) AS calificaciones`);
console.log('Base de datos lista:', rows[0]);
await pool.end();
