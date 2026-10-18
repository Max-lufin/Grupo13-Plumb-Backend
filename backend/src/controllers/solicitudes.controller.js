import { Calificacion } from '../models/calificacion.model.js';
import { Solicitud } from '../models/solicitud.model.js';
import { esquemas, validar } from '../validators/esquemas.js';
import { cronometro, noEncontrado, ok } from '../utils/http.js';

export async function listar(req, res) {
  const filtros = validar(esquemas.filtrosSolicitudes, req.query);
  const medir = cronometro();
  const solicitudes = await Solicitud.listar(filtros);
  res.json(ok(solicitudes, { total: solicitudes.length, ms: medir(), consulta: 4 }));
}

export async function detalle(req, res) {
  const id = validar(esquemas.id, req.params.id);
  const solicitud = await Solicitud.buscar(id);
  if (!solicitud) throw noEncontrado(`No existe la solicitud ${id}.`);
  res.json(ok(solicitud));
}

export async function crear(req, res) {
  const datos = validar(esquemas.solicitudNueva, req.body);
  const solicitud = await Solicitud.crear(datos);
  res.status(201).location(`/api/v1/solicitudes/${solicitud.id_solicitud}`).json(ok(solicitud));
}

export async function cambiarEstado(req, res) {
  const id = validar(esquemas.id, req.params.id);
  const { estado } = validar(esquemas.cambioEstado, req.body);
  res.json(ok(await Solicitud.cambiarEstado(id, estado)));
}

export async function eliminar(req, res) {
  const id = validar(esquemas.id, req.params.id);
  const solicitud = await Solicitud.eliminar(id);
  if (!solicitud) throw noEncontrado(`No existe la solicitud ${id}.`);
  res.json(ok(solicitud));
}

export async function calificar(req, res) {
  const id = validar(esquemas.id, req.params.id);
  const datos = validar(esquemas.calificacionNueva, req.body);
  res.status(201).json(ok(await Calificacion.crear(id, datos)));
}
