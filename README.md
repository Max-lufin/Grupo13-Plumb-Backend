# Plumb

Marketplace que conecta a clientes con maestros de oficios (gasfíter, electricista, pintor…) por región, tarifa y reputación. Proyecto del Grupo 13 para ICI324 Bases de Datos y Programación Web, Universidad de Valparaíso, 2026.

Vicente Fernández, Maximiliano Sepúlveda y Vicente Cid.

Aplicación publicada: <https://grupo13-plumb.vercel.app>

| Carpeta | Contenido |
|---|---|
| [`nosql/`](nosql/) | Modelo de documentos en MongoDB: colecciones, validadores, índices, datos y ejemplos |
| [`backend/`](backend/) | API REST en Express 5 sobre MongoDB, con inicio de sesión y sus pruebas |
| [`frontend/`](frontend/) | Aplicación en React 19 con Vite |
| [`docs/`](docs/) | Referencia de la API, diagramas (casos de uso, secuencia, modelos) y mockups |
| [`despliegue/`](despliegue/) | Scripts para publicar en Vercel |

## Probarlo en local

Requisitos: Node.js 20 o superior y Docker.

```bash
cd backend
docker compose up -d                 # MongoDB 8 como replica set, puerto 27019
cp .env.example .env
npm install && npm run db:init       # colecciones, validadores, índices y datos
npm run dev                          # API en http://localhost:3000/api/v1

cd ../frontend
npm install && npm run dev           # aplicación en http://localhost:5173
```

Cuentas de prueba (contraseña `plumb2026`): `maria.gonzalez@ejemplo.cl` (cliente), `pedro.gonzalez@ejemplo.cl` (maestro) y `admin@plumb.cl` (administrador).

## Etapas

- **Etapa I:** modelo relacional, 13 consultas SQL, API y frontend con dos mantenedores y los casos de uso Consulta y Transacción.
- **Etapa II:** la persistencia pasa por completo a MongoDB (modelo de documentos guiado por las consultas), las 13 consultas se convierten a MQL y se ejecutan desde la pantalla **Consultas**, y se agregan el inicio de sesión con roles, el historial, la calificación y la moderación.

## Flujo de trabajo

GitHub Flow: cada cambio se desarrolla en una rama propia, se integra a `etapa-2` con un merge y la etapa entra a `main` con un pull request revisado por el grupo. Las credenciales viven solo en `.env` locales y en las variables de entorno de Vercel; ningún archivo con claves entra al repositorio.
