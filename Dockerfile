# ZUNO Technologies — production container image
# Node 22 ships the built-in `node:sqlite` module, so there are no native build
# steps. Set DATABASE_URL to run on a free permanent Postgres (Neon/Supabase);
# otherwise the app uses a local SQLite file under ZUNO_DATA_DIR.
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Application source
COPY . .

# Persistent data lives here (mount a volume at /data to keep the DB + uploads)
ENV PORT=3000
ENV ZUNO_DATA_DIR=/data
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

# Basic container health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
