import { coleccion, enTransaccion } from '../config/mongo.js';
import { ErrorHttp, noEncontrado, reglaDeNegocio } from '../utils/http.js';
import { primerNombre } from './reglas.js';

// La calificación vive dentro de su solicitud. Al calificar se actualizan dos
// documentos en una transacción: la solicitud y la reputación del maestro.
export const Calificacion = {
  async crear(id, d, actor) {
    const solicitudes = await coleccion('solicitudes');
    const s = await solicitudes.findOne({ folio: id }, { projection: { cliente: 1, maestro: 1, estado: 1, calificacion: 1 } });
    if (!s) throw noEncontrado(`No existe la solicitud ${id}.`);
    if (s.cliente._id !== actor.rut) throw new ErrorHttp(403, 'SIN_PERMISO', 'Solo el cliente que pidió el trabajo puede calificarlo.');
    if (s.estado !== 'Finalizada') throw reglaDeNegocio('Solo se puede calificar un trabajo finalizado.');
    if (s.calificacion) throw reglaDeNegocio('Esta solicitud ya fue calificada.');

    const nota = { puntuacion: d.puntuacion, comentario: d.comentario ?? null, fecha: new Date() };
    const resena = { solicitud_id: s._id, ...nota, cliente: primerNombre(s.cliente.nombre) };

    return enTransaccion(async (db, session) => {
      // El filtro calificacion: null impide una segunda nota (equivale al UNIQUE de la Etapa I).
      const r = await db.collection('solicitudes').updateOne({ _id: s._id, calificacion: null }, { $set: { calificacion: nota } }, { session });
      if (!r.matchedCount) throw reglaDeNegocio('Esta solicitud ya fue calificada.');
      await db.collection('usuarios').updateOne({ _id: s.maestro._id }, [
        {
          $set: {
            'maestro.reputacion.total': { $add: ['$maestro.reputacion.total', 1] },
            'maestro.reputacion.suma': { $add: ['$maestro.reputacion.suma', nota.puntuacion] },
            // Patrón subconjunto: la nueva reseña entra primero y se conservan 5.
            'maestro.resenas_recientes': { $slice: [{ $concatArrays: [{ $literal: [resena] }, '$maestro.resenas_recientes'] }, 5] },
          },
        },
        // Un decimal con la mitad hacia arriba ($round redondea al par).
        { $set: { 'maestro.reputacion.promedio': { $divide: [{ $floor: { $add: [{ $divide: [{ $multiply: ['$maestro.reputacion.suma', 10] }, '$maestro.reputacion.total'] }, 0.5] } }, 10] } } },
      ], { session });
      return { id_solicitud: id, ...nota };
    });
  },
};
