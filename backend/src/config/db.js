import pg from 'pg';
import { env } from './env.js';

// NUMERIC (ej. el promedio) y COUNT(*) (BIGINT) llegan como texto desde pg;
// a nuestra escala caben sin problema en un Number de JavaScript.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
// DATE se deja como 'AAAA-MM-DD' para que la zona horaria no corra el día.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

// Un único pool para toda la aplicación: las conexiones se reutilizan en vez
// de abrir una por petición. En Vercel cada instancia usa pocas conexiones.
export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: env.produccion ? 3 : 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (error) => {
  console.error('[bd] conexión inactiva con error:', error.message);
});

export function query(texto, valores = []) {
  return pool.query(texto, valores);
}

// Ejecuta fn dentro de una transacción y SIEMPRE hace ROLLBACK al terminar.
// La usa el laboratorio de consultas para demostrar INSERT, DELETE, ALTER o
// DROP sin dejar cambios en la base (PostgreSQL permite DDL transaccional).
export async function enTransaccionDePrueba(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query("SET LOCAL statement_timeout = '5s'");
    return await fn(cliente);
  } finally {
    await cliente.query('ROLLBACK').catch(() => {});
    cliente.release();
  }
}
