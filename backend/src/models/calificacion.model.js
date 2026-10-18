import { query } from '../config/db.js';
import { noEncontrado, reglaDeNegocio } from '../utils/http.js';

export const SQL = {
  ESTADO_SOLICITUD: 'SELECT estado FROM solicitud WHERE id_solicitud = $1',

  // Si la solicitud ya tiene nota, el UNIQUE (uq_calificacion_solicitud) la rechaza.
  CREAR: `
INSERT INTO calificacion (id_solicitud, puntuacion, comentario)
VALUES ($1, $2, $3)
RETURNING id_calificacion, id_solicitud, puntuacion, comentario, fecha`.trim(),
};

export const Calificacion = {
  async crear(idSolicitud, d) {
    const solicitud = (await query(SQL.ESTADO_SOLICITUD, [idSolicitud])).rows[0];
    if (!solicitud) throw noEncontrado(`No existe la solicitud ${idSolicitud}.`);
    if (solicitud.estado !== 'Finalizada') {
      throw reglaDeNegocio('Solo se puede calificar un trabajo finalizado.');
    }
    return (await query(SQL.CREAR, [idSolicitud, d.puntuacion, d.comentario ?? null])).rows[0];
  },
};
