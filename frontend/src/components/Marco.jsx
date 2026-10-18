import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { api, URL_API } from '../api/cliente.js';
import { useSesion } from '../hooks/sesionDemo.jsx';
import { nombreCorto } from '../utils/formato.js';
import { Logo } from './Piezas.jsx';

const ENLACES = [
  { a: '/catalogo', texto: 'Buscar maestro' },
  { a: '/solicitudes', texto: 'Mis solicitudes' },
  { a: '/admin', texto: 'Administración' },
  { a: '/consultas', texto: 'Consultas SQL' },
  { a: '/nosql', texto: 'Modelo NoSQL' },
];

function SelectorIdentidad() {
  const { rutCliente, rutMaestro, cliente, clientes, maestros, elegirCliente, elegirMaestro } = useSesion();
  const ref = useRef(null);

  useEffect(() => {
    const cerrarFuera = (e) => {
      if (ref.current?.open && !ref.current.contains(e.target)) ref.current.open = false;
    };
    document.addEventListener('click', cerrarFuera);
    return () => document.removeEventListener('click', cerrarFuera);
  }, []);

  return (
    <details className="identidad" ref={ref}>
      <summary>
        <span className="identidad__rotulo">Actúas como</span>
        <span className="identidad__nombre">{cliente ? nombreCorto(cliente.nombre) : 'Elegir cliente'}</span>
      </summary>
      <div className="identidad__panel">
        <p className="identidad__nota">
          Esta etapa no tiene inicio de sesión. Elige con quién quieres probar el sistema.
        </p>
        <label className="campo">
          <span className="campo__etiqueta">Cliente que pide servicios</span>
          <select className="entrada" value={rutCliente} onChange={(e) => elegirCliente(e.target.value)}>
            {clientes.map((c) => <option key={c.rut_cliente} value={c.rut_cliente}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="campo">
          <span className="campo__etiqueta">Maestro que responde solicitudes</span>
          <select className="entrada" value={rutMaestro} onChange={(e) => elegirMaestro(e.target.value)}>
            {maestros.map((m) => <option key={m.rut_maestro} value={m.rut_maestro}>{m.nombre} ({m.oficio.toLowerCase()})</option>)}
          </select>
        </label>
        <Link to="/registro" className="identidad__registro" onClick={() => { ref.current.open = false; }}>
          Registrar un cliente nuevo
        </Link>
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
      Conectado a {salud.bd.motor}, respuesta en {Math.max(1, Math.round(salud.bd.latenciaMs))} ms.
      {' '}{salud.tablas.maestro} maestros y {salud.tablas.solicitud} solicitudes registradas.
    </p>
  );
}

export default function Marco() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { pathname } = useLocation();

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
              {ENLACES.map((e) => (
                <li key={e.a}><NavLink to={e.a}>{e.texto}</NavLink></li>
              ))}
            </ul>
            <SelectorIdentidad />
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
