#!/usr/bin/env bash
# Publica Plumb en la cuenta de Vercel del grupo (despliegue permanente).
#
# Requisitos (una sola vez):
#   1. npx vercel login                      inicia sesión en Vercel
#   2. Crear .env.produccion en esta carpeta (no se sube al repositorio) con:
#        MONGODB_URI='mongodb+srv://...mongodb.net/?retryWrites=true&w=majority'
#        SESION_SECRETO=<texto aleatorio largo, por ejemplo: openssl rand -base64 48>
#   3. Cargar la base: (cd ../backend && MONGODB_URI=... npm run db:init)
#
# Uso: ./publicar.sh
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
source "$AQUI/.env.produccion"
: "${MONGODB_URI:?Falta MONGODB_URI en .env.produccion}"
: "${SESION_SECRETO:?Falta SESION_SECRETO en .env.produccion}"

"$AQUI/armar.sh" "$AQUI/grupo13-plumb"
cd "$AQUI/grupo13-plumb"
npx vercel link --yes --project grupo13-plumb >/dev/null
# Las variables quedan guardadas en el proyecto de Vercel (no en el código).
for v in MONGODB_URI SESION_SECRETO; do
  npx vercel env rm "$v" production --yes >/dev/null 2>&1 || true
  printf '%s' "${!v}" | npx vercel env add "$v" production >/dev/null
done
npx vercel deploy --prod --yes
