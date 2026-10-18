import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Configuración leída del entorno. En local viene del archivo .env; en Vercel,
// de las variables definidas en el panel del proyecto.
// Las variables ya definidas en el sistema mandan sobre el archivo
// (process.loadEnvFile las pisaría).
try {
  for (const [clave, valor] of Object.entries(parseEnv(readFileSync('.env', 'utf8')))) process.env[clave] ??= valor;
} catch {
  // Sin .env: se usan las variables del sistema.
}

function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}. Revisa .env.example.`);
  return valor;
}

export const env = {
  databaseUrl: requerida('DATABASE_URL'),
  port: Number(process.env.PORT) || 3000,
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean),
  // MongoDB es opcional: sin URI la API funciona igual y /nosql responde 503.
  mongodbUri: process.env.MONGODB_URI || null,
  mongodbDb: process.env.MONGODB_DB || 'plumb',
  produccion: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
};
