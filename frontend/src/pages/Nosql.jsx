import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api/cliente.js';
import BloqueSQL from '../components/BloqueSQL.jsx';
import { CajaError, Cargando } from '../components/Piezas.jsx';
import { usePeticion } from '../hooks/usePeticion.js';
import { useTitulo } from '../hooks/usePagina.js';
import { plural } from '../utils/formato.js';

const ms = (n) => `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} ms`;
const TIPO = { lectura: 'Lectura', transaccion: 'Transacción' };

function EstadoMongo({ estado }) {
  return (
    <p className="nosql__estado">
      <span className="pie__luz" aria-hidden="true" />
      <span>
        Conectado a <strong>{estado.motor}</strong> en {estado.alojamiento}, base <code>{estado.baseDeDatos}</code>,
        respuesta en {ms(estado.latenciaMs)}.
      </span>
    </p>
  );
}

function Traspaso({ filas, duplicados }) {
  return (
    <section id="traspaso" className="nosql__seccion" aria-labelledby="titulo-traspaso">
      <span className="nosql__paso" aria-hidden="true">1</span>
      <h2 id="titulo-traspaso">Del modelo relacional a documentos</h2>
      <p className="nosql__intro">
        Cada tabla se decidió mirando qué pantallas la leen y cuántas veces. Lo que se lee junto se guarda
        junto; lo que crece sin límite va en su propia colección.
      </p>

      <ol className="traspaso">
        <li className="traspaso__fila traspaso__fila--titulos" aria-hidden="true">
          <span>PostgreSQL</span><span>MongoDB</span><span>Por qué</span>
        </li>
        {filas.map((f) => (
          <li key={f.tabla} className="traspaso__fila">
            <p className="traspaso__tabla"><span className="visualmente-oculto">Tabla </span><code>{f.tabla}</code></p>
            <div className="traspaso__destino">
              <span className="visualmente-oculto">pasa a </span>
              <code>{f.destino}</code>
              <span className="traspaso__decision">{f.decision}</span>
            </div>
            <div className="traspaso__porque">
              <p>{f.porque}</p>
              <p className="traspaso__consultas">
                Resuelve {f.consultas.map((q) => <span key={q} className="codigo-q">{q}</span>)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <h3 className="nosql__subtitulo">El costo de copiar datos</h3>
      <p className="nosql__intro">
        Copiar un nombre evita un $lookup en cada búsqueda, pero obliga a actualizar cada copia cuando el
        original cambia. Solo se copió lo que casi nunca cambia o lo que se actualiza en la misma transacción.
      </p>
      <div className="tabla-marco" tabIndex={0} role="region" aria-label="Datos copiados y cómo se mantienen">
        <table className="tabla">
          <thead>
            <tr><th scope="col">Dato copiado</th><th scope="col">Dónde vive la copia</th><th scope="col">Cuándo cambia</th><th scope="col">Cómo se mantiene al día</th></tr>
          </thead>
          <tbody>
            {duplicados.map((d) => (
              <tr key={d.dato}>
                <th scope="row">{d.dato}</th>
                <td><code className="nosql__ruta">{d.donde}</code></td>
                <td>{d.cambia}</td>
                <td>{d.mantiene}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Colecciones({ colecciones }) {
  const [elegida, setElegida] = useState(colecciones[0].nombre);
  const c = colecciones.find((x) => x.nombre === elegida);

  return (
    <section id="colecciones" className="nosql__seccion" aria-labelledby="titulo-colecciones">
      <span className="nosql__paso" aria-hidden="true">2</span>
      <h2 id="titulo-colecciones">Las colecciones y sus documentos</h2>
      <p className="nosql__intro">
        Documentos reales leídos ahora desde MongoDB, con sus tipos: <code>ObjectId</code>, <code>ISODate</code>,
        enteros y decimales. Cada colección tiene un validador <code>$jsonSchema</code> y los índices que piden sus consultas.
      </p>

      <div className="pestanas pestanas--desplazables" role="group" aria-label="Colección">
        {colecciones.map((x) => (
          <button key={x.nombre} type="button" aria-pressed={x.nombre === elegida} onClick={() => setElegida(x.nombre)}>
            {x.nombre} <span className="pestanas__cuenta">{x.total}</span>
          </button>
        ))}
      </div>

      <div className="pestana coleccion">
        <div className="coleccion__documento">
          <h3>Un documento de <code>{c.nombre}</code></h3>
          {c.ejemplo ? <BloqueSQL sql={c.ejemplo} lenguaje="mql" titulo={`Documento de ${c.nombre}`} /> : <p>La colección está vacía.</p>}
        </div>

        <dl className="coleccion__ficha">
          <div>
            <dt>Viene de</dt>
            <dd>
              {c.origen.length
                ? c.origen.map((t) => <code key={t} className="coleccion__tabla">{t}</code>)
                : 'Ninguna tabla: reemplaza al SERIAL de PostgreSQL'}
            </dd>
          </div>
          <div>
            <dt>Resuelve</dt>
            <dd><ul className="coleccion__lista">{c.resuelve.map((r) => <li key={r}>{r}</li>)}</ul></dd>
          </div>
          <div>
            <dt>Documentos</dt>
            <dd className="coleccion__total">{c.total}</dd>
          </div>
          <div>
            <dt>Índices</dt>
            <dd>
              <ul className="coleccion__lista coleccion__indices">
                {c.indices.map((i) => (
                  <li key={i.nombre}>
                    <code className="coleccion__indice">{i.nombre}</code>
                    {i.unico && <span className="etiqueta-sql etiqueta-sql--alter">único</span>}
                    <code className="coleccion__clave">{i.clave}</code>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>

        {c.validador && (
          <details className="coleccion__validador">
            <summary>Ver el validador de <code>{c.nombre}</code></summary>
            <BloqueSQL sql={c.validador} lenguaje="mql" titulo={`Validador de ${c.nombre}`} />
          </details>
        )}
      </div>
    </section>
  );
}

function Veredicto({ r }) {
  const { equivalente, mismoOrden, mongo } = r.comparacion;
  const n = mongo.length;
  return (
    <p className={`veredicto${equivalente ? '' : ' veredicto--mal'}`} role="status">
      <strong>{equivalente ? 'Mismo resultado en los dos motores' : 'Los motores no coinciden'}</strong>
      <span>
        {r.tipo === 'lectura'
          ? `${plural(n, 'elemento', 'elementos')} comparados${equivalente && mismoOrden ? ', en el mismo orden' : ''}.`
          : 'Se comparó el efecto de la operación. Luego se abortó la transacción en MongoDB y se hizo ROLLBACK en PostgreSQL.'}
      </span>
    </p>
  );
}

function Plan({ plan }) {
  return (
    <div className="plan">
      <h4>Cómo la resolvió MongoDB</h4>
      <p className="plan__etapas" aria-label={`Etapas: ${[...plan.etapas].reverse().join(', ')}`}>
        {[...plan.etapas].reverse().map((e, i) => (
          <span key={i} className={`plan__etapa${/IXSCAN/.test(e) ? ' plan__etapa--indice' : ''}`}>{e}</span>
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
  return (
    <section className="lab__resultado" aria-live="polite">
      <Veredicto r={r} />
      <div className="duelo">
        <div className="duelo__lado">
          <h4>MongoDB <span>{ms(r.mongo.ms)}</span></h4>
          <ul>{r.comparacion.mongo.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
        <div className="duelo__lado">
          <h4>PostgreSQL <span>{ms(r.sql.reduce((t, s) => t + s.ms, 0))}</span></h4>
          <ul>{r.comparacion.sql.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      </div>
      {r.mongo.plan && <Plan plan={r.mongo.plan} />}
      <details className="lab__preparacion">
        <summary>Respuesta de MongoDB en cada paso</summary>
        {r.mongo.pasos.map((p, i) => (
          <div key={i} className="paso-respuesta">
            <p>Paso {i + 1}{p.nota ? `, ${p.nota.toLowerCase()}` : ''}: {plural(p.cantidad, 'resultado', 'resultados')}{p.cantidad > p.resultado.length ? `, se muestran ${p.resultado.length}` : ''}</p>
            <BloqueSQL sql={p.resultado.join(',\n')} lenguaje="mql" titulo={`Respuesta del paso ${i + 1}`} />
          </div>
        ))}
      </details>
    </section>
  );
}

function DetalleConsulta({ c, resultado, ejecutando, alEjecutar }) {
  return (
    <article className="lab__detalle hoja" aria-labelledby="nosql-titulo">
      <header className="lab__cabecera">
        <p className="lab__numero">{c.codigo}</p>
        <span className={`etiqueta-sql etiqueta-sql--${c.tipo === 'lectura' ? 'select' : 'update'}`}>{TIPO[c.tipo]}</span>
      </header>
      <h2 id="nosql-titulo">{c.titulo}</h2>
      <p className="lab__descripcion">{c.porque}</p>

      <dl className="trazabilidad">
        <div><dt>Pantalla</dt><dd>{c.pantalla}</dd></div>
        <div><dt>Índice que usa</dt><dd>{c.indice ? <code>{c.indice}</code> : 'Escritura: no aplica'}</dd></div>
      </dl>

      <h3 className="lab__motor">MQL <span>MongoDB{c.pasos.length > 1 ? `, ${c.pasos.length} pasos` : ''}</span></h3>
      <ol className="pasos-mql">
        {c.pasos.map((p, i) => (
          <li key={i}>
            {c.pasos.length > 1 && <p className="pasos-mql__rotulo">Paso {i + 1}{p.nota ? `, ${p.nota.toLowerCase()}` : ''}</p>}
            <BloqueSQL sql={p.texto} lenguaje="mql" titulo={`Paso ${i + 1}`} />
          </li>
        ))}
      </ol>

      <h3 className="lab__motor">SQL <span>PostgreSQL, la consulta equivalente</span></h3>
      {c.sql.map((s, i) => (
        <div key={i} className="pasos-sql">
          <BloqueSQL sql={s.texto} />
          {s.valores.length > 0 && (
            <p className="pasos-sql__valores">
              Parámetros: {s.valores.map((v, j) => <code key={j}>${j + 1} = {v === null ? 'NULL' : String(v)}</code>)}
            </p>
          )}
        </div>
      ))}

      <button type="button" className="boton lab__ejecutar" onClick={alEjecutar} disabled={ejecutando}>
        {ejecutando ? 'Ejecutando…' : 'Ejecutar en los dos motores'}
      </button>

      {resultado?.error && <CajaError error={resultado.error} />}
      {resultado?.datos && <Resultado r={resultado.datos} />}
    </article>
  );
}

function Consultas({ consultas }) {
  const [params, setParams] = useSearchParams();
  const actual = consultas.find((c) => c.codigo === params.get('q')) ?? consultas[0];
  const [resultados, setResultados] = useState({});
  const [enCurso, setEnCurso] = useState(null);

  const ejecutar = async (codigo) => {
    setEnCurso(codigo);
    try {
      const r = await api.ejecutarNosql(codigo);
      setResultados((x) => ({ ...x, [codigo]: { datos: r.data } }));
    } catch (error) {
      setResultados((x) => ({ ...x, [codigo]: { error } }));
    } finally {
      setEnCurso(null);
    }
  };

  const ejecutarTodas = async () => {
    for (const c of consultas) {
      // Una a la vez, como en el laboratorio SQL.
      // eslint-disable-next-line no-await-in-loop
      await ejecutar(c.codigo);
    }
  };

  const hechas = Object.values(resultados).filter((r) => r.datos);
  const iguales = hechas.filter((r) => r.datos.comparacion.equivalente).length;

  return (
    <section id="consultas" className="nosql__seccion" aria-labelledby="titulo-consultas">
      <span className="nosql__paso" aria-hidden="true">3</span>
      <h2 id="titulo-consultas">Las consultas principales, en los dos motores</h2>
      <p className="nosql__intro">
        Cinco lecturas que sostienen las pantallas y tres escrituras que muestran el costo del modelo. Cada una
        se ejecuta en MongoDB y en PostgreSQL, y la API compara los resultados. Las escrituras corren en una
        transacción que se aborta: nada queda guardado.
      </p>

      <div className="lab__cuerpo">
        <nav className="lab__indice" aria-label="Consultas NoSQL">
          <button type="button" className="boton lab__todas" onClick={ejecutarTodas} disabled={enCurso !== null}>
            {enCurso !== null ? `Ejecutando ${enCurso}…` : `Ejecutar las ${consultas.length}`}
          </button>
          {hechas.length > 0 && (
            <p className="lab__marcador" role="status">
              {iguales} de {hechas.length} con el mismo resultado en ambos motores.
            </p>
          )}
          <ol>
            {consultas.map((c) => {
              const r = resultados[c.codigo];
              return (
                <li key={c.codigo}>
                  <button type="button" aria-current={c.codigo === actual.codigo ? 'true' : undefined}
                    onClick={() => setParams({ q: c.codigo }, { replace: true, preventScrollReset: true })}>
                    <span className="lab__indice-num">{c.codigo}</span>
                    <span className="lab__indice-texto">
                      <span className={`etiqueta-sql etiqueta-sql--${c.tipo === 'lectura' ? 'select' : 'update'}`}>{TIPO[c.tipo]}</span>
                      {c.titulo}
                    </span>
                    {r?.datos && (r.datos.comparacion.equivalente
                      ? <span className="lab__ok" aria-label="Mismo resultado">✓</span>
                      : <span className="lab__falla" aria-label="Distinto resultado">✕</span>)}
                    {r?.error && <span className="lab__falla" aria-label="Falló">✕</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <DetalleConsulta
          c={actual}
          resultado={resultados[actual.codigo]}
          ejecutando={enCurso === actual.codigo}
          alEjecutar={() => ejecutar(actual.codigo)}
        />
      </div>
    </section>
  );
}

function Validacion({ pruebas }) {
  const [resultados, setResultados] = useState({});

  const probar = async (codigo) => {
    setResultados((r) => ({ ...r, [codigo]: { cargando: true } }));
    try {
      const r = await api.probarNosql(codigo);
      setResultados((x) => ({ ...x, [codigo]: { datos: r.data } }));
    } catch (error) {
      setResultados((x) => ({ ...x, [codigo]: { error } }));
    }
  };

  return (
    <section id="validacion" className="nosql__seccion integridad" aria-labelledby="titulo-validacion">
      <span className="nosql__paso" aria-hidden="true">4</span>
      <h2 id="titulo-validacion">El validador se defiende, y lo que no protege</h2>
      <p className="nosql__intro">
        Las mismas trampas del laboratorio SQL, ahora contra MongoDB. El validador rechaza documentos mal
        formados; lo que MongoDB no tiene, como las claves foráneas, pasa a ser responsabilidad de la API.
      </p>
      <ul className="integridad__lista">
        {pruebas.map((p) => {
          const r = resultados[p.codigo];
          const leccion = p.esperado === 'aceptada';
          return (
            <li key={p.codigo} className={`integridad__item hoja${leccion ? ' integridad__item--leccion' : ''}`}>
              <p className="integridad__regla">{p.codigo}, {p.regla}</p>
              <h3>{p.titulo}</h3>
              <p className="integridad__esperado">En SQL: {p.equivalente}</p>
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

export default function Nosql() {
  useTitulo('Modelo NoSQL');
  const resumen = usePeticion((s) => api.nosql(s), []);
  const lab = usePeticion((s) => api.nosqlConsultas(s), []);

  if (resumen.cargando || lab.cargando) return <div className="contenedor"><Cargando texto="Conectando con MongoDB…" /></div>;
  const error = resumen.error ?? lab.error;
  if (error) {
    return (
      <div className="contenedor">
        <CajaError error={error} alReintentar={() => { resumen.recargar(); lab.recargar(); }} />
      </div>
    );
  }

  const { estado, traspaso, duplicados, colecciones } = resumen.datos;
  const { consultas, pruebas } = lab.datos;

  return (
    <div className="contenedor nosql">
      <header className="pagina__cabecera nosql__cabecera">
        <p className="nosql__antetitulo">Etapa II, modelo NoSQL</p>
        <h1>El mismo Plumb, en documentos</h1>
        <p>
          Las 6 tablas de PostgreSQL pasaron a 5 colecciones de MongoDB, más una técnica para el folio. Aquí están
          las decisiones, los documentos reales y las consultas ejecutándose en los dos motores. Las 13 consultas
          de la Etapa I, traducidas a MQL, están en <Link to="/consultas">Consultas SQL</Link>.
        </p>
        <EstadoMongo estado={estado} />
      </header>

      <nav className="nosql__indice" aria-label="En esta página">
        <a href="#traspaso"><span>1</span>Traspaso</a>
        <a href="#colecciones"><span>2</span>Colecciones</a>
        <a href="#consultas"><span>3</span>Consultas</a>
        <a href="#validacion"><span>4</span>Validación</a>
      </nav>

      <Traspaso filas={traspaso} duplicados={duplicados} />
      <Colecciones colecciones={colecciones} />
      <Consultas consultas={consultas} />
      <Validacion pruebas={pruebas} />

      <p className="nosql__nota">
        MongoDB se cargó desde PostgreSQL con <code>npm run mongo:migrar</code>. Lo que se cree después en la
        aplicación queda solo en PostgreSQL hasta volver a migrar.
      </p>
    </div>
  );
}
