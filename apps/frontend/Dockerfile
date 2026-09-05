# syntax=docker/dockerfile:1
#
# Cogniva frontend — React + TypeScript + Vite, built to static files and served
# by nginx. nginx also reverse-proxies /api, /health and /ws to the backend so
# the browser talks to a single origin (the backend's CORS only trusts
# localhost, so same-origin is the clean production setup).
#
# Because the API is same-origin behind nginx, VITE_API_BASE defaults to "" and
# the app calls relative paths (/api/...). Override the build arg only if you
# serve the backend on a different origin.

# ---- Stage 1: build the static bundle -------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Empty base => relative /api/... requests, resolved by nginx (see nginx.conf).
ARG VITE_API_BASE=""
ENV VITE_API_BASE=${VITE_API_BASE}
# Whiteboard engine. Production runs on a real HTTPS domain where tldraw demands a
# paid license, so default the image to Excalidraw (MIT, no license enforcement).
# Local `npm run dev` leaves this unset and keeps tldraw.
ARG VITE_WHITEBOARD="excalidraw"
ENV VITE_WHITEBOARD=${VITE_WHITEBOARD}
RUN npm run build

# ---- Stage 2: serve with nginx --------------------------------------------
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
