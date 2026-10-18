import { z } from 'zod';
import { ErrorHttp } from '../utils/http.js';
import { normalizarRut, rutValido } from './rut.js';

// Validación de forma (tipos, largos, formatos). Si algo no cumple, la API
// responde 400 antes de tocar la base. Las reglas de negocio (mayoría de
// edad, transiciones de estado...) viven en los modelos y responden 422.

const ESTADOS = ['Pendiente', 'Aceptada', 'Rechazada', 'Finalizada', 'Cancelada'];

const rut = z.preprocess(
  normalizarRut,
  z.string({ required_error: 'Falta el RUT.' })
    .regex(/^\d{7,8}-[\dK]$/, 'Usa el formato 12345678-5.')
    .refine(rutValido, 'El dígito verificador no corresponde.'),
);

// "La región" → "Falta la región." Así el mensaje concuerda en género sin casos especiales.
const falta = (campo) => `Falta ${campo.charAt(0).toLowerCase()}${campo.slice(1)}.`;

const texto = (campo, min, max) =>
  z.string({ required_error: falta(campo), invalid_type_error: `${campo} debe ser texto.` })
    .trim()
    .min(min, `${campo} debe tener al menos ${min} caracteres.`)
    .max(max, `${campo} admite hasta ${max} caracteres.`);

const textoOpcional = (campo, max) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(max, `${campo} admite hasta ${max} caracteres.`).nullable().optional(),
  );

const email = z.string({ required_error: 'Falta el correo.' })
  .trim().toLowerCase().max(120).email('El correo no tiene un formato válido.');

const telefono = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    const digitos = v.replace(/[\s()-]/g, '');
    if (/^9\d{8}$/.test(digitos)) return `+56${digitos}`;
    if (/^569\d{8}$/.test(digitos)) return `+${digitos}`;
    return digitos;
  },
  z.string().regex(/^\+569\d{8}$/, 'Usa un celular chileno: +56 9 1234 5678.'),
);

const fecha = (campo) =>
  z.string({ required_error: falta(campo) })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${campo} debe tener el formato AAAA-MM-DD.`)
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v),
      `${campo} no es una fecha válida.`);

const aNumero = (v) => {
  if (v === '' || v === null || v === undefined) return undefined;
  return typeof v === 'string' ? Number(v) : v;
};

// Entero que puede llegar como texto (query string o formulario).
const entero = (campo, min, max, { opcional = false, faltante } = {}) => {
  let numero = z.number({ required_error: faltante ?? falta(campo), invalid_type_error: `${campo} debe ser un número.` })
    .int(`${campo} debe ser un número entero.`)
    .min(min, `${campo} debe ser al menos ${min}.`)
    .max(max, `${campo} no puede superar ${max}.`);
  if (opcional) numero = numero.optional();
  return z.preprocess(aNumero, numero);
};

const aBooleano = (v) => (v === 'true' ? true : v === 'false' ? false : v === '' ? undefined : v);
const booleano = z.preprocess(aBooleano, z.boolean({ invalid_type_error: 'Debe ser verdadero o falso.' }));
const booleanoOpcional = z.preprocess(aBooleano, z.boolean({ invalid_type_error: 'Debe ser verdadero o falso.' }).optional());

const vacioAUndefined = (v) => (v === '' || v === undefined ? undefined : v);

export const esquemas = {
  rut,

  clienteNuevo: z.object({
    rut_cliente: rut,
    nombre: texto('El nombre', 3, 120),
    email,
    telefono: telefono.nullable().optional(),
    fecha_nacimiento: fecha('La fecha de nacimiento'),
  }),

  maestroNuevo: z.object({
    rut_maestro: rut,
    nombre: texto('El nombre', 3, 120),
    email,
    telefono,
    fecha_nacimiento: fecha('La fecha de nacimiento'),
    id_oficio: entero('El oficio', 1, 2_147_483_647),
    id_region: entero('La región', 1, 16),
    tarifa_hora: entero('La tarifa', 1, 150_000),
    experiencia_anios: entero('La experiencia', 0, 60, { opcional: true }).transform((v) => v ?? 0),
    disponible: booleanoOpcional.transform((v) => v ?? true),
    descripcion: textoOpcional('La descripción', 500),
  }),

  maestroCambios: z.object({
    disponible: booleanoOpcional,
    tarifa_hora: entero('La tarifa', 1, 150_000, { opcional: true }),
  }).refine((d) => d.disponible !== undefined || d.tarifa_hora !== undefined, {
    message: 'Indica al menos disponible o tarifa_hora.',
  }),

  oficio: z.object({
    nombre: texto('El nombre', 3, 60),
    descripcion: textoOpcional('La descripción', 255),
  }),

  solicitudNueva: z.object({
    rut_cliente: rut,
    rut_maestro: rut,
    descripcion: texto('La descripción del trabajo', 15, 1000),
    direccion: texto('La dirección', 5, 200),
    fecha_servicio: fecha('La fecha del servicio'),
  }),

  cambioEstado: z.object({
    estado: z.enum(ESTADOS, { errorMap: () => ({ message: `El estado debe ser uno de: ${ESTADOS.join(', ')}.` }) }),
  }),

  calificacionNueva: z.object({
    puntuacion: entero('La puntuación', 1, 5),
    comentario: textoOpcional('El comentario', 500),
  }),

  filtrosCatalogo: z.object({
    region: entero('La región', 1, 16, { faltante: 'Falta la región (filtro obligatorio).' }),
    oficio: entero('El oficio', 1, 2_147_483_647, { faltante: 'Falta el oficio (filtro obligatorio).' }),
    tarifaMax: entero('La tarifa máxima', 1, 1_000_000, { opcional: true }),
    calificacionMin: z.preprocess(aNumero, z.number({ invalid_type_error: 'La calificación mínima debe ser un número.' }).min(0).max(5).optional()),
    disponible: booleanoOpcional,
    experienciaMin: entero('La experiencia mínima', 0, 60, { opcional: true }),
  }),

  filtrosSolicitudes: z.object({
    cliente: z.preprocess(vacioAUndefined, rut.optional()),
    maestro: z.preprocess(vacioAUndefined, rut.optional()),
    estado: z.preprocess(vacioAUndefined, z.enum(ESTADOS).optional()),
  }),

  id: entero('El identificador', 1, 2_147_483_647),
};

export function validar(esquema, datos) {
  const resultado = esquema.safeParse(datos ?? {});
  if (resultado.success) return resultado.data;
  const detalles = resultado.error.issues.map((issue) => ({
    campo: issue.path.join('.') || null,
    mensaje: issue.message,
  }));
  throw new ErrorHttp(400, 'VALIDACION', 'Hay datos que faltan o no tienen el formato esperado.', detalles);
}

export { ESTADOS };
