import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api/cliente.js';
import BloqueSQL from '../components/BloqueSQL.jsx';
import { CajaError, Cargando, Dialogo, Disponibilidad, Reputacion } from '../components/Piezas.jsx';
import { useAngosto, useTitulo } from '../hooks/usePagina.js';
import { usePeticion } from '../hooks/usePeticion.js';
import { clp, plural } from '../utils/formato.js';

const OPCIONALES = ['tarifaMax', 'calificacionMin', 'disponible', 'experienciaMin'];

const TARIFAS = [
  ['', 'Sin tope'], ['12000', 'Hasta $12.000'], ['15000', 'Hasta $15.000'], ['20000', 'Hasta $20.000'],
  ['25000', 'Hasta $25.000'], ['30000', 'Hasta $30.000'],
];
const NOTAS = [['', 'Cualquiera'], ['3', '3 o más'], ['4', '4 o más'], ['4.5', '4,5 o más']];
const EXPERIENCIA = [['', 'Cualquiera'], ['1', '1 año o más'], ['3', '3 años o más'], ['5', '5 años o más'], ['10', '10 años o más']];

function VerSQL({ abierto, alCerrar, meta }) {
  const consulta = usePeticion((s) => (abierto ? api.consulta(3, s) : Promise.resolve({ data: null })), [abierto]);
  const filtros = meta?.filtros ?? {};
  const parametros = [
    ['$1 región', filtros.region], ['$2 oficio', filtros.oficio], ['$3 tarifa máx.', filtros.tarifaMax],
    ['$4 calificación mín.', filtros.calificacionMin], ['$5 disponible', filtros.disponible],
    ['$6 experiencia mín.', filtros.experienciaMin],
  ];
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo="Consulta 3: catálogo con filtros" ancho={820}>
      <p className="dialogo__texto">
        Es una sola sentencia parametrizada. Cada filtro opcional que no usas viaja como NULL y la
        condición <code>($n IS NULL OR …)</code> lo deja pasar, así nunca se arma SQL concatenando texto.
      </p>
      {consulta.datos && <BloqueSQL sql={consulta.datos.sql} />}
      <h3 className="dialogo__subtitulo">Parámetros de esta búsqueda</h3>
      <dl className="parametros">
        {parametros.map(([nombre, valor]) => (
          <div key={nombre}>
            <dt>{nombre}</dt>
            <dd>{valor === undefined ? <span className="parametros__nulo">NULL</span> : String(valor)}</dd>
          </div>
        ))}
      </dl>
      <Link to="/consultas?n=3" className="boton boton--secundario boton--chico">Abrir en el laboratorio de consultas</Link>
    </Dialogo>
  );
}

export default function Catalogo() {
  const [params, setParams] = useSearchParams();
  const [regiones, setRegiones] = useState([]);
  const [oficios, setOficios] = useState([]);
  const [verSQL, setVerSQL] = useState(false);

  const filtros = Object.fromEntries(['region', 'oficio', ...OPCIONALES].map((k) => [k, params.get(k) ?? '']));
  const listos = filtros.region && filtros.oficio;
  const clave = params.toString();

  useEffect(() => {
    api.regiones().then((r) => setRegiones(r.data)).catch(() => {});
    api.oficios().then((r) => setOficios(r.data)).catch(() => {});
  }, []);

  const resultado = usePeticion(
    (s) => (listos ? api.catalogo(filtros, s) : Promise.resolve({ data: null })),
    [clave],
  );

  const cambiar = (clave, valor) => {
    const siguiente = new URLSearchParams(params);
    if (valor === '' || valor === false) siguiente.delete(clave);
    else siguiente.set(clave, valor);
    setParams(siguiente, { replace: true });
  };

  const quitarOpcionales = () => {
    const siguiente = new URLSearchParams(params);
    OPCIONALES.forEach((k) => siguiente.delete(k));
    setParams(siguiente, { replace: true });
  };

  const oficioActual = oficios.find((o) => String(o.id_oficio) === filtros.oficio);
  const regionActual = regiones.find((r) => String(r.id_region) === filtros.region);
  const nActivos = OPCIONALES.filter((k) => filtros[k]).length;
  const hayOpcionales = nActivos > 0;
  const angosto = useAngosto();
  useTitulo(oficioActual && regionActual ? `${oficioActual.nombre} en ${regionActual.nombre}` : 'Buscar maestro');

  return (
    <div className="contenedor catalogo">
      <header className="pagina__cabecera">
        <h1>Buscar maestro</h1>
        <p>Región y oficio son obligatorios. Los otros cuatro filtros son opcionales y se aplican al momento.</p>
      </header>

      <div className="catalogo__cuerpo">
        <form className="filtros hoja" onSubmit={(e) => e.preventDefault()} aria-label="Filtros de búsqueda">
          <fieldset>
            <legend>Obligatorios</legend>
            <label className="campo">
              <span className="campo__etiqueta">Región<span className="campo__requerido" aria-hidden="true">*</span></span>
              <select className="entrada" required value={filtros.region} onChange={(e) => cambiar('region', e.target.value)}>
                <option value="" disabled>Elige una región</option>
                {regiones.map((r) => <option key={r.id_region} value={r.id_region}>{r.nombre}</option>)}
              </select>
            </label>
            <label className="campo">
              <span className="campo__etiqueta">Oficio<span className="campo__requerido" aria-hidden="true">*</span></span>
              <select className="entrada" required value={filtros.oficio} onChange={(e) => cambiar('oficio', e.target.value)}>
                <option value="" disabled>Elige un oficio</option>
                {oficios.map((o) => <option key={o.id_oficio} value={o.id_oficio}>{o.nombre}</option>)}
              </select>
            </label>
          </fieldset>

          {angosto ? (
            <details className="filtros__desplegable" open={hayOpcionales}>
              <summary>
                <span>Filtros opcionales{nActivos > 0 && <span className="filtros__activos">{nActivos} activos</span>}</span>
              </summary>
              <fieldset>
                <legend className="visualmente-oculto">Opcionales</legend>
            <label className="campo">
              <span className="campo__etiqueta">Tarifa por hora</span>
              <select className="entrada" value={filtros.tarifaMax} onChange={(e) => cambiar('tarifaMax', e.target.value)}>
                {TARIFAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
            <div className="campo" role="radiogroup" aria-labelledby="etq-nota">
              <span className="campo__etiqueta" id="etq-nota">Calificación mínima</span>
              <div className="segmentos">
                {NOTAS.map(([v, t]) => (
                  <label key={v} className="segmentos__opcion">
                    <input type="radio" name="nota" value={v} checked={filtros.calificacionMin === v}
                      onChange={() => cambiar('calificacionMin', v)} />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="interruptor">
              <input type="checkbox" checked={filtros.disponible === 'true'}
                onChange={(e) => cambiar('disponible', e.target.checked ? 'true' : '')} />
              <span>Solo maestros que reciben solicitudes</span>
            </label>
            <label className="campo">
              <span className="campo__etiqueta">Experiencia</span>
              <select className="entrada" value={filtros.experienciaMin} onChange={(e) => cambiar('experienciaMin', e.target.value)}>
                {EXPERIENCIA.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
            {hayOpcionales && (
              <button type="button" className="boton boton--texto boton--chico" onClick={quitarOpcionales}>
                Quitar filtros opcionales
              </button>
            )}
              </fieldset>
            </details>
          ) : (
            <fieldset>
              <legend>Opcionales</legend>
            <label className="campo">
              <span className="campo__etiqueta">Tarifa por hora</span>
              <select className="entrada" value={filtros.tarifaMax} onChange={(e) => cambiar('tarifaMax', e.target.value)}>
                {TARIFAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
            <div className="campo" role="radiogroup" aria-labelledby="etq-nota">
              <span className="campo__etiqueta" id="etq-nota">Calificación mínima</span>
              <div className="segmentos">
                {NOTAS.map(([v, t]) => (
                  <label key={v} className="segmentos__opcion">
                    <input type="radio" name="nota" value={v} checked={filtros.calificacionMin === v}
                      onChange={() => cambiar('calificacionMin', v)} />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="interruptor">
              <input type="checkbox" checked={filtros.disponible === 'true'}
                onChange={(e) => cambiar('disponible', e.target.checked ? 'true' : '')} />
              <span>Solo maestros que reciben solicitudes</span>
            </label>
            <label className="campo">
              <span className="campo__etiqueta">Experiencia</span>
              <select className="entrada" value={filtros.experienciaMin} onChange={(e) => cambiar('experienciaMin', e.target.value)}>
                {EXPERIENCIA.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
            {hayOpcionales && (
              <button type="button" className="boton boton--texto boton--chico" onClick={quitarOpcionales}>
                Quitar filtros opcionales
              </button>
            )}
            </fieldset>
          )}
        </form>

        <section className="resultados" aria-live="polite" aria-busy={resultado.cargando}>
          {!listos && (
            <div className="resultados__vacio">
              <h2>Elige región y oficio para empezar</h2>
              <p>Son los dos filtros obligatorios de la búsqueda.</p>
            </div>
          )}

          {listos && resultado.cargando && <Cargando texto="Buscando maestros…" />}
          {listos && resultado.error && <CajaError error={resultado.error} alReintentar={resultado.recargar} />}

          {listos && resultado.datos && (
            <>
              <div className="resultados__resumen">
                <h2>
                  {resultado.datos.length === 0
                    ? 'Ningún maestro cumple todos los filtros'
                    : `${plural(resultado.datos.length, 'maestro cumple', 'maestros cumplen')} tu búsqueda`}
                </h2>
                <p className="resultados__contexto">
                  {oficioActual?.nombre} en {regionActual?.nombre}.{' '}
                  <button type="button" className="enlace-sql" onClick={() => setVerSQL(true)}>
                    Consulta 3, respondió en {Math.max(1, Math.round(resultado.meta.ms))} ms. Ver el SQL
                  </button>
                </p>
              </div>

              {resultado.datos.length === 0 ? (
                <div className="resultados__vacio">
                  <p>
                    {hayOpcionales
                      ? 'Prueba subiendo la tarifa máxima o bajando la calificación mínima.'
                      : 'Todavía no hay maestros de este oficio en la región. Prueba con una región vecina.'}
                  </p>
                  {hayOpcionales && (
                    <button type="button" className="boton boton--secundario" onClick={quitarOpcionales}>
                      Quitar filtros opcionales
                    </button>
                  )}
                </div>
              ) : (
                <ul className="fichas">
                  {resultado.datos.map((m) => (
                    <li key={m.rut_maestro} className="ficha">
                      <div className="ficha__principal">
                        <h3><Link to={`/maestros/${m.rut_maestro}`}>{m.nombre}</Link></h3>
                        <p className="ficha__detalle">
                          {m.oficio} en {m.region}, {plural(m.experiencia_anios, 'año', 'años')} de experiencia
                        </p>
                      </div>
                      <Reputacion promedio={m.promedio} total={m.total_resenas} />
                      <div className="ficha__precio">
                        <p><strong>{clp(m.tarifa_hora)}</strong> la hora</p>
                        <Disponibilidad disponible={m.disponible} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      <VerSQL abierto={verSQL} alCerrar={() => setVerSQL(false)} meta={resultado.meta} />
    </div>
  );
}
