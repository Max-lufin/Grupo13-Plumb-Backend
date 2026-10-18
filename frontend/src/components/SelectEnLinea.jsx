// <select> que se escribe dentro de una frase y toma el ancho de la opción
// elegida (no el de la opción más larga), como un espacio en blanco de un formulario.
export default function SelectEnLinea({ id, etiqueta, valor, opciones, alCambiar }) {
  const actual = opciones.find((o) => String(o.valor) === String(valor));
  return (
    <span className="select-en-linea">
      <span className="select-en-linea__medida" aria-hidden="true">{actual?.texto ?? '—'}</span>
      <select id={id} aria-label={etiqueta} value={valor} onChange={(e) => alCambiar(e.target.value)}>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>{o.texto}</option>
        ))}
      </select>
    </span>
  );
}
