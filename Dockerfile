# ---------- base ----------
FROM node:20-alpine AS base
WORKDIR /app

# ---------- deps: SIEMPRE instala deps + devDeps para poder compilar ----------
FROM base AS deps
COPY package*.json ./
RUN npm ci

# ---------- build: compila TS usando node_modules de deps ----------
FROM base AS build
WORKDIR /app
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- runner: imagen final en producción ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=America/Guatemala

# Herramientas para healthcheck/entrypoint
RUN apk add --no-cache wget netcat-openbsd

# entrypoint
COPY docker/entrypoint.sh /app/docker/entrypoint.sh
RUN sed -i 's/\r$//' /app/docker/entrypoint.sh && chmod +x /app/docker/entrypoint.sh

# Traemos package.json y node_modules completos, y luego podamos devDeps
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev \
  && node -e "console.log('typeorm =>', require.resolve('typeorm'))"

# Copiamos build compilado
COPY --from=build /app/dist ./dist

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -qO- http://localhost:4000/health/liveness || exit 1

CMD ["node","dist/server.js"]
