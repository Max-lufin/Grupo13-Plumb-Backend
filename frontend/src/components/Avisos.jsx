import { createContext, useCallback, useContext, useState } from 'react';

// Mensajes breves que confirman una acción ("Solicitud enviada") o avisan
// un problema. Se anuncian a lectores de pantalla con aria-live.

const Contexto = createContext(() => {});

export function ProveedorAvisos({ children }) {
  const [avisos, setAvisos] = useState([]);

  const avisar = useCallback((texto, tipo = 'exito') => {
    const id = crypto.randomUUID();
    setAvisos((lista) => [...lista, { id, texto, tipo }]);
    setTimeout(() => setAvisos((lista) => lista.filter((a) => a.id !== id)), 5200);
  }, []);

  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div className="avisos" aria-live="polite" role="status">
        {avisos.map((a) => (
          <p key={a.id} className={`aviso aviso--${a.tipo}`}>{a.texto}</p>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export const useAvisar = () => useContext(Contexto);
