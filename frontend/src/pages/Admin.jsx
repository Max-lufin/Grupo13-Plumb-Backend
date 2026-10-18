import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api/cliente.js';
import { useAvisar } from '../components/Avisos.jsx';
import { CajaError, Campo, Cargando, Dialogo, Estrella, Reputacion, Timbre } from '../components/Piezas.jsx';
import { usePeticion } from '../hooks/usePeticion.js';
import { useTitulo } from '../hooks/usePagina.js';
import { clp, fecha, folio } from '../utils/formato.js';

const MAESTRO_VACIO = {
  rut_maestro: '', nombre: '', email: '', telefono: '', fecha_nacimiento: '',
  id_oficio: '', id_region: '', tarifa_hora: '', experiencia_anios: '0', disponible: true, descripcion: '',
};

function FormularioMaestro({ inicial, editando, alCerrar, alGuardar }) {
  const [datos, setDatos] = useState(inicial);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [regiones, setRegiones] = useState([]);
  const [oficios, setOficios] = useState([]);

  useEffect(() => {
    api.regiones().then((r) => setRegiones(r.data)).catch(() => {});
    api.oficios().then((r) => setOficios(r.data)).catch(() => {});
  }, []);

  const poner = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrores({});
    try {
      const r = editando ? await api.editarMaestro(inicial.rut_maestro, datos) : await api.crearMaestro(datos);
      alGuardar(r.data);
    } catch (error) {
      setErrores({ ...error.porCampo?.(), general: error.message });
      setEnviando(false);
    }
  };

  const campo = (nombre, etiqueta, props = {}, ayuda) => (
    <Campo etiqueta={etiqueta} requerido={props.required} id={`m-${nombre}`} error={errores[nombre]} ayuda={ayuda}>
      <input id={`m-${nombre}`} className="entrada" value={datos[nombre]} onChange={poner(nombre)}
        aria-invalid={Boolean(errores[nombre])} {...props} />
    </Campo>
  );

  return (
    <form className="formulario formulario--dos" onSubmit={enviar} noValidate>
      {campo('rut_maestro', 'RUT', { required: true, disabled: editando }, editando ? 'El RUT es la clave primaria y no se edita.' : 'Ej.: 12.345.678-5')}
      {campo('nombre', 'Nombre completo', { required: true, autoComplete: 'off' })}
      {campo('email', 'Correo', { required: true, type: 'email' })}
      {campo('telefono', 'Celular', { required: true, type: 'tel' }, '+56 9 1234 5678')}
      {campo('fecha_nacimiento', 'Fecha de nacimiento', { required: true, type: 'date' })}
      <Campo etiqueta="Oficio" requerido id="m-id_oficio" error={errores.id_oficio}>
        <select id="m-id_oficio" className="entrada" value={datos.id_oficio} onChange={poner('id_oficio')}>
          <option value="" disabled>Elige un oficio</option>
          {oficios.map((o) => <option key={o.id_oficio} value={o.id_oficio}>{o.nombre}</option>)}
        </select>
      </Campo>
      <Campo etiqueta="Región" requerido id="m-id_region" error={errores.id_region}>
        <select id="m-id_region" className="entrada" value={datos.id_region} onChange={poner('id_region')}>
          <option value="" disabled>Elige una región</option>
          {regiones.map((r) => <option key={r.id_region} value={r.id_region}>{r.nombre}</option>)}
        </select>
      </Campo>
      {campo('tarifa_hora', 'Tarifa por hora (CLP)', { required: true, type: 'number', min: 1, step: 500 })}
      {campo('experiencia_anios', 'Años de experiencia', { type: 'number', min: 0, max: 60 })}
      <label className="interruptor formulario__ancho">
        <input type="checkbox" checked={datos.disponible} onChange={poner('disponible')} />
        <span>Recibe solicitudes</span>
      </label>
      <Campo etiqueta="Descripción" id="m-descripcion" error={errores.descripcion} ayuda="Opcional, hasta 500 caracteres.">
        <textarea id="m-descripcion" className="entrada" value={datos.descripcion ?? ''} onChange={poner('descripcion')} maxLength={500} />
      </Campo>
      {errores.general && <p className="orden__error formulario__ancho" role="alert">{errores.general}</p>}
      <div className="formulario__acciones formulario__ancho">
        <button type="button" className="boton boton--secundario" onClick={alCerrar}>Cancelar</button>
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar maestro'}
        </button>
      </div>
    </form>
  );
}

function Confirmar({ abierto, titulo, texto, accion, alCerrar, alConfirmar }) {
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (abierto) { setError(null); setEnviando(false); } }, [abierto]);

  const confirmar = async () => {
    setEnviando(true);
    try {
      await alConfirmar();
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo={titulo} ancho={520}>
      <p className="dialogo__texto">{texto}</p>
      {error && <p className="orden__error" role="alert">{error}</p>}
      <div className="formulario__acciones">
        <button type="button" className="boton boton--secundario" onClick={alCerrar}>{error ? 'Entendido' : 'Cancelar'}</button>
        {!error && <button type="button" className="boton boton--peligro" onClick={confirmar} disabled={enviando}>{accion}</button>}
      </div>
    </Dialogo>
  );
}

function MantenedorMaestros() {
  const avisar = useAvisar();
  const lista = usePeticion((s) => api.maestros(s), []);
  const [filtro, setFiltro] = useState('');
  const [formulario, setFormulario] = useState(null);
  const [borrando, setBorrando] = useState(null);

  const visibles = (lista.datos ?? []).filter((m) =>
    `${m.nombre} ${m.oficio} ${m.region} ${m.rut_maestro}`.toLowerCase().includes(filtro.toLowerCase()));

  const alternar = async (m) => {
    try {
      const r = await api.modificarMaestro(m.rut_maestro, { disponible: !m.disponible });
      avisar(`${m.nombre} ${r.data.disponible ? 'vuelve a recibir solicitudes' : 'dejó de recibir solicitudes'}.`);
      lista.recargar();
    } catch (e) {
      avisar(e.message, 'error');
    }
  };

  return (
    <>
      <div className="mantenedor__barra">
        <label className="mantenedor__busqueda">
          <span className="visualmente-oculto">Filtrar maestros</span>
          <input className="entrada" type="search" placeholder="Filtrar por nombre, oficio, región o RUT"
            value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        </label>
        <button type="button" className="boton" onClick={() => setFormulario({ inicial: MAESTRO_VACIO, editando: false })}>
          Agregar maestro
        </button>
      </div>
      {lista.cargando && <Cargando />}
      {lista.error && <CajaError error={lista.error} alReintentar={lista.recargar} />}
      {lista.datos && (
        <div className="tabla-marco" tabIndex={0} role="region" aria-label="Maestros registrados">
          <table className="tabla">
            <caption className="visualmente-oculto">Maestros registrados</caption>
            <thead>
              <tr>
                <th scope="col">Maestro</th>
                <th scope="col">Oficio y región</th>
                <th scope="col" className="tabla__numero">Tarifa</th>
                <th scope="col" className="tabla__numero">Exp.</th>
                <th scope="col">Nota</th>
                <th scope="col">Recibe solicitudes</th>
                <th scope="col"><span className="visualmente-oculto">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((m) => (
                <tr key={m.rut_maestro}>
                  <td><strong>{m.nombre}</strong><br /><span className="tabla__sub">{m.rut_maestro}</span></td>
                  <td>{m.oficio}<br /><span className="tabla__sub">{m.region}</span></td>
                  <td className="tabla__numero">{clp(m.tarifa_hora)}</td>
                  <td className="tabla__numero">{m.experiencia_anios}</td>
                  <td><Reputacion promedio={m.promedio} total={m.total_resenas} /></td>
                  <td>
                    <label className="interruptor interruptor--solo">
                      <input type="checkbox" checked={m.disponible} onChange={() => alternar(m)} />
                      <span>{m.disponible ? 'Sí' : 'No'}</span>
                    </label>
                  </td>
                  <td className="tabla__acciones">
                    <button type="button" className="boton boton--secundario boton--chico"
                      onClick={() => setFormulario({ inicial: { ...m, descripcion: m.descripcion ?? '' }, editando: true })}>Editar</button>
                    <button type="button" className="boton boton--peligro boton--chico" onClick={() => setBorrando(m)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialogo abierto={Boolean(formulario)} alCerrar={() => setFormulario(null)}
        titulo={formulario?.editando ? `Editar a ${formulario.inicial.nombre}` : 'Agregar maestro'} ancho={760}>
        {formulario && (
          <FormularioMaestro {...formulario} alCerrar={() => setFormulario(null)} alGuardar={(m) => {
            avisar(formulario.editando ? `Guardaste los cambios de ${m.nombre}.` : `Agregaste a ${m.nombre} al catálogo.`);
            setFormulario(null);
            lista.recargar();
          }} />
        )}
      </Dialogo>

      <Confirmar
        abierto={Boolean(borrando)}
        titulo="Eliminar maestro"
        texto={borrando && `Vas a eliminar a ${borrando.nombre} (${borrando.rut_maestro}). Si tiene solicitudes en su historial, la base de datos lo impedirá para no perder ese registro.`}
        accion="Eliminar maestro"
        alCerrar={() => setBorrando(null)}
        alConfirmar={async () => {
          await api.eliminarMaestro(borrando.rut_maestro);
          avisar(`Eliminaste a ${borrando.nombre}.`);
          setBorrando(null);
          lista.recargar();
        }}
      />
    </>
  );
}

function MantenedorOficios() {
  const avisar = useAvisar();
  const lista = usePeticion((s) => api.oficios(s), []);
  const [formulario, setFormulario] = useState(null);
  const [errores, setErrores] = useState({});
  const [borrando, setBorrando] = useState(null);

  const guardar = async (e) => {
    e.preventDefault();
    setErrores({});
    try {
      const { id_oficio, nombre, descripcion } = formulario;
      const r = id_oficio ? await api.editarOficio(id_oficio, { nombre, descripcion }) : await api.crearOficio({ nombre, descripcion });
      avisar(id_oficio ? `Guardaste el oficio ${r.data.nombre}.` : `Agregaste el oficio ${r.data.nombre}.`);
      setFormulario(null);
      lista.recargar();
    } catch (error) {
      setErrores({ ...error.porCampo?.(), general: error.message });
    }
  };

  return (
    <>
      <div className="mantenedor__barra">
        <p>Los oficios ordenan el catálogo. Un oficio con maestros no se puede borrar (ON DELETE RESTRICT).</p>
        <button type="button" className="boton" onClick={() => { setErrores({}); setFormulario({ nombre: '', descripcion: '' }); }}>
          Agregar oficio
        </button>
      </div>
      {lista.cargando && <Cargando />}
      {lista.error && <CajaError error={lista.error} alReintentar={lista.recargar} />}
      {lista.datos && (
        <div className="tabla-marco" tabIndex={0} role="region" aria-label="Oficios">
          <table className="tabla">
            <caption className="visualmente-oculto">Oficios</caption>
            <thead>
              <tr>
                <th scope="col">Oficio</th>
                <th scope="col">Descripción</th>
                <th scope="col" className="tabla__numero">Maestros</th>
                <th scope="col"><span className="visualmente-oculto">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {lista.datos.map((o) => (
                <tr key={o.id_oficio}>
                  <td><strong>{o.nombre}</strong></td>
                  <td>{o.descripcion ?? <span className="tabla__sub">Sin descripción</span>}</td>
                  <td className="tabla__numero">{o.total_maestros}</td>
                  <td className="tabla__acciones">
                    <button type="button" className="boton boton--secundario boton--chico"
                      onClick={() => { setErrores({}); setFormulario({ ...o, descripcion: o.descripcion ?? '' }); }}>Editar</button>
                    <button type="button" className="boton boton--peligro boton--chico" onClick={() => setBorrando(o)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialogo abierto={Boolean(formulario)} alCerrar={() => setFormulario(null)}
        titulo={formulario?.id_oficio ? `Editar ${formulario.nombre}` : 'Agregar oficio'} ancho={520}>
        {formulario && (
          <form className="formulario" onSubmit={guardar} noValidate>
            <Campo etiqueta="Nombre" requerido id="o-nombre" error={errores.nombre}>
              <input id="o-nombre" className="entrada" value={formulario.nombre} maxLength={60}
                onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))} aria-invalid={Boolean(errores.nombre)} />
            </Campo>
            <Campo etiqueta="Descripción" id="o-descripcion" error={errores.descripcion} ayuda="Opcional, hasta 255 caracteres.">
              <textarea id="o-descripcion" className="entrada" value={formulario.descripcion} maxLength={255}
                onChange={(e) => setFormulario((f) => ({ ...f, descripcion: e.target.value }))} />
            </Campo>
            {errores.general && <p className="orden__error" role="alert">{errores.general}</p>}
            <div className="formulario__acciones">
              <button type="button" className="boton boton--secundario" onClick={() => setFormulario(null)}>Cancelar</button>
              <button type="submit" className="boton">{formulario.id_oficio ? 'Guardar cambios' : 'Agregar oficio'}</button>
            </div>
          </form>
        )}
      </Dialogo>

      <Confirmar
        abierto={Boolean(borrando)}
        titulo="Eliminar oficio"
        texto={borrando && (borrando.total_maestros > 0
          ? `${borrando.nombre} tiene ${borrando.total_maestros} maestros. Puedes intentarlo para ver cómo responde la base de datos.`
          : `Vas a eliminar el oficio ${borrando.nombre}. No tiene maestros asociados.`)}
        accion="Eliminar oficio"
        alCerrar={() => setBorrando(null)}
        alConfirmar={async () => {
          await api.eliminarOficio(borrando.id_oficio);
          avisar(`Eliminaste el oficio ${borrando.nombre}.`);
          setBorrando(null);
          lista.recargar();
        }}
      />
    </>
  );
}

function Moderacion() {
  const avisar = useAvisar();
  const lista = usePeticion((s) => api.solicitudes({}, s), []);
  const [borrando, setBorrando] = useState(null);

  return (
    <>
      <div className="mantenedor__barra">
        <p>
          Si una solicitud es falsa (por ejemplo, creada para inflar la nota de un maestro), se elimina aquí.
          Su calificación se borra en la misma operación por ON DELETE CASCADE.
        </p>
      </div>
      {lista.cargando && <Cargando />}
      {lista.error && <CajaError error={lista.error} alReintentar={lista.recargar} />}
      {lista.datos && (
        <div className="tabla-marco" tabIndex={0} role="region" aria-label="Solicitudes recientes">
          <table className="tabla">
            <caption className="visualmente-oculto">Solicitudes recientes</caption>
            <thead>
              <tr>
                <th scope="col">Folio</th>
                <th scope="col">Cliente y maestro</th>
                <th scope="col">Trabajo</th>
                <th scope="col">Estado</th>
                <th scope="col">Nota</th>
                <th scope="col"><span className="visualmente-oculto">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {lista.datos.map((s) => (
                <tr key={s.id_solicitud}>
                  <td className="tabla__folio">{folio(s.id_solicitud)}</td>
                  <td>{s.cliente}<br /><span className="tabla__sub">para {s.maestro}</span></td>
                  <td>{s.descripcion}<br /><span className="tabla__sub">{fecha(s.fecha_servicio)}</span></td>
                  <td><Timbre estado={s.estado} /></td>
                  <td>{s.puntuacion ? <span className="reputacion"><Estrella /> <strong>{s.puntuacion}</strong></span> : <span className="tabla__sub">Sin nota</span>}</td>
                  <td className="tabla__acciones">
                    <button type="button" className="boton boton--peligro boton--chico" onClick={() => setBorrando(s)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Confirmar
        abierto={Boolean(borrando)}
        titulo="Eliminar solicitud"
        texto={borrando && `Vas a eliminar la solicitud ${folio(borrando.id_solicitud)} de ${borrando.cliente}.${borrando.puntuacion ? ' Su calificación también se borrará y dejará de contar en el promedio del maestro.' : ''}`}
        accion="Eliminar solicitud"
        alCerrar={() => setBorrando(null)}
        alConfirmar={async () => {
          await api.eliminarSolicitud(borrando.id_solicitud);
          avisar(`Eliminaste la solicitud ${folio(borrando.id_solicitud)}.`);
          setBorrando(null);
          lista.recargar();
        }}
      />
    </>
  );
}

export default function Admin() {
  useTitulo('Administración');
  const [params, setParams] = useSearchParams();
  const seccion = ['oficios', 'moderacion'].includes(params.get('seccion')) ? params.get('seccion') : 'maestros';

  return (
    <div className="contenedor">
      <header className="pagina__cabecera">
        <h1>Administración</h1>
        <p>Los dos mantenedores de la Etapa I (maestros y oficios) y la moderación de solicitudes.</p>
      </header>
      <div className="pestanas" role="group" aria-label="Mantenedor">
        <button type="button" aria-pressed={seccion === 'maestros'} onClick={() => setParams({}, { replace: true })}>
          Maestros
        </button>
        <button type="button" aria-pressed={seccion === 'oficios'} onClick={() => setParams({ seccion: 'oficios' }, { replace: true })}>
          Oficios
        </button>
        <button type="button" aria-pressed={seccion === 'moderacion'} onClick={() => setParams({ seccion: 'moderacion' }, { replace: true })}>
          Moderación
        </button>
      </div>
      <section className="pestana" aria-live="polite">
        {seccion === 'maestros' && <MantenedorMaestros />}
        {seccion === 'oficios' && <MantenedorOficios />}
        {seccion === 'moderacion' && <Moderacion />}
      </section>
    </div>
  );
}
