const pesos = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fechaCorta = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Santiago' });
const fechaHora = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago',
});

export const clp = (n) => pesos.format(n ?? 0);
export const nota = (n) => decimal.format(n ?? 0);

// 'AAAA-MM-DD' se interpreta a mediodía para que la zona horaria no mueva el día.
export function fecha(valor) {
  if (!valor) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00`) : new Date(valor);
  return fechaCorta.format(d).replace('.', '');
}

export const fechaYHora = (valor) => (valor ? fechaHora.format(new Date(valor)).replace('.', '').replace(',', ' a las') : '');

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function folio(n) {
  return `N° ${String(n).padStart(6, '0')}`;
}

export function hoyISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
}

export function sumarDias(fechaISO, dias) {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function edad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const [a, m, d] = fechaNacimiento.split('-').map(Number);
  const [ha, hm, hd] = hoyISO().split('-').map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

export function nombreCorto(nombre = '') {
  const partes = nombre.split(' ');
  return partes.length > 2 ? `${partes[0]} ${partes[partes.length - 2]}` : nombre;
}
