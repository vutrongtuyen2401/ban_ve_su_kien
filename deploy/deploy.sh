#!/bin/sh
set -eu

: "${IMAGE:?IMAGE is required}"

if [ ! -f deploy/Caddyfile ]; then
  printf ':8090 {\n  reverse_proxy api-blue:8090\n}\n' > deploy/Caddyfile
fi

docker compose -f compose.staging.yml up -d --wait
docker pull "$IMAGE"

active="blue"
if [ -f .active-color ]; then
  active="$(cat .active-color)"
fi

if [ "$active" = "blue" ]; then
  candidate="green"
else
  candidate="blue"
fi

candidate_name="api-$candidate"
active_name="api-$active"
docker rm -f "$candidate_name" >/dev/null 2>&1 || true

docker run --rm --network ban-ve-network --env-file .env.staging "$IMAGE" npm run migrate:latest

docker run -d \
  --name "$candidate_name" \
  --network ban-ve-network \
  --env-file .env.staging \
  --restart unless-stopped \
  "$IMAGE"

healthy=false
for _attempt in $(seq 1 30); do
  if docker exec "$candidate_name" wget -qO- http://127.0.0.1:8090/health/ready >/dev/null 2>&1; then
    healthy=true
    break
  fi
  sleep 2
done

if [ "$healthy" != "true" ]; then
  docker logs "$candidate_name" --tail 100
  docker rm -f "$candidate_name" >/dev/null
  echo "Candidate failed health check; active container was kept." >&2
  exit 1
fi

sed "s/api-$active:8090/api-$candidate:8090/" deploy/Caddyfile > deploy/Caddyfile.next
mv deploy/Caddyfile.next deploy/Caddyfile
docker exec ban-ve-proxy caddy reload --config /etc/caddy/Caddyfile
printf '%s\n' "$candidate" > .active-color

docker rm -f "$active_name" >/dev/null 2>&1 || true
docker image prune -f >/dev/null
echo "Deployment switched from $active to $candidate."
