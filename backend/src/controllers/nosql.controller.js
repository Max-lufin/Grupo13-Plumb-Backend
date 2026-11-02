import { DUPLICADOS, Nosql, TRASPASO } from '../models/nosql.model.js';
import { ok } from '../utils/http.js';

export async function resumen(req, res) {
  const [estado, colecciones] = await Promise.all([Nosql.estado(), Nosql.colecciones()]);
  res.json(ok({ estado, traspaso: TRASPASO, duplicados: DUPLICADOS, colecciones }));
}
