const db = require('../config/db');

const OficioModel = {
  getAll: async () => {
    const [rows] = await db.query('SELECT * FROM OFICIO');
    return rows;
  },
  getById: async (id) => {
    const [rows] = await db.query('SELECT * FROM OFICIO WHERE Id_oficio = ?', [id]);
    return rows[0];
  },
  create: async (data) => {
    const [result] = await db.query('INSERT INTO OFICIO (Nombre, Descripcion) VALUES (?, ?)', [data.nombre, data.descripcion || null]);
    return result;
  },
  update: async (id, data) => {
    const [result] = await db.query('UPDATE OFICIO SET Nombre = ?, Descripcion = ? WHERE Id_oficio = ?', [data.nombre, data.descripcion || null, id]);
    return result;
  },
  delete: async (id) => {
    const [result] = await db.query('DELETE FROM OFICIO WHERE Id_oficio = ?', [id]);
    return result;
  }
};

module.exports = OficioModel;