import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api/cliente.js';
import BloqueSQL from '../components/BloqueSQL.jsx';
import { CajaError, Cargando } from '../components/Piezas.jsx';
import { usePeticion } from '../hooks/usePeticion.js';
import { useTitulo } from '../hooks/usePagina.js';
import { plural } from '../utils/formato.js';

const ms = (n) => `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} ms`;

function etiquetaTipo(c) {
  if (c.tipo === 'SELECT') return c.conJoin ? 'SELECT con JOIN' : 'SELECT simple';
  return c.tipo;
}

const CIERRE = {
  abortTransaction: 'Las escrituras corrieron en una transacción que se abortó: la base de datos quedó igual que antes.',
  'Validador restaurado': 'Después de comprobar el cambio se restauró el validador original.',
  'Colección temporal eliminada': 'La colección temporal se creó y se eliminó en la misma ejecución.',
};

function Plan({ plan }) {
  return (
    <div className="plan">
      <h4>Cómo la resolvió MongoDB</h4>
      <p className="plan__etapas" aria-label={`Etapas: ${[...plan.etapas].reverse().join(', ')}`}>
        {[...plan.etapas].reverse().map((e, i) => (
          <span key={i} className="plan__paso">
            {i > 0 && <span className="plan__flecha" aria-hidden="true">→</span>}
            <span className={`plan__etapa${/IXSCAN/.test(e) ? ' plan__etapa--indice' : ''}`}>{e}</span>
          </span>
        ))}
      </p>
      <dl className="plan__cifras">
        <div><dt>Índice</dt><dd><code>{plan.indice ?? 'ninguno'}</code></dd></div>
        <div><dt>Claves revisadas</dt><dd>{plan.clavesExaminadas}</dd></div>
        <div><dt>Documentos revisados</dt><dd>{plan.documentosExaminados}</dd></div>
        <div><dt>Devueltos</dt><dd>{plan.devueltos}</dd></div>
        <div><dt>Orden</dt><dd>{plan.ordenEnMemoria ? 'En memoria' : 'Lo da el índice'}</dd></div>
      </dl>
    </div>
  );
}

function Resultado({ r }) {
  const principal = r.pasos[0];
  const resumen = r.modo === 'lectura'
    ? `Devolvió ${plural(principal.cantidad, 'documento', 'documentos')} en ${ms(r.ms)}.`
    : `${plural(r.pasos.length, 'operación ejecutada', 'operaciones ejecutadas')} en ${ms(r.ms)}.`;

  return (
    <section className="lab__resultado" aria-live="polite">
      <p className="lab__resumen"><strong>{resumen}</strong> {CIERRE[r.cierre] ?? ''}</p>
      {r.plan && <Plan plan={r.plan} />}
      {r.pasos.map((p, i) => (
        <div key={i} className="paso-respuesta">
          <h4>
            {r.pasos.length > 1 ? `Paso ${i + 1}` : 'Respuesta de MongoDB'}{p.nota ? `: ${p.nota.toLowerCase()}` : ''}
            {p.cantidad > p.resultado.length && <span className="paso-respuesta__nota">, se muestran {p.resultado.length} de {p.cantidad}</span>}
          </h4>
          {p.resultado.length > 0
            ? <BloqueSQL sql={p.resultado.join(',\n')} lenguaje="mql" titulo={`Respuesta del paso ${i + 1}`} />
            : <p className="lab__sin-filas">Sin resultados.</p>}
        </div>
      ))}
    </section>
  );
}

function Detalle({ c, resultado, alEjecutar, ejecutando }) {
  return (
    <article className="lab__detalle hoja" aria-labelledby="lab-titulo">
      <header className="lab__cabecera">
        <p className="lab__numero">Consulta {c.numero}</p>
        <span className={`etiqueta-sql etiqueta-sql--${c.tipo.toLowerCase()}`}>{etiquetaTipo(c)}</span>
      </header>
      <h2 id="lab-titulo">{c.titulo}</h2>
      <p className="lab__descripcion">{c.descripcion}</p>

      <dl className="trazabilidad">
        <div><dt>Requisito</dt><dd>{c.trazabilidad.requisito}</dd></div>
        <div><dt>Caso de uso</dt><dd>{c.trazabilidad.casoDeUso}</dd></div>
        <div><dt>Colecciones</dt><dd>{c.trazabilidad.colecciones.join(', ')}</dd></div>
        <div><dt>Desde la app</dt><dd>{c.endpoint ? <code>{c.endpoint}</code> : 'Solo en este laboratorio (cambio de estructura)'}</dd></div>
      </dl>

      <p className="conversion"><span className="conversion__rotulo">Conversión</span>{c.conversion}</p>

      <div className="comparacion">
        <div className="comparacion__lado">
          <h3 className="lab__motor">SQL <span>Etapa I, modelo relacional</span></h3>
          <BloqueSQL sql={c.sql} titulo="SQL de la Etapa I" />
          {c.algebra && (
            <details className="lab__preparacion">
              <summary>Álgebra relacional</summary>
              <pre className="algebra">{c.algebra.join('\n')}</pre>
            </details>
          )}
        </div>
        <div className="comparacion__lado">
          <h3 className="lab__motor">MQL <span>Etapa II, MongoDB (lo que se ejecuta)</span></h3>
          <BloqueSQL sql={c.mql} lenguaje="mql" titulo="MQL de la Etapa II" />
        </div>
      </div>

      <button type="button" className="boton lab__ejecutar" onClick={alEjecutar} disabled={ejecutando}>
        {ejecutando ? 'Ejecutando…' : `Ejecutar la consulta ${c.numero} en MongoDB`}
      </button>

      {resultado?.error && <CajaError error={resultado.error} />}
      {resultado?.datos && <Resultado r={resultado.datos} />}
    </article>
  );
}

function PruebasIntegridad({ pruebas }) {
  const [resultados, setResultados] = useState({});

  const probar = async (codigo) => {
    setResultados((r) => ({ ...r, [codigo]: { cargando: true } }));
    try {
      const r = await api.probarIntegridad(codigo);
      setResultados((x) => ({ ...x, [codigo]: { datos: r.data } }));
    } catch (error) {
      setResultados((x) => ({ ...x, [codigo]: { error } }));
    }
  };

  return (
    <section className="integridad" aria-labelledby="titulo-integridad">
      <h2 id="titulo-integridad">La base de datos se defiende, y lo que no protege</h2>
      <p>
        Estas operaciones son incorrectas a propósito. Se envían directo a MongoDB, sin pasar por las validaciones
        de la API, para mostrar qué rechaza el validador de cada colección. La última muestra una regla de la
        Etapa I que MongoDB no tiene y que por eso cumple la API.
      </p>
      <ul className="integridad__lista">
        {pruebas.map((p) => {
          const r = resultados[p.codigo];
          const leccion = p.esperado === 'aceptada';
          return (
            <li key={p.codigo} className={`integridad__item hoja${leccion ? ' integridad__item--leccion' : ''}`}>
              <p className="integridad__regla">{p.codigo}, {p.regla}</p>
              <h3>{p.titulo}</h3>
              <p className="integridad__esperado">En la Etapa I: {p.equivalente}</p>
              <button type="button" className="boton boton--secundario boton--chico" onClick={() => probar(p.codigo)} disabled={r?.cargando}>
                {r?.cargando ? 'Probando…' : 'Intentar'}
              </button>
              {r?.datos && (
                <p className={`integridad__veredicto${r.datos.cumpleLoEsperado ? '' : ' integridad__veredicto--mal'}${leccion ? ' integridad__veredicto--leccion' : ''}`}>
                  {r.datos.rechazada && <>Rechazada: {r.datos.nombreError ?? 'error'} (código {r.datos.codigoMongo}).</>}
                  {!r.datos.rechazada && p.esperado === 'sin coincidencias' && <>No se modificó nada: el filtro <code>calificacion: null</code> no encontró la solicitud.</>}
                  {!r.datos.rechazada && leccion && <>MongoDB lo aceptó. {p.leccion}</>}
                  {r.datos.motivo && <span className="integridad__mensaje">{r.datos.motivo}</span>}
                  {!r.datos.rechazada && <span className="integridad__mensaje">{r.datos.resultado.replace(/\s+/g, ' ')}</span>}
                </p>
              )}
              {r?.error && <CajaError error={r.error} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function Consultas() {
  useTitulo('Consultas');
  const catalogo = usePeticion((s) => api.consultas(s), []);
  const [params, setParams] = useSearchParams();
  const elegida = Number(params.get('n')) || 1;
  const [resultados, setResultados] = useState({});
  const [enCurso, setEnCurso] = useState(null);

  const ejecutar = async (numero) => {
    setEnCurso(numero);
    try {
      const r = await api.ejecutarConsulta(numero);
      setResultados((x) => ({ ...x, [numero]: { datos: r.data } }));
    } catch (error) {
      setResultados((x) => ({ ...x, [numero]: { error } }));
    } finally {
      setEnCurso(null);
    }
  };

  const ejecutarTodas = async () => {
    for (const c of catalogo.datos.consultas) {
      // Una a la vez: cada una abre y cierra su propia transacción.
      // eslint-disable-next-line no-await-in-loop
      await ejecutar(c.numero);
    }
  };

  if (catalogo.cargando) return <div className="contenedor"><Cargando texto="Cargando las consultas…" /></div>;
  if (catalogo.error) return <div className="contenedor"><CajaError error={catalogo.error} alReintentar={catalogo.recargar} /></div>;

  const { consultas, pruebas } = catalogo.datos;
  const actual = consultas.find((c) => c.numero === elegida) ?? consultas[0];
  const ejecutadas = Object.values(resultados).filter((r) => r.datos).length;
  const fallidas = Object.values(resultados).filter((r) => r.error).length;

  return (
    <div className="contenedor lab">
      <header className="pagina__cabecera">
        <h1>Consultas: de SQL a MongoDB</h1>
        <p>
          Las 13 consultas de la Etapa I, convertidas a MQL y ejecutadas sobre la base MongoDB de la aplicación.
          El SQL se muestra solo como referencia de la conversión. Las escrituras corren en una transacción que se
          aborta, así puedes repetirlas sin cambiar los datos. El modelo completo está en <Link to="/nosql">Modelo NoSQL</Link>.
        </p>
      </header>

      <div className="lab__cuerpo">
        <nav className="lab__indice" aria-label="Las 13 consultas">
          <button type="button" className="boton lab__todas" onClick={ejecutarTodas} disabled={enCurso !== null}>
            {enCurso !== null ? `Ejecutando la ${enCurso} de 13…` : 'Ejecutar las 13'}
          </button>
          {(ejecutadas > 0 || fallidas > 0) && (
            <p className="lab__marcador" role="status">
              {ejecutadas} de 13 funcionaron{fallidas > 0 && `, ${fallidas} con error`}.
            </p>
          )}
          <ol>
            {consultas.map((c) => {
              const r = resultados[c.numero];
              return (
                <li key={c.numero}>
                  <button type="button" aria-current={c.numero === actual.numero ? 'true' : undefined}
                    onClick={() => setParams({ n: c.numero }, { replace: true, preventScrollReset: true })}>
                    <span className="lab__indice-num">{c.numero}</span>
                    <span className="lab__indice-texto">
                      <span className={`etiqueta-sql etiqueta-sql--${c.tipo.toLowerCase()}`}>{etiquetaTipo(c)}</span>
                      {c.titulo}
                    </span>
                    {r?.datos && <span className="lab__ok" aria-label="Funcionó">✓</span>}
                    {r?.error && <span className="lab__falla" aria-label="Falló">✕</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <Detalle
          c={actual}
          resultado={resultados[actual.numero]}
          ejecutando={enCurso === actual.numero}
          alEjecutar={() => ejecutar(actual.numero)}
        />
      </div>

      <PruebasIntegridad pruebas={pruebas} />
    </div>
  );
}
