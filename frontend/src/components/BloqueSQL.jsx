// Resaltado mínimo de SQL y de MQL (mongosh): palabras clave u operadores,
// cadenas, números y parámetros. Se arma con elementos de React (sin
// innerHTML), así nada se inyecta.

const PALABRAS = new Set(`SELECT FROM WHERE AND OR NOT JOIN LEFT INNER ON AS ORDER BY GROUP HAVING LIMIT
INSERT INTO VALUES RETURNING UPDATE SET DELETE ALTER TABLE ADD COLUMN CONSTRAINT CHECK DROP IF EXISTS
CREATE NULL IS TRUE FALSE COALESCE COUNT AVG ROUND DESC ASC DEFAULT PRIMARY KEY FOREIGN REFERENCES
CASCADE RESTRICT UNIQUE VARCHAR INT INTEGER NUMERIC BOOLEAN TIMESTAMPTZ DATE TEXT BEGIN ROLLBACK COMMIT`
  .split(/\s+/));

const SQL = {
  token: /('(?:[^']|'')*')|(\$\d+)|(::\w+)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]+\b)|(--[^\n]*)/g,
  clase([, cadena, parametro, conversion, numero, palabra, comentario]) {
    if (cadena) return 'sql-cadena';
    if (parametro) return 'sql-parametro';
    if (conversion) return 'sql-tipo';
    if (numero) return 'sql-numero';
    if (comentario) return 'sql-comentario';
    if (palabra && PALABRAS.has(palabra.toUpperCase()) && palabra === palabra.toUpperCase()) return 'sql-clave';
    return null;
  },
};

// En MQL los operadores ($set, $gte…) cumplen el papel de las palabras clave.
const MQL = {
  token: /('(?:[^'\\]|\\.)*')|(\/\/[^\n]*)|(\$\$?[A-Za-z_][\w.]*)|(\b(?:ObjectId|ISODate|Long|Decimal128)\b)|(\b(?:db|const|new|if|true|false|null)\b)|(\b\d+(?:\.\d+)?\b)|(‹[^›]*›)/g,
  clase([, cadena, comentario, operador, tipo, reservada, numero, pendiente]) {
    if (cadena) return 'sql-cadena';
    if (comentario) return 'sql-comentario';
    if (operador) return 'sql-clave';
    if (tipo) return 'sql-tipo';
    if (reservada) return 'mql-reservada';
    if (numero) return 'sql-numero';
    if (pendiente) return 'sql-parametro';
    return null;
  },
};

function resaltar(codigo, { token, clase }) {
  const partes = [];
  let ultimo = 0;
  for (const m of codigo.matchAll(token)) {
    if (m.index > ultimo) partes.push(codigo.slice(ultimo, m.index));
    const c = clase(m);
    partes.push(c ? <span key={m.index} className={c}>{m[0]}</span> : m[0]);
    ultimo = m.index + m[0].length;
  }
  if (ultimo < codigo.length) partes.push(codigo.slice(ultimo));
  return partes;
}

export default function BloqueSQL({ sql, titulo, lenguaje = 'sql' }) {
  return (
    <figure className={`bloque-sql bloque-sql--${lenguaje}`}>
      <figcaption className="visualmente-oculto">{titulo ?? lenguaje.toUpperCase()}</figcaption>
      <pre tabIndex={0}><code>{resaltar(sql, lenguaje === 'mql' ? MQL : SQL)}</code></pre>
    </figure>
  );
}
