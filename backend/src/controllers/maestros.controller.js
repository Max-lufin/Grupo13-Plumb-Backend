import { Maestro } from '../models/maestro.model.js';
import { esquemas, validar } from '../validators/esquemas.js';
import { cronometro, noEncontrado, ok } from '../utils/http.js';

// Controladores: leen la petición, llaman al modelo y eligen la respuesta.
// No contienen SQL ni reglas de negocio.

export async function catalogo(req, res) {
  const filtros = validar(esquemas.filtrosCatalogo, req.query);
  const medir = cronometro();
  const maestros = await Maestro.catalogo(filtros);
  res.json(ok(maestros, { total: maestros.length, ms: medir(), consulta: 3, filtros }));
}

export async function ranking(req, res) {
  const limite = Math.min(Number(req.query.limite) || 6, 24);
  res.json(ok(await Maestro.ranking(limite)));
}

export async function listar(req, res) {
  const maestros = await Maestro.listar();
  res.json(ok(maestros, { total: maestros.length }));
}

export async function detalle(req, res) {
  const rut = validar(esquemas.rut, req.params.rut);
  const maestro = await Maestro.buscar(rut);
  if (!maestro) throw noEncontrado(`No existe un maestro con RUT ${rut}.`);
  maestro.resenas = await Maestro.resenas(rut);
  res.json(ok(maestro));
}

export async function bandeja(req, res) {
  const rut = validar(esquemas.rut, req.params.rut);
  const { estado = 'Pendiente' } = validar(esquemas.filtrosSolicitudes, { estado: req.query.estado });
  const medir = cronometro();
  const solicitudes = await Maestro.bandeja(rut, estado);
  res.json(ok(solicitudes, { total: solicitudes.length, ms: medir(), consulta: 5 }));
}

export async function crear(req, res) {
  const datos = validar(esquemas.maestroNuevo, req.body);
  res.status(201).json(ok(await Maestro.crear(datos)));
}

export async function reemplazar(req, res) {
  const rut = validar(esquemas.rut, req.params.rut);
  const { rut_maestro, ...datos } = validar(esquemas.maestroNuevo, { ...req.body, rut_maestro: rut });
  const maestro = await Maestro.actualizar(rut_maestro, datos);
  if (!maestro) throw noEncontrado(`No existe un maestro con RUT ${rut}.`);
  res.json(ok(maestro));
}

export async function modificar(req, res) {
  const rut = validar(esquemas.rut, req.params.rut);
  const cambios = validar(esquemas.maestroCambios, req.body);
  const maestro = await Maestro.actualizarParcial(rut, cambios);
  if (!maestro) throw noEncontrado(`No existe un maestro con RUT ${rut}.`);
  res.json(ok(maestro));
}

export async function eliminar(req, res) {
  const rut = validar(esquemas.rut, req.params.rut);
  const maestro = await Maestro.eliminar(rut);
  if (!maestro) throw noEncontrado(`No existe un maestro con RUT ${rut}.`);
  res.json(ok(maestro));
}
