import { coleccion, enTransaccion, siguiente } from '../config/mongo.js';
import { conflicto } from '../utils/http.js';

const ficha = (o) => ({ id_oficio: o._id, nombre: o.nombre, descripcion: o.descripcion ?? null });

export const Oficio = {
  // Mantenedor: todos los oficios, también los que nadie ofrece, con su cantidad
  // de maestros. Es la razón para que oficios sea una colección propia.
  async listar() {
    const oficios = await coleccion('oficios');
    return oficios.aggregate([
      { $lookup: { from: 'usuarios', localField: '_id', foreignField: 'maestro.oficio._id', as: 'm', pipeline: [{ $project: { _id: 1 } }] } },
      { $project: { _id: 0, id_oficio: '$_id', nombre: 1, descripcion: 1, total_maestros: { $size: '$m' } } },
      { $sort: { nombre: 1 } },
    ], { collation: { locale: 'es' } }).toArray();
  },

  async buscar(id) {
    const oficios = await coleccion('oficios');
    const o = await oficios.findOne({ _id: id });
    return o ? ficha(o) : null;
  },

  async crear(d) {
    return enTransaccion(async (db, session) => {
      const doc = { _id: await siguiente(db, 'oficios', session), nombre: d.nombre, descripcion: d.descripcion ?? null };
      await db.collection('oficios').insertOne(doc, { session });
      return ficha(doc);
    });
  },

  // El nombre del oficio está copiado en cada maestro que lo ejerce: renombrar
  // actualiza el oficio y esas copias en la misma transacción.
  async actualizar(id, d) {
    return enTransaccion(async (db, session) => {
      const r = await db.collection('oficios').updateOne({ _id: id }, { $set: { nombre: d.nombre, descripcion: d.descripcion ?? null } }, { session });
      if (!r.matchedCount) return null;
      await db.collection('usuarios').updateMany({ 'maestro.oficio._id': id }, { $set: { 'maestro.oficio.nombre': d.nombre } }, { session });
      return { id_oficio: id, nombre: d.nombre, descripcion: d.descripcion ?? null };
    });
  },

  // MongoDB no tiene ON DELETE RESTRICT: se cuenta antes de borrar.
  async eliminar(id) {
    const usuarios = await coleccion('usuarios');
    if (await usuarios.countDocuments({ 'maestro.oficio._id': id }, { limit: 1 })) {
      throw conflicto('No se puede eliminar: hay maestros que ejercen este oficio.');
    }
    const oficios = await coleccion('oficios');
    const o = await oficios.findOneAndDelete({ _id: id });
    return o ? { id_oficio: o._id, nombre: o.nombre } : null;
  },
};
