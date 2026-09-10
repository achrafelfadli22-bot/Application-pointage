#!/bin/sh
set -eu

pnpm db:deploy

if [ "${SEED_DEMO_ON_START:-false}" = "true" ]; then
  pnpm db:futura-only
fi

minio_data_dir="${MINIO_DATA_DIR:-/var/data/minio}"
mkdir -p "$minio_data_dir"

MINIO_ROOT_USER="$MINIO_ACCESS_KEY" \
MINIO_ROOT_PASSWORD="$MINIO_SECRET_KEY" \
  minio server "$minio_data_dir" --address 127.0.0.1:9000 &
minio_pid=$!

PORT=4000 pnpm --filter @pointage360/api run start &
api_pid=$!

terminate() {
  kill -TERM "$api_pid" 2>/dev/null || true
  kill -TERM "$minio_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
  wait "$minio_pid" 2>/dev/null || true
}

trap terminate INT TERM EXIT

API_PROXY_URL=http://127.0.0.1:4000 \
  pnpm --filter @pointage360/web exec next start --port "${PORT:-10000}"
