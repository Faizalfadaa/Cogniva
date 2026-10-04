#!/bin/sh
# Bring the schema up to date, then hand over to the server.
#
# `migrate deploy` only applies migrations that are already committed — it never
# generates one and never prompts — so it is safe to run on every boot. A fresh
# volume becomes a fully migrated database here; an up-to-date one is a no-op.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[cogniva] applying database migrations..."
  npx prisma migrate deploy
fi

exec "$@"
