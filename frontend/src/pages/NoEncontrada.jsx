import { Link } from 'react-router';
import { useTitulo } from '../hooks/usePagina.js';

export default function NoEncontrada() {
  useTitulo('Página no encontrada');
  return (
    <div className="contenedor no-encontrada">
      <p className="no-encontrada__folio">N° 000404</p>
      <h1>Esta página no existe</h1>
      <p>Puede que el enlace esté mal escrito o que la página se haya movido.</p>
      <Link to="/" className="boton">Volver al inicio</Link>
    </div>
  );
}
