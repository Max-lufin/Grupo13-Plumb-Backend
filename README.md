# Plumb

Marketplace que conecta a clientes con maestros de oficios (gasfíter, electricista, pintor…) por región, tarifa y reputación. Proyecto del Grupo 13 para ICI324 Bases de Datos y Programación Web, Universidad de Valparaíso, 2026.

Vicente Fernández, Maximiliano Sepúlveda y Vicente Cid.

| Carpeta | Contenido |
|---|---|
| [`bd/`](bd/) | Modelo relacional en PostgreSQL 17: esquema, datos y las 13 consultas de la Etapa I |
| [`nosql/`](nosql/) | Etapa II: el modelo en MongoDB (validadores, índices, documentos de ejemplo y consultas MQL) |
| [`backend/`](backend/) | API REST en Express 5 con PostgreSQL y MongoDB, y sus pruebas |
| [`frontend/`](frontend/) | Aplicación en React 19 con Vite |
| [`docs/`](docs/) | Referencia de la API, diagramas y mockups |
| [`despliegue/`](despliegue/) | Scripts para publicar en Vercel |

## Probarlo en local

Requisitos: Node.js 20 o superior y Docker.

```bash
cd backend
docker compose up -d                 # PostgreSQL 17 en el puerto 54329
cp .env.example .env
npm install && npm run db:init       # tablas y datos
npm run dev                          # API en http://localhost:3000/api/v1

cd ../frontend
npm install && npm run dev           # aplicación en http://localhost:5173
```

MongoDB es opcional para todo lo anterior. Para el modelo NoSQL, ver [`nosql/README.md`](nosql/README.md).

## Etapas

- **Etapa I:** modelo relacional, 13 consultas SQL, API y frontend con dos mantenedores y los casos de uso Consulta y Transacción.
- **Etapa II:** traspaso a MongoDB guiado por las consultas principales, documentos de ejemplo, comparación en vivo entre motores (pantalla **Modelo NoSQL**) y mockups de diseño y navegación en [`docs/mockups/`](docs/mockups/).

## Flujo de trabajo

GitHub Flow: cada etapa se desarrolla en su rama (`etapa-2`) y entra a `main` con un pull request revisado por el grupo. Las credenciales viven solo en `.env` locales y en las variables de entorno de Vercel; ningún archivo con claves entra al repositorio.
