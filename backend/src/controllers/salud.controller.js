import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { Nosql } from '../models/nosql.model.js';
import { cronometro, ok } from '../utils/http.js';

const SQL_ESTADO = `
SELECT current_setting('server_version') AS version,
       current_database()                AS base_de_datos,
       (SELECT COUNT(*) FROM region)       AS region,
       (SELECT COUNT(*) FROM oficio)       AS oficio,
       (SELECT COUNT(*) FROM cliente)      AS cliente,
       (SELECT COUNT(*) FROM maestro)      AS maestro,
       (SELECT COUNT(*) FROM solicitud)    AS solicitud,
       (SELECT COUNT(*) FROM calificacion) AS calificacion`;

// Demuestra que la conexión a la BD funciona: versión del motor, latencia
// de una consulta real y cuántas filas tiene cada tabla.
export async function estado(req, res) {
  const medir = cronometro();
  const [{ version, base_de_datos, ...tablas }, mongo] = await Promise.all([
    query(SQL_ESTADO).then((r) => r.rows[0]),
    // MongoDB es opcional: si falla, la salud lo informa pero no se cae.
    env.mongodbUri ? Nosql.estado().catch((error) => ({ conectada: false, error: error.message })) : { conectada: false, error: 'Sin MONGODB_URI' },
  ]);
  res.set('Cache-Control', 'no-store').json(ok({
    api: 'en línea',
    bd: {
      conectada: true,
      motor: `PostgreSQL ${version.split(' ')[0]}`,
      baseDeDatos: base_de_datos,
      latenciaMs: medir(),
    },
    tablas,
    mongo,
    hora: new Date().toISOString(),
  }));
}
