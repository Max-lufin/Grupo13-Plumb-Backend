# despliegue

Publica el frontend y la API en un mismo proyecto de Vercel. La base de datos es MongoDB Atlas; su URI y el secreto de las sesiones se cargan como variables de entorno del proyecto (`MONGODB_URI`, `SESION_SECRETO`), nunca en el repositorio.

- `armar.sh`: compila el frontend y junta todo en la carpeta `grupo13-plumb/` (`public/` estático, `api/` + `src/` como función).
- `vercel.json`: `/api/*` va a la función Express y el resto a la aplicación React.
- `publicar.sh`: publica en la cuenta de Vercel del grupo (pasos dentro del archivo).
