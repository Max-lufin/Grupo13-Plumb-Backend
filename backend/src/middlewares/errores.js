import { ErrorHttp } from '../utils/http.js';

// Traduce las restricciones de la BD a mensajes que una persona entiende.
// La clave es el nombre de la restricción definido en 01_esquema.sql.
const MENSAJES = {
  ck_cliente_mayor_edad: 'El cliente debe ser mayor de 18 años.',
  ck_maestro_mayor_edad: 'El maestro debe ser mayor de 18 años.',
  ck_cliente_rut: 'El RUT debe tener el formato 12345678-5.',
  ck_maestro_rut: 'El RUT debe tener el formato 12345678-5.',
  ck_cliente_email: 'El correo no tiene un formato válido.',
  ck_maestro_email: 'El correo no tiene un formato válido.',
  ck_maestro_tarifa: 'La tarifa debe ser mayor que cero.',
  ck_maestro_tarifa_max: 'La tarifa no puede superar $150.000 por hora.',
  ck_maestro_experiencia: 'Los años de experiencia deben estar entre 0 y 60.',
  ck_solicitud_estado: 'Ese estado de solicitud no existe.',
  ck_solicitud_descripcion: 'Describe el trabajo con al menos 15 caracteres.',
  ck_calificacion_puntuacion: 'La puntuación debe estar entre 1 y 5.',
  uq_calificacion_solicitud: 'Esta solicitud ya fue calificada.',
  cliente_pkey: 'Ya existe un cliente con ese RUT.',
  cliente_email_key: 'Ese correo ya está registrado.',
  maestro_pkey: 'Ya existe un maestro con ese RUT.',
  maestro_email_key: 'Ese correo ya está registrado por otro maestro.',
  oficio_nombre_key: 'Ya existe un oficio con ese nombre.',
};

const AL_BORRAR = {
  fk_maestro_oficio: 'No se puede eliminar: hay maestros que ejercen este oficio.',
  fk_maestro_region: 'No se puede eliminar: hay maestros en esta región.',
  fk_solicitud_cliente: 'No se puede eliminar: el cliente tiene solicitudes en su historial.',
  fk_solicitud_maestro: 'No se puede eliminar: el maestro tiene solicitudes en su historial.',
};

const AL_INSERTAR = {
  fk_maestro_oficio: 'El oficio indicado no existe.',
  fk_maestro_region: 'La región indicada no existe.',
  fk_solicitud_cliente: 'El cliente indicado no existe.',
  fk_solicitud_maestro: 'El maestro indicado no existe.',
  fk_calificacion_solicitud: 'La solicitud indicada no existe.',
};

function desdePostgres(error) {
  const restriccion = error.constraint;
  switch (error.code) {
    case '23505': // unique_violation
    case '23514': // check_violation
      return new ErrorHttp(422, 'REGLA_DE_NEGOCIO', MENSAJES[restriccion] ?? 'Los datos no cumplen una regla del sistema.',
        [{ campo: null, mensaje: `Restricción ${restriccion}` }]);
    case '23503': // foreign_key_violation
      if (/still referenced/.test(error.detail ?? '')) {
        return new ErrorHttp(409, 'CONFLICTO', AL_BORRAR[restriccion] ?? 'El registro está en uso y no se puede eliminar.');
      }
      return new ErrorHttp(422, 'REGLA_DE_NEGOCIO', AL_INSERTAR[restriccion] ?? 'Un registro relacionado no existe.');
    case '42701': // duplicate_column (ALTER ya aplicado)
    case '42710': // duplicate_object
      return new ErrorHttp(409, 'CONFLICTO', 'El cambio de estructura ya estaba aplicado en esta base de datos.');
    case '57014': // query_canceled por statement_timeout
      return new ErrorHttp(503, 'TIEMPO_AGOTADO', 'La base de datos tardó demasiado en responder.');
    default:
      return null;
  }
}

export function rutaNoEncontrada(req, res) {
  res.status(404).json({
    ok: false,
    error: { codigo: 'NO_ENCONTRADO', mensaje: `No existe la ruta ${req.method} ${req.originalUrl}.` },
  });
}

// eslint-disable-next-line no-unused-vars
export function manejarErrores(error, req, res, next) {
  let http = error instanceof ErrorHttp ? error : desdePostgres(error);

  if (!http && error.type === 'entity.parse.failed') {
    http = new ErrorHttp(400, 'JSON_INVALIDO', 'El cuerpo de la petición no es un JSON válido.');
  }

  if (!http) {
    // Error inesperado: el detalle va al registro del servidor, nunca al usuario.
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
    http = new ErrorHttp(500, 'ERROR_INTERNO', 'Algo falló de nuestro lado. Intenta de nuevo en un momento.');
  }

  const cuerpo = { codigo: http.codigo, mensaje: http.message };
  if (http.detalles) cuerpo.detalles = http.detalles;
  res.status(http.status).json({ ok: false, error: cuerpo });
}
