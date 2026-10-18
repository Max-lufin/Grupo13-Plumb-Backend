# despliegue

Publica el frontend y la API en un mismo proyecto de Vercel. PostgreSQL vive en Neon y MongoDB en Atlas; las dos URI se cargan como variables de entorno del proyecto (`DATABASE_URL`, `MONGODB_URI`), nunca en el repositorio.

- `armar.sh`: compila el frontend y junta todo en la carpeta `grupo13-plumb/` (`public/` estático, `api/` + `src/` como función).
- `vercel.json`: `/api/*` va a la función Express y el resto a la aplicación React.
- `publicar.sh`: publica en la cuenta de Vercel del grupo (pasos dentro del archivo).

No se usa GitHub: Vercel recibe la carpeta directamente desde la CLI.
