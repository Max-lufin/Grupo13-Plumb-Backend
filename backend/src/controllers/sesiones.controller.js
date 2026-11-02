import { Usuario } from '../models/usuario.model.js';
import { esquemas, validar } from '../validators/esquemas.js';
import { ErrorHttp, noEncontrado, ok } from '../utils/http.js';

// Límite de intentos fallidos por IP para frenar ataques de fuerza bruta.
// shortcut: memoria de cada instancia (en Vercel puede haber varias); pasar a un almacén compartido si crece el tráfico.
const VENTANA_MS = 15 * 60 * 1000;
const MAX_FALLOS = 10;
const fallos = new Map();

function revisarLimite(ip) {
  const r = fallos.get(ip);
  if (r && r.hasta > Date.now() && r.cantidad >= MAX_FALLOS) {
    throw new ErrorHttp(429, 'DEMASIADOS_INTENTOS', 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.');
  }
}

function anotarFallo(ip) {
  const r = fallos.get(ip);
  if (!r || r.hasta < Date.now()) fallos.set(ip, { cantidad: 1, hasta: Date.now() + VENTANA_MS });
  else r.cantidad += 1;
}

export async function iniciar(req, res) {
  const { email, contrasena } = validar(esquemas.inicioSesion, req.body);
  revisarLimite(req.ip);
  try {
    const sesion = await Usuario.iniciarSesion(email, contrasena);
    fallos.delete(req.ip);
    res.status(201).json(ok(sesion));
  } catch (error) {
    if (error.status === 401) anotarFallo(req.ip);
    throw error;
  }
}

export async function actual(req, res) {
  const usuario = await Usuario.perfil(req.usuario.rut);
  if (!usuario) throw noEncontrado('La cuenta de esta sesión ya no existe.');
  res.json(ok(usuario));
}
