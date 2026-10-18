import { Cliente } from '../models/cliente.model.js';
import { esquemas, validar } from '../validators/esquemas.js';
import { noEncontrado, ok } from '../utils/http.js';

export async function listar(req, res) {
  res.json(ok(await Cliente.listar()));
}

export async function detalle(req, res) {
  const rut = validar(esquemas.rut, req.params.rut);
  const cliente = await Cliente.buscar(rut);
  if (!cliente) throw noEncontrado(`No existe un cliente con RUT ${rut}.`);
  res.json(ok(cliente));
}

export async function crear(req, res) {
  const datos = validar(esquemas.clienteNuevo, req.body);
  res.status(201).json(ok(await Cliente.crear(datos)));
}
