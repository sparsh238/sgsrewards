# SGS Rewards — single-image build: Node API + built SPA served from one origin.
# Used for the staging deploy (docker-compose.staging.yml). Context = repo root.

# ---- build the frontend (SPA) ----
FROM node:20-alpine AS fe
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Single-origin: strip any baked API URL so api.ts falls back to relative "/api"
# (the SPA is served by the same Express process that serves the API).
RUN rm -f .env .env.production .env.development .env.production.local .env.local \
 && npm run build

# ---- build the backend (TypeScript -> dist) ----
FROM node:20-alpine AS be
WORKDIR /be
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# ---- runtime ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=be /be/dist ./dist
COPY --from=fe /fe/dist ./public
# server.ts serves ./public when SERVE_STATIC=true (set in compose).
EXPOSE 3000
CMD ["node", "dist/server.js"]
