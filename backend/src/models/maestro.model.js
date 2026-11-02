import { coleccion, enTransaccion } from '../config/mongo.js';
import { conflicto, reglaDeNegocio } from '../utils/http.js';
import { regionPorNumero } from './region.model.js';
import { aDia, aFecha, esMayorDeEdad } from './reglas.js';
import { Usuario } from './usuario.model.js';

// Un maestro es un documento de usuarios con el rol "maestro" y su perfil
// embebido en el campo maestro: oficio y región copiados, reputación calculada
// y sus cinco reseñas más recientes. Así catálogo, perfil y ranking se resuelven
// leyendo una sola colección, sin uniones.

export const CONSULTAS_MAESTRO = {
  // Catálogo: 2 filtros obligatorios y 4 opcionales. Usa el índice ix_catalogo.
  catalogo(f) {
    const filtro = { 'maestro.region.numero': f.region, 'maestro.oficio._id': f.oficio };
    if (f.tarifaMax !== undefined) filtro['maestro.tarifa_hora'] = { $lte: f.tarifaMax };
    if (f.calificacionMin !== undefined) filtro['maestro.reputacion.promedio'] = { $gte: f.calificacionMin };
    if (f.disponible !== undefined) filtro['maestro.disponible'] = f.disponible;
    if (f.experienciaMin !== undefined) filtro['maestro.experiencia_anios'] = { $gte: f.experienciaMin };
    return {
      filtro,
      proyeccion: { nombre: 1, 'maestro.oficio': 1, 'maestro.region': 1, 'maestro.tarifa_hora': 1, 'maestro.experiencia_anios': 1, 'maestro.disponible': 1, 'maestro.reputacion': 1 },
      orden: { 'maestro.reputacion.promedio': -1, 'maestro.tarifa_hora': 1 },
    };
  },
};

const ficha = (u) => ({
  rut_maestro: u._id,
  nombre: u.nombre,
  id_oficio: u.maestro.oficio._id,
  oficio: u.maestro.oficio.nombre,
  id_region: u.maestro.region.numero,
  region: u.maestro.region.nombre,
  tarifa_hora: u.maestro.tarifa_hora,
  experiencia_anios: u.maestro.experiencia_anios,
  disponible: u.maestro.disponible,
  descripcion: u.maestro.descripcion ?? null,
  promedio: u.maestro.reputacion.promedio,
  total_resenas: u.maestro.reputacion.total,
});

function exigirMayorDeEdad(fechaNacimiento) {
  if (!esMayorDeEdad(fechaNacimiento)) {
    throw reglaDeNegocio('El maestro debe ser mayor de 18 años.', [
      { campo: 'fecha_nacimiento', mensaje: 'Debe tener al menos 18 años.' },
    ]);
  }
}

// Oficio y región se copian en el perfil (referencia extendida y región embebida).
async function oficioYRegion(d) {
  const oficios = await coleccion('oficios');
  const oficio = await oficios.findOne({ _id: d.id_oficio }, { projection: { nombre: 1 } });
  if (!oficio) throw reglaDeNegocio('El oficio indicado no existe.', [{ campo: 'id_oficio', mensaje: 'Elige un oficio de la lista.' }]);
  const region = regionPorNumero(d.id_region);
  if (!region) throw reglaDeNegocio('La región indicada no existe.', [{ campo: 'id_region', mensaje: 'Elige una región de la lista.' }]);
  return { oficio: { _id: oficio._id, nombre: oficio.nombre }, region };
}

export const Maestro = {
  async catalogo(f) {
    const usuarios = await coleccion('usuarios');
    const { filtro, proyeccion, orden } = CONSULTAS_MAESTRO.catalogo(f);
    return (await usuarios.find(filtro, { projection: proyeccion, sort: orden }).toArray()).map(ficha);
  },

  // Solo maestros con al menos 2 reseñas: con una sola nota, un 5,0 no dice mucho.
  async ranking(limite = 6) {
    const usuarios = await coleccion('usuarios');
    const lista = await usuarios.find(
      { 'maestro.reputacion.total': { $gte: 2 } },
      { projection: { contrasena: 0 }, sort: { 'maestro.reputacion.promedio': -1, 'maestro.reputacion.total': -1, nombre: 1 }, limit: limite },
    ).toArray();
    return lista.map(ficha);
  },

  // Lista completa para el administrador (incluye datos de contacto).
  async listar() {
    const usuarios = await coleccion('usuarios');
    const lista = await usuarios.find({ roles: 'maestro' }, { projection: { contrasena: 0 }, sort: { nombre: 1 }, collation: { locale: 'es' } }).toArray();
    return lista.map((u) => ({ ...ficha(u), email: u.email, telefono: u.telefono, fecha_nacimiento: aDia(u.fecha_nacimiento) }));
  },

  // Perfil público: una lectura por _id más el conteo de trabajos terminados.
  // El teléfono no se publica: el cliente lo ve cuando el maestro acepta.
  async buscar(rut) {
    const usuarios = await coleccion('usuarios');
    const u = await usuarios.findOne({ _id: rut, roles: 'maestro' }, { projection: { contrasena: 0, email: 0, telefono: 0 } });
    if (!u) return null;
    const solicitudes = await coleccion('solicitudes');
    const terminados = await solicitudes.countDocuments({ 'maestro._id': rut, estado: 'Finalizada' });
    return {
      ...ficha(u),
      fecha_registro: u.fecha_registro,
      trabajos_finalizados: terminados,
      resenas: u.maestro.resenas_recientes.map((r) => ({
        id: String(r.solicitud_id), puntuacion: r.puntuacion, comentario: r.comentario, fecha: r.fecha, cliente: r.cliente,
      })),
    };
  },

  async bandeja(rut, estado = 'Pendiente') {
    const solicitudes = await coleccion('solicitudes');
    const lista = await solicitudes.find({ 'maestro._id': rut, estado }, { sort: { fecha_solicitud: 1 } }).toArray();
    return lista.map((s) => ({
      id_solicitud: s.folio, descripcion: s.descripcion, direccion: s.direccion,
      fecha_servicio: aDia(s.fecha_servicio), fecha_solicitud: s.fecha_solicitud, cliente: s.cliente.nombre,
    }));
  },

  // Si el RUT ya tiene cuenta (por ejemplo, como cliente), se le agrega el rol
  // de maestro a esa misma cuenta: una persona, un documento.
  async crear(d) {
    exigirMayorDeEdad(d.fecha_nacimiento);
    if (!d.contrasena) throw reglaDeNegocio('Falta la contraseña inicial del maestro.', [{ campo: 'contrasena', mensaje: 'Escribe una contraseña inicial.' }]);
    const { oficio, region } = await oficioYRegion(d);
    const perfil = {
      oficio, region, tarifa_hora: d.tarifa_hora, experiencia_anios: d.experiencia_anios, disponible: d.disponible,
      descripcion: d.descripcion ?? null, reputacion: { promedio: 0, total: 0, suma: 0 }, resenas_recientes: [],
    };
    const usuarios = await coleccion('usuarios');
    const existente = await usuarios.findOne({ _id: d.rut_maestro }, { projection: { roles: 1 } });
    if (existente?.roles.includes('maestro')) throw conflicto('Ya existe un maestro con ese RUT.');
    if (existente) {
      await usuarios.updateOne({ _id: d.rut_maestro }, { $set: { maestro: perfil, telefono: d.telefono }, $addToSet: { roles: 'maestro' } });
    } else {
      await usuarios.insertOne({
        _id: d.rut_maestro, nombre: d.nombre, email: d.email, telefono: d.telefono,
        fecha_nacimiento: aFecha(d.fecha_nacimiento), contrasena: await Usuario.hashContrasena(d.contrasena),
        roles: ['maestro'], fecha_registro: new Date(), maestro: perfil,
      });
    }
    return { rut_maestro: d.rut_maestro, nombre: d.nombre, id_oficio: oficio._id, id_region: region.numero };
  },

  // El nombre del maestro está copiado en sus solicitudes: si cambia, se
  // actualizan las copias en la misma transacción.
  async actualizar(rut, d) {
    exigirMayorDeEdad(d.fecha_nacimiento);
    const { oficio, region } = await oficioYRegion(d);
    const cambios = {
      nombre: d.nombre, email: d.email, telefono: d.telefono, fecha_nacimiento: aFecha(d.fecha_nacimiento),
      'maestro.oficio': oficio, 'maestro.region': region, 'maestro.tarifa_hora': d.tarifa_hora,
      'maestro.experiencia_anios': d.experiencia_anios, 'maestro.disponible': d.disponible,
      'maestro.descripcion': d.descripcion ?? null,
    };
    if (d.contrasena) cambios.contrasena = await Usuario.hashContrasena(d.contrasena);
    return enTransaccion(async (db, session) => {
      const r = await db.collection('usuarios').updateOne({ _id: rut, roles: 'maestro' }, { $set: cambios }, { session });
      if (!r.matchedCount) return null;
      await db.collection('solicitudes').updateMany({ 'maestro._id': rut }, { $set: { 'maestro.nombre': d.nombre } }, { session });
      return { rut_maestro: rut, nombre: d.nombre };
    });
  },

  async actualizarParcial(rut, d) {
    const cambios = {};
    if (d.disponible !== undefined) cambios['maestro.disponible'] = d.disponible;
    if (d.tarifa_hora !== undefined) cambios['maestro.tarifa_hora'] = d.tarifa_hora;
    const usuarios = await coleccion('usuarios');
    const u = await usuarios.findOneAndUpdate({ _id: rut, roles: 'maestro' }, { $set: cambios },
      { returnDocument: 'after', projection: { nombre: 1, 'maestro.disponible': 1, 'maestro.tarifa_hora': 1 } });
    return u ? { rut_maestro: u._id, nombre: u.nombre, disponible: u.maestro.disponible, tarifa_hora: u.maestro.tarifa_hora } : null;
  },

  // MongoDB no tiene ON DELETE RESTRICT: la API revisa el historial antes de borrar.
  async eliminar(rut) {
    const usuarios = await coleccion('usuarios');
    const u = await usuarios.findOne({ _id: rut, roles: 'maestro' }, { projection: { nombre: 1, roles: 1 } });
    if (!u) return null;
    const solicitudes = await coleccion('solicitudes');
    if (await solicitudes.countDocuments({ 'maestro._id': rut }, { limit: 1 })) {
      throw conflicto('No se puede eliminar: el maestro tiene solicitudes en su historial.');
    }
    // Si la persona también es cliente, se le quita solo el perfil de maestro.
    if (u.roles.length > 1) await usuarios.updateOne({ _id: rut }, { $unset: { maestro: '' }, $pull: { roles: 'maestro' } });
    else await usuarios.deleteOne({ _id: rut });
    return { rut_maestro: rut, nombre: u.nombre };
  },
};
