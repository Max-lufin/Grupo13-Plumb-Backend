import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAvisar } from '../components/Avisos.jsx';
import { Campo } from '../components/Piezas.jsx';
import { useSesion } from '../hooks/sesion.jsx';
import { useTitulo } from '../hooks/usePagina.js';

// Cuentas de los datos de ejemplo, para probar cada rol en la demostración.
const CUENTAS_DE_PRUEBA = [
  { rol: 'Cliente', nombre: 'María González', email: 'maria.gonzalez@ejemplo.cl' },
  { rol: 'Maestro', nombre: 'Pedro González', email: 'pedro.gonzalez@ejemplo.cl' },
  { rol: 'Administrador', nombre: 'Camila Herrera', email: 'admin@plumb.cl' },
];
const CLAVE_DE_PRUEBA = 'plumb2026';

// Solo se vuelve a rutas internas de la aplicación.
const destinoSeguro = (ruta) => (ruta?.startsWith('/') && !ruta.startsWith('//') ? ruta : null);

export default function Ingresar() {
  useTitulo('Iniciar sesión');
  const navegar = useNavigate();
  const avisar = useAvisar();
  const [params] = useSearchParams();
  const { iniciar } = useSesion();
  const [datos, setDatos] = useState({ email: '', contrasena: '' });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);

  const poner = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrores({});
    try {
      const usuario = await iniciar(datos.email, datos.contrasena);
      avisar(`Hola, ${usuario.nombre.split(' ')[0]}.`);
      const porRol = usuario.roles.includes('administrador') ? '/admin' : usuario.roles.includes('maestro') ? '/solicitudes?vista=maestro' : '/catalogo';
      navegar(destinoSeguro(params.get('volver')) ?? porRol, { replace: true });
    } catch (error) {
      setErrores({ ...error.porCampo?.(), general: error.message });
      setEnviando(false);
    }
  };

  return (
    <div className="contenedor ingreso">
      <header className="pagina__cabecera">
        <h1>Iniciar sesión</h1>
        <p>Clientes, maestros y administradores entran con el mismo formulario.</p>
      </header>

      <div className="ingreso__cuerpo">
        <form className="hoja registro__form" onSubmit={enviar} noValidate>
          <Campo etiqueta="Correo" requerido id="ing-email" error={errores.email}>
            <input id="ing-email" type="email" className="entrada" value={datos.email} onChange={poner('email')}
              autoComplete="username" aria-invalid={Boolean(errores.email)} />
          </Campo>
          <Campo etiqueta="Contraseña" requerido id="ing-contrasena" error={errores.contrasena}>
            <input id="ing-contrasena" type="password" className="entrada" value={datos.contrasena} onChange={poner('contrasena')}
              autoComplete="current-password" aria-invalid={Boolean(errores.contrasena)} />
          </Campo>
          {errores.general && <p className="orden__error" role="alert">{errores.general}</p>}
          <button type="submit" className="boton" disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
          <p className="registro__nota">¿No tienes cuenta? <Link to="/registro">Crea una cuenta de cliente</Link>.</p>
        </form>

        <aside className="hoja ingreso__pruebas" aria-labelledby="titulo-pruebas">
          <h2 id="titulo-pruebas">Cuentas de prueba</h2>
          <p>Todas usan la contraseña <code>{CLAVE_DE_PRUEBA}</code>. Elige una para completar el formulario.</p>
          <ul>
            {CUENTAS_DE_PRUEBA.map((c) => (
              <li key={c.email}>
                <button type="button" className="ingreso__cuenta" onClick={() => setDatos({ email: c.email, contrasena: CLAVE_DE_PRUEBA })}>
                  <span className="ingreso__rol">{c.rol}</span>
                  <span>{c.nombre}</span>
                  <span className="ingreso__correo">{c.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
