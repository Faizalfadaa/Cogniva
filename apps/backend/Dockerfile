# syntax=docker/dockerfile:1
#
# Cogniva backend — TypeScript + Fastify, run directly with tsx.
#
# The backend has no compile-to-JS step (`npm run build` is just `tsc --noEmit`);
# it is started with `tsx src/main.ts`. tsx lives in devDependencies, so the
# runtime image keeps the full dependency tree rather than `--omit=dev`.
#
# Listens on 0.0.0.0:8000 (override with PORT). GEMINI_API_KEY is optional — the
# Learner falls back to a deterministic mock when it is absent. DATABASE_URL is
# not: all storage is Postgres, and the entrypoint applies pending migrations
# before the server starts.

FROM node:20-alpine

# Small init so PID 1 reaps children and forwards signals (clean Ctrl-C / stop).
RUN apk add --no-cache tini

WORKDIR /app

# Install dependencies first so this layer is cached until the lockfile changes.
# --include=dev is required: the app is started with `tsx` (npm start), and tsx
# lives in devDependencies. NODE_ENV=production is set *after* the install so it
# can't cause npm to omit dev deps and drop tsx.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

ENV NODE_ENV=production

# Application source (see .dockerignore for what is excluded).
COPY . .

# The Prisma client is generated code, kept out of git — build it into the image
# so the first request doesn't race a code generator.
RUN npx prisma generate

RUN chmod +x ./docker-entrypoint.sh

# Run as the built-in non-root user shipped with the node image.
USER node

EXPOSE 8000

# Basic liveness probe against the /health route the app exposes.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["npm", "start"]
