# backend

API REST de Plumb (Express 5 + MongoDB 8). Grupo 13, ICI324 Bases de Datos y Programación Web, Universidad de Valparaíso.

## Ejecutar en local

```bash
docker compose up -d        # MongoDB 8 como replica set de un nodo (las transacciones lo necesitan)
cp .env.example .env        # MONGODB_URI, SESION_SECRETO, CORS_ORIGINS
npm install
npm run db:init             # crea colecciones, validadores e índices y carga ../nosql/datos
npm run dev                 # http://localhost:3000/api/v1
npm test                    # pruebas contra una base aparte (plumb_prueba)
```

## Estructura

| Carpeta | Responsabilidad |
|---|---|
| `src/routes/index.js` | Mapa completo de la API `/api/v1`, con el permiso de cada ruta |
| `src/controllers/` | Un archivo por recurso: lee la petición, revisa la propiedad del dato, llama al modelo y elige la respuesta |
| `src/validators/` | Forma de los datos (Zod) y RUT con módulo 11. Si no cumple: 400 |
| `src/models/` | Operaciones MongoDB y reglas de negocio. Si una regla no se cumple: 422 |
| `src/middlewares/` | Sesión (token JWT y roles), traducción de errores de MongoDB a 409, 422 y 503, y registro de peticiones |
| `src/config/` | Variables de entorno y cliente de MongoDB (transacciones y contadores) |
| `src/utils/` | Respuestas uniformes, contraseñas (scrypt) y tokens |
| `scripts/db-init.js` | Crea la base desde `../nosql/esquema.cjs` y `../nosql/datos` |
| `api/index.js` | Punto de entrada en Vercel |
| `tests/` | Pruebas con `node:test` y Supertest |

La referencia completa de la API, con un ejemplo por endpoint, está en [`../docs/api.md`](../docs/api.md).
