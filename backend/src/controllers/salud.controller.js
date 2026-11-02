import { env } from '../config/env.js';
import { mongo } from '../config/mongo.js';
import { cronometro, ok } from '../utils/http.js';

// Demuestra que la conexión a la base funciona: versión del motor, latencia
// de una consulta real y cuántos documentos hay de cada tipo.
export async function estado(req, res) {
  const { db } = await mongo();
  const medir = cronometro();
  await db.command({ ping: 1 });
  const latenciaMs = medir();
  const usuarios = db.collection('usuarios');
  const [info, clientes, maestros, administradores, oficios, solicitudes] = await Promise.all([
    db.command({ buildInfo: 1 }),
    usuarios.countDocuments({ roles: 'cliente' }),
    usuarios.countDocuments({ roles: 'maestro' }),
    usuarios.countDocuments({ roles: 'administrador' }),
    db.collection('oficios').estimatedDocumentCount(),
    db.collection('solicitudes').estimatedDocumentCount(),
  ]);
  res.set('Cache-Control', 'no-store').json(ok({
    api: 'en línea',
    bd: {
      conectada: true,
      motor: `MongoDB ${info.version}`,
      alojamiento: /\.mongodb\.net/.test(env.mongodbUri) ? 'MongoDB Atlas' : 'MongoDB local',
      baseDeDatos: db.databaseName,
      latenciaMs,
    },
    documentos: { clientes, maestros, administradores, oficios, solicitudes },
    hora: new Date().toISOString(),
  }));
}
