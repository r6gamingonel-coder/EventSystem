# EA KIDS Studio — reproducible environment (Node 22, FFmpeg with libass/harfbuzz, espeak-ng).
# Build:  docker build -t ea-kids-studio .
# Run:    docker run --rm -p 127.0.0.1:4300:4300 -v eakids-data:/app/data --env-file .env ea-kids-studio
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg espeak-ng fontconfig ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4300 DATA_DIR=/app/data
# NOTE: set APP_SECRET (and SETUP_TOKEN for first-run from outside the container) in your env file.
# Bind the published port to 127.0.0.1 or put an HTTPS reverse proxy in front (see docs/PRODUCTION_CHECKLIST.md).
EXPOSE 4300
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
