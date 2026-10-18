#!/usr/bin/env bash
# Arma la carpeta que se sube a Vercel: el frontend compilado (public/) y la API
# Express como función serverless (api/ + src/). Frontend y API quedan en la
# misma dirección, así el navegador llama a /api/v1 sin problemas de CORS.
#
# Uso:  ./armar.sh [carpeta_salida]
# Luego: cd <carpeta_salida> && npx vercel deploy --prod -e DATABASE_URL="postgresql://..."
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
SALIDA="${1:-$RAIZ/despliegue/grupo13-plumb}"

rm -rf "$SALIDA"
mkdir -p "$SALIDA/public"

echo "1/2 Compilando el frontend..."
(cd "$RAIZ/frontend" && npm install --no-audit --no-fund >/dev/null && VITE_API_URL= npm run build >/dev/null)
cp -r "$RAIZ/frontend/dist/." "$SALIDA/public/"

echo "2/2 Copiando la API..."
cp -r "$RAIZ/backend/api" "$RAIZ/backend/src" "$SALIDA/"
cp "$RAIZ/backend/package.json" "$RAIZ/backend/package-lock.json" "$SALIDA/"
cp "$RAIZ/despliegue/vercel.json" "$SALIDA/"
# Nunca subir credenciales locales (vercel link crea .env.local aquí).
printf '.env*\n' > "$SALIDA/.vercelignore"

echo "Listo: $SALIDA"
