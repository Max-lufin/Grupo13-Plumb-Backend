import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api/cliente.js';
import { useAvisar } from '../components/Avisos.jsx';
import { CajaError, Campo, Cargando, Disponibilidad, Estrella, Reputacion, Timbre } from '../components/Piezas.jsx';
import { usePeticion } from '../hooks/usePeticion.js';
import { useTitulo } from '../hooks/usePagina.js';
import { useSesion } from '../hooks/sesionDemo.jsx';
import { clp, fecha, folio, hoyISO, plural, sumarDias } from '../utils/formato.js';

function OrdenDeTrabajo({ maestro }) {
  const { cliente } = useSesion();
  const avisar = useAvisar();
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ descripcion: '', direccion: '', fecha_servicio: sumarDias(hoyISO(), 2) });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [emitida, setEmitida] = useState(null);

  const poner = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    if (!cliente) return;
    setEnviando(true);
    setErrores({});
    try {
      const r = await api.crearSolicitud({ ...datos, rut_cliente: cliente.rut_cliente, rut_maestro: maestro.rut_maestro });
      setEmitida(r.data);
      avisar(`Solicitud ${folio(r.data.id_solicitud)} enviada a ${maestro.nombre}.`);
    } catch (error) {
      setErrores({ ...error.porCampo?.(), general: error.message });
    } finally {
      setEnviando(false);
    }
  };

  if (emitida) {
    return (
      <section className="orden orden--emitida" aria-labelledby="orden-titulo">
        <header className="orden__cabecera">
          <h2 id="orden-titulo">Orden de trabajo</h2>
          <p className="orden__folio orden__folio--timbrado">{folio(emitida.id_solicitud)}</p>
        </header>
        <Timbre estado={emitida.estado} grande />
        <p>
          {maestro.nombre} recibió tu solicitud para el {fecha(datos.fecha_servicio)}. Cuando la acepte,
          verás el cambio de estado en tus solicitudes.
        </p>
        <div className="orden__acciones">
          <button type="button" className="boton" onClick={() => navegar('/solicitudes')}>Ver mis solicitudes</button>
          <Link to="/catalogo" className="boton boton--secundario">Buscar otro maestro</Link>
        </div>
      </section>
    );
  }

  const bloqueado = !maestro.disponible;

  return (
    <form className="orden" onSubmit={enviar} aria-labelledby="orden-titulo" noValidate>
      <header className="orden__cabecera">
        <h2 id="orden-titulo">Orden de trabajo</h2>
        <p className="orden__folio" aria-label="El folio se asigna al enviar">N° ——————</p>
      </header>

      <dl className="orden__partes">
        <div>
          <dt>Cliente</dt>
          <dd>{cliente ? cliente.nombre : 'Elige un cliente arriba, en «Actúas como»'}</dd>
        </div>
        <div>
          <dt>Maestro</dt>
          <dd>{maestro.nombre}</dd>
        </div>
      </dl>

      {bloqueado && (
        <p className="orden__aviso">Este maestro no está recibiendo solicitudes por ahora. Puedes buscar otro en la misma región.</p>
      )}

      <fieldset disabled={bloqueado || enviando} className="orden__campos">
        <Campo etiqueta="¿Qué necesitas?" requerido id="orden-descripcion" error={errores.descripcion}
          ayuda="Cuenta qué pasa y desde cuándo. Mínimo 15 caracteres.">
          <textarea id="orden-descripcion" className="entrada" value={datos.descripcion} onChange={poner('descripcion')}
            maxLength={1000} aria-invalid={Boolean(errores.descripcion)}
            placeholder="Ej.: gotea la llave del lavaplatos aunque esté cerrada." />
        </Campo>
        <Campo etiqueta="Dirección" requerido id="orden-direccion" error={errores.direccion}>
          <input id="orden-direccion" className="entrada" value={datos.direccion} onChange={poner('direccion')}
            maxLength={200} autoComplete="street-address" aria-invalid={Boolean(errores.direccion)}
            placeholder="Calle, número y comuna" />
        </Campo>
        <Campo etiqueta="Día que te acomoda" requerido id="orden-fecha" error={errores.fecha_servicio}>
          <input id="orden-fecha" type="date" className="entrada" min={hoyISO()} value={datos.fecha_servicio}
            onChange={poner('fecha_servicio')} aria-invalid={Boolean(errores.fecha_servicio)} />
        </Campo>
      </fieldset>

      {errores.general && <p className="orden__error" role="alert">{errores.general}</p>}

      <button type="submit" className="boton orden__enviar" disabled={bloqueado || enviando || !cliente}>
        {enviando ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  );
}

export default function PerfilMaestro() {
  const { rut } = useParams();
  const { datos: m, error, cargando, recargar } = usePeticion((s) => api.maestro(rut, s), [rut]);
  useTitulo(m ? `${m.nombre}, ${m.oficio.toLowerCase()}` : 'Perfil del maestro');

  if (cargando) return <div className="contenedor"><Cargando /></div>;
  if (error) return <div className="contenedor"><CajaError error={error} alReintentar={recargar} /></div>;

  return (
    <div className="contenedor perfil">
      <article className="perfil__ficha">
        <p className="perfil__volver"><Link to={`/catalogo?region=${m.id_region}&oficio=${m.id_oficio}`}>Ver más maestros de {m.oficio.toLowerCase()} en {m.region}</Link></p>
        <h1>{m.nombre}</h1>
        <p className="perfil__oficio">{m.oficio} en {m.region}</p>

        <dl className="perfil__datos">
          <div><dt>Nota</dt><dd><Reputacion promedio={m.promedio} total={m.total_resenas} /></dd></div>
          <div><dt>Tarifa</dt><dd>{clp(m.tarifa_hora)} la hora</dd></div>
          <div><dt>Experiencia</dt><dd>{plural(m.experiencia_anios, 'año', 'años')}</dd></div>
          <div><dt>Trabajos terminados</dt><dd>{m.trabajos_finalizados}</dd></div>
        </dl>
        <Disponibilidad disponible={m.disponible} />

        {m.descripcion && <p className="perfil__descripcion">{m.descripcion}</p>}
        <p className="perfil__privacidad">El teléfono del maestro se comparte cuando acepta tu solicitud.</p>

        <section className="resenas" aria-labelledby="titulo-resenas">
          <h2 id="titulo-resenas">Reseñas</h2>
          {m.resenas.length === 0 ? (
            <p className="resenas__vacio">Aún no tiene reseñas. La primera la deja el cliente de su primer trabajo terminado.</p>
          ) : (
            <ul>
              {m.resenas.map((r) => (
                <li key={r.id_calificacion} className="resena">
                  <p className="resena__nota" role="img" aria-label={`${r.puntuacion} de 5 estrellas`}>
                    {[1, 2, 3, 4, 5].map((i) => <Estrella key={i} llena={i <= r.puntuacion} />)}
                  </p>
                  {r.comentario && <p className="resena__texto">{r.comentario}</p>}
                  <p className="resena__autor">{r.cliente}, {fecha(r.fecha)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>

      <aside className="perfil__orden">
        <OrdenDeTrabajo maestro={m} />
      </aside>
    </div>
  );
}
