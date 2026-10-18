import { Consulta } from '../models/consulta.model.js';
import { noEncontrado, ok } from '../utils/http.js';

export function listar(req, res) {
  res.json(ok(Consulta.listar()));
}

export function detalle(req, res) {
  const consulta = Consulta.buscar(Number(req.params.numero));
  if (!consulta) throw noEncontrado(`No existe la consulta ${req.params.numero}. Van de la 1 a la 13.`);
  res.json(ok(consulta));
}

// POST porque crea una "ejecución"; aun así nada queda guardado (ROLLBACK).
export async function ejecutar(req, res) {
  const resultado = await Consulta.ejecutar(Number(req.params.numero));
  if (!resultado) throw noEncontrado(`No existe la consulta ${req.params.numero}. Van de la 1 a la 13.`);
  res.status(201).json(ok(resultado));
}

export async function probarIntegridad(req, res) {
  const resultado = await Consulta.probar(String(req.params.codigo).toUpperCase());
  if (!resultado) throw noEncontrado(`No existe la prueba ${req.params.codigo}. Van de R1 a R6.`);
  res.status(201).json(ok(resultado));
}
