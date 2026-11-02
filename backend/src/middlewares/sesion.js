import { env } from '../config/env.js';
import { verificarToken } from '../utils/credenciales.js';
import { ErrorHttp } from '../utils/http.js';

// Lee el token "Authorization: Bearer <token>" si viene. Sin token, la petición
// sigue como visitante; con un token inválido o vencido, responde 401.
export function leerSesion(req, res, next) {
  const [tipo, token] = (req.get('authorization') ?? '').split(' ');
  if (!token) return next();
  const datos = tipo === 'Bearer' ? verificarToken(token, env.sesionSecreto) : null;
  if (!datos) throw new ErrorHttp(401, 'SESION_INVALIDA', 'Tu sesión venció o no es válida. Vuelve a iniciar sesión.');
  req.usuario = { rut: datos.sub, nombre: datos.nombre, roles: datos.roles };
  next();
}

// exigir() pide una sesión; exigir('administrador') además pide ese rol.
export const exigir = (...roles) => (req, res, next) => {
  if (!req.usuario) throw new ErrorHttp(401, 'SIN_SESION', 'Inicia sesión para continuar.');
  if (roles.length && !roles.some((r) => req.usuario.roles.includes(r))) {
    throw new ErrorHttp(403, 'SIN_PERMISO', 'Tu cuenta no tiene permiso para esta acción.');
  }
  next();
};

export const tieneRol = (req, rol) => Boolean(req.usuario?.roles.includes(rol));
