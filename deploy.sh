#!/bin/bash
# ─── deploy.sh — Script di deploy per Docker Swarm ───────────────────────────
# Utilizzo: ./deploy.sh
# Prerequisito: eseguire dalla root del repo dopo git pull

set -euo pipefail

STACK_NAME="domusbet"
ENV_FILE="/opt/domusbet/.env.production"
COMPOSE_FILE="$(cd "$(dirname "$0")" && pwd)/docker-compose.prod.yml"

echo ""
echo "══════════════════════════════════════════════"
echo "  Domusbet — Deploy Docker Swarm"
echo "══════════════════════════════════════════════"
echo ""

# ─── Step 1: Verifica Swarm ──────────────────────────────────────────────────
echo "==> [1/6] Verifica Docker Swarm..."
SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")
if [ "$SWARM_STATE" != "active" ]; then
  echo "❌ ERRORE: Docker Swarm non è attivo."
  echo "   Esegui prima: docker swarm init --advertise-addr <IP_VPS>"
  exit 1
fi
echo "   ✓ Swarm attivo"

# ─── Step 2: Caricamento variabili ambiente ──────────────────────────────────
echo "==> [2/6] Caricamento variabili ambiente da $ENV_FILE..."
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ ERRORE: File $ENV_FILE non trovato."
  echo "   Copia .env.production.example in $ENV_FILE e compila i valori."
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
echo "   ✓ Variabili caricate"

# ─── Step 3: Build immagini ──────────────────────────────────────────────────
echo "==> [3/6] Build immagini Docker..."
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

docker build -t domusbet/api:latest       -f "$REPO_DIR/apps/api/Dockerfile"       "$REPO_DIR"
echo "   ✓ domusbet/api:latest"

docker build -t domusbet/bot:latest       -f "$REPO_DIR/apps/bot/Dockerfile"       "$REPO_DIR"
echo "   ✓ domusbet/bot:latest"

docker build -t domusbet/worker:latest    -f "$REPO_DIR/apps/worker/Dockerfile"    "$REPO_DIR"
echo "   ✓ domusbet/worker:latest"

docker build -t domusbet/admin-web:latest -f "$REPO_DIR/apps/admin-web/Dockerfile" "$REPO_DIR"
echo "   ✓ domusbet/admin-web:latest"

docker build -t domusbet/nginx:latest     "$REPO_DIR/docker/nginx/"
echo "   ✓ domusbet/nginx:latest"

# ─── Step 4: Migrazione database ─────────────────────────────────────────────
echo "==> [4/6] Esecuzione migrazioni Prisma..."

# Usiamo l'immagine builder (con Prisma CLI disponibile) non il runner
# L'immagine domusbet/api:latest è il runner — non ha prisma CLI
# Costruiamo un'immagine migrate temporanea basata sullo stage builder
docker build \
  --target builder \
  -t domusbet/migrate:latest \
  -f "$REPO_DIR/apps/api/Dockerfile" \
  "$REPO_DIR"

docker run --rm \
  --network domusbet_overlay \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
  domusbet/migrate:latest \
  sh -c "cd /app && pnpm --filter @domusbet/database db:migrate"

echo "   ✓ Migrazioni completate"

# ─── Step 5: Deploy stack ────────────────────────────────────────────────────
echo "==> [5/6] Deploy stack Swarm '$STACK_NAME'..."
docker stack deploy \
  --compose-file "$COMPOSE_FILE" \
  --prune \
  "$STACK_NAME"
echo "   ✓ Stack aggiornato"

# ─── Step 6: Pulizia ─────────────────────────────────────────────────────────
echo "==> [6/6] Pulizia immagini obsolete..."
docker image prune -f --filter "until=24h"
docker rmi domusbet/migrate:latest 2>/dev/null || true
echo "   ✓ Pulizia completata"

echo ""
echo "✅ Deploy completato con successo!"
echo ""
echo "   Stato servizi:  docker service ls"
echo "   Log API:        docker service logs domusbet_api -f"
echo "   Log Bot:        docker service logs domusbet_bot -f"
echo "   Log Worker:     docker service logs domusbet_worker -f"
echo ""
