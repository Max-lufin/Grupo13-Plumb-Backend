import { Cliente } from '../models/cliente.model.js';
import { esquemas, validar } from '../validators/esquemas.js';
import { tieneRol } from '../middlewares/sesion.js';
import { ErrorHttp, noEncontrado, ok } from '../utils/http.js';

export async function listar(req, res) {
  res.json(ok(await Cliente.listar()));
}

export async function detalle(req, res) {
  const rut = validar(esquemas.rut, req.params.rut);
  if (req.usuario.rut !== rut && !tieneRol(req, 'administrador')) {
    throw new ErrorHttp(403, 'SIN_PERMISO', 'Solo puedes ver tu propia cuenta.');
  }
  const cliente = await Cliente.buscar(rut);
  if (!cliente) throw noEncontrado(`No existe un cliente con RUT ${rut}.`);
  res.json(ok(cliente));
}

export async function crear(req, res) {
  const datos = validar(esquemas.clienteNuevo, req.body);
  res.status(201).json(ok(await Cliente.crear(datos)));
}
