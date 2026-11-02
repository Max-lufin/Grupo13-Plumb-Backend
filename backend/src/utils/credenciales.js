import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Contraseñas: scrypt con una sal aleatoria por cuenta. En la base solo queda
// "scrypt$<sal>$<hash>", nunca la contraseña.
const scryptAsync = promisify(scrypt);

export async function hashContrasena(contrasena) {
  const sal = randomBytes(16);
  const hash = await scryptAsync(contrasena, sal, 32);
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export async function verificarContrasena(contrasena, guardada) {
  const [tipo, sal, hash] = String(guardada).split('$');
  if (tipo !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const calculado = await scryptAsync(contrasena, Buffer.from(sal, 'base64'), esperado.length);
  return timingSafeEqual(calculado, esperado);
}

// Token de sesión en formato JWT, firmado con HMAC-SHA256. El algoritmo es fijo:
// la cabecera del token no se usa para elegirlo, así no se puede degradar.
const CABECERA = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const firma = (contenido, secreto) => createHmac('sha256', secreto).update(contenido).digest();

export function firmarToken(datos, secreto, segundos) {
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = Buffer.from(JSON.stringify({ ...datos, iat: ahora, exp: ahora + segundos })).toString('base64url');
  return `${CABECERA}.${cuerpo}.${firma(`${CABECERA}.${cuerpo}`, secreto).toString('base64url')}`;
}

// Devuelve los datos del token si la firma es válida y no venció; si no, null.
export function verificarToken(token, secreto) {
  const [cabecera, cuerpo, recibida] = String(token).split('.');
  if (!cabecera || !cuerpo || !recibida) return null;
  const esperada = firma(`${cabecera}.${cuerpo}`, secreto);
  const dada = Buffer.from(recibida, 'base64url');
  if (dada.length !== esperada.length || !timingSafeEqual(dada, esperada)) return null;
  try {
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    return typeof datos.exp === 'number' && datos.exp > Date.now() / 1000 ? datos : null;
  } catch {
    return null;
  }
}
