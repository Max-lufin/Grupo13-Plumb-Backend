// Una línea por petición: método, ruta, código de estado y duración.
export function registrarPeticiones(req, res, next) {
  if (process.env.NODE_ENV === 'test') return next();
  const inicio = performance.now();
  res.on('finish', () => {
    const ms = (performance.now() - inicio).toFixed(1);
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms} ms)`);
  });
  next();
}
