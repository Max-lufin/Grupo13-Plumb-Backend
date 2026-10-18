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

function valorCelda(v) {
  if (v === null || v === undefined) return <span className="parametros__nulo">NULL</span>;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function TablaFilas({ columnas, filas }) {
  if (!filas.length) return <p className="lab__sin-filas">La sentencia no devolvió filas.</p>;
  const cols = columnas?.length ? columnas : Object.keys(filas[0]);
  return (
    <div className="tabla-marco" tabIndex={0} role="region" aria-label="Filas devueltas">
      <table className="tabla tabla--compacta">
        <thead><tr>{cols.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>
          {filas.slice(0, 25).map((f, i) => (
            <tr key={i}>{cols.map((c) => <td key={c}>{valorCelda(f[c])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Resultado({ r }) {
  const filas = r.filasAfectadas ?? r.filas.length;
  let resumen;
  if (r.tipo === 'SELECT') resumen = `Devolvió ${plural(r.filas.length, 'fila', 'filas')} en ${ms(r.ms)}.`;
  else if (['ALTER', 'DROP'].includes(r.tipo)) resumen = `${r.comando} ejecutado en ${ms(r.ms)}.`;
  else resumen = `${r.comando} afectó ${plural(filas, 'fila', 'filas')} en ${ms(r.ms)}.`;

  return (
    <section className="lab__resultado" aria-live="polite">
      <p className="lab__resumen">
        <strong>{resumen}</strong>{' '}
        Después se hizo ROLLBACK, así que la base de datos quedó igual que antes.
      </p>
      {r.parametros.length > 0 && (
        <>
          <h4>Parámetros enviados</h4>
          <dl className="parametros">
            {r.parametros.map((p, i) => (
              <div key={i}><dt>${i + 1} {p.nombre}</dt><dd>{valorCelda(p.valor)}</dd></div>
            ))}
          </dl>
        </>
      )}
      {r.filas.length > 0 && (
        <>
          <h4>{r.tipo === 'SELECT' ? 'Filas devueltas' : 'Filas devueltas por RETURNING'}</h4>
          <TablaFilas columnas={r.columnas} filas={r.filas} />
        </>
      )}
      {r.verificacion && (
        <>
          <h4>Comprobación: {r.verificacion.descripcion.toLowerCase()}</h4>
          <TablaFilas filas={r.verificacion.filas} />
        </>
      )}
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
        <div><dt>Tablas</dt><dd>{c.trazabilidad.tablas.join(', ')}</dd></div>
        <div><dt>Desde la app</dt><dd>{c.endpoint ? <code>{c.endpoint}</code> : 'Solo en este laboratorio (cambio de estructura)'}</dd></div>
      </dl>

      {c.algebra && (
        <>
          <h3>Álgebra relacional</h3>
          <pre className="algebra">{c.algebra.join('\n')}</pre>
        </>
      )}

      {c.preparacion && (
        <details className="lab__preparacion">
          <summary>Preparación dentro de la misma transacción</summary>
          <BloqueSQL sql={c.preparacion} />
        </details>
      )}

      <h3 className="lab__motor">SQL <span>PostgreSQL</span></h3>
      <BloqueSQL sql={c.sql} />

      {c.mql && (
        <>
          <h3 className="lab__motor">MQL <span>MongoDB, mismo caso sobre el modelo de documentos</span></h3>
          <BloqueSQL sql={c.mql} lenguaje="mql" />
        </>
      )}

      <button type="button" className="boton lab__ejecutar" onClick={alEjecutar} disabled={ejecutando}>
        {ejecutando ? 'Ejecutando…' : `Ejecutar consulta ${c.numero}`}
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
      <h2 id="titulo-integridad">La base de datos se defiende sola</h2>
      <p>
        Estas operaciones son incorrectas a propósito. Se envían directo a PostgreSQL, sin pasar por las
        validaciones de la API, para mostrar que las restricciones del modelo relacional las rechazan.
      </p>
      <ul className="integridad__lista">
        {pruebas.map((p) => {
          const r = resultados[p.codigo];
          return (
            <li key={p.codigo} className="integridad__item hoja">
              <p className="integridad__regla">{p.codigo}, {p.regla}</p>
              <h3>{p.titulo}</h3>
              <p className="integridad__esperado">Debe fallar por <code>{p.restriccionEsperada}</code></p>
              <button type="button" className="boton boton--secundario boton--chico" onClick={() => probar(p.codigo)} disabled={r?.cargando}>
                {r?.cargando ? 'Probando…' : 'Intentar'}
              </button>
              {r?.datos && (
                <p className={`integridad__veredicto${r.datos.cumpleLoEsperado ? '' : ' integridad__veredicto--mal'}`}>
                  {r.datos.cumpleLoEsperado
                    ? <>Rechazada por <code>{r.datos.restriccion}</code>, como se esperaba.</>
                    : <>Resultado inesperado: {r.datos.restriccion ?? 'la operación se aceptó'}.</>}
                  {r.datos.mensajePostgres && <span className="integridad__mensaje">{r.datos.mensajePostgres}</span>}
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
  useTitulo('Consultas SQL');
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

  if (catalogo.cargando) return <div className="contenedor"><Cargando /></div>;
  if (catalogo.error) return <div className="contenedor"><CajaError error={catalogo.error} alReintentar={catalogo.recargar} /></div>;

  const { consultas, pruebas } = catalogo.datos;
  const actual = consultas.find((c) => c.numero === elegida) ?? consultas[0];
  const ejecutadas = Object.values(resultados).filter((r) => r.datos).length;
  const fallidas = Object.values(resultados).filter((r) => r.error).length;

  return (
    <div className="contenedor lab">
      <header className="pagina__cabecera">
        <h1>Consultas SQL de la Etapa I</h1>
        <p>
          Las 13 consultas de la Etapa I se ejecutan aquí contra la base de datos real. Cada una corre dentro de
          una transacción que termina en ROLLBACK: puedes repetirlas cuantas veces quieras sin cambiar los datos.
          Bajo cada SQL está su traducción a MongoDB; las principales se comparan en vivo en el{' '}
          <Link to="/nosql">modelo NoSQL</Link>.
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
                    onClick={() => setParams({ n: c.numero }, { replace: true })}>
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
