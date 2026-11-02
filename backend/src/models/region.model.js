// Las 16 regiones de Chile, de norte a sur. Es un catálogo fijo que la aplicación
// no modifica: en MongoDB cada maestro guarda su región completa (embebida) y esta
// lista alimenta los filtros y formularios.
export const REGIONES = [
  [1, 'XV', 'Arica y Parinacota'], [2, 'I', 'Tarapacá'], [3, 'II', 'Antofagasta'], [4, 'III', 'Atacama'],
  [5, 'IV', 'Coquimbo'], [6, 'V', 'Valparaíso'], [7, 'RM', 'Metropolitana'], [8, 'VI', "O'Higgins"],
  [9, 'VII', 'Maule'], [10, 'XVI', 'Ñuble'], [11, 'VIII', 'Biobío'], [12, 'IX', 'La Araucanía'],
  [13, 'XIV', 'Los Ríos'], [14, 'X', 'Los Lagos'], [15, 'XI', 'Aysén'], [16, 'XII', 'Magallanes'],
].map(([numero, codigo, nombre]) => ({ numero, codigo, nombre }));

export const regionPorNumero = (numero) => REGIONES.find((r) => r.numero === numero) ?? null;

export const Region = {
  listar() {
    return REGIONES.map((r) => ({ id_region: r.numero, codigo: r.codigo, nombre: r.nombre }));
  },
};
