import { Calificacion } from '../models/calificacion.model.js';
import { Solicitud } from '../models/solicitud.model.js';
import { tieneRol } from '../middlewares/sesion.js';
import { esquemas, validar } from '../validators/esquemas.js';
import { ErrorHttp, cronometro, noEncontrado, ok } from '../utils/http.js';

const sinPermiso = (mensaje) => new ErrorHttp(403, 'SIN_PERMISO', mensaje);

// El administrador ve todas; cada cliente y maestro, solo las suyas.
export async function listar(req, res) {
  const filtros = validar(esquemas.filtrosSolicitudes, req.query);
  if (!tieneRol(req, 'administrador')) {
    const propia = filtros.cliente === req.usuario.rut || filtros.maestro === req.usuario.rut;
    if (!propia) throw sinPermiso('Solo puedes ver tus propias solicitudes.');
  }
  const medir = cronometro();
  const solicitudes = await Solicitud.listar(filtros);
  res.json(ok(solicitudes, { total: solicitudes.length, ms: medir() }));
}

export async function detalle(req, res) {
  const id = validar(esquemas.id, req.params.id);
  const solicitud = await Solicitud.buscar(id);
  if (!solicitud) throw noEncontrado(`No existe la solicitud ${id}.`);
  const participa = [solicitud.rut_cliente, solicitud.rut_maestro].includes(req.usuario.rut);
  if (!participa && !tieneRol(req, 'administrador')) throw sinPermiso('Esta solicitud no es tuya.');
  res.json(ok(solicitud));
}

// El cliente de la solicitud es siempre quien inició sesión, no lo que diga el cuerpo.
export async function crear(req, res) {
  const datos = validar(esquemas.solicitudNueva, { ...req.body, rut_cliente: req.usuario.rut });
  const solicitud = await Solicitud.crear(datos);
  res.status(201).location(`/api/v1/solicitudes/${solicitud.id_solicitud}`).json(ok(solicitud));
}

export async function cambiarEstado(req, res) {
  const id = validar(esquemas.id, req.params.id);
  const { estado } = validar(esquemas.cambioEstado, req.body);
  res.json(ok(await Solicitud.cambiarEstado(id, estado, req.usuario)));
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
  res.status(201).json(ok(await Calificacion.crear(id, datos, req.usuario)));
}
