import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/cliente.js';

// En la Etapa I no hay inicio de sesión: quien usa la demo elige con qué
// cliente y con qué maestro actuar. La elección se recuerda en el navegador.

const CLAVE = 'plumb.sesionDemo';
const POR_DEFECTO = { rutCliente: '12588772-4', rutMaestro: '7765180-2' };

function leer() {
  try {
    return { ...POR_DEFECTO, ...JSON.parse(localStorage.getItem(CLAVE) ?? '{}') };
  } catch {
    return POR_DEFECTO;
  }
}

const Contexto = createContext(null);

export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(leer);
  const [clientes, setClientes] = useState([]);
  const [maestros, setMaestros] = useState([]);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(sesion));
    } catch {
      // Navegador sin almacenamiento: la elección dura solo esta visita.
    }
  }, [sesion]);

  useEffect(() => {
    api.clientes().then((r) => setClientes(r.data)).catch(() => {});
    api.maestros().then((r) => setMaestros(r.data)).catch(() => {});
  }, []);

  const valor = useMemo(() => {
    const cliente = clientes.find((c) => c.rut_cliente === sesion.rutCliente) ?? null;
    const maestro = maestros.find((m) => m.rut_maestro === sesion.rutMaestro) ?? null;
    return {
      ...sesion,
      cliente,
      maestro,
      clientes,
      maestros,
      elegirCliente: (rutCliente) => setSesion((s) => ({ ...s, rutCliente })),
      elegirMaestro: (rutMaestro) => setSesion((s) => ({ ...s, rutMaestro })),
      recargarClientes: () => api.clientes().then((r) => setClientes(r.data)).catch(() => {}),
    };
  }, [sesion, clientes, maestros]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useSesion = () => useContext(Contexto);
