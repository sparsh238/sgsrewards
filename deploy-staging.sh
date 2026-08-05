#!/usr/bin/env bash
# Deploy SGS Rewards STAGING to the Hostinger VPS. Fully isolated from production:
# own dir (/home/loyalty-staging), own port (127.0.0.1:8090), own subdomain.
# Secrets (.env.staging) live ONLY on the VPS and are never synced from here.
set -euo pipefail
HOST="root@82.112.236.6"
REMOTE="/home/loyalty-staging"
cd "$(dirname "$0")"

echo "==> [1/2] Syncing source to $HOST:$REMOTE (no secrets, no node_modules/dist)"
ssh "$HOST" "mkdir -p $REMOTE"
rsync -az --delete \
  --exclude 'node_modules' --exclude 'dist' --exclude 'build' --exclude '.git' \
  --exclude '.env' --exclude '.env.*' --exclude '*.log' --exclude '.DS_Store' \
  --exclude 'backend/uploads' \
  backend frontend Dockerfile docker-compose.staging.yml "$HOST:$REMOTE/"

echo "==> [2/2] Building + (re)starting the staging container on the VPS"
ssh "$HOST" "cd $REMOTE && docker compose -f docker-compose.staging.yml up -d --build && sleep 5 && echo -n 'healthz: ' && curl -s http://127.0.0.1:8090/healthz && echo"
echo "Done. Container on 127.0.0.1:8090 — front it via CloudPanel reverse proxy (see DEPLOY_STAGING.md)."
