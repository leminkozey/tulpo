FROM oven/bun:1.3 AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
RUN bun install --frozen-lockfile

# Build frontend
FROM deps AS frontend-build
COPY packages/shared/ ./packages/shared/
COPY packages/frontend/ ./packages/frontend/
RUN cd packages/frontend && bun run build

# Production
FROM base AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY packages/backend/ ./packages/backend/
COPY packages/shared/ ./packages/shared/
COPY packages/db/ ./packages/db/
COPY --from=frontend-build /app/packages/frontend/build ./packages/frontend/build

ENV NODE_ENV=production
ENV TULPO_PORT=3000
ENV TULPO_DB_PATH=/data/tulpo.db
EXPOSE 3000
VOLUME /data

CMD ["bun", "packages/backend/src/index.ts"]
