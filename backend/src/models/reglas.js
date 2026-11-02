// Reglas del dominio y conversiones que comparten los modelos.

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

// Las fechas sin hora ('AAAA-MM-DD') se guardan como fecha UTC a medianoche.
export const aFecha = (iso) => new Date(`${iso}T00:00:00Z`);
export const aDia = (fecha) => (fecha ? fecha.toISOString().slice(0, 10) : null);

export const primerNombre = (nombre) => nombre.split(' ')[0];
