import { coleccion } from '../config/mongo.js';
import { conflicto, reglaDeNegocio } from '../utils/http.js';
import { aDia, aFecha, esMayorDeEdad } from './reglas.js';
import { Usuario } from './usuario.model.js';

const ficha = (u) => ({
  rut_cliente: u._id, nombre: u.nombre, email: u.email, telefono: u.telefono ?? null,
  fecha_nacimiento: aDia(u.fecha_nacimiento), fecha_registro: u.fecha_registro,
});

export const Cliente = {
  // Lista para el administrador, con cuántas solicitudes tiene cada cliente.
  async listar() {
    const usuarios = await coleccion('usuarios');
    return usuarios.aggregate([
      { $match: { roles: 'cliente' } },
      { $lookup: { from: 'solicitudes', localField: '_id', foreignField: 'cliente._id', as: 's', pipeline: [{ $project: { _id: 1 } }] } },
      { $project: { _id: 0, rut_cliente: '$_id', nombre: 1, email: 1, total_solicitudes: { $size: '$s' } } },
      { $sort: { nombre: 1 } },
    ], { collation: { locale: 'es' } }).toArray();
  },

  async buscar(rut) {
    const usuarios = await coleccion('usuarios');
    const u = await usuarios.findOne({ _id: rut, roles: 'cliente' }, { projection: { contrasena: 0, maestro: 0 } });
    return u ? ficha(u) : null;
  },

  // Solo mayores de 18 años. Se valida aquí (422 con mensaje claro) y además
  // el validador de la colección lo garantiza con $expr.
  async crear(d) {
    if (!esMayorDeEdad(d.fecha_nacimiento)) {
      throw reglaDeNegocio('Para registrarte debes ser mayor de 18 años.', [
        { campo: 'fecha_nacimiento', mensaje: 'Debes tener al menos 18 años.' },
      ]);
    }
    const usuarios = await coleccion('usuarios');
    if (await usuarios.countDocuments({ _id: d.rut_cliente }, { limit: 1 })) {
      throw conflicto('Ya existe una cuenta con ese RUT. Inicia sesión con tu correo.');
    }
    const doc = {
      _id: d.rut_cliente, nombre: d.nombre, email: d.email, telefono: d.telefono ?? null,
      fecha_nacimiento: aFecha(d.fecha_nacimiento), contrasena: await Usuario.hashContrasena(d.contrasena),
      roles: ['cliente'], fecha_registro: new Date(),
    };
    await usuarios.insertOne(doc);
    return { rut_cliente: doc._id, nombre: doc.nombre, fecha_registro: doc.fecha_registro };
  },
};
