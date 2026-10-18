# despliegue

Publica el frontend y la API en un mismo proyecto de Vercel; la base de datos vive en Neon.

- `armar.sh`: compila el frontend y junta todo en la carpeta `grupo13-plumb/` (`public/` estático, `api/` + `src/` como función).
- `vercel.json`: `/api/*` va a la función Express y el resto a la aplicación React.
- `publicar.sh`: publica en la cuenta de Vercel del grupo (pasos dentro del archivo).

No se usa GitHub: Vercel recibe la carpeta directamente desde la CLI.
