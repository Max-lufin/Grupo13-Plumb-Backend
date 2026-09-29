const db = require('../config/db');

const ClienteModel = {
  getAll: async () => {
    const [rows] = await db.query('SELECT * FROM CLIENTE');
    return rows;
  },
  getById: async (rut) => {
    const [rows] = await db.query('SELECT * FROM CLIENTE WHERE Rut = ?', [rut]);
    return rows[0];
  },
  create: async (data) => {
    const { rut, nombre, fecha_nacimiento, telefono } = data;
    const [result] = await db.query('INSERT INTO CLIENTE (Rut, Nombre, fecha_nacimiento, Telefono) VALUES (?, ?, ?, ?)', [rut, nombre, fecha_nacimiento || null, telefono || null]);
    return result;
  },
  update: async (rut, data) => {
    const { nombre, fecha_nacimiento, telefono } = data;
    const [result] = await db.query('UPDATE CLIENTE SET Nombre = ?, fecha_nacimiento = ?, Telefono = ? WHERE Rut = ?', [nombre, fecha_nacimiento || null, telefono || null, rut]);
    return result;
  },
  delete: async (rut) => {
    const [result] = await db.query('DELETE FROM CLIENTE WHERE Rut = ?', [rut]);
    return result;
  }
};

module.exports = ClienteModel;