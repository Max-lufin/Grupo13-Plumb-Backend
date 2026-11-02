import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/cliente.js';
import BloqueSQL from '../components/BloqueSQL.jsx';
import { CajaError, Cargando } from '../components/Piezas.jsx';
import { usePeticion } from '../hooks/usePeticion.js';
import { useTitulo } from '../hooks/usePagina.js';

const ms = (n) => `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} ms`;

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
          <span>Modelo relacional</span><span>MongoDB</span><span>Por qué</span>
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
                : 'Ninguna tabla: reemplaza a los SERIAL del modelo relacional'}
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

export default function Nosql() {
  useTitulo('Modelo NoSQL');
  const resumen = usePeticion((s) => api.nosql(s), []);

  if (resumen.cargando) return <div className="contenedor"><Cargando texto="Conectando con MongoDB…" /></div>;
  if (resumen.error) return <div className="contenedor"><CajaError error={resumen.error} alReintentar={resumen.recargar} /></div>;

  const { estado, traspaso, duplicados, colecciones } = resumen.datos;

  return (
    <div className="contenedor nosql">
      <header className="pagina__cabecera nosql__cabecera">
        <p className="nosql__antetitulo">Modelo de datos en MongoDB</p>
        <h1>Del modelo relacional a documentos</h1>
        <p>
          Las 7 tablas del modelo relacional de la Etapa I pasaron a 3 colecciones de datos y una técnica. Aquí
          están las decisiones de cada tabla, el costo de los datos copiados y un documento real por colección,
          con sus índices y su validador. Las consultas convertidas se ejecutan en <Link to="/consultas">Consultas</Link>.
        </p>
        <EstadoMongo estado={estado} />
      </header>

      <nav className="nosql__indice" aria-label="En esta página">
        <a href="#traspaso"><span>1</span>Traspaso</a>
        <a href="#colecciones"><span>2</span>Colecciones</a>
      </nav>

      <Traspaso filas={traspaso} duplicados={duplicados} />
      <Colecciones colecciones={colecciones} />
    </div>
  );
}
