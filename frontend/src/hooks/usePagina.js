import { useEffect, useState } from 'react';

// Título de la pestaña del navegador para cada página (WCAG 2.4.2).
export function useTitulo(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} | Plumb` : 'Plumb: maestros de confianza en tu región';
  }, [titulo]);
}

// true cuando la pantalla es angosta (celular o ventana chica).
export function useAngosto(consulta = '(max-width: 900px)') {
  const [coincide, setCoincide] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const cambiar = () => setCoincide(mq.matches);
    mq.addEventListener('change', cambiar);
    return () => mq.removeEventListener('change', cambiar);
  }, [consulta]);
  return coincide;
}
