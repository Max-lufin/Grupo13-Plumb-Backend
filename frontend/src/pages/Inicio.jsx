import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../api/cliente.js';
import { Cargando, Reputacion } from '../components/Piezas.jsx';
import SelectEnLinea from '../components/SelectEnLinea.jsx';
import { usePeticion } from '../hooks/usePeticion.js';
import { useTitulo } from '../hooks/usePagina.js';
import { clp } from '../utils/formato.js';

const enRegion = (nombre) => (nombre === 'Metropolitana' ? 'la Región Metropolitana' : nombre);

export default function Inicio() {
  useTitulo(null);
  const navegar = useNavigate();
  const [regiones, setRegiones] = useState([]);
  const [oficios, setOficios] = useState([]);
  const [oficio, setOficio] = useState('1');
  const [region, setRegion] = useState('6');
  const ranking = usePeticion((s) => api.ranking(6, s), []);

  useEffect(() => {
    api.regiones().then((r) => setRegiones(r.data)).catch(() => {});
    api.oficios().then((r) => setOficios(r.data)).catch(() => {});
  }, []);

  const buscar = (e) => {
    e.preventDefault();
    navegar(`/catalogo?region=${region}&oficio=${oficio}`);
  };

  return (
    <>
      <section className="portada">
        <form className="contenedor portada__form" onSubmit={buscar}>
          <h1 className="portada__pregunta">
            ¿Conoces a un buen{' '}
            <SelectEnLinea
              id="portada-oficio"
              etiqueta="Oficio"
              valor={oficio}
              alCambiar={setOficio}
              opciones={(oficios.length ? oficios : [{ id_oficio: 1, nombre: 'Gasfíter' }])
                .map((o) => ({ valor: o.id_oficio, texto: o.nombre.toLowerCase() }))}
            />
            {' '}en{' '}
            <span className="portada__cierre">
              <SelectEnLinea
                id="portada-region"
                etiqueta="Región"
                valor={region}
                alCambiar={setRegion}
                opciones={(regiones.length ? regiones : [{ id_region: 6, nombre: 'Valparaíso' }])
                  .map((r) => ({ valor: r.id_region, texto: enRegion(r.nombre) }))}
              />
              ?
            </span>
          </h1>
          <div className="portada__accion">
            <button type="submit" className="boton portada__boton">Buscar maestros</button>
            <p>
              Antes había que preguntarle a un vecino. Aquí ves la tarifa, las reseñas y si el maestro
              tiene agenda antes de llamarlo.
            </p>
          </div>
        </form>
      </section>

      <section className="contenedor inicio__bloque" aria-labelledby="titulo-ranking">
        <div className="inicio__encabezado">
          <h2 id="titulo-ranking">Los mejor evaluados</h2>
          <p>Nota promedio que dejan los clientes al terminar cada trabajo. Solo cuentan maestros con dos reseñas o más.</p>
        </div>
        {ranking.cargando && <Cargando />}
        {ranking.datos && (
          <ol className="ranking">
            {ranking.datos.map((m, i) => (
              <li key={m.rut_maestro} className="ranking__fila">
                <span className="ranking__puesto">{i + 1}</span>
                <Link to={`/maestros/${m.rut_maestro}`} className="ranking__nombre">{m.nombre}</Link>
                <span className="ranking__oficio">{m.oficio} en {m.region}</span>
                <Reputacion promedio={m.promedio} total={m.total_resenas} />
                <span className="ranking__tarifa">{clp(m.tarifa_hora)} la hora</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="contenedor inicio__bloque" aria-labelledby="titulo-pasos">
        <h2 id="titulo-pasos" className="inicio__encabezado">Cómo funciona</h2>
        <ol className="pasos">
          <li>
            <h3>Busca por oficio y región</h3>
            <p>Afina por tarifa máxima, nota mínima, disponibilidad y años de experiencia.</p>
          </li>
          <li>
            <h3>Envía una solicitud</h3>
            <p>Describe el trabajo, la dirección y el día que te acomoda. Queda registrada con número de folio.</p>
          </li>
          <li>
            <h3>Califica al terminar</h3>
            <p>Tu nota se suma a la reputación del maestro y ayuda al próximo cliente a decidir.</p>
          </li>
        </ol>
      </section>

      <aside className="contenedor inicio__evaluacion">
        <div className="hoja inicio__evaluacion-hoja">
          <h2>Revisión de la Etapa I</h2>
          <p>
            Las 13 consultas exigidas (2 ALTER, 3 SELECT, 2 UPDATE, 3 INSERT, 2 DELETE y 1 DROP) se pueden
            ejecutar contra la base de datos real, con su álgebra relacional y su trazabilidad a los requisitos.
          </p>
          <div className="inicio__evaluacion-acciones">
            <Link to="/consultas" className="boton">Abrir las consultas SQL</Link>
            <Link to="/admin" className="boton boton--secundario">Ver los mantenedores</Link>
          </div>
        </div>
      </aside>
    </>
  );
}
