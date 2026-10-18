// Escribe un valor de MongoDB con la sintaxis de mongosh: ObjectId('…'),
// ISODate('…'), 4.5 para un double y 6 para un entero. Así lo que muestra el
// laboratorio es lo mismo que se podría pegar en la consola.

const CLAVE_SIMPLE = /^[A-Za-z_$][\w$]*$/;
const ANCHO = 72;

// Un valor que todavía no existe al mostrar la operación (lo produce un paso anterior).
export class Pendiente {
  constructor(descripcion) {
    this.descripcion = descripcion;
  }
}

const cadena = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

function simple(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return cadena(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return `ISODate('${v.toISOString()}')`;
  if (v instanceof Pendiente) return `‹${v.descripcion}›`;
  switch (v._bsontype) {
    case 'ObjectId': return `ObjectId('${v.toHexString()}')`;
    case 'Int32': return String(v.value);
    case 'Double': return Number.isInteger(v.value) ? v.value.toFixed(1) : String(v.value);
    case 'Long': return `Long('${v.toString()}')`;
    case 'Decimal128': return `Decimal128('${v.toString()}')`;
    case 'BSONRegExp': return `/${v.pattern}/${v.options}`;
    default: return null;
  }
}

export function aMongosh(v, sangria = '') {
  const s = simple(v);
  if (s !== null) return s;
  if (v instanceof RegExp) return String(v);

  const dentro = `${sangria}  `;
  const esArreglo = Array.isArray(v);
  const partes = esArreglo
    ? v.map((x) => aMongosh(x, dentro))
    : Object.entries(v).map(([k, x]) => `${CLAVE_SIMPLE.test(k) ? k : cadena(k)}: ${aMongosh(x, dentro)}`);
  const [abre, cierra] = esArreglo ? ['[', ']'] : ['{', '}'];
  if (partes.length === 0) return `${abre}${cierra}`;

  const enLinea = esArreglo ? `[${partes.join(', ')}]` : `{ ${partes.join(', ')} }`;
  if (!enLinea.includes('\n') && enLinea.length + sangria.length <= ANCHO) return enLinea;
  return `${abre}\n${partes.map((p) => dentro + p).join(',\n')}\n${sangria}${cierra}`;
}
