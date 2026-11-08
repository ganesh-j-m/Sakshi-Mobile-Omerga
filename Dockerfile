# ── Single-image build: React client + Express API ─────────────────────────
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
# pg_dump for the Database Backup module (must match the PostgreSQL major version)
RUN apk add --no-cache postgresql16-client tini
ENV NODE_ENV=production \
    SERVE_CLIENT=true \
    CLIENT_DIST_DIR=/app/client/dist \
    UPLOAD_DIR=/data/uploads \
    BACKUP_DIR=/data/backups \
    PORT=4000
WORKDIR /app/server
COPY --from=server /app/server/node_modules ./node_modules
COPY --from=server /app/server/dist ./dist
COPY --from=server /app/server/drizzle ./drizzle
COPY --from=server /app/server/package.json ./
COPY --from=client /app/client/dist /app/client/dist
RUN mkdir -p /data/uploads /data/backups && chown -R node:node /data
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:4000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
# Apply pending migrations, then start the API
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
