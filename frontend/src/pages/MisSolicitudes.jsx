import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api/cliente.js';
import { useAvisar } from '../components/Avisos.jsx';
import { CajaError, Campo, Cargando, Dialogo, Estrella, Timbre } from '../components/Piezas.jsx';
import { usePeticion } from '../hooks/usePeticion.js';
import { useTitulo } from '../hooks/usePagina.js';
import { useSesion } from '../hooks/sesionDemo.jsx';
import { fecha, fechaYHora, folio, nombreCorto } from '../utils/formato.js';

function Calificar({ solicitud, alCerrar, alTerminar }) {
  const avisar = useAvisar();
  const [puntuacion, setPuntuacion] = useState(0);
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (!puntuacion) return setError('Elige de 1 a 5 estrellas.');
    setEnviando(true);
    try {
      await api.calificar(solicitud.id_solicitud, { puntuacion, comentario });
      avisar(`Calificaste el trabajo de ${nombreCorto(solicitud.maestro)} con ${puntuacion} de 5.`);
      alTerminar();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="formulario">
      <p>{solicitud.descripcion}</p>
      <fieldset className="estrellas-entrada">
        <legend className="campo__etiqueta">¿Cómo fue el trabajo de {nombreCorto(solicitud.maestro)}?</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n}>
            <input type="radio" name="puntuacion" value={n} checked={puntuacion === n} onChange={() => setPuntuacion(n)} />
            <Estrella llena={n <= puntuacion} />
            <span className="visualmente-oculto">{n} de 5</span>
          </label>
        ))}
      </fieldset>
      <Campo etiqueta="Comentario" id="calificar-comentario" ayuda="Opcional. Lo verán otros clientes en el perfil del maestro.">
        <textarea id="calificar-comentario" className="entrada" maxLength={500} value={comentario}
          onChange={(e) => setComentario(e.target.value)} />
      </Campo>
      {error && <p className="campo__error" role="alert">{error}</p>}
      <div className="formulario__acciones">
        <button type="button" className="boton boton--secundario" onClick={alCerrar}>Volver</button>
        <button type="submit" className="boton" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar calificación'}</button>
      </div>
    </form>
  );
}

function FilaSolicitud({ s, vista, children }) {
  return (
    <li className="solicitud">
      <div className="solicitud__folio">{folio(s.id_solicitud)}</div>
      <div className="solicitud__cuerpo">
        <p className="solicitud__quien">
          {vista === 'cliente' && <>Para <strong>{s.maestro}</strong>, </>}
          {vista === 'maestro' && s.cliente && <>De <strong>{s.cliente}</strong>, </>}
          {s.fecha_servicio && <>trabajo para el {fecha(s.fecha_servicio)}</>}
        </p>
        <p className="solicitud__descripcion">{s.descripcion}</p>
        <p className="solicitud__meta">
          {s.direccion && <>{s.direccion}. </>}Enviada el {fechaYHora(s.fecha_solicitud)}.
        </p>
      </div>
      <div className="solicitud__estado">
        {s.estado && <Timbre estado={s.estado} />}
        {children}
      </div>
    </li>
  );
}

function ComoCliente() {
  const { cliente, rutCliente } = useSesion();
  const avisar = useAvisar();
  const [calificando, setCalificando] = useState(null);
  const lista = usePeticion((s) => api.solicitudes({ cliente: rutCliente }, s), [rutCliente]);

  const cancelar = async (s) => {
    try {
      await api.cambiarEstado(s.id_solicitud, 'Cancelada');
      avisar(`Cancelaste la solicitud ${folio(s.id_solicitud)}.`);
      lista.recargar();
    } catch (e) {
      avisar(e.message, 'error');
    }
  };

  return (
    <>
      <p className="pestana__intro">
        Solicitudes de <strong>{cliente?.nombre ?? rutCliente}</strong>. Esta lista es la consulta 4: une
        Solicitud, Cliente y Maestro{lista.meta && <> y respondió en {Math.max(1, Math.round(lista.meta.ms))} ms</>}.
      </p>
      {lista.cargando && <Cargando />}
      {lista.error && <CajaError error={lista.error} alReintentar={lista.recargar} />}
      {lista.datos?.length === 0 && (
        <div className="resultados__vacio">
          <p>Todavía no hay solicitudes.</p>
          <Link className="boton" to="/catalogo">Buscar un maestro</Link>
        </div>
      )}
      {lista.datos?.length > 0 && (
        <ul className="solicitudes">
          {lista.datos.map((s) => (
            <FilaSolicitud key={s.id_solicitud} s={s} vista="cliente">
              {['Pendiente', 'Aceptada'].includes(s.estado) && (
                <button type="button" className="boton boton--texto boton--chico" onClick={() => cancelar(s)}>Cancelar</button>
              )}
              {s.estado === 'Finalizada' && !s.puntuacion && (
                <button type="button" className="boton boton--chico" onClick={() => setCalificando(s)}>Calificar</button>
              )}
              {s.puntuacion && (
                <span className="solicitud__nota" role="img" aria-label={`Calificaste ${s.puntuacion} de 5 estrellas`}>
                  {[1, 2, 3, 4, 5].map((i) => <Estrella key={i} llena={i <= s.puntuacion} />)}
                </span>
              )}
            </FilaSolicitud>
          ))}
        </ul>
      )}
      <Dialogo abierto={Boolean(calificando)} alCerrar={() => setCalificando(null)} titulo="Calificar el trabajo">
        {calificando && (
          <Calificar solicitud={calificando} alCerrar={() => setCalificando(null)}
            alTerminar={() => { setCalificando(null); lista.recargar(); }} />
        )}
      </Dialogo>
    </>
  );
}

function ComoMaestro() {
  const { maestro, rutMaestro } = useSesion();
  const avisar = useAvisar();
  const pendientes = usePeticion((s) => api.bandeja(rutMaestro, 'Pendiente', s), [rutMaestro]);
  const aceptadas = usePeticion((s) => api.solicitudes({ maestro: rutMaestro, estado: 'Aceptada' }, s), [rutMaestro]);

  const cambiar = async (s, estado, mensaje) => {
    try {
      await api.cambiarEstado(s.id_solicitud, estado);
      avisar(mensaje);
      pendientes.recargar();
      aceptadas.recargar();
    } catch (e) {
      avisar(e.message, 'error');
    }
  };

  return (
    <>
      <p className="pestana__intro">
        Bandeja de <strong>{maestro?.nombre ?? rutMaestro}</strong>. Las pendientes salen de la consulta 5
        {pendientes.meta && <>, que respondió en {Math.max(1, Math.round(pendientes.meta.ms))} ms</>}.
      </p>

      <h2 className="pestana__titulo">Por responder</h2>
      {pendientes.cargando && <Cargando />}
      {pendientes.error && <CajaError error={pendientes.error} alReintentar={pendientes.recargar} />}
      {pendientes.datos?.length === 0 && <p className="resultados__vacio">No hay solicitudes esperando respuesta.</p>}
      {pendientes.datos?.length > 0 && (
        <ul className="solicitudes">
          {pendientes.datos.map((s) => (
            <FilaSolicitud key={s.id_solicitud} s={{ ...s, estado: 'Pendiente' }} vista="maestro">
              <button type="button" className="boton boton--chico"
                onClick={() => cambiar(s, 'Aceptada', `Aceptaste la solicitud ${folio(s.id_solicitud)}.`)}>Aceptar</button>
              <button type="button" className="boton boton--peligro boton--chico"
                onClick={() => cambiar(s, 'Rechazada', `Rechazaste la solicitud ${folio(s.id_solicitud)}.`)}>Rechazar</button>
            </FilaSolicitud>
          ))}
        </ul>
      )}

      <h2 className="pestana__titulo">En curso</h2>
      {aceptadas.datos?.length === 0 && <p className="resultados__vacio">No hay trabajos aceptados en curso.</p>}
      {aceptadas.datos?.length > 0 && (
        <ul className="solicitudes">
          {aceptadas.datos.map((s) => (
            <FilaSolicitud key={s.id_solicitud} s={s} vista="maestro">
              <button type="button" className="boton boton--chico"
                onClick={() => cambiar(s, 'Finalizada', `Marcaste como terminado el trabajo ${folio(s.id_solicitud)}.`)}>
                Marcar terminado
              </button>
            </FilaSolicitud>
          ))}
        </ul>
      )}
    </>
  );
}

export default function MisSolicitudes() {
  useTitulo('Mis solicitudes');
  const [params, setParams] = useSearchParams();
  const vista = params.get('vista') === 'maestro' ? 'maestro' : 'cliente';

  return (
    <div className="contenedor">
      <header className="pagina__cabecera">
        <h1>Mis solicitudes</h1>
        <p>El mismo trabajo visto desde los dos lados: quien lo pide y quien lo hace.</p>
      </header>
      <div className="pestanas" role="group" aria-label="Vista">
        <button type="button" aria-pressed={vista === 'cliente'} onClick={() => setParams({}, { replace: true })}>
          Como cliente
        </button>
        <button type="button" aria-pressed={vista === 'maestro'} onClick={() => setParams({ vista: 'maestro' }, { replace: true })}>
          Como maestro
        </button>
      </div>
      <section className="pestana" aria-live="polite">
        {vista === 'cliente' ? <ComoCliente /> : <ComoMaestro />}
      </section>
    </div>
  );
}
