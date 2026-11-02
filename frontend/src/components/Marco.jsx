import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { api, URL_API } from '../api/cliente.js';
import { useSesion } from '../hooks/sesion.jsx';
import { nombreCorto } from '../utils/formato.js';
import { Logo } from './Piezas.jsx';

// Enlaces de la barra según quién usa la aplicación.
function enlacesPara({ usuario, esAdmin }) {
  return [
    { a: '/catalogo', texto: 'Buscar maestro' },
    usuario && (usuario.roles.includes('cliente') || usuario.roles.includes('maestro')) && { a: '/solicitudes', texto: 'Mis solicitudes' },
    esAdmin && { a: '/admin', texto: 'Administración' },
    { a: '/consultas', texto: 'Consultas' },
    { a: '/nosql', texto: 'Modelo NoSQL' },
  ].filter(Boolean);
}

const NOMBRE_ROL = { cliente: 'Cliente', maestro: 'Maestro', administrador: 'Administrador' };

function MenuCuenta() {
  const { usuario, cerrar } = useSesion();
  const navegar = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    const cerrarFuera = (e) => {
      if (ref.current?.open && !ref.current.contains(e.target)) ref.current.open = false;
    };
    document.addEventListener('click', cerrarFuera);
    return () => document.removeEventListener('click', cerrarFuera);
  }, []);

  if (!usuario) {
    return (
      <div className="cuenta-visitante">
        <Link to="/ingresar" className="boton boton--chico">Iniciar sesión</Link>
        <Link to="/registro" className="boton boton--texto boton--chico">Crear cuenta</Link>
      </div>
    );
  }

  return (
    <details className="identidad" ref={ref}>
      <summary>
        <span className="identidad__rotulo">{usuario.roles.map((r) => NOMBRE_ROL[r]).join(' y ')}</span>
        <span className="identidad__nombre">{nombreCorto(usuario.nombre)}</span>
      </summary>
      <div className="identidad__panel">
        <p className="identidad__nota">
          Ingresaste como <strong>{usuario.nombre}</strong> ({usuario.email}).
        </p>
        <button type="button" className="boton boton--secundario boton--chico"
          onClick={() => { ref.current.open = false; cerrar(); navegar('/'); }}>
          Cerrar sesión
        </button>
      </div>
    </details>
  );
}

function EstadoBaseDeDatos() {
  const [salud, setSalud] = useState(null);
  const [falla, setFalla] = useState(false);

  useEffect(() => {
    api.salud().then((r) => setSalud(r.data)).catch(() => setFalla(true));
  }, []);

  if (falla) return <p className="pie__bd pie__bd--caida">Sin conexión con la base de datos.</p>;
  if (!salud) return <p className="pie__bd">Comprobando la base de datos…</p>;
  return (
    <p className="pie__bd">
      <span className="pie__luz" aria-hidden="true" />
      Conectado a {salud.bd.motor} ({salud.bd.alojamiento}), respuesta en {Math.max(1, Math.round(salud.bd.latenciaMs))} ms.
      {' '}{salud.documentos.maestros} maestros y {salud.documentos.solicitudes} solicitudes registradas.
    </p>
  );
}

export default function Marco() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { pathname } = useLocation();
  const sesion = useSesion();

  const primeraCarga = useRef(true);

  useEffect(() => {
    setMenuAbierto(false);
    window.scrollTo(0, 0);
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    document.getElementById('contenido')?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <>
      <a className="saltar" href="#contenido">Ir al contenido</a>
      <header className="cabecera">
        <div className="contenedor cabecera__fila">
          <Link to="/" className="cabecera__logo" aria-label="Plumb, inicio"><Logo /></Link>
          <button
            type="button"
            className="cabecera__menu"
            aria-expanded={menuAbierto}
            aria-controls="navegacion"
            onClick={() => setMenuAbierto((v) => !v)}
          >
            Menú
          </button>
          <nav id="navegacion" className={`navegacion${menuAbierto ? ' navegacion--abierta' : ''}`} aria-label="Principal">
            <ul>
              {enlacesPara(sesion).map((e) => (
                <li key={e.a}><NavLink to={e.a}>{e.texto}</NavLink></li>
              ))}
            </ul>
            <MenuCuenta />
          </nav>
        </div>
      </header>

      <main id="contenido" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="pie">
        <div className="contenedor pie__fila">
          <EstadoBaseDeDatos />
          <p className="pie__creditos">
            Plumb es el proyecto del Grupo 13 para ICI324 Bases de Datos y Programación Web,
            Universidad de Valparaíso, 2026. Vicente Fernández, Maximiliano Sepúlveda y Vicente Cid.
            {' '}<a href={URL_API}>Ver la API</a>.
          </p>
        </div>
      </footer>
    </>
  );
}
