#!/bin/sh
set -e

MAX_RETRIES="${DB_PUSH_MAX_RETRIES:-30}"
RETRY_DELAY_SECONDS="${DB_PUSH_RETRY_DELAY_SECONDS:-2}"

echo "[entrypoint] Generating Prisma client..."
npm run prisma:generate

echo "[entrypoint] Applying Prisma schema (db push)..."
attempt=1
while [ "$attempt" -le "$MAX_RETRIES" ]; do
  if output="$(npm run prisma:push 2>&1)"; then
    echo "$output"
    break
  fi

  echo "$output"

  if echo "$output" | grep -q "P1000"; then
    echo "[entrypoint] Database authentication failed (P1000). Check POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB and DATABASE_URL."
    exit 1
  fi

  if [ "$attempt" -eq "$MAX_RETRIES" ]; then
    echo "[entrypoint] Database not ready after ${MAX_RETRIES} attempts. Exiting."
    exit 1
  fi

  echo "[entrypoint] Database not ready yet (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_SECONDS}s..."
  attempt=$((attempt + 1))
  sleep "$RETRY_DELAY_SECONDS"
done

echo "[entrypoint] Starting API..."
exec "$@"
