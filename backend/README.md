# backend

API REST de Plumb (Express 5 + PostgreSQL 17). Grupo 13, ICI324 Bases de Datos y Programación Web, Universidad de Valparaíso.

## Ejecutar en local

```bash
docker compose up -d        # PostgreSQL 17 en el puerto 54329
cp .env.example .env        # DATABASE_URL=postgresql://plumb:plumb@localhost:54329/plumb
npm install
npm run db:init             # crea las tablas y carga los datos (lee ../bd)
npm run dev                 # http://localhost:3000/api/v1
npm test                    # 42 pruebas contra la base real
```

## Estructura

| Carpeta | Responsabilidad |
|---|---|
| `src/routes/index.js` | Mapa completo de la API `/api/v1` |
| `src/controllers/` | Un archivo por recurso: lee la petición, llama al modelo y elige la respuesta |
| `src/validators/` | Forma de los datos (Zod) y RUT con módulo 11. Si no cumple: 400 |
| `src/models/` | SQL parametrizado y reglas de negocio. Si una regla no se cumple: 422 |
| `src/middlewares/` | Traduce las restricciones de PostgreSQL a 409 o 422, y registra las peticiones |
| `src/config/` | Variables de entorno y pool de conexiones |
| `api/index.js` | Punto de entrada en Vercel |
| `tests/` | Pruebas con `node:test` y Supertest |

## Endpoints principales

`GET /salud`, `GET /catalogo`, `GET /ranking`, CRUD de `/maestros` y `/oficios`, `/clientes`, `/solicitudes` (crear, cambiar estado, moderar, calificar) y el laboratorio `/consultas/{n}/ejecuciones` con las 13 consultas de la Etapa I. El detalle está en la sección 12 del informe.
