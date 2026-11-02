import { ErrorHttp } from '../utils/http.js';

// Traduce los errores de MongoDB a mensajes que una persona entiende.
// Índice único violado: la clave es el campo del índice.
const DUPLICADO = {
  email: ['email', 'Ese correo ya está registrado.'],
  _id: ['rut', 'Ya existe una cuenta con ese RUT.'],
  nombre: ['nombre', 'Ya existe un oficio con ese nombre.'],
  folio: [null, 'El folio ya fue usado. Inténtalo de nuevo.'],
};

function desdeMongo(error) {
  if (error.code === 11000) {
    const campo = Object.keys(error.keyPattern ?? {})[0];
    const [nombre, mensaje] = DUPLICADO[campo] ?? [null, 'Ya existe un registro con esos datos.'];
    return new ErrorHttp(409, 'CONFLICTO', mensaje, nombre ? [{ campo: nombre, mensaje }] : undefined);
  }
  // El validador de la colección rechazó el documento. La API valida antes,
  // así que esto solo ocurre si una regla quedó solo en la base de datos.
  if (error.code === 121) {
    return new ErrorHttp(422, 'REGLA_DE_NEGOCIO', 'Los datos no cumplen las reglas de la base de datos.');
  }
  if (/^Mongo(ServerSelection|Network|Topology)/.test(error.name ?? '')) {
    return new ErrorHttp(503, 'BD_NO_DISPONIBLE', 'No hay conexión con la base de datos en este momento. Intenta de nuevo en unos segundos.');
  }
  return null;
}

export function rutaNoEncontrada(req, res) {
  res.status(404).json({
    ok: false,
    error: { codigo: 'NO_ENCONTRADO', mensaje: `No existe la ruta ${req.method} ${req.originalUrl}.` },
  });
}

// eslint-disable-next-line no-unused-vars
export function manejarErrores(error, req, res, next) {
  let http = error instanceof ErrorHttp ? error : desdeMongo(error);

  if (!http && error.type === 'entity.parse.failed') {
    http = new ErrorHttp(400, 'JSON_INVALIDO', 'El cuerpo de la petición no es un JSON válido.');
  }
  if (!http && error.type === 'entity.too.large') {
    http = new ErrorHttp(413, 'DEMASIADO_GRANDE', 'El cuerpo de la petición supera los 20 KB.');
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
