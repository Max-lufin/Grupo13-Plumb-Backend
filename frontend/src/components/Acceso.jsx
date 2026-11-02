import { Link, useLocation } from 'react-router';
import { useSesion } from '../hooks/sesion.jsx';

// Muestra el contenido solo si hay sesión y, si se pide, un rol. Si no, explica
// qué falta y ofrece el siguiente paso, en vez de una pantalla vacía o un error.
export default function Acceso({ rol, nombreRol, children }) {
  const { usuario, vencida } = useSesion();
  const { pathname, search } = useLocation();
  const volver = encodeURIComponent(pathname + search);

  if (!usuario) {
    return (
      <div className="contenedor acceso">
        <div className="hoja acceso__panel">
          <h1>{vencida ? 'Tu sesión venció' : 'Inicia sesión para continuar'}</h1>
          <p>{vencida ? 'Por seguridad, las sesiones duran 8 horas. Vuelve a ingresar para seguir donde estabas.' : 'Esta sección es personal: muestra tus solicitudes o las herramientas de tu cuenta.'}</p>
          <div className="acceso__acciones">
            <Link className="boton" to={`/ingresar?volver=${volver}`}>Iniciar sesión</Link>
            <Link className="boton boton--secundario" to="/registro">Crear cuenta de cliente</Link>
          </div>
        </div>
      </div>
    );
  }

  if (rol && !usuario.roles.includes(rol)) {
    return (
      <div className="contenedor acceso">
        <div className="hoja acceso__panel">
          <h1>Esta sección es para {nombreRol}</h1>
          <p>Ingresaste como {usuario.nombre}. Tu cuenta no tiene acceso aquí.</p>
          <div className="acceso__acciones">
            <Link className="boton" to="/catalogo">Ir al catálogo</Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
