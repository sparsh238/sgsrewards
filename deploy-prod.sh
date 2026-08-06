#!/usr/bin/env bash
# Deploy SGS Rewards PRODUCTION to the Hostinger VPS. Isolated from staging:
# own dir (/home/loyalty-prod), own port (127.0.0.1:8091), fronted by sgsrewards.in.
# Secrets (.env.prod) live ONLY on the VPS and are never synced from here.
set -euo pipefail
HOST="root@82.112.236.6"
REMOTE="/home/loyalty-prod"
cd "$(dirname "$0")"

# Refuse to build if the prod env file isn't in place yet (first-time setup below).
ssh "$HOST" "test -f $REMOTE/.env.prod" || { echo "ERROR: $REMOTE/.env.prod missing on the VPS. Create it first (see PROD note)."; exit 1; }

echo "==> [1/2] Syncing source to $HOST:$REMOTE (no secrets, no node_modules/dist)"
ssh "$HOST" "mkdir -p $REMOTE"
rsync -az --delete \
  --exclude 'node_modules' --exclude 'dist' --exclude 'build' --exclude '.git' \
  --exclude '.env' --exclude '.env.*' --exclude '*.log' --exclude '.DS_Store' \
  --exclude 'backend/uploads' \
  backend frontend Dockerfile docker-compose.prod.yml "$HOST:$REMOTE/"

echo "==> [2/2] Building + (re)starting the prod container on the VPS"
ssh "$HOST" "cd $REMOTE && docker compose -f docker-compose.prod.yml up -d --build && sleep 5 && echo -n 'healthz: ' && curl -s http://127.0.0.1:8091/healthz && echo"
echo "Done. Container on 127.0.0.1:8091 — front sgsrewards.in at it via CloudPanel reverse proxy."
