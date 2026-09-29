const db = require('../config/db');

const CalificacionModel = {
  getAll: async () => {
    const [rows] = await db.query('SELECT * FROM CALIFICACION');
    return rows;
  },
  getById: async (id) => {
    const [rows] = await db.query('SELECT * FROM CALIFICACION WHERE Id_calificacion = ?', [id]);
    return rows[0];
  },
  create: async (data) => {
    const { rut_maestro, rut_cliente, id_solicitud, puntuacion, comentario, fecha } = data;
    const [result] = await db.query(
      'INSERT INTO CALIFICACION (Rut_maestro, Rut_cliente, Id_solicitud, puntuacion, Comentario, Fecha) VALUES (?, ?, ?, ?, ?, ?)',
      [rut_maestro, rut_cliente, id_solicitud, puntuacion, comentario || null, fecha]
    );
    return result;
  },
  update: async (id, data) => {
    const [result] = await db.query(
      'UPDATE CALIFICACION SET puntuacion = ?, Comentario = ? WHERE Id_calificacion = ?',
      [data.puntuacion, data.comentario || null, id]
    );
    return result;
  },
  delete: async (id) => {
    const [result] = await db.query('DELETE FROM CALIFICACION WHERE Id_calificacion = ?', [id]);
    return result;
  }
};

module.exports = CalificacionModel;