import { query } from '../config/db.js';
import { reglaDeNegocio } from '../utils/http.js';
import { esMayorDeEdad } from './reglas.js';

// Las constantes SQL se exportan porque el laboratorio de consultas
// (consulta.model.js) ejecuta exactamente las mismas sentencias.
export const SQL = {
  // Consulta 3 · catálogo con 2 filtros obligatorios y 4 opcionales.
  // Un filtro opcional vale NULL cuando no se usa: ($n IS NULL OR ...).
  // Así hay una sola sentencia parametrizada y nunca se concatena SQL.
  CATALOGO: `
SELECT m.rut_maestro,
       m.nombre,
       o.nombre                     AS oficio,
       r.nombre                     AS region,
       m.tarifa_hora,
       m.experiencia_anios,
       m.disponible,
       COALESCE(v.promedio, 0)      AS promedio,
       COALESCE(v.total_resenas, 0) AS total_resenas
FROM maestro m
JOIN oficio o ON o.id_oficio = m.id_oficio
JOIN region r ON r.id_region = m.id_region
LEFT JOIN v_reputacion_maestro v ON v.rut_maestro = m.rut_maestro
WHERE m.id_region = $1
  AND m.id_oficio = $2
  AND ($3::int     IS NULL OR m.tarifa_hora <= $3)
  AND ($4::numeric IS NULL OR COALESCE(v.promedio, 0) >= $4)
  AND ($5::boolean IS NULL OR m.disponible = $5)
  AND ($6::int     IS NULL OR m.experiencia_anios >= $6)
ORDER BY promedio DESC, m.tarifa_hora`.trim(),

  // Consulta 5 · bandeja de entrada del maestro.
  BANDEJA: `
SELECT id_solicitud,
       descripcion,
       direccion,
       fecha_servicio,
       fecha_solicitud
FROM solicitud
WHERE rut_maestro = $1
  AND estado = $2
ORDER BY fecha_solicitud`.trim(),

  // Consulta 7 · cambio parcial: disponibilidad y/o tarifa.
  ACTUALIZAR_PARCIAL: `
UPDATE maestro
SET disponible  = COALESCE($2, disponible),
    tarifa_hora = COALESCE($3, tarifa_hora)
WHERE rut_maestro = $1
RETURNING rut_maestro, nombre, disponible, tarifa_hora`.trim(),

  // Consulta 9 · alta de un maestro.
  CREAR: `
INSERT INTO maestro (rut_maestro, nombre, email, telefono, fecha_nacimiento,
                     id_oficio, id_region, tarifa_hora, experiencia_anios, disponible, descripcion)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING rut_maestro, nombre, id_oficio, id_region`.trim(),

  LISTAR: `
SELECT m.rut_maestro, m.nombre, m.email, m.telefono, m.fecha_nacimiento,
       m.id_oficio, o.nombre AS oficio, m.id_region, r.nombre AS region,
       m.tarifa_hora, m.experiencia_anios, m.disponible, m.descripcion,
       COALESCE(v.promedio, 0) AS promedio, COALESCE(v.total_resenas, 0) AS total_resenas
FROM maestro m
JOIN oficio o ON o.id_oficio = m.id_oficio
JOIN region r ON r.id_region = m.id_region
LEFT JOIN v_reputacion_maestro v ON v.rut_maestro = m.rut_maestro
ORDER BY m.nombre`.trim(),

  // RF-06 · ranking por calificación promedio. Se exigen al menos 2 reseñas:
  // con una sola nota, un 5,0 no dice mucho.
  RANKING: `
SELECT m.rut_maestro, m.nombre, o.nombre AS oficio, r.nombre AS region,
       m.tarifa_hora, m.disponible, v.promedio, v.total_resenas
FROM v_reputacion_maestro v
JOIN maestro m ON m.rut_maestro = v.rut_maestro
JOIN oficio o ON o.id_oficio = m.id_oficio
JOIN region r ON r.id_region = m.id_region
WHERE v.total_resenas >= 2
ORDER BY v.promedio DESC, v.total_resenas DESC, m.nombre
LIMIT $1`.trim(),

  DETALLE: `
SELECT m.rut_maestro, m.nombre, m.telefono, m.descripcion,
       m.id_oficio, o.nombre AS oficio, m.id_region, r.nombre AS region,
       m.tarifa_hora, m.experiencia_anios, m.disponible, m.fecha_registro,
       COALESCE(v.promedio, 0) AS promedio, COALESCE(v.total_resenas, 0) AS total_resenas,
       (SELECT COUNT(*) FROM solicitud s
         WHERE s.rut_maestro = m.rut_maestro AND s.estado = 'Finalizada') AS trabajos_finalizados
FROM maestro m
JOIN oficio o ON o.id_oficio = m.id_oficio
JOIN region r ON r.id_region = m.id_region
LEFT JOIN v_reputacion_maestro v ON v.rut_maestro = m.rut_maestro
WHERE m.rut_maestro = $1`.trim(),

  RESENAS: `
SELECT c.id_calificacion, c.puntuacion, c.comentario, c.fecha,
       split_part(cl.nombre, ' ', 1) AS cliente
FROM calificacion c
JOIN solicitud s ON s.id_solicitud = c.id_solicitud
JOIN cliente cl ON cl.rut_cliente = s.rut_cliente
WHERE s.rut_maestro = $1
ORDER BY c.fecha DESC
LIMIT 20`.trim(),

  ACTUALIZAR: `
UPDATE maestro
SET nombre = $2, email = $3, telefono = $4, fecha_nacimiento = $5,
    id_oficio = $6, id_region = $7, tarifa_hora = $8,
    experiencia_anios = $9, disponible = $10, descripcion = $11
WHERE rut_maestro = $1
RETURNING rut_maestro, nombre`.trim(),

  ELIMINAR: `
DELETE FROM maestro
WHERE rut_maestro = $1
RETURNING rut_maestro, nombre`.trim(),
};

function exigirMayorDeEdad(fechaNacimiento) {
  if (!esMayorDeEdad(fechaNacimiento)) {
    throw reglaDeNegocio('El maestro debe ser mayor de 18 años.', [
      { campo: 'fecha_nacimiento', mensaje: 'Debe tener al menos 18 años.' },
    ]);
  }
}

const valoresFicha = (d) => [
  d.nombre, d.email, d.telefono, d.fecha_nacimiento, d.id_oficio, d.id_region,
  d.tarifa_hora, d.experiencia_anios, d.disponible, d.descripcion ?? null,
];

export const Maestro = {
  async catalogo(f) {
    const valores = [f.region, f.oficio, f.tarifaMax ?? null, f.calificacionMin ?? null,
      f.disponible ?? null, f.experienciaMin ?? null];
    return (await query(SQL.CATALOGO, valores)).rows;
  },

  async listar() {
    return (await query(SQL.LISTAR)).rows;
  },

  async ranking(limite = 6) {
    return (await query(SQL.RANKING, [limite])).rows;
  },

  async buscar(rut) {
    return (await query(SQL.DETALLE, [rut])).rows[0] ?? null;
  },

  async resenas(rut) {
    return (await query(SQL.RESENAS, [rut])).rows;
  },

  async bandeja(rut, estado = 'Pendiente') {
    return (await query(SQL.BANDEJA, [rut, estado])).rows;
  },

  async crear(d) {
    exigirMayorDeEdad(d.fecha_nacimiento);
    return (await query(SQL.CREAR, [d.rut_maestro, ...valoresFicha(d)])).rows[0];
  },

  async actualizar(rut, d) {
    exigirMayorDeEdad(d.fecha_nacimiento);
    return (await query(SQL.ACTUALIZAR, [rut, ...valoresFicha(d)])).rows[0] ?? null;
  },

  async actualizarParcial(rut, d) {
    const valores = [rut, d.disponible ?? null, d.tarifa_hora ?? null];
    return (await query(SQL.ACTUALIZAR_PARCIAL, valores)).rows[0] ?? null;
  },

  async eliminar(rut) {
    return (await query(SQL.ELIMINAR, [rut])).rows[0] ?? null;
  },
};
