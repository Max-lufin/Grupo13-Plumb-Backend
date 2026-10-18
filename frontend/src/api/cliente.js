// Cliente HTTP de la API. Todas las respuestas tienen la forma
// { ok, data, meta } o { ok: false, error: { codigo, mensaje, detalles } }.

const BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

export class ErrorApi extends Error {
  constructor(status, error) {
    super(error?.mensaje ?? 'Error desconocido');
    this.status = status;
    this.codigo = error?.codigo;
    this.detalles = error?.detalles ?? [];
  }

  // { campo: mensaje } para pintar los errores junto a cada campo.
  porCampo() {
    return Object.fromEntries(this.detalles.filter((d) => d.campo).map((d) => [d.campo, d.mensaje]));
  }
}

async function pedir(ruta, { metodo = 'GET', cuerpo, consulta, signal } = {}) {
  const url = new URL(BASE + ruta, window.location.origin);
  for (const [clave, valor] of Object.entries(consulta ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(clave, valor);
  }

  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ErrorApi(0, { codigo: 'SIN_CONEXION', mensaje: 'No hay conexión con la API. Revisa tu internet e intenta de nuevo.' });
  }

  const json = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !json?.ok) {
    throw new ErrorApi(respuesta.status, json?.error ?? { mensaje: `La API respondió ${respuesta.status}.` });
  }
  return json;
}

export const api = {
  salud: (signal) => pedir('/salud', { signal }),
  regiones: (signal) => pedir('/regiones', { signal }),

  oficios: (signal) => pedir('/oficios', { signal }),
  crearOficio: (datos) => pedir('/oficios', { metodo: 'POST', cuerpo: datos }),
  editarOficio: (id, datos) => pedir(`/oficios/${id}`, { metodo: 'PUT', cuerpo: datos }),
  eliminarOficio: (id) => pedir(`/oficios/${id}`, { metodo: 'DELETE' }),

  catalogo: (filtros, signal) => pedir('/catalogo', { consulta: filtros, signal }),
  ranking: (limite, signal) => pedir('/ranking', { consulta: { limite }, signal }),

  maestros: (signal) => pedir('/maestros', { signal }),
  maestro: (rut, signal) => pedir(`/maestros/${rut}`, { signal }),
  bandeja: (rut, estado, signal) => pedir(`/maestros/${rut}/solicitudes`, { consulta: { estado }, signal }),
  crearMaestro: (datos) => pedir('/maestros', { metodo: 'POST', cuerpo: datos }),
  editarMaestro: (rut, datos) => pedir(`/maestros/${rut}`, { metodo: 'PUT', cuerpo: datos }),
  modificarMaestro: (rut, cambios) => pedir(`/maestros/${rut}`, { metodo: 'PATCH', cuerpo: cambios }),
  eliminarMaestro: (rut) => pedir(`/maestros/${rut}`, { metodo: 'DELETE' }),

  clientes: (signal) => pedir('/clientes', { signal }),
  crearCliente: (datos) => pedir('/clientes', { metodo: 'POST', cuerpo: datos }),

  solicitudes: (filtros, signal) => pedir('/solicitudes', { consulta: filtros, signal }),
  crearSolicitud: (datos) => pedir('/solicitudes', { metodo: 'POST', cuerpo: datos }),
  cambiarEstado: (id, estado) => pedir(`/solicitudes/${id}`, { metodo: 'PATCH', cuerpo: { estado } }),
  eliminarSolicitud: (id) => pedir(`/solicitudes/${id}`, { metodo: 'DELETE' }),
  calificar: (id, datos) => pedir(`/solicitudes/${id}/calificacion`, { metodo: 'POST', cuerpo: datos }),

  consultas: (signal) => pedir('/consultas', { signal }),
  consulta: (numero, signal) => pedir(`/consultas/${numero}`, { signal }),
  ejecutarConsulta: (numero) => pedir(`/consultas/${numero}/ejecuciones`, { metodo: 'POST' }),
  probarIntegridad: (codigo) => pedir(`/pruebas-integridad/${codigo}/ejecuciones`, { metodo: 'POST' }),

  nosql: (signal) => pedir('/nosql', { signal }),
  nosqlConsultas: (signal) => pedir('/nosql/consultas', { signal }),
  ejecutarNosql: (codigo) => pedir(`/nosql/consultas/${codigo}/ejecuciones`, { metodo: 'POST' }),
  probarNosql: (codigo) => pedir(`/nosql/pruebas/${codigo}/ejecuciones`, { metodo: 'POST' }),
};

export const URL_API = BASE.startsWith('http') ? BASE : `${window.location.origin}${BASE}`;
