import { query } from '../config/db.js';

export const SQL = {
  LISTAR: `
SELECT o.id_oficio, o.nombre, o.descripcion,
       COUNT(m.rut_maestro) AS total_maestros
FROM oficio o
LEFT JOIN maestro m ON m.id_oficio = o.id_oficio
GROUP BY o.id_oficio
ORDER BY o.nombre`.trim(),

  BUSCAR: 'SELECT id_oficio, nombre, descripcion FROM oficio WHERE id_oficio = $1',

  CREAR: `
INSERT INTO oficio (nombre, descripcion)
VALUES ($1, $2)
RETURNING id_oficio, nombre, descripcion`.trim(),

  ACTUALIZAR: `
UPDATE oficio
SET nombre = $2, descripcion = $3
WHERE id_oficio = $1
RETURNING id_oficio, nombre, descripcion`.trim(),

  // Consulta 12 · si hay maestros con este oficio, ON DELETE RESTRICT lo impide.
  ELIMINAR: `
DELETE FROM oficio
WHERE id_oficio = $1
RETURNING id_oficio, nombre`.trim(),
};

export const Oficio = {
  async listar() {
    return (await query(SQL.LISTAR)).rows;
  },

  async buscar(id) {
    return (await query(SQL.BUSCAR, [id])).rows[0] ?? null;
  },

  async crear(d) {
    return (await query(SQL.CREAR, [d.nombre, d.descripcion ?? null])).rows[0];
  },

  async actualizar(id, d) {
    return (await query(SQL.ACTUALIZAR, [id, d.nombre, d.descripcion ?? null])).rows[0] ?? null;
  },

  async eliminar(id) {
    return (await query(SQL.ELIMINAR, [id])).rows[0] ?? null;
  },
};
