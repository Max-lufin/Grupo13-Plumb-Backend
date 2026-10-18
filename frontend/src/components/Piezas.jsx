import { useEffect, useRef } from 'react';
import { nota } from '../utils/formato.js';

export function Logo({ grande = false }) {
  return (
    <span className={`logo${grande ? ' logo--grande' : ''}`}>
      <svg className="logo__marca" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M6 4v12a8 8 0 0 0 8 8h12" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="square" />
        <rect x="23" y="18" width="6" height="12" fill="var(--folio)" />
      </svg>
      plumb
    </span>
  );
}

export function Estrella({ llena = true }) {
  return (
    <svg className="estrella" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 1.8l2.5 5.3 5.7.7-4.2 4 1.1 5.7L10 14.7l-5.1 2.8L6 11.8l-4.2-4 5.7-.7z"
        fill={llena ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Reputacion({ promedio, total }) {
  if (!total) return <span className="reputacion reputacion--nuevo">Sin reseñas aún</span>;
  return (
    <span className="reputacion">
      <Estrella />
      <strong>{nota(promedio)}</strong>
      <span className="reputacion__total" aria-hidden="true">({total})</span>
      <span className="visualmente-oculto">de 5, {total === 1 ? '1 reseña' : `${total} reseñas`}</span>
    </span>
  );
}

const CLASE_ESTADO = {
  Pendiente: 'pendiente',
  Aceptada: 'aceptada',
  Rechazada: 'rechazada',
  Finalizada: 'finalizada',
  Cancelada: 'cancelada',
};

export function Timbre({ estado, grande = false }) {
  return <span className={`timbre timbre--${CLASE_ESTADO[estado]}${grande ? ' timbre--grande' : ''}`}>{estado}</span>;
}

export function Disponibilidad({ disponible }) {
  return (
    <span className={`disponibilidad${disponible ? '' : ' disponibilidad--no'}`}>
      {disponible ? 'Recibe solicitudes' : 'Sin agenda por ahora'}
    </span>
  );
}

export function Cargando({ texto = 'Cargando…' }) {
  return <p className="estado-carga" role="status">{texto}</p>;
}

export function CajaError({ error, alReintentar }) {
  return (
    <div className="caja-error" role="alert">
      <p><strong>{error?.message ?? 'Algo salió mal.'}</strong></p>
      {alReintentar && (
        <button type="button" className="boton boton--secundario boton--chico" onClick={alReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

// Envoltura de <dialog> nativo: atrapa el foco y se cierra con Esc.
export function Dialogo({ abierto, alCerrar, titulo, children, ancho = 640 }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className="dialogo"
      style={{ '--ancho-dialogo': `${ancho}px` }}
      onClose={alCerrar}
      onClick={(e) => e.target === ref.current && alCerrar()}
      aria-labelledby="dialogo-titulo"
    >
      <div className="dialogo__cuerpo">
        <header className="dialogo__cabecera">
          <h2 id="dialogo-titulo">{titulo}</h2>
          <button type="button" className="dialogo__cerrar" onClick={alCerrar} aria-label="Cerrar">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2.2" /></svg>
          </button>
        </header>
        {abierto && children}
      </div>
    </dialog>
  );
}

export function Campo({ etiqueta, requerido, ayuda, error, id, children }) {
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
        {requerido && <span className="campo__requerido" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <span className="campo__error" id={`${id}-error`}>{error}</span>
      ) : (
        ayuda && <span className="campo__ayuda" id={`${id}-ayuda`}>{ayuda}</span>
      )}
    </div>
  );
}
