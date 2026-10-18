#!/usr/bin/env bash
# Publica Plumb en la cuenta de Vercel del grupo (despliegue permanente).
#
# Requisitos (una sola vez):
#   1. npx vercel login                      inicia sesión en Vercel
#   2. Crear .env.produccion en esta carpeta con:
#        DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=verify-full
#   3. Cargar la base:  (cd ../backend && DATABASE_URL=... npm run db:init)
#
# Uso: ./publicar.sh
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
source "$AQUI/.env.produccion"
: "${DATABASE_URL:?Falta DATABASE_URL en .env.produccion}"

"$AQUI/armar.sh" "$AQUI/grupo13-plumb"
cd "$AQUI/grupo13-plumb"
npx vercel link --yes --project grupo13-plumb >/dev/null
# La variable queda guardada en el proyecto de Vercel (no en el código).
npx vercel env rm DATABASE_URL production --yes >/dev/null 2>&1 || true
printf '%s' "$DATABASE_URL" | npx vercel env add DATABASE_URL production >/dev/null
npx vercel deploy --prod --yes
