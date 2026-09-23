FROM node:18-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node app.js db.js index.js knexfile.js ./
COPY --chown=node:node migrations ./migrations

USER node
EXPOSE 8090

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8090/health/ready || exit 1

CMD ["node", "index.js"]
