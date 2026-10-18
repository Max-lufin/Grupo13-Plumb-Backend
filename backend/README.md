# backend

API REST de Plumb (Express 5 + PostgreSQL 17 + MongoDB 8). Grupo 13, ICI324 Bases de Datos y Programación Web, Universidad de Valparaíso.

## Ejecutar en local

```bash
docker compose up -d        # PostgreSQL 17 en el puerto 54329
cp .env.example .env        # DATABASE_URL=postgresql://plumb:plumb@localhost:54329/plumb
npm install
npm run db:init             # crea las tablas y carga los datos (lee ../bd)
npm run mongo:migrar        # opcional: copia los datos a MongoDB (MONGODB_URI en .env)
npm run dev                 # http://localhost:3000/api/v1
npm test                    # 50 pruebas contra las bases reales (las de MongoDB se omiten sin MONGODB_URI)
```

## Estructura

| Carpeta | Responsabilidad |
|---|---|
| `src/routes/index.js` | Mapa completo de la API `/api/v1` |
| `src/controllers/` | Un archivo por recurso: lee la petición, llama al modelo y elige la respuesta |
| `src/validators/` | Forma de los datos (Zod) y RUT con módulo 11. Si no cumple: 400 |
| `src/models/` | SQL parametrizado y reglas de negocio. Si una regla no se cumple: 422 |
| `src/middlewares/` | Traduce las restricciones de PostgreSQL a 409 o 422, y registra las peticiones |
| `src/config/` | Variables de entorno, pool de PostgreSQL y cliente de MongoDB |
| `api/index.js` | Punto de entrada en Vercel |
| `tests/` | Pruebas con `node:test` y Supertest |

## Endpoints principales

`GET /salud`, `GET /catalogo`, `GET /ranking`, CRUD de `/maestros` y `/oficios`, `/clientes`, `/solicitudes` (crear, cambiar estado, moderar, calificar), el laboratorio `/consultas/{n}/ejecuciones` con las 13 consultas de la Etapa I y el laboratorio `/nosql` de la Etapa II. La referencia completa está en [`../docs/api.md`](../docs/api.md).
