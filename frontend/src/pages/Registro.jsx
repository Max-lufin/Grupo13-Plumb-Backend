import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api/cliente.js';
import { useAvisar } from '../components/Avisos.jsx';
import { Campo } from '../components/Piezas.jsx';
import { useSesion } from '../hooks/sesionDemo.jsx';
import { useTitulo } from '../hooks/usePagina.js';
import { edad, hoyISO } from '../utils/formato.js';

const VACIO = { rut_cliente: '', nombre: '', email: '', telefono: '', fecha_nacimiento: '' };

export default function Registro() {
  useTitulo('Crear cuenta');
  const navegar = useNavigate();
  const avisar = useAvisar();
  const { elegirCliente, recargarClientes } = useSesion();
  const [datos, setDatos] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);

  const poner = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));
  const anios = edad(datos.fecha_nacimiento);
  const menor = anios !== null && anios < 18;

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrores({});
    try {
      const r = await api.crearCliente({ ...datos, telefono: datos.telefono || null });
      await recargarClientes();
      elegirCliente(r.data.rut_cliente);
      avisar(`Bienvenido, ${r.data.nombre.split(' ')[0]}. Ya puedes pedir servicios.`);
      navegar('/catalogo');
    } catch (error) {
      setErrores({ ...error.porCampo?.(), general: error.message });
      setEnviando(false);
    }
  };

  return (
    <div className="contenedor registro">
      <header className="pagina__cabecera">
        <h1>Crear cuenta de cliente</h1>
        <p>Para contratar un servicio necesitas ser mayor de 18 años: el acuerdo con el maestro es un contrato.</p>
      </header>

      <form className="hoja registro__form" onSubmit={enviar} noValidate>
        <Campo etiqueta="RUT" requerido id="reg-rut" error={errores.rut_cliente} ayuda="Con guion y dígito verificador. Ej.: 12.345.678-5">
          <input id="reg-rut" className="entrada" value={datos.rut_cliente} onChange={poner('rut_cliente')}
            inputMode="text" autoComplete="off" aria-invalid={Boolean(errores.rut_cliente)} />
        </Campo>
        <Campo etiqueta="Nombre completo" requerido id="reg-nombre" error={errores.nombre}>
          <input id="reg-nombre" className="entrada" value={datos.nombre} onChange={poner('nombre')}
            autoComplete="name" aria-invalid={Boolean(errores.nombre)} />
        </Campo>
        <Campo etiqueta="Correo" requerido id="reg-email" error={errores.email}>
          <input id="reg-email" type="email" className="entrada" value={datos.email} onChange={poner('email')}
            autoComplete="email" aria-invalid={Boolean(errores.email)} />
        </Campo>
        <Campo etiqueta="Celular" id="reg-telefono" error={errores.telefono} ayuda="Opcional. Ej.: +56 9 1234 5678">
          <input id="reg-telefono" type="tel" className="entrada" value={datos.telefono} onChange={poner('telefono')}
            autoComplete="tel" aria-invalid={Boolean(errores.telefono)} />
        </Campo>
        <Campo etiqueta="Fecha de nacimiento" requerido id="reg-nacimiento"
          error={errores.fecha_nacimiento ?? (menor ? `Tienes ${anios} años. El registro es desde los 18.` : null)}>
          <input id="reg-nacimiento" type="date" className="entrada" max={hoyISO()} value={datos.fecha_nacimiento}
            onChange={poner('fecha_nacimiento')} aria-invalid={Boolean(errores.fecha_nacimiento) || menor} />
        </Campo>

        {errores.general && <p className="orden__error" role="alert">{errores.general}</p>}

        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
        <p className="registro__nota">
          La mayoría de edad se revisa en tres lugares: en este formulario, en la API (responde 422) y en la base
          de datos (restricción <code>ck_cliente_mayor_edad</code>).
        </p>
      </form>
    </div>
  );
}
