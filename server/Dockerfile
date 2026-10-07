# The online play server (CHE-271) for the VPS (Kamal 2 with kamal-proxy). Build context: the repo root. The image holds only server/
# and the rules engine it imports (src/rules.js), nothing else of the game. No build step, one dependency (jose, CHE-341 spike, server/package.json only), runs as a non root user,
# the database under /data (a Kamal volume). The app listens on PORT (3000); GET /up is the health check.
FROM node:24-slim
LABEL service="chess-online"
ENV NODE_ENV=production PORT=3000 ONLINE_DB=/data/online.db
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/ ./server/
COPY src/rules.js ./src/rules.js
RUN printf '{"type":"module","private":true}\n' > package.json && mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server/index.mjs"]
