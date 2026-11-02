import { coleccion, enTransaccion, siguiente } from '../config/mongo.js';
import { ErrorHttp, conflicto, noEncontrado, reglaDeNegocio } from '../utils/http.js';
import { TRANSICIONES, aDia, aFecha, hoyISO, primerNombre } from './reglas.js';

// Las solicitudes son su propia colección porque crecen sin límite. Cada una
// copia el nombre del cliente y del maestro (referencias extendidas) y guarda
// dentro su calificación (relación 1:0..1).

const ficha = (s) => ({
  id_solicitud: s.folio,
  fecha_solicitud: s.fecha_solicitud,
  fecha_servicio: aDia(s.fecha_servicio),
  estado: s.estado,
  descripcion: s.descripcion,
  direccion: s.direccion,
  rut_cliente: s.cliente._id,
  cliente: s.cliente.nombre,
  rut_maestro: s.maestro._id,
  maestro: s.maestro.nombre,
  puntuacion: s.calificacion?.puntuacion ?? null,
});

// Historial y bandeja: $lookup trae el teléfono del maestro, que no se copia
// porque cambia y solo se comparte cuando el maestro aceptó el trabajo.
export function pipelineHistorial({ cliente, maestro, estado } = {}) {
  const filtro = {};
  if (cliente) filtro['cliente._id'] = cliente;
  if (maestro) filtro['maestro._id'] = maestro;
  if (estado) filtro.estado = estado;
  return [
    { $match: filtro },
    { $sort: { fecha_solicitud: -1 } },
    { $limit: 200 },
    { $lookup: { from: 'usuarios', localField: 'maestro._id', foreignField: '_id', as: 'datos_maestro', pipeline: [{ $project: { _id: 0, telefono: 1 } }] } },
    { $set: { telefono_maestro: { $cond: [{ $in: ['$estado', ['Aceptada', 'Finalizada']] }, { $first: '$datos_maestro.telefono' }, null] } } },
    { $unset: 'datos_maestro' },
  ];
}

// Recalcula la reputación del maestro desde sus solicitudes calificadas ($group)
// y vuelve a llenar sus cinco reseñas más recientes.
export async function recalcularReputacion(db, rutMaestro, session) {
  const solicitudes = db.collection('solicitudes');
  const [totales] = await solicitudes.aggregate([
    { $match: { 'maestro._id': rutMaestro, calificacion: { $ne: null } } },
    { $group: { _id: '$maestro._id', total: { $sum: 1 }, suma: { $sum: '$calificacion.puntuacion' } } },
  ], { session }).toArray();
  const recientes = await solicitudes.find(
    { 'maestro._id': rutMaestro, calificacion: { $ne: null } },
    { sort: { 'calificacion.fecha': -1 }, limit: 5, session },
  ).toArray();
  const total = totales?.total ?? 0;
  const suma = totales?.suma ?? 0;
  await db.collection('usuarios').updateOne({ _id: rutMaestro }, {
    $set: {
      // Un decimal con la mitad hacia arriba, igual que ROUND(AVG(x), 1) de la Etapa I.
      'maestro.reputacion': { promedio: total ? Math.round((suma * 10) / total) / 10 : 0, total, suma },
      'maestro.resenas_recientes': recientes.map((s) => ({
        solicitud_id: s._id, puntuacion: s.calificacion.puntuacion, comentario: s.calificacion.comentario ?? null,
        cliente: primerNombre(s.cliente.nombre), fecha: s.calificacion.fecha,
      })),
    },
  }, { session });
}

export const Solicitud = {
  async listar(filtros = {}) {
    const solicitudes = await coleccion('solicitudes');
    const lista = await solicitudes.aggregate(pipelineHistorial(filtros)).toArray();
    return lista.map((s) => ({ ...ficha(s), telefono_maestro: s.telefono_maestro ?? null }));
  },

  async buscar(id) {
    const solicitudes = await coleccion('solicitudes');
    const s = await solicitudes.findOne({ folio: id });
    return s ? ficha(s) : null;
  },

  // La transacción del sistema: relaciona un cliente y un maestro en una nueva
  // solicitud. El folio sale de contadores y el estado inicial lo pone la API.
  async crear(d) {
    if (d.fecha_servicio < hoyISO()) {
      throw reglaDeNegocio('La fecha del servicio no puede estar en el pasado.', [
        { campo: 'fecha_servicio', mensaje: 'Elige hoy o una fecha futura.' },
      ]);
    }
    const usuarios = await coleccion('usuarios');
    const [cliente, maestro] = await Promise.all([
      usuarios.findOne({ _id: d.rut_cliente, roles: 'cliente' }, { projection: { nombre: 1 } }),
      usuarios.findOne({ _id: d.rut_maestro, roles: 'maestro' }, { projection: { nombre: 1, 'maestro.disponible': 1 } }),
    ]);
    if (!cliente) throw reglaDeNegocio('El cliente indicado no existe.', [{ campo: 'rut_cliente', mensaje: 'No existe.' }]);
    if (!maestro) throw reglaDeNegocio('El maestro indicado no existe.', [{ campo: 'rut_maestro', mensaje: 'No existe.' }]);
    if (!maestro.maestro.disponible) throw reglaDeNegocio('El maestro no está recibiendo solicitudes por ahora.');
    if (cliente._id === maestro._id) throw reglaDeNegocio('No puedes pedirte un servicio a ti mismo.');

    return enTransaccion(async (db, session) => {
      const doc = {
        folio: await siguiente(db, 'solicitudes', session),
        cliente: { _id: cliente._id, nombre: cliente.nombre },
        maestro: { _id: maestro._id, nombre: maestro.nombre },
        descripcion: d.descripcion,
        direccion: d.direccion,
        fecha_servicio: aFecha(d.fecha_servicio),
        estado: 'Pendiente',
        fecha_solicitud: new Date(),
        calificacion: null,
      };
      await db.collection('solicitudes').insertOne(doc, { session });
      return { id_solicitud: doc.folio, estado: doc.estado, fecha_solicitud: doc.fecha_solicitud };
    });
  },

  // El cliente puede cancelar; el maestro acepta, rechaza y marca como terminado.
  async cambiarEstado(id, nuevo, actor) {
    const actual = await this.buscar(id);
    if (!actual) throw noEncontrado(`No existe la solicitud ${id}.`);
    const quien = nuevo === 'Cancelada' ? actual.rut_cliente : actual.rut_maestro;
    if (actor.rut !== quien) {
      throw new ErrorHttp(403, 'SIN_PERMISO', nuevo === 'Cancelada'
        ? 'Solo el cliente que pidió el trabajo puede cancelarlo.'
        : 'Solo el maestro de esta solicitud puede cambiar su estado.');
    }
    if (!TRANSICIONES[actual.estado].includes(nuevo)) {
      throw reglaDeNegocio(`Una solicitud ${actual.estado.toLowerCase()} no puede pasar a ${nuevo.toLowerCase()}.`);
    }
    const solicitudes = await coleccion('solicitudes');
    // La condición sobre el estado actual evita pisar un cambio hecho entremedio.
    const r = await solicitudes.updateOne({ folio: id, estado: actual.estado }, { $set: { estado: nuevo } });
    if (!r.matchedCount) throw conflicto('La solicitud cambió mientras tanto. Recarga e inténtalo de nuevo.');
    return { id_solicitud: id, estado: nuevo };
  },

  // Moderación: borra la solicitud (su calificación se va con ella) y recalcula
  // la reputación del maestro, todo en una transacción.
  async eliminar(id) {
    return enTransaccion(async (db, session) => {
      const s = await db.collection('solicitudes').findOneAndDelete({ folio: id }, { session });
      if (!s) return null;
      if (s.calificacion) await recalcularReputacion(db, s.maestro._id, session);
      return { id_solicitud: s.folio, rut_maestro: s.maestro._id, estado: s.estado };
    });
  },
};
