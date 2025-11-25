#!/bin/sh
set -eu

# --- Config básicos ---
DB_HOST="${DB_HOST:-pg}"
DB_PORT="${DB_PORT:-5432}"
MEDIA_DIR="${MEDIA_DIR:-/app/uploads}"   # <-- ahora por defecto /app/uploads
HEALTH_PATH="${HEALTHCHECK_PATH:-/health/liveness}"

echo "🌎 NODE_ENV=${NODE_ENV:-}"
echo "🕒 TZ=${TZ:-}"
echo "📦 MEDIA_DIR=${MEDIA_DIR}"

# --- Esperar DB ---
echo "⏳ Esperando DB en $DB_HOST:$DB_PORT…"
until nc -z "$DB_HOST" "$DB_PORT"; do
  sleep 2
done
echo "✅ DB lista"

# --- (Opcional) Esperar Redis si existe nombre de host estándar ---
REDIS_WAIT="${REDIS_WAIT:-true}"  # exporta REDIS_WAIT=false para saltarlo
if [ "$REDIS_WAIT" = "true" ]; then
  # deduce host:puerto desde REDIS_URL (redis://host:port)
  R_HOST="redis"
  R_PORT="6379"
  if [ -n "${REDIS_URL:-}" ]; then
    R_STR="${REDIS_URL#redis://}"
    R_HOST="${R_STR%%:*}"
    R_PORT="${R_STR##*:}"
  fi
  echo "⏳ Esperando Redis en $R_HOST:$R_PORT…"
  until nc -z "$R_HOST" "$R_PORT"; do
    sleep 2
  done
  echo "✅ Redis listo"
fi

# --- Asegurar estructura de la app ---
cd /app

echo "📁 Asegurando carpeta de uploads: ${MEDIA_DIR}"
mkdir -p "${MEDIA_DIR}"

echo "🔎 Verificando build (dist)…"
if [ ! -d "dist" ]; then
  echo "❌ No existe la carpeta dist. ¿Ejecutaste el build en la imagen?"
  echo "   Revisa tu Dockerfile (COPY --from=build /app/dist ./dist)"
  exit 1
fi

# (Opcional) Verificación de data-source compilado
if [ ! -f "dist/db/data-source.js" ] && [ ! -f "dist/db/data-source.cjs" ]; then
  echo "⚠️  No se encontró dist/db/data-source.(js|cjs). Si cambiaste la ruta, ajusta migration:run:dist."
fi

# --- Migraciones y seeds ---
echo "📦 Ejecutando migraciones (dist)…"
if ! npm run migration:run:dist; then
  echo "❌ Error al ejecutar migraciones"
  exit 1
fi

# Ejecutar seeds solo si quieres (SEED_ON_START=true por defecto)
if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "🌱 Ejecutando seed principal (dist, idempotente)…"
  if ! npm run seed:dist; then
    echo "⚠️  Seed principal retornó error (posible repetición). Continuando…"
  fi

  echo "🌱 Ejecutando seed de plantilla de cierre (dist, idempotente)…"
  if ! npm run seed:plantilla:dist; then
    echo "⚠️  Seed de plantilla retornó error (posible repetición). Continuando…"
  fi
else
  echo "🌱 Seeds desactivados (SEED_ON_START=false)"
fi

# --- Lanzar API ---
echo "🩺 Healthcheck path: ${HEALTH_PATH}"
echo "🚀 Iniciando API…"
exec npm run start
