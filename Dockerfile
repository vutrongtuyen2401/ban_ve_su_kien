FROM node:20-bookworm-slim AS dependencies

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
ENV npm_config_nodedir=/usr/local
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim

WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

EXPOSE 8090
CMD ["npm", "start"]
