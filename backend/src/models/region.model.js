import { query } from '../config/db.js';

export const Region = {
  async listar() {
    return (await query('SELECT id_region, codigo, nombre FROM region ORDER BY id_region')).rows;
  },
};
