import { DUPLICADOS, Nosql, TRASPASO } from '../models/nosql.model.js';
import { noEncontrado, ok } from '../utils/http.js';

export async function resumen(req, res) {
  const [estado, colecciones] = await Promise.all([Nosql.estado(), Nosql.colecciones()]);
  res.json(ok({ estado, traspaso: TRASPASO, duplicados: DUPLICADOS, colecciones }));
}

export async function consultas(req, res) {
  res.json(ok({ consultas: await Nosql.consultas(), pruebas: Nosql.pruebas() }));
}

// POST porque crea una "ejecución"; las escrituras se abortan (nada queda guardado).
export async function ejecutar(req, res) {
  const resultado = await Nosql.ejecutar(String(req.params.codigo).toUpperCase());
  if (!resultado) throw noEncontrado(`No existe la consulta ${req.params.codigo}. Son Q1 a Q5 y T1 a T3.`);
  res.status(201).json(ok(resultado));
}

export async function probar(req, res) {
  const resultado = await Nosql.probar(String(req.params.codigo).toUpperCase());
  if (!resultado) throw noEncontrado(`No existe la prueba ${req.params.codigo}. Van de N1 a N7.`);
  res.status(201).json(ok(resultado));
}
