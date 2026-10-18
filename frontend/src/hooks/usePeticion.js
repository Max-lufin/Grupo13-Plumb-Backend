import { useCallback, useEffect, useState } from 'react';

// Ejecuta una petición a la API al montar el componente y cada vez que
// cambian las dependencias. Cancela la anterior si llega una nueva.
export function usePeticion(funcion, dependencias) {
  const [estado, setEstado] = useState({ cargando: true, error: null, datos: null, meta: null });
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    const control = new AbortController();
    setEstado((previo) => ({ ...previo, cargando: true, error: null }));
    funcion(control.signal)
      .then((r) => setEstado({ cargando: false, error: null, datos: r.data, meta: r.meta ?? null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setEstado({ cargando: false, error, datos: null, meta: null });
      });
    return () => control.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, vuelta]);

  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  return { ...estado, recargar };
}
