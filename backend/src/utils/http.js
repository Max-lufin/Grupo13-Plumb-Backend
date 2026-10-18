// Todas las respuestas comparten la misma forma, tanto en éxito como en error:
//   { ok: true,  data, meta? }
//   { ok: false, error: { codigo, mensaje, detalles? } }

export function ok(data, meta) {
  return meta ? { ok: true, data, meta } : { ok: true, data };
}

export class ErrorHttp extends Error {
  constructor(status, codigo, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export const noEncontrado = (mensaje) => new ErrorHttp(404, 'NO_ENCONTRADO', mensaje);
export const reglaDeNegocio = (mensaje, detalles) => new ErrorHttp(422, 'REGLA_DE_NEGOCIO', mensaje, detalles);
export const conflicto = (mensaje) => new ErrorHttp(409, 'CONFLICTO', mensaje);

export function cronometro() {
  const inicio = performance.now();
  return () => Math.round((performance.now() - inicio) * 10) / 10;
}
