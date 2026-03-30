# Design: Link Referral come Variabili nei Messaggi Bot

**Data:** 2026-03-30
**Stato:** Approvato

---

## Obiettivo

Quando una segnalazione viene approvata, il bot invia al referrer un messaggio (già esistente) che può contenere due nuove variabili:

- `{linkBot}` — deep link personale del referrer al bot Telegram
- `{linkCanale}` — invite link unico al canale Telegram privato Domusbet

L'admin compone il messaggio di approvazione dall'editor "Messaggi Bot" già esistente in dashboard, includendo le variabili dove vuole.

---

## Contesto architetturale

### Come funzionano già i template

- I template sono salvati in PostgreSQL (`BotMessageTemplate`) con chiave univoca (es. `submission_approved`)
- All'avvio del bot e ad ogni salvataggio dall'admin, il contenuto viene caricato su Redis con chiave `bot:msg:{key}`
- Il **bot** (Telegraf) legge sempre da Redis → fallback API → fallback messaggio di errore
- Il **worker** (BullMQ) invia le notifiche di approvazione/rifiuto con testo **hardcoded** — non usa né Redis né il sistema di template

### Bug pre-esistente

Il worker bypassa il sistema di template. Questo deve essere corretto come parte di questa feature: il worker deve leggere `bot:msg:submission_approved` da Redis, esattamente come fa il bot.

---

## Variabili nuove

| Variabile | Valore | Generazione |
|---|---|---|
| `{linkBot}` | `https://t.me/{BOT_USERNAME}?start=ref_{referrerId}` | Calcolato staticamente — nessuna API call |
| `{linkCanale}` | `https://t.me/+xxxxxxxx` | Generato via Telegram `createChatInviteLink` — una volta sola per referrer, poi riusato |

Il formato `{variabile}` (singole graffe) è lo stesso già usato da tutti gli altri template.

---

## Architettura della soluzione

### 1. Database — Prisma schema

Aggiunta al modello `Referrer`:

```prisma
channelInviteLink   String? @map("channel_invite_link")
channelInviteLinkId String? @map("channel_invite_link_id")
```

`channelInviteLinkId` è l'identificatore interno Telegram (campo `invite_link` nella risposta di `createChatInviteLink`), necessario per una eventuale revoca futura.

### 2. Configurazione — packages/config/src/worker.config.ts

Nuovi campi nel Zod schema del worker:

```ts
TELEGRAM_BOT_TOKEN: z.string().min(1)         // già usato raw, ora formalizzato
TELEGRAM_CHANNEL_ID: z.string().min(1)         // ID del canale privato Domusbet (es. -1001234567890)
BOT_USERNAME: z.string().min(1)                // username del bot senza @ (es. DomusbetBot)
```

### 3. Worker — apps/worker

**Redis client:** il worker usa già Redis per BullMQ; va aggiunto un client `ioredis` standalone per leggere i template con la stessa logica del bot.

**Flusso aggiornato di `processApprovalNotification`:**

```
1. Fetch template da Redis: GET bot:msg:submission_approved
   → fallback: GET /internal/bot-messages/submission_approved via API interna
2. Template contiene {linkBot}?
   → Sì: calcola https://t.me/{BOT_USERNAME}?start=ref_{referrerId}
3. Template contiene {linkCanale}?
   → Sì: GET /internal/referrers/{telegramId}/channel-link
       → link già presente: riusa
       → link assente: chiama Telegram createChatInviteLink(TELEGRAM_CHANNEL_ID)
                       → PATCH /internal/referrers/{telegramId}/channel-link
4. renderTemplate(template, { firstName, domusbetUsername, points, totalPoints, linkBot, linkCanale })
5. Invia messaggio Telegram al referrer
```

**Nota:** se `{linkCanale}` è nel template ma `TELEGRAM_CHANNEL_ID` non è configurato o la call Telegram fallisce, il worker loga un errore e sostituisce la variabile con una stringa vuota — il messaggio viene comunque inviato.

### 4. API — Nuovi endpoint interni

**`GET /internal/referrers/:telegramId/channel-link`**
Restituisce `{ channelInviteLink: string | null }` per il referrer identificato da `telegramId`.

**`PATCH /internal/referrers/:telegramId/channel-link`**
Body: `{ channelInviteLink: string, channelInviteLinkId: string }`
Salva il link generato sul referrer. Idempotente: se esiste già non sovrascrive (il worker controlla prima con GET).

Entrambi protetti da `InternalApiGuard` (già esistente).

### 5. Job payload — shared-types

Aggiungere `referrerId: string` a `SendApprovalNotificationPayload` — serve al worker per costruire il `{linkBot}` e per le chiamate API interne.

### 6. shared-types — BOT_MESSAGE_PLACEHOLDERS

```ts
[BOT_MESSAGE_KEYS.SUBMISSION_APPROVED]: [
  'domusbetUsername', 'points', 'firstName', 'totalPoints',
  'linkBot',      // nuovo
  'linkCanale',   // nuovo
],
```

### 7. Admin web — bot-messages-content.tsx

Aggiungere descrizioni in `VAR_DESCRIPTIONS`:

```ts
linkBot: 'Link personale del referrer al bot (condivisibile)',
linkCanale: 'Invite link unico al canale Telegram privato Domusbet',
```

Nessun'altra modifica: i chip cliccabili nell'editor appaiono automaticamente dai placeholder.

---

## Seed

Aggiornare il contenuto di default del template `submission_approved` per includere esempio d'uso delle nuove variabili (es. riga finale con i link). Il seed usa `upsert` con `update: {}` quindi non sovrascrive template già personalizzati in produzione.

---

## Scope escluso

- Tracking di chi entra nel canale tramite quale link (solo tracking passivo già garantito da Telegram)
- Interfaccia per rigenerare il link canale (possibile in futuro dal profilo referrer)
- Generazione automatica del link al di fuori del flusso di approvazione
- Il referrer non può gestire i link in autonomia dal bot

---

## File coinvolti

| File | Tipo modifica |
|---|---|
| `packages/database/prisma/schema.prisma` | Aggiunta campi `Referrer` + migration |
| `packages/config/src/worker.config.ts` | Nuove env var |
| `packages/shared-types/src/bot-message.types.ts` | Nuovi placeholder |
| `packages/shared-types/src/job.types.ts` | `referrerId` in `SendApprovalNotificationPayload` |
| `apps/api/src/modules/referrers/referrers.controller.ts` | Nuovi endpoint interni |
| `apps/api/src/modules/referrers/referrers.service.ts` | Logica get/save channel link |
| `apps/worker/src/processors/telegram-notification.processor.ts` | Riscrittura con template Redis |
| `apps/worker/src/worker.ts` (o equivalente) | Aggiunta Redis client |
| `apps/admin-web/src/components/bot-messages/bot-messages-content.tsx` | Nuove descrizioni variabili |
| `packages/database/prisma/seed.ts` | Aggiornamento template `submission_approved` |
