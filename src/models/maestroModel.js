const db = require('../config/db');

const MaestroModel = {
  getAll: async () => {
    const [rows] = await db.query('SELECT * FROM MAESTRO WHERE Disponibilidad = TRUE');
    return rows;
  },
  getById: async (rut) => {
    const [rows] = await db.query('SELECT * FROM MAESTRO WHERE Rut = ?', [rut]);
    return rows[0];
  },
  buscar: async (region, especialidad, calificacion, disponibilidad) => {
    let query = `
      SELECT M.*, O.Nombre AS nombre_oficio, R.Nombre AS nombre_region, IFNULL(AVG(C.puntuacion), 0) AS calificacion_promedio
      FROM MAESTRO M
      JOIN OFICIO O ON M.Id_oficio = O.Id_oficio
      JOIN REGION R ON M.Id_region = R.Id_region
      LEFT JOIN CALIFICACION C ON M.Rut = C.Rut_maestro
      WHERE R.Id_region = ? AND O.Id_oficio = ?
    `;
    const params = [region, especialidad];

    if (disponibilidad !== undefined) {
      query += ' AND M.Disponibilidad = ?';
      params.push(disponibilidad);
    }

    query += ' GROUP BY M.Rut';

    if (calificacion) {
      query += ' HAVING calificacion_promedio >= ?';
      params.push(calificacion);
    }

    const [rows] = await db.query(query, params);
    return rows;
  },
  create: async (data) => {
    const { rut, nombre, id_region, id_oficio, disponibilidad } = data;
    // Default disponibilidad to true if not provided
    const disp = disponibilidad !== undefined ? disponibilidad : true;
    const [result] = await db.query(
      'INSERT INTO MAESTRO (Rut, Nombre, Id_region, Id_oficio, Disponibilidad) VALUES (?, ?, ?, ?, ?)',
      [rut, nombre, id_region, id_oficio, disp]
    );
    return result;
  },
  update: async (rut, data) => {
    const { nombre, id_region, id_oficio, disponibilidad } = data;
    const [result] = await db.query(
      'UPDATE MAESTRO SET Nombre = ?, Id_region = ?, Id_oficio = ?, Disponibilidad = ? WHERE Rut = ?',
      [nombre, id_region, id_oficio, disponibilidad, rut]
    );
    return result;
  },
  delete: async (rut) => {
    const [result] = await db.query('DELETE FROM MAESTRO WHERE Rut = ?', [rut]);
    return result;
  }
};

module.exports = MaestroModel;