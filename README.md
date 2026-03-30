# Domusbet Referral System

Monorepo production-ready per sistema referral Telegram integrato con Domusbet.

---

## Architettura

```
Telegram Users
      |
      v
 [Bot Service] ──internal API──> [API Service (NestJS)]
                                        |          |
                                  [PostgreSQL]  [Redis]
                                        |          |
                               [Worker Service]   BullMQ Queues
                                        |
                               Telegram Notifications
                                        |
                            [Admin Dashboard (Next.js)]
```

Il sistema e' composto da quattro applicazioni indipendenti che comunicano
tramite HTTP (REST) e code asincrone (BullMQ su Redis):

| Servizio      | Ruolo                                                       |
|---------------|-------------------------------------------------------------|
| `api`         | Core NestJS REST API — gestisce autenticazione, submission, punteggi e configurazione |
| `bot`         | Bot Telegram — raccoglie username Domusbet dagli utenti      |
| `worker`      | Consumatore BullMQ — invia notifiche e ricalcola leaderboard |
| `admin-web`   | Dashboard Next.js — pannello di amministrazione              |

---

## Struttura Monorepo

```
domusbet-referral/
├── apps/
│   ├── api/                  # NestJS REST API (porta 3001)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/         # JWT auth + refresh token
│   │   │   │   ├── admins/       # Gestione utenti admin
│   │   │   │   ├── referrers/    # Gestione referenti Telegram
│   │   │   │   ├── submissions/  # Workflow submission referral
│   │   │   │   ├── scores/       # Regole punteggio e movimenti
│   │   │   │   ├── leaderboard/  # Classifica referenti
│   │   │   │   ├── bot-messages/ # Template messaggi bot
│   │   │   │   ├── settings/     # Configurazione di sistema
│   │   │   │   ├── audit/        # Log di audit
│   │   │   │   ├── dashboard/    # KPI e statistiche
│   │   │   │   ├── queues/       # Integrazione BullMQ
│   │   │   │   └── health/       # Health check endpoint
│   │   │   ├── common/           # Guards, decorators, filtri globali
│   │   │   └── prisma/           # PrismaService singleton
│   │   └── Dockerfile
│   ├── bot/                  # Bot Telegram (grammy)
│   │   └── Dockerfile
│   ├── worker/               # Worker BullMQ
│   │   └── Dockerfile
│   └── admin-web/            # Dashboard Next.js (porta 3000)
│       └── Dockerfile
├── packages/
│   ├── database/             # Schema Prisma + client generato
│   ├── shared-types/         # Interfacce TypeScript condivise
│   ├── shared-utils/         # Utilities condivise (username, template…)
│   └── config/               # Validazione variabili d'ambiente (Zod)
├── docker/
│   └── nginx/
│       └── nginx.conf        # Reverse proxy produzione
├── docker-compose.yml        # Stack completo (tutti i servizi)
├── docker-compose.override.yml # Solo infrastruttura per sviluppo locale
├── .env.example              # Template variabili d'ambiente
└── package.json              # Workspace root con script globali
```

---

## Quick Start

### Prerequisiti

- Node.js 20+
- pnpm 9+
- Docker e Docker Compose

### Setup Sviluppo (host nativo)

```bash
# 1. Clona il repository
git clone <url> domusbet-referral
cd domusbet-referral

# 2. Installa dipendenze
pnpm install

# 3. Copia il file d'ambiente
cp .env.example .env
# Modifica .env con i tuoi valori (minimo: TELEGRAM_BOT_TOKEN)

# 4. Avvia solo Postgres e Redis via Docker
pnpm docker:up

# 5. Genera il client Prisma
pnpm db:generate

# 6. Esegui le migrazioni
pnpm db:migrate

# 7. Popola il database con i dati iniziali
pnpm db:seed

# 8. Avvia i servizi in terminali separati
pnpm dev:api       # API su http://localhost:3001
pnpm dev:bot       # Bot Telegram (polling)
pnpm dev:worker    # Worker BullMQ
pnpm dev:admin     # Admin dashboard su http://localhost:3000
```

### Setup Completo con Docker

```bash
cp .env.example .env
# Modifica .env con i valori richiesti

docker compose up -d

# Visualizza i log
docker compose logs -f
```

### Accesso

| Servizio         | URL                          | Credenziali default          |
|------------------|------------------------------|------------------------------|
| Admin Dashboard  | http://localhost:3000        | admin@domusbet.it / Admin@123456 |
| API              | http://localhost:3001/api    | —                            |
| Prisma Studio    | `pnpm db:studio` (porta 5555)| —                            |

---

## Variabili Ambiente

| Variabile                  | Servizi          | Default                    | Descrizione                                      |
|----------------------------|------------------|----------------------------|--------------------------------------------------|
| `NODE_ENV`                 | tutti            | `development`              | Ambiente di esecuzione                           |
| `DATABASE_URL`             | api, bot, worker | —                          | URL PostgreSQL (Prisma)                          |
| `REDIS_URL`                | api, bot, worker | `redis://localhost:6379`   | URL Redis completo                               |
| `REDIS_HOST`               | api, bot, worker | `localhost`                | Host Redis                                       |
| `REDIS_PORT`               | api, bot, worker | `6379`                     | Porta Redis                                      |
| `API_PORT`                 | api              | `3001`                     | Porta di ascolto API                             |
| `API_HOST`                 | api              | `0.0.0.0`                  | Indirizzo di bind API                            |
| `CORS_ORIGIN`              | api              | `http://localhost:3000`    | Origine CORS consentita                          |
| `JWT_SECRET`               | api              | —                          | Segreto token di accesso (min 32 caratteri)      |
| `JWT_EXPIRES_IN`           | api              | `15m`                      | TTL token di accesso                             |
| `JWT_REFRESH_SECRET`       | api              | —                          | Segreto refresh token (min 32 caratteri)         |
| `JWT_REFRESH_EXPIRES_IN`   | api              | `7d`                       | TTL refresh token                                |
| `API_INTERNAL_SECRET`      | api, bot, worker | —                          | Segreto condiviso per route interne (min 16)     |
| `TELEGRAM_BOT_TOKEN`       | bot, worker      | —                          | Token bot da @BotFather                          |
| `BOT_API_URL`              | bot              | `http://localhost:3001`    | URL API raggiungibile dal bot                    |
| `BOT_API_INTERNAL_SECRET`  | bot              | —                          | Alias di API_INTERNAL_SECRET per il bot          |
| `BOT_WEBHOOK_URL`          | bot              | —                          | URL webhook (opzionale, altrimenti polling)      |
| `WORKER_API_URL`           | worker           | `http://localhost:3001`    | URL API raggiungibile dal worker                 |
| `WORKER_API_INTERNAL_SECRET`| worker          | —                          | Alias di API_INTERNAL_SECRET per il worker       |
| `WORKER_CONCURRENCY`       | worker           | `5`                        | Job concorrenti per coda                         |
| `WORKER_MAX_STALLED_COUNT` | worker           | `3`                        | Max tentativi job in stallo                      |
| `NEXT_PUBLIC_API_URL`      | admin-web        | `http://localhost:3001`    | URL API pubblica (browser)                       |
| `NEXTAUTH_SECRET`          | admin-web        | —                          | Segreto NextAuth.js (min 32 caratteri)           |
| `NEXTAUTH_URL`             | admin-web        | `http://localhost:3000`    | URL canonico dashboard                           |
| `THROTTLE_SHORT_LIMIT`     | api              | `10`                       | Max req/sec per IP (finestra corta)              |
| `THROTTLE_MEDIUM_LIMIT`    | api              | `50`                       | Max req/10s per IP (finestra media)              |
| `THROTTLE_LONG_LIMIT`      | api              | `100`                      | Max req/min per IP (finestra lunga)              |
| `LOG_LEVEL`                | tutti            | `info`                     | Livello di log: debug, info, warn, error         |
| `APP_NAME`                 | tutti            | `Domusbet Referral`        | Nome applicazione nei log                        |

---

## Database

### Migrazioni

```bash
# Applica migrazioni in produzione (non interattivo)
pnpm db:migrate

# Applica migrazioni in sviluppo (crea migration file se schema cambia)
pnpm db:migrate:dev

# Genera il client Prisma dopo modifiche allo schema
pnpm db:generate
```

### Seed

```bash
# Popola il database con dati iniziali (admin default, regole punteggio…)
pnpm db:seed
```

### Prisma Studio

```bash
# Apre l'interfaccia grafica per esplorare il database
pnpm db:studio
# Disponibile su http://localhost:5555
```

---

## Bot Telegram

Il bot comunica con gli utenti Telegram e raccoglie username Domusbet tramite i
seguenti comandi:

| Comando      | Descrizione                                          |
|--------------|------------------------------------------------------|
| `/start`     | Registra il referente e mostra il messaggio di benvenuto |
| `/submit`    | Avvia il flusso di invio di un username Domusbet     |
| `/status`    | Mostra lo stato delle proprie submission             |
| `/help`      | Mostra i comandi disponibili                         |
| `/punti`     | Mostra i punti accumulati e il proprio rank          |

I messaggi inviati dal bot sono personalizzabili tramite la sezione
**Bot Messages** del pannello di amministrazione, senza riavviare il servizio.

---

## API Reference

### Autenticazione

```
POST   /api/auth/login           # Login con email e password
POST   /api/auth/logout          # Logout (invalida refresh token)
POST   /api/auth/refresh         # Rinnova access token via refresh token
GET    /api/auth/me              # Profilo admin autenticato
```

### Submission

```
GET    /api/submissions          # Lista submission (paginata, filtrabile)
GET    /api/submissions/:id      # Dettaglio submission + eventi
POST   /api/submissions/:id/approve    # Approva submission
POST   /api/submissions/:id/reject     # Rifiuta submission
POST   /api/submissions/:id/points     # Assegna punti manualmente
GET    /api/submissions/:id/events     # Storia eventi submission
```

### Referenti

```
GET    /api/referrers            # Lista referenti
GET    /api/referrers/:id        # Dettaglio referente
PATCH  /api/referrers/:id        # Aggiorna referente
DELETE /api/referrers/:id        # Disattiva referente
GET    /api/referrers/:id/score  # Riepilogo punteggio
```

### Leaderboard

```
GET    /api/leaderboard          # Classifica corrente (paginata)
```

### Punteggi

```
GET    /api/scores/rules         # Lista regole punteggio
POST   /api/scores/rules         # Crea regola punteggio
PATCH  /api/scores/rules/:id     # Aggiorna regola
DELETE /api/scores/rules/:id     # Elimina regola
GET    /api/scores/movements     # Lista movimenti punteggio
```

### Impostazioni

```
GET    /api/settings             # Lista impostazioni di sistema
PATCH  /api/settings/:key        # Aggiorna impostazione
```

### Bot Messages

```
GET    /api/bot-messages         # Lista template messaggi
PATCH  /api/bot-messages/:key    # Aggiorna template
```

### Admin

```
GET    /api/admins               # Lista amministratori (solo SUPER_ADMIN)
POST   /api/admins               # Crea amministratore (solo SUPER_ADMIN)
PATCH  /api/admins/:id           # Aggiorna amministratore
DELETE /api/admins/:id           # Elimina amministratore (solo SUPER_ADMIN)
POST   /api/admins/:id/password  # Cambia password
```

### Dashboard

```
GET    /api/dashboard/stats      # KPI principali (submission, referenti, punti)
```

### Audit

```
GET    /api/audit                # Log di audit (solo SUPER_ADMIN)
```

### Interno (Bot / Worker)

Tutte le route `/api/internal/*` richiedono l'header:

```
x-internal-secret: <API_INTERNAL_SECRET>
```

```
POST   /api/internal/submissions         # Crea submission dal bot
GET    /api/internal/referrers/:tgId     # Recupera referente per Telegram ID
POST   /api/internal/referrers           # Crea/aggiorna referente
GET    /api/internal/bot-messages/:key   # Recupera template messaggio
```

### Health Check

```
GET    /api/health               # { status: "ok", timestamp: "...", uptime: N }
```

---

## Sicurezza

- **JWT con rotazione refresh token**: access token di breve durata (15 min),
  refresh token di lunga durata (7 giorni) con rotazione ad ogni rinnovo.
- **RBAC**: tre ruoli — `SUPER_ADMIN`, `ADMIN`, `VIEWER` — con permessi granulari.
- **Helmet**: header HTTP di sicurezza (CSP, HSTS, X-Frame-Options…).
- **Rate limiting**: tre finestre temporali indipendenti per prevenire abusi.
- **Internal secret**: route interne protette da segreto condiviso, non esposte
  pubblicamente tramite nginx.
- **Audit log**: ogni azione rilevante viene tracciata con attore, timestamp e
  contesto.
- **Validazione input**: ogni DTO e' validato con class-validator; input non
  conformi vengono rifiutati con 400.

---

## Test

```bash
# Esegui tutti i test del monorepo
pnpm test

# Solo test del package shared-utils (username, template…)
pnpm --filter shared-utils test

# Solo test dell'API
pnpm --filter api test

# Solo test del database
pnpm --filter database test

# Con coverage
pnpm --filter shared-utils test -- --coverage
```

---

## Docker

```bash
# Avvia tutti i servizi (build incluso)
docker compose up -d

# Avvia solo infrastruttura (Postgres + Redis) per sviluppo locale
docker compose up -d postgres redis

# Visualizza log in tempo reale
docker compose logs -f

# Visualizza log di un singolo servizio
docker compose logs -f api

# Ferma tutti i servizi
docker compose down

# Ferma e rimuovi volumi (reset completo)
docker compose down -v

# Rebuild di un singolo servizio
docker compose build api
docker compose up -d api

# Alias pnpm
pnpm docker:up      # docker compose up -d
pnpm docker:down    # docker compose down
pnpm docker:logs    # docker compose logs -f
```

---

## Architettura Decisioni

### Perche' Prisma Transactions?

Ogni operazione che modifica piu' entita' contemporaneamente (es. approvazione
submission: aggiorna stato + crea evento + crea ScoreMovement + crea audit log)
viene eseguita in una singola transazione Prisma. In questo modo o tutto va a
buon fine o nulla viene persistito, garantendo consistenza dei dati anche in
caso di errori parziali.

### Perche' ScoreMovements invece di un campo punti diretto?

Anziche' aggiornare un campo `totalPoints` sul referente, ogni variazione di
punteggio viene registrata come `ScoreMovement` separato. Questo approccio
offre:

- **Auditabilita'**: e' possibile vedere esattamente quando e perche' sono stati
  assegnati i punti.
- **Ricalcolo**: il punteggio totale puo' essere ricalcolato da zero in qualsiasi
  momento a partire dai movimenti.
- **Storia completa**: e' possibile annullare movimenti specifici senza perdere
  la storia.
- **Flessibilita'**: le regole di punteggio possono cambiare senza dover
  migrare dati storici.

### Perche' BullMQ?

Le notifiche Telegram e il ricalcolo della leaderboard sono operazioni
asincrone che non devono bloccare la risposta HTTP. BullMQ su Redis offre:

- **Retry automatico** con backoff esponenziale in caso di errori temporanei
  (es. Telegram API down).
- **Persistenza**: i job sopravvivono al riavvio del worker.
- **Concorrenza configurabile**: il numero di job paralleli e' regolabile via
  `WORKER_CONCURRENCY`.
- **Monitoraggio**: job completati, falliti e in coda sono ispezionabili.

---

## Flusso Operativo

```
1.  Referente invia /start al bot Telegram
2.  Bot registra il referente (crea o aggiorna via API interna)
3.  Referente invia il proprio username Domusbet
4.  Bot normalizza l'username (lowercase, trim, rimozione @)
5.  Bot valida il formato (3-32 caratteri, solo alfanumerici + . + _)
6.  API controlla duplicati (unique constraint su normalizedDomusbetUsername)
7.  API crea la Submission in stato PENDING
8.  API crea un SubmissionEvent CREATED nella stessa transazione
9.  Worker notifica il referente via Telegram: "Submission ricevuta"
10. Admin vede la nuova submission nel pannello (aggiornamento real-time)
11. Admin approva o rifiuta con eventuali note
12. Se approvata: API crea ScoreMovement e aggiorna leaderboard
13. Worker notifica il referente: "Approvata!" o "Rifiutata: <motivo>"
14. Audit log registra chi ha eseguito l'azione e quando
```

---

## Licenza

Proprietario — tutti i diritti riservati.
