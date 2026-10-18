// RUT chileno: se guarda sin puntos y con guion (12345678-5), dígito K en mayúscula.

export function normalizarRut(valor) {
  if (typeof valor !== 'string') return valor;
  const limpio = valor.replace(/[.\s]/g, '').toUpperCase();
  if (limpio.includes('-') || limpio.length < 2) return limpio;
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}

export function digitoVerificador(numero) {
  let suma = 0;
  let multiplicador = 2;
  for (const digito of String(numero).split('').reverse()) {
    suma += Number(digito) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

export function rutValido(rut) {
  const coincide = /^(\d{7,8})-([\dK])$/.exec(rut ?? '');
  return Boolean(coincide) && digitoVerificador(coincide[1]) === coincide[2];
}
