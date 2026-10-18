import { query } from '../config/db.js';
import { conflicto, noEncontrado, reglaDeNegocio } from '../utils/http.js';
import { hoyISO, TRANSICIONES } from './reglas.js';

export const SQL = {
  // Consulta 4 · historial: Solicitud ⨝ Cliente ⨝ Maestro, más la
  // calificación si existe (relación 1:1 opcional, por eso LEFT JOIN).
  LISTAR: `
SELECT s.id_solicitud,
       s.fecha_solicitud,
       s.fecha_servicio,
       s.estado,
       s.descripcion,
       s.direccion,
       c.rut_cliente,
       c.nombre       AS cliente,
       m.rut_maestro,
       m.nombre       AS maestro,
       k.puntuacion
FROM solicitud s
JOIN cliente c ON c.rut_cliente = s.rut_cliente
JOIN maestro m ON m.rut_maestro = s.rut_maestro
LEFT JOIN calificacion k ON k.id_solicitud = s.id_solicitud
WHERE ($1::varchar IS NULL OR s.rut_cliente = $1)
  AND ($2::varchar IS NULL OR s.rut_maestro = $2)
  AND ($3::varchar IS NULL OR s.estado = $3)
ORDER BY s.fecha_solicitud DESC
LIMIT 200`.trim(),

  // Consulta 10 · la transacción: vincula un cliente y un maestro en una
  // nueva solicitud. El estado 'Pendiente' lo pone el DEFAULT de la columna.
  CREAR: `
INSERT INTO solicitud (rut_cliente, rut_maestro, descripcion, direccion, fecha_servicio)
VALUES ($1, $2, $3, $4, $5)
RETURNING id_solicitud, estado, fecha_solicitud`.trim(),

  // Consulta 6 · cambio de estado. La condición "estado = $3" asegura que
  // nadie cambió la solicitud entre la lectura y la escritura.
  CAMBIAR_ESTADO: `
UPDATE solicitud
SET estado = $2
WHERE id_solicitud = $1
  AND estado = $3
RETURNING id_solicitud, estado`.trim(),

  // Consulta 11 · moderación. ON DELETE CASCADE borra también su calificación.
  ELIMINAR: `
DELETE FROM solicitud
WHERE id_solicitud = $1
RETURNING id_solicitud, rut_maestro, estado`.trim(),

  BUSCAR: `
SELECT s.id_solicitud, s.rut_cliente, s.rut_maestro, s.descripcion, s.direccion,
       s.fecha_servicio, s.estado, s.fecha_solicitud,
       c.nombre AS cliente, m.nombre AS maestro, m.disponible
FROM solicitud s
JOIN cliente c ON c.rut_cliente = s.rut_cliente
JOIN maestro m ON m.rut_maestro = s.rut_maestro
WHERE s.id_solicitud = $1`.trim(),

  DISPONIBILIDAD_MAESTRO: 'SELECT disponible FROM maestro WHERE rut_maestro = $1',
};

export const Solicitud = {
  async listar({ cliente, maestro, estado } = {}) {
    return (await query(SQL.LISTAR, [cliente ?? null, maestro ?? null, estado ?? null])).rows;
  },

  async buscar(id) {
    return (await query(SQL.BUSCAR, [id])).rows[0] ?? null;
  },

  async crear(d) {
    if (d.fecha_servicio < hoyISO()) {
      throw reglaDeNegocio('La fecha del servicio no puede estar en el pasado.', [
        { campo: 'fecha_servicio', mensaje: 'Elige hoy o una fecha futura.' },
      ]);
    }
    const maestro = (await query(SQL.DISPONIBILIDAD_MAESTRO, [d.rut_maestro])).rows[0];
    if (!maestro) {
      throw reglaDeNegocio('El maestro indicado no existe.', [{ campo: 'rut_maestro', mensaje: 'No existe.' }]);
    }
    if (!maestro.disponible) {
      throw reglaDeNegocio('El maestro no está recibiendo solicitudes por ahora.');
    }
    const valores = [d.rut_cliente, d.rut_maestro, d.descripcion, d.direccion, d.fecha_servicio];
    return (await query(SQL.CREAR, valores)).rows[0];
  },

  async cambiarEstado(id, nuevo) {
    const actual = await this.buscar(id);
    if (!actual) throw noEncontrado(`No existe la solicitud ${id}.`);
    if (!TRANSICIONES[actual.estado].includes(nuevo)) {
      throw reglaDeNegocio(`Una solicitud ${actual.estado.toLowerCase()} no puede pasar a ${nuevo.toLowerCase()}.`);
    }
    const fila = (await query(SQL.CAMBIAR_ESTADO, [id, nuevo, actual.estado])).rows[0];
    if (!fila) throw conflicto('La solicitud cambió mientras tanto. Recarga e inténtalo de nuevo.');
    return fila;
  },

  async eliminar(id) {
    return (await query(SQL.ELIMINAR, [id])).rows[0] ?? null;
  },
};
