# syntax=docker/dockerfile:1
#
# Cogniva backend — TypeScript + Fastify, run directly with tsx.
#
# The backend has no compile-to-JS step (`npm run build` is just `tsc --noEmit`);
# it is started with `tsx src/main.ts`. tsx lives in devDependencies, so the
# runtime image keeps the full dependency tree rather than `--omit=dev`.
#
# Listens on 0.0.0.0:8000 (override with PORT). GEMINI_API_KEY is optional — the
# Learner falls back to a deterministic mock when it is absent.

FROM node:20-alpine

# Small init so PID 1 reaps children and forwards signals (clean Ctrl-C / stop).
RUN apk add --no-cache tini

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first so this layer is cached until the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

# Application source (see .dockerignore for what is excluded).
COPY . .

# Run as the built-in non-root user shipped with the node image.
USER node

EXPOSE 8000

# Basic liveness probe against the /health route the app exposes.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]
