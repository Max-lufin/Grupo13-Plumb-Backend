import { Oficio } from '../models/oficio.model.js';
import { esquemas, validar } from '../validators/esquemas.js';
import { noEncontrado, ok } from '../utils/http.js';

// Mantenedor 2: oficios (categorías de servicio).

export async function listar(req, res) {
  res.json(ok(await Oficio.listar()));
}

export async function detalle(req, res) {
  const id = validar(esquemas.id, req.params.id);
  const oficio = await Oficio.buscar(id);
  if (!oficio) throw noEncontrado(`No existe el oficio ${id}.`);
  res.json(ok(oficio));
}

export async function crear(req, res) {
  const datos = validar(esquemas.oficio, req.body);
  res.status(201).json(ok(await Oficio.crear(datos)));
}

export async function reemplazar(req, res) {
  const id = validar(esquemas.id, req.params.id);
  const datos = validar(esquemas.oficio, req.body);
  const oficio = await Oficio.actualizar(id, datos);
  if (!oficio) throw noEncontrado(`No existe el oficio ${id}.`);
  res.json(ok(oficio));
}

export async function eliminar(req, res) {
  const id = validar(esquemas.id, req.params.id);
  const oficio = await Oficio.eliminar(id);
  if (!oficio) throw noEncontrado(`No existe el oficio ${id}.`);
  res.json(ok(oficio));
}
