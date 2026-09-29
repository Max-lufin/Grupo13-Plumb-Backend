const db = require('../config/db');

const SolicitudModel = {
  getAll: async () => {
    const [rows] = await db.query(`
      SELECT S.*, C.Nombre as cliente_nombre, M.Nombre as maestro_nombre
      FROM SOLICITUD S
      JOIN CLIENTE C ON S.Rut_cliente = C.Rut
      JOIN MAESTRO M ON S.Rut_maestro = M.Rut
    `);
    return rows;
  },
  getById: async (id) => {
    const [rows] = await db.query('SELECT * FROM SOLICITUD WHERE Id_solicitud = ?', [id]);
    return rows[0];
  },
  create: async (data) => {
    const { rut_cliente, rut_maestro, fecha, estado, descripcion } = data;
    const [result] = await db.query(
      'INSERT INTO SOLICITUD (Rut_cliente, Rut_maestro, Fecha, Estado, Descripcion) VALUES (?, ?, ?, ?, ?)',
      [rut_cliente, rut_maestro, fecha, estado || 'Pendiente', descripcion || 'Sin descripción']
    );
    return result;
  },
  updateEstado: async (id, estado) => {
    const [result] = await db.query('UPDATE SOLICITUD SET Estado = ? WHERE Id_solicitud = ?', [estado, id]);
    return result;
  },
  delete: async (id) => {
    const [result] = await db.query('DELETE FROM SOLICITUD WHERE Id_solicitud = ?', [id]);
    return result;
  }
};

module.exports = SolicitudModel;