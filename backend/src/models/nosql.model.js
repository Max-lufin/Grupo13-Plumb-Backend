// Modelo de documentos: decisiones del traspaso, costo de las copias y, por
// colección, un documento real con sus índices y su validador.

import { env } from '../config/env.js';
import { mongo } from '../config/mongo.js';
import { cronometro } from '../utils/http.js';
import { aMongosh } from '../utils/mongosh.js';

// Destino de cada tabla del modelo relacional y por qué, según las consultas.
export const TRASPASO = [
  {
    tabla: 'cliente, maestro, administrador',
    destino: 'usuarios',
    decision: 'Una colección para las tres (patrón polimórfico)',
    porque: 'El inicio de sesión busca por correo sin saber el rol. Un solo documento por persona permite que alguien sea cliente y maestro con el mismo RUT y un único índice de correo.',
    consultas: ['Inicio de sesión', 'Q1', 'Q2', 'Q5'],
  },
  {
    tabla: 'maestro (datos del oficio)',
    destino: 'usuarios.maestro',
    decision: 'Perfil embebido (1:0..1)',
    porque: 'Solo existe si la persona es maestro y se lee siempre junto con ella: catálogo, perfil y ranking salen de un solo documento.',
    consultas: ['Q1', 'Q2', 'Q5'],
  },
  {
    tabla: 'region',
    destino: 'usuarios.maestro.region',
    decision: 'Embebida completa',
    porque: 'Catálogo fijo de 16 regiones que nunca cambia: copiarla no tiene costo de mantención. La lista para los filtros es una constante de la API, no una colección.',
    consultas: ['Q1'],
  },
  {
    tabla: 'oficio',
    destino: 'oficios y copia en usuarios.maestro.oficio',
    decision: 'Colección propia y referencia extendida',
    porque: 'El mantenedor lista todos los oficios, incluso los que nadie ofrece, y los crea, renombra y borra. En el maestro se copia solo { _id, nombre } para filtrar y mostrar sin $lookup.',
    consultas: ['Mantenedor de oficios', 'Q1'],
  },
  {
    tabla: 'solicitud',
    destino: 'solicitudes',
    decision: 'Colección propia con referencias extendidas',
    porque: 'Crece sin límite: embebida en el cliente o en el maestro sería un arreglo sin tope (máximo 16 MB por documento). Copia el nombre de cliente y maestro para la bandeja y el historial.',
    consultas: ['Q3', 'Q4'],
  },
  {
    tabla: 'calificacion',
    destino: 'solicitudes.calificacion',
    decision: 'Embebida',
    porque: 'Relación 1:0..1 que depende de su solicitud: se lee con ella y desaparece con ella. El UNIQUE y el ON DELETE CASCADE se cumplen por construcción.',
    consultas: ['Q4'],
  },
  {
    tabla: 'v_reputacion_maestro (vista)',
    destino: 'usuarios.maestro.reputacion y resenas_recientes',
    decision: 'Patrones calculado y subconjunto',
    porque: 'El catálogo filtra y ordena por promedio: guardado, se indexa. El perfil muestra solo las 5 reseñas más recientes, así el arreglo nunca crece.',
    consultas: ['Q1', 'Q2', 'Q5'],
  },
  {
    tabla: 'SERIAL de solicitud y oficio',
    destino: 'contadores',
    decision: 'Colección técnica',
    porque: 'MongoDB no tiene secuencias. El folio y el código del oficio salen de findOneAndUpdate con $inc, que es atómico.',
    consultas: ['Crear solicitud', 'Crear oficio'],
  },
];

// Cada dato copiado, cuándo cambia y cómo se mantiene al día.
export const DUPLICADOS = [
  { dato: 'Nombre del oficio', donde: 'usuarios.maestro.oficio.nombre', cambia: 'Al renombrar un oficio (casi nunca)', mantiene: 'updateMany en la misma transacción que renombra el oficio' },
  { dato: 'Región completa', donde: 'usuarios.maestro.region', cambia: 'Nunca: catálogo fijo', mantiene: 'No requiere mantención' },
  { dato: 'Nombre del cliente y del maestro', donde: 'solicitudes.cliente.nombre, solicitudes.maestro.nombre', cambia: 'Si una persona corrige su nombre (casi nunca)', mantiene: 'updateMany por _id en la misma transacción que edita a la persona' },
  { dato: 'Nombre de pila del cliente en cada reseña', donde: 'usuarios.maestro.resenas_recientes[].cliente', cambia: 'Si el cliente corrige su nombre', mantiene: 'Se conserva como estaba al calificar, igual que una firma; al moderar, las 5 reseñas se vuelven a armar desde las solicitudes' },
  { dato: 'Reputación (promedio, total, suma)', donde: 'usuarios.maestro.reputacion', cambia: 'En cada calificación y al moderar una', mantiene: 'Transacción junto con la calificación; al moderar se recalcula con $group' },
  { dato: 'Últimas 5 reseñas', donde: 'usuarios.maestro.resenas_recientes', cambia: 'En cada calificación', mantiene: '$slice: 5 en la misma transacción; el validador impide un sexto elemento' },
];

const COLECCIONES = [
  { nombre: 'usuarios', origen: ['cliente', 'maestro', 'administrador', 'region', 'v_reputacion_maestro'], resuelve: ['Inicio de sesión', 'Q1 Catálogo', 'Q2 Perfil', 'Q5 Ranking'], ejemplo: { _id: '7765180-2' } },
  { nombre: 'solicitudes', origen: ['solicitud', 'calificacion'], resuelve: ['Q3 Bandeja', 'Q4 Historial', 'Q2 Trabajos terminados'], ejemplo: { folio: 1 } },
  { nombre: 'oficios', origen: ['oficio'], resuelve: ['Mantenedor de oficios', 'Lista de oficios del catálogo'], ejemplo: { _id: 1 } },
  { nombre: 'contadores', origen: [], resuelve: ['Folio de cada solicitud', 'Código de cada oficio nuevo'], ejemplo: { _id: 'solicitudes' } },
];

export const Nosql = {
  async estado() {
    const { db } = await mongo();
    const medir = cronometro();
    await db.command({ ping: 1 });
    const latenciaMs = medir();
    const { version } = await db.command({ buildInfo: 1 });
    return { conectada: true, motor: `MongoDB ${version}`, alojamiento: /\.mongodb\.net/.test(env.mongodbUri) ? 'MongoDB Atlas' : 'MongoDB local', baseDeDatos: db.databaseName, latenciaMs };
  },

  async colecciones() {
    const { db } = await mongo();
    const info = new Map((await db.listCollections().toArray()).map((c) => [c.name, c.options]));
    return Promise.all(COLECCIONES.map(async (c) => {
      const col = db.collection(c.nombre);
      // La contraseña se reemplaza: es un hash, pero igual no se muestra.
      const [total, ejemplo, indices] = await Promise.all([
        col.countDocuments(), col.findOne(c.ejemplo, { promoteValues: false }), col.indexes(),
      ]);
      if (ejemplo?.contrasena) ejemplo.contrasena = 'scrypt$…$… (hash con sal)';
      return {
        nombre: c.nombre, origen: c.origen, resuelve: c.resuelve, total,
        ejemplo: ejemplo ? aMongosh(ejemplo) : null,
        indices: indices.map((i) => ({ nombre: i.name, clave: aMongosh(i.key), unico: Boolean(i.unique) })),
        validador: info.get(c.nombre)?.validator ? aMongosh(info.get(c.nombre).validator) : null,
      };
    }));
  },
};
