# Guida Setup VPS — Domusbet Referral

Guida completa per il primo deploy su una VPS Linux (Ubuntu 22.04 / Debian 12) con Docker Swarm, Nginx e Let's Encrypt.

**Domini:**
- `api.fcast7.it` → API NestJS + Webhook Telegram Bot
- `panel.fcast7.it` → Admin Dashboard

> Per i deploy successivi al primo usa solo `./deploy.sh`.

---

## Prerequisiti

- VPS Linux con IP pubblico e accesso root via SSH
- DNS: record A per `api.fcast7.it` e `panel.fcast7.it` puntati all'IP della VPS
- Repo clonabile dalla VPS (SSH key o token GitHub)

---

## Step 1 — Installazione dipendenze

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER
apt install -y certbot git
newgrp docker  # oppure disconnettiti e riconnettiti
```

Verifica Docker:

```bash
docker --version
docker run --rm hello-world
```

---

## Step 2 — Inizializzazione Docker Swarm

```bash
docker swarm init --advertise-addr $(curl -s ifconfig.me)
```

Verifica:

```bash
docker info | grep -A2 "Swarm"
# LocalNodeState: active
```

---

## Step 3 — Crea rete overlay

```bash
docker network create --driver overlay --attachable domusbet_overlay
```

Verifica:

```bash
docker network ls | grep domusbet_overlay
```

---

## Step 4 — Clone del repository

```bash
git clone <URL_REPO> /opt/domusbet
cd /opt/domusbet
```

---

## Step 5 — Configurazione variabili d'ambiente

```bash
cp /opt/domusbet/.env.production.example /opt/domusbet/.env.production
nano /opt/domusbet/.env.production
```

**Genera i secret sul posto:**

```bash
# JWT_SECRET
openssl rand -hex 32

# JWT_REFRESH_SECRET (deve essere diverso)
openssl rand -hex 32

# API_INTERNAL_SECRET
openssl rand -hex 20

# NEXTAUTH_SECRET
openssl rand -hex 32
```

**Valori da compilare:**

| Variabile | Valore |
|-----------|--------|
| `POSTGRES_PASSWORD` | Password sicura a scelta |
| `JWT_SECRET` | Output `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Output `openssl rand -hex 32` (diverso!) |
| `API_INTERNAL_SECRET` | Output `openssl rand -hex 20` |
| `WORKER_API_INTERNAL_SECRET` | Stesso di `API_INTERNAL_SECRET` |
| `BOT_API_INTERNAL_SECRET` | Stesso di `API_INTERNAL_SECRET` |
| `NEXTAUTH_SECRET` | Output `openssl rand -hex 32` |
| `TELEGRAM_BOT_TOKEN` | Token da @BotFather |
| `BOT_WEBHOOK_URL` | `https://api.fcast7.it` |

Proteggi il file:

```bash
chmod 600 /opt/domusbet/.env.production
```

---

## Step 6 — Directory per ACME webroot

```bash
mkdir -p /var/www/certbot
```

---

## Step 7 — Certificati Let's Encrypt

Usa `standalone` per il primo certificato (Nginx non è ancora in esecuzione). Ottieni un certificato per ciascun subdomain:

```bash
# Certificato per api.fcast7.it
certbot certonly --standalone \
  --non-interactive --agree-tos \
  -m admin@fcast7.it \
  -d api.fcast7.it

# Certificato per panel.fcast7.it
certbot certonly --standalone \
  --non-interactive --agree-tos \
  -m admin@fcast7.it \
  -d panel.fcast7.it
```

Verifica:

```bash
ls /etc/letsencrypt/live/
# api.fcast7.it/  panel.fcast7.it/
```

---

## Step 8 — Primo deploy

```bash
chmod +x /opt/domusbet/deploy.sh
cd /opt/domusbet
./deploy.sh
```

Il deploy eseguirà in ordine:
1. Verifica Swarm attivo
2. Carica `.env.production`
3. Builda tutte le immagini Docker (alcuni minuti)
4. Esegue le migration Prisma
5. Avvia lo stack Swarm
6. Pulisce le immagini obsolete

---

## Step 9 — Verifica

```bash
# Stato di tutti i servizi
docker service ls

# Test API
curl -I https://api.fcast7.it/api/health
# HTTP/2 200

# Test redirect HTTP → HTTPS
curl -I http://api.fcast7.it
# HTTP/1.1 301

# Test admin panel
curl -I https://panel.fcast7.it
# HTTP/2 200

# Verifica webhook bot registrato con Telegram
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
# "url": "https://api.fcast7.it/bot-webhook"
```

---

## Step 10 — Cron per rinnovo automatico certificati

```bash
crontab -e
```

Aggiungi:

```cron
# Rinnovo certificati Let's Encrypt (due volte al giorno)
0 3,15 * * * certbot renew --webroot --webroot-path /var/www/certbot --non-interactive --quiet --post-hook "docker service update --force domusbet_nginx" >> /var/log/certbot-renew.log 2>&1
```

---

## Deploy successivi

```bash
cd /opt/domusbet
git pull
./deploy.sh
```

---

## Comandi utili

```bash
# Stato servizi
docker service ls

# Scala il worker (es. da 3 a 5)
docker service scale domusbet_worker=5

# Rollback API all'immagine precedente
docker service rollback domusbet_api

# Log in tempo reale
docker service logs domusbet_api -f --timestamps
docker service logs domusbet_bot -f --timestamps
docker service logs domusbet_worker -f --timestamps
docker service logs domusbet_nginx -f --timestamps

# Rimuovi tutto lo stack (i volumi dati persistono)
docker stack rm domusbet

# Ispeziona un servizio
docker service inspect domusbet_api --pretty
```

---

## Troubleshooting

**Errore "network domusbet_overlay not found"**
```bash
docker network create --driver overlay --attachable domusbet_overlay
```

**Bot con errore 409 Conflict** (due istanze in polling)
```bash
docker service update --replicas 0 domusbet_bot
docker service update --replicas 1 domusbet_bot
```

**Webhook bot non risponde**
Verifica che il bot sia registrato correttamente su Telegram:
```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```
Se `url` è vuoto, il bot non è ancora partito o `BOT_WEBHOOK_URL` non è impostato in `.env.production`.

**Nginx non parte (certificato non trovato)**
```bash
ls /etc/letsencrypt/live/
# Devono esserci: api.fcast7.it/  panel.fcast7.it/
```

**Migrazioni fallite al deploy**
Verifica che Postgres sia healthy:
```bash
docker service ps domusbet_postgres
docker service logs domusbet_postgres --tail 20
```
