const db = require('../config/db');

const RegionModel = {
  getAll: async () => {
    const [rows] = await db.query('SELECT * FROM REGION');
    return rows;
  },
  getById: async (id) => {
    const [rows] = await db.query('SELECT * FROM REGION WHERE Id_region = ?', [id]);
    return rows[0];
  },
  create: async (data) => {
    const [result] = await db.query('INSERT INTO REGION (Nombre) VALUES (?)', [data.nombre]);
    return result;
  },
  update: async (id, data) => {
    const [result] = await db.query('UPDATE REGION SET Nombre = ? WHERE Id_region = ?', [data.nombre, id]);
    return result;
  },
  delete: async (id) => {
    const [result] = await db.query('DELETE FROM REGION WHERE Id_region = ?', [id]);
    return result;
  }
};

module.exports = RegionModel;