// Reglas del dominio que no dependen de una tabla en particular.

export function hoyISO() {
  // Fecha local de Chile, no la del servidor (Vercel corre en UTC).
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
}

export function esMayorDeEdad(fechaNacimiento, hoy = hoyISO()) {
  const [a, m, d] = hoy.split('-').map(Number);
  const limite = `${String(a - 18).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return fechaNacimiento <= limite;
}

// Estados a los que puede pasar una solicitud desde cada estado.
export const TRANSICIONES = {
  Pendiente: ['Aceptada', 'Rechazada', 'Cancelada'],
  Aceptada: ['Finalizada', 'Cancelada'],
  Rechazada: [],
  Finalizada: [],
  Cancelada: [],
};
