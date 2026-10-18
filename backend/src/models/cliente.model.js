import { query } from '../config/db.js';
import { reglaDeNegocio } from '../utils/http.js';
import { esMayorDeEdad } from './reglas.js';

export const SQL = {
  // Consulta 8 · registro de un cliente.
  CREAR: `
INSERT INTO cliente (rut_cliente, nombre, email, telefono, fecha_nacimiento)
VALUES ($1, $2, $3, $4, $5)
RETURNING rut_cliente, nombre, fecha_registro`.trim(),

  LISTAR: `
SELECT c.rut_cliente, c.nombre, c.email,
       COUNT(s.id_solicitud) AS total_solicitudes
FROM cliente c
LEFT JOIN solicitud s ON s.rut_cliente = c.rut_cliente
GROUP BY c.rut_cliente
ORDER BY c.nombre`.trim(),

  BUSCAR: `
SELECT rut_cliente, nombre, email, telefono, fecha_nacimiento, fecha_registro
FROM cliente
WHERE rut_cliente = $1`.trim(),
};

export const Cliente = {
  async listar() {
    return (await query(SQL.LISTAR)).rows;
  },

  async buscar(rut) {
    return (await query(SQL.BUSCAR, [rut])).rows[0] ?? null;
  },

  // RF-05: solo mayores de 18 años. Se valida aquí (422 con mensaje claro)
  // y además la BD lo garantiza con ck_cliente_mayor_edad.
  async crear(d) {
    if (!esMayorDeEdad(d.fecha_nacimiento)) {
      throw reglaDeNegocio('Para registrarte debes ser mayor de 18 años.', [
        { campo: 'fecha_nacimiento', mensaje: 'Debes tener al menos 18 años.' },
      ]);
    }
    const valores = [d.rut_cliente, d.nombre, d.email, d.telefono ?? null, d.fecha_nacimiento];
    return (await query(SQL.CREAR, valores)).rows[0];
  },
};
