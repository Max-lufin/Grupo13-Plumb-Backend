import { coleccion } from '../config/mongo.js';
import { env } from '../config/env.js';
import { firmarToken, hashContrasena, verificarContrasena } from '../utils/credenciales.js';
import { ErrorHttp } from '../utils/http.js';

// Clientes, maestros y administradores viven en la colección usuarios: el
// inicio de sesión busca por correo sin saber de antemano el rol de la persona.
const DURACION_SESION = 8 * 60 * 60; // 8 horas

// La contraseña (su hash) nunca sale de la base de datos.
export const SIN_CONTRASENA = { contrasena: 0 };

export const Usuario = {
  hashContrasena,

  async iniciarSesion(email, contrasena) {
    const usuarios = await coleccion('usuarios');
    const u = await usuarios.findOne({ email }, { projection: { nombre: 1, email: 1, roles: 1, contrasena: 1 } });
    // Mismo mensaje si el correo no existe o la contraseña no coincide: no se revela qué falló.
    if (!u || !(await verificarContrasena(contrasena, u.contrasena))) {
      throw new ErrorHttp(401, 'CREDENCIALES', 'Correo o contraseña incorrectos.');
    }
    const token = firmarToken({ sub: u._id, nombre: u.nombre, roles: u.roles }, env.sesionSecreto, DURACION_SESION);
    return { token, expiraEn: DURACION_SESION, usuario: { rut: u._id, nombre: u.nombre, email: u.email, roles: u.roles } };
  },

  async perfil(rut) {
    const usuarios = await coleccion('usuarios');
    const u = await usuarios.findOne({ _id: rut }, { projection: { nombre: 1, email: 1, roles: 1 } });
    return u ? { rut: u._id, nombre: u.nombre, email: u.email, roles: u.roles } : null;
  },
};
