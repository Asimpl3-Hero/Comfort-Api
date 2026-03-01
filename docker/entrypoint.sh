#!/bin/sh
set -e

echo "[entrypoint] Generating Prisma client..."
npm run prisma:generate

echo "[entrypoint] Applying Prisma schema (db push)..."
until npm run prisma:push; do
  echo "[entrypoint] Database not ready yet, retrying in 2s..."
  sleep 2
done

echo "[entrypoint] Starting API..."
exec "$@"
