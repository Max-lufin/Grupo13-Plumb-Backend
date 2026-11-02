import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, configurarSesion } from '../api/cliente.js';

// Sesión de la persona que usa la aplicación: el token que entrega la API al
// iniciar sesión y sus datos básicos (rut, nombre, roles). Se recuerda en el
// navegador hasta que vence o la persona cierra la sesión.
const CLAVE = 'plumb.sesion';

function leer() {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    // El token es un JWT: su parte central dice cuándo vence.
    const exp = guardada && JSON.parse(atob(guardada.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp;
    return exp && exp * 1000 > Date.now() ? guardada : null;
  } catch {
    return null;
  }
}

function guardar(sesion) {
  try {
    if (sesion) localStorage.setItem(CLAVE, JSON.stringify(sesion));
    else localStorage.removeItem(CLAVE);
  } catch {
    // Navegador sin almacenamiento: la sesión dura solo esta visita.
  }
}

const Contexto = createContext(null);

export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(leer);
  const [vencida, setVencida] = useState(false);

  const cerrar = useCallback(() => { guardar(null); setSesion(null); }, []);

  // El token se fija antes de pintar, así ninguna petición sale sin él.
  configurarSesion(sesion?.token ?? null, () => { guardar(null); setSesion(null); setVencida(true); });

  const iniciar = useCallback(async (email, contrasena) => {
    const r = await api.iniciarSesion({ email, contrasena });
    const nueva = { token: r.data.token, usuario: r.data.usuario };
    configurarSesion(nueva.token);
    guardar(nueva);
    setSesion(nueva);
    setVencida(false);
    return nueva.usuario;
  }, []);

  useEffect(() => {
    const alCambiar = (e) => { if (e.key === CLAVE) setSesion(leer()); };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, []);

  const valor = useMemo(() => {
    const usuario = sesion?.usuario ?? null;
    const tiene = (rol) => Boolean(usuario?.roles.includes(rol));
    return {
      usuario,
      vencida,
      esCliente: tiene('cliente'),
      esMaestro: tiene('maestro'),
      esAdmin: tiene('administrador'),
      cliente: tiene('cliente') ? { rut_cliente: usuario.rut, nombre: usuario.nombre } : null,
      maestro: tiene('maestro') ? { rut_maestro: usuario.rut, nombre: usuario.nombre } : null,
      iniciar,
      cerrar,
    };
  }, [sesion, vencida, iniciar, cerrar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useSesion = () => useContext(Contexto);
