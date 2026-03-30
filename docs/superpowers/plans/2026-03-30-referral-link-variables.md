# Referral Link Variables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere le variabili `{linkBot}` e `{linkCanale}` al template del messaggio di approvazione, con il worker che legge il template da Redis invece di usare testo hardcoded.

**Architecture:** Il worker legge il template `submission_approved` da Redis (`bot:msg:submission_approved`), genera i link (statico per `{linkBot}`, via Telegram API per `{linkCanale}` salvando il risultato sul Referrer), e renderizza il messaggio prima di inviarlo. I nuovi endpoint interni API gestiscono get/save del link canale sul referrer.

**Tech Stack:** NestJS (API), BullMQ + ioredis (Worker), Vitest, Prisma, axios, Zod, shared-types monorepo

---

## File Map

| File | Tipo | Responsabilità |
|---|---|---|
| `packages/database/prisma/schema.prisma` | Modify | Campi `channelInviteLink`, `channelInviteLinkId` su `Referrer` |
| `packages/config/src/worker.config.ts` | Modify | Aggiunta `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, `BOT_USERNAME` |
| `packages/shared-types/src/job.types.ts` | Modify | `referrerId` in `SendApprovalNotificationPayload` e `ApprovalNotificationInput` |
| `packages/shared-types/src/bot-message.types.ts` | Modify | `linkBot`, `linkCanale` in `BOT_MESSAGE_PLACEHOLDERS['submission_approved']` |
| `apps/api/src/modules/referrers/referrers.service.ts` | Modify | Metodi `getChannelLink`, `saveChannelLink` |
| `apps/api/src/modules/referrers/referrers.controller.ts` | Modify | `GET` e `PATCH` `/internal/referrers/:telegramId/channel-link` |
| `apps/api/src/modules/queues/queues.service.ts` | Modify | `referrerId` in `ApprovalNotificationInput` |
| `apps/api/src/modules/submissions/submissions.service.ts` | Modify | Passa `referrerId` all'enqueue |
| `apps/worker/src/worker.ts` | Modify | Passa `redis` al processor di notifiche |
| `apps/worker/src/processors/telegram-notification.processor.ts` | Modify | Riscrittura: template da Redis + generazione link |
| `apps/admin-web/src/components/bot-messages/bot-messages-content.tsx` | Modify | `VAR_DESCRIPTIONS` per `linkBot` e `linkCanale` |
| `packages/database/prisma/seed.ts` | Modify | Template `submission_approved` con esempio variabili link |

---

## Task 1: Prisma — Campi channel link su Referrer

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Aggiungi i campi al modello Referrer**

In `packages/database/prisma/schema.prisma`, modifica il modello `Referrer` aggiungendo dopo il campo `isActive`:

```prisma
model Referrer {
  id               String  @id @default(cuid())
  telegramId       String  @unique @map("telegram_id")
  telegramUsername String? @map("telegram_username")
  firstName        String? @map("first_name")
  lastName         String? @map("last_name")
  isActive         Boolean @default(true) @map("is_active")
  channelInviteLink   String? @map("channel_invite_link")
  channelInviteLinkId String? @map("channel_invite_link_id")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  submissions    Submission[]
  scoreMovements ScoreMovement[]

  @@index([telegramId])
  @@map("referrers")
}
```

- [ ] **Step 2: Genera e applica la migration**

```bash
cd /Users/lospaccabit/Documents/bot_affiliazione
pnpm --filter @domusbet/database exec prisma migrate dev --name add_referrer_channel_link
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Rigenera il client Prisma**

```bash
pnpm --filter @domusbet/database exec prisma generate
```

Expected: `Generated Prisma Client` senza errori.

---

## Task 2: Worker Config — Nuove env var

**Files:**
- Modify: `packages/config/src/worker.config.ts`

- [ ] **Step 1: Aggiungi le tre nuove variabili allo schema Zod**

```typescript
import { z } from 'zod';

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WORKER_API_URL: z.string().url().default('http://localhost:3001'),
  WORKER_API_INTERNAL_SECRET: z.string().min(16),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  APP_NAME: z.string().default('Domusbet Referral'),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  WORKER_MAX_STALLED_COUNT: z.coerce.number().default(3),
  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_CHANNEL_ID: z.string().min(1, 'TELEGRAM_CHANNEL_ID is required'),
  BOT_USERNAME: z.string().min(1, 'BOT_USERNAME is required'),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function validateWorkerEnv(env: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const result = workerEnvSchema.safeParse(env);
  if (!result.success) {
    console.error('Invalid Worker environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data!;
}
```

- [ ] **Step 2: Aggiungi le variabili al file .env**

Nel file `.env` alla radice del monorepo, aggiungi:

```env
TELEGRAM_CHANNEL_ID=-1001234567890
BOT_USERNAME=DomusbetBot
```

`TELEGRAM_BOT_TOKEN` è già presente. `TELEGRAM_CHANNEL_ID` deve essere l'ID numerico del canale privato Domusbet (lo trovi dalle info del canale con `/getChat` via Bot API). `BOT_USERNAME` è lo username del bot senza `@`.

---

## Task 3: shared-types — referrerId nel payload

**Files:**
- Modify: `packages/shared-types/src/job.types.ts`

- [ ] **Step 1: Aggiungi `referrerId` a `SendApprovalNotificationPayload`**

```typescript
import type { JobName } from './enums';

// Base job payload interface
export interface BaseJobPayload {
  jobId?: string;
  triggeredAt?: string;
  retryCount?: number;
}

// Notification job payloads
export interface SendApprovalNotificationPayload extends BaseJobPayload {
  job: JobName.SEND_APPROVAL_NOTIFICATION;
  telegramId: string;
  referrerId: string;
  firstName?: string | null;
  domusbetUsername: string;
  points: number;
  totalPoints: number;
  submissionId: string;
}

export interface SendRejectionNotificationPayload extends BaseJobPayload {
  job: JobName.SEND_REJECTION_NOTIFICATION;
  telegramId: string;
  firstName?: string | null;
  domusbetUsername: string;
  rejectionReason: string;
  submissionId: string;
}

// Leaderboard job payloads
export interface RecalcLeaderboardPayload extends BaseJobPayload {
  job: JobName.RECALC_LEADERBOARD;
  reason?: string;
  triggeredByAdminId?: string;
}

export interface ExportLeaderboardPayload extends BaseJobPayload {
  job: JobName.EXPORT_LEADERBOARD;
  format: 'csv' | 'json' | 'excel';
  includeAllReferrers?: boolean;
  topN?: number;
  requestedByAdminId?: string;
  deliverToTelegramId?: string;
}

// Union type for all job payloads
export type JobPayload =
  | SendApprovalNotificationPayload
  | SendRejectionNotificationPayload
  | RecalcLeaderboardPayload
  | ExportLeaderboardPayload;

// Job result types
export interface JobResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

export interface NotificationJobResult extends JobResult {
  telegramMessageId?: number;
  sent: boolean;
}
```

- [ ] **Step 2: Rebuilda shared-types**

```bash
pnpm --filter @domusbet/shared-types build
```

Expected: build senza errori TypeScript.

---

## Task 4: shared-types — Nuovi placeholder nei messaggi bot

**Files:**
- Modify: `packages/shared-types/src/bot-message.types.ts`

- [ ] **Step 1: Aggiungi `linkBot` e `linkCanale` al `SUBMISSION_APPROVED` entry**

Modifica solo la riga di `SUBMISSION_APPROVED` in `BOT_MESSAGE_PLACEHOLDERS`:

```typescript
export const BOT_MESSAGE_PLACEHOLDERS: Record<BotMessageKey, string[]> = {
  [BOT_MESSAGE_KEYS.WELCOME_MESSAGE]: ['firstName', 'lastName', 'appName'],
  [BOT_MESSAGE_KEYS.SUBMISSION_RECEIVED]: ['domusbetUsername', 'firstName'],
  [BOT_MESSAGE_KEYS.DUPLICATE_SUBMISSION]: ['domusbetUsername', 'firstName'],
  [BOT_MESSAGE_KEYS.SUBMISSION_APPROVED]: [
    'domusbetUsername',
    'points',
    'firstName',
    'totalPoints',
    'linkBot',
    'linkCanale',
  ],
  [BOT_MESSAGE_KEYS.SUBMISSION_REJECTED]: ['domusbetUsername', 'rejectionReason', 'firstName'],
  [BOT_MESSAGE_KEYS.LEADERBOARD_MESSAGE]: ['entries'],
  [BOT_MESSAGE_KEYS.LEADERBOARD_POSITION]: ['rank', 'totalPoints'],
  [BOT_MESSAGE_KEYS.LEADERBOARD_DISABLED]: [],
  [BOT_MESSAGE_KEYS.LEADERBOARD_EMPTY]: [],
  [BOT_MESSAGE_KEYS.MY_STATS]: [
    'firstName',
    'totalPoints',
    'totalSubmissions',
    'approvedSubmissions',
    'pendingSubmissions',
    'rank',
  ],
  [BOT_MESSAGE_KEYS.GENERIC_ERROR]: ['errorCode'],
  [BOT_MESSAGE_KEYS.INVALID_USERNAME]: ['username'],
  [BOT_MESSAGE_KEYS.RATE_LIMIT]: ['maxRequests'],
  [BOT_MESSAGE_KEYS.HELP_MESSAGE]: [],
};
```

- [ ] **Step 2: Rebuilda shared-types**

```bash
pnpm --filter @domusbet/shared-types build
```

---

## Task 5: API — ReferrersService: metodi channel link

**Files:**
- Modify: `apps/api/src/modules/referrers/referrers.service.ts`

- [ ] **Step 1: Scrivi il test per i nuovi metodi**

Crea `apps/api/src/modules/referrers/referrers.service.channel-link.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ReferrersService } from './referrers.service';

const mockPrismaReferrer = {
  findUnique: vi.fn(),
  update: vi.fn(),
};

const mockPrisma = {
  referrer: mockPrismaReferrer,
  submission: { groupBy: vi.fn().mockResolvedValue([]) },
  scoreMovement: { aggregate: vi.fn().mockResolvedValue({ _sum: { points: 0 } }) },
};

const mockAuditService = { log: vi.fn() };

function makeService() {
  return new ReferrersService(mockPrisma as any, mockAuditService as any);
}

describe('ReferrersService.getChannelLink', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns channelInviteLink when referrer exists', async () => {
    mockPrismaReferrer.findUnique.mockResolvedValue({
      id: 'ref-1',
      telegramId: '111',
      channelInviteLink: 'https://t.me/+abc123',
      channelInviteLinkId: 'https://t.me/+abc123',
    });
    const service = makeService();
    const result = await service.getChannelLink('111');
    expect(result).toBe('https://t.me/+abc123');
    expect(mockPrismaReferrer.findUnique).toHaveBeenCalledWith({ where: { telegramId: '111' } });
  });

  it('returns null when referrer has no channel link', async () => {
    mockPrismaReferrer.findUnique.mockResolvedValue({
      id: 'ref-1',
      telegramId: '111',
      channelInviteLink: null,
    });
    const service = makeService();
    const result = await service.getChannelLink('111');
    expect(result).toBeNull();
  });

  it('throws NotFoundException when referrer does not exist', async () => {
    mockPrismaReferrer.findUnique.mockResolvedValue(null);
    const service = makeService();
    await expect(service.getChannelLink('999')).rejects.toThrow(NotFoundException);
  });
});

describe('ReferrersService.saveChannelLink', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves channel link and returns it', async () => {
    mockPrismaReferrer.findUnique.mockResolvedValue({ id: 'ref-1', telegramId: '111' });
    mockPrismaReferrer.update.mockResolvedValue({
      id: 'ref-1',
      channelInviteLink: 'https://t.me/+xyz',
      channelInviteLinkId: 'https://t.me/+xyz',
    });
    const service = makeService();
    const result = await service.saveChannelLink('111', 'https://t.me/+xyz', 'https://t.me/+xyz');
    expect(result).toBe('https://t.me/+xyz');
    expect(mockPrismaReferrer.update).toHaveBeenCalledWith({
      where: { telegramId: '111' },
      data: {
        channelInviteLink: 'https://t.me/+xyz',
        channelInviteLinkId: 'https://t.me/+xyz',
      },
    });
  });

  it('throws NotFoundException when referrer does not exist', async () => {
    mockPrismaReferrer.findUnique.mockResolvedValue(null);
    const service = makeService();
    await expect(service.saveChannelLink('999', 'https://t.me/+xyz', 'https://t.me/+xyz')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

```bash
pnpm --filter @domusbet/api vitest run src/modules/referrers/referrers.service.channel-link.test.ts
```

Expected: FAIL — `getChannelLink is not a function`.

- [ ] **Step 3: Aggiungi i metodi a ReferrersService**

In `apps/api/src/modules/referrers/referrers.service.ts`, aggiungi questi due metodi prima della chiusura della classe:

```typescript
  async getChannelLink(telegramId: string): Promise<string | null> {
    const referrer = await this.prisma.referrer.findUnique({ where: { telegramId } });
    if (!referrer) {
      throw new NotFoundException(`Referrer con telegramId "${telegramId}" non trovato.`);
    }
    return referrer.channelInviteLink ?? null;
  }

  async saveChannelLink(
    telegramId: string,
    channelInviteLink: string,
    channelInviteLinkId: string,
  ): Promise<string> {
    const referrer = await this.prisma.referrer.findUnique({ where: { telegramId } });
    if (!referrer) {
      throw new NotFoundException(`Referrer con telegramId "${telegramId}" non trovato.`);
    }
    const updated = await this.prisma.referrer.update({
      where: { telegramId },
      data: { channelInviteLink, channelInviteLinkId },
    });
    return updated.channelInviteLink!;
  }
```

- [ ] **Step 4: Esegui il test**

```bash
pnpm --filter @domusbet/api vitest run src/modules/referrers/referrers.service.channel-link.test.ts
```

Expected: PASS — tutti i test verdi.

---

## Task 6: API — InternalReferrersController: nuovi endpoint

**Files:**
- Modify: `apps/api/src/modules/referrers/referrers.controller.ts`

- [ ] **Step 1: Aggiungi i due endpoint interni al `InternalReferrersController`**

In `apps/api/src/modules/referrers/referrers.controller.ts`, modifica `InternalReferrersController` aggiungendo i due metodi e i DTO inline:

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { IsString } from 'class-validator';
import { ReferrersService } from './referrers.service';
import { UpdateReferrerDto } from './dto/update-referrer.dto';
import { CreateReferrerDto } from './dto/create-referrer.dto';
import { ReferrerQueryDto } from './dto/referrer-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { InternalApiGuard } from '../../common/guards/internal-api.guard';
import { AdminJwtPayload } from '../../common/types/request.types';
import { SubmissionsService } from '../submissions/submissions.service';

class SaveChannelLinkDto {
  @IsString()
  channelInviteLink!: string;

  @IsString()
  channelInviteLinkId!: string;
}

@Controller('referrers')
@Roles('VIEWER')
export class ReferrersController {
  constructor(
    private readonly referrersService: ReferrersService,
    private readonly submissionsService: SubmissionsService,
  ) {}

  @Get()
  findAll(@Query() query: ReferrerQueryDto) {
    return this.referrersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.referrersService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReferrerDto,
  ) {
    return this.referrersService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
  ) {
    return this.referrersService.deactivate(id, admin.sub);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.referrersService.getReferrerStats(id);
  }

  @Get(':id/submissions')
  getSubmissions(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.submissionsService.findAll({ referrerId: id, page, limit });
  }
}

// Internal (bot-facing) routes
@Controller('internal/referrers')
export class InternalReferrersController {
  constructor(private readonly referrersService: ReferrersService) {}

  @Public()
  @UseGuards(InternalApiGuard)
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  syncReferrer(@Body() dto: CreateReferrerDto) {
    const { telegramId, ...rest } = dto;
    return this.referrersService.findOrCreateByTelegramId(telegramId, rest);
  }

  @Public()
  @UseGuards(InternalApiGuard)
  @Get(':telegramId/stats')
  getReferrerStats(@Param('telegramId') telegramId: string) {
    return this.referrersService.getReferrerStatsByTelegramId(telegramId);
  }

  @Public()
  @UseGuards(InternalApiGuard)
  @Get(':telegramId/channel-link')
  async getChannelLink(
    @Param('telegramId') telegramId: string,
  ): Promise<{ channelInviteLink: string | null }> {
    const channelInviteLink = await this.referrersService.getChannelLink(telegramId);
    return { channelInviteLink };
  }

  @Public()
  @UseGuards(InternalApiGuard)
  @Patch(':telegramId/channel-link')
  @HttpCode(HttpStatus.OK)
  async saveChannelLink(
    @Param('telegramId') telegramId: string,
    @Body() dto: SaveChannelLinkDto,
  ): Promise<{ channelInviteLink: string }> {
    const channelInviteLink = await this.referrersService.saveChannelLink(
      telegramId,
      dto.channelInviteLink,
      dto.channelInviteLinkId,
    );
    return { channelInviteLink };
  }
}
```

- [ ] **Step 2: Verifica che l'API compili**

```bash
pnpm --filter @domusbet/api build
```

Expected: build senza errori TypeScript.

---

## Task 7: API — Aggiungi referrerId all'enqueue

**Files:**
- Modify: `apps/api/src/modules/queues/queues.service.ts`
- Modify: `apps/api/src/modules/submissions/submissions.service.ts`

- [ ] **Step 1: Aggiungi `referrerId` a `ApprovalNotificationInput` in queues.service.ts**

Modifica l'interfaccia `ApprovalNotificationInput`:

```typescript
export interface ApprovalNotificationInput {
  telegramId: string;
  referrerId: string;
  submissionId: string;
  domusbetUsername: string;
  points: number;
  totalPoints: number;
  firstName?: string | null;
}
```

- [ ] **Step 2: Passa `referrerId` nella chiamata in submissions.service.ts**

In `apps/api/src/modules/submissions/submissions.service.ts`, cerca la chiamata a `enqueueApprovalNotification` nel metodo `approve` e aggiungi `referrerId`:

```typescript
this.queuesService
  .enqueueApprovalNotification({
    telegramId: submission.referrer.telegramId,
    referrerId: submission.referrerId,
    submissionId: id,
    domusbetUsername: submission.normalizedDomusbetUsername,
    points: scorePoints ?? 0,
    totalPoints: totalPoints._sum.points ?? 0,
    firstName: submission.referrer.firstName,
  })
```

- [ ] **Step 3: Verifica che l'API compili**

```bash
pnpm --filter @domusbet/api build
```

Expected: senza errori TypeScript.

---

## Task 8: Worker — Riscrittura del notification processor

**Files:**
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/worker/src/processors/telegram-notification.processor.ts`

- [ ] **Step 1: Scrivi il test per la logica di rendering**

Crea `apps/worker/src/processors/telegram-notification.processor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderApprovalTemplate } from './telegram-notification.processor';

describe('renderApprovalTemplate', () => {
  it('sostituisce le variabili di testo con escape MarkdownV2', () => {
    const template = 'Ciao {firstName}\\! Username: {domusbetUsername}';
    const result = renderApprovalTemplate(template, {
      firstName: 'Mario',
      domusbetUsername: 'mario_123',
      points: 3,
      totalPoints: 10,
    });
    // underscore in username deve essere escapato per MarkdownV2
    expect(result).toContain('mario\\_123');
    expect(result).toContain('Mario');
  });

  it('sostituisce {linkBot} senza escape', () => {
    const template = '[Link bot]({linkBot})';
    const result = renderApprovalTemplate(template, {
      firstName: 'Mario',
      domusbetUsername: 'mario',
      points: 1,
      totalPoints: 5,
      linkBot: 'https://t.me/DomusbetBot?start=ref_abc123',
    });
    expect(result).toBe('[Link bot](https://t.me/DomusbetBot?start=ref_abc123)');
  });

  it('sostituisce {linkCanale} senza escape', () => {
    const template = '[Canale]({linkCanale})';
    const result = renderApprovalTemplate(template, {
      firstName: 'Mario',
      domusbetUsername: 'mario',
      points: 1,
      totalPoints: 5,
      linkCanale: 'https://t.me/+abc123XYZ',
    });
    expect(result).toBe('[Canale](https://t.me/+abc123XYZ)');
  });

  it('lascia invariati i placeholder non risolti', () => {
    const template = 'Test {linkCanale} fine';
    const result = renderApprovalTemplate(template, {
      firstName: 'Mario',
      domusbetUsername: 'mario',
      points: 1,
      totalPoints: 5,
      // linkCanale non fornito
    });
    // placeholder non risolto rimane (con braces escapate per MarkdownV2)
    expect(result).toContain('{linkCanale}');
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

```bash
pnpm --filter @domusbet/worker vitest run src/processors/telegram-notification.processor.test.ts
```

Expected: FAIL — `renderApprovalTemplate is not exported`.

- [ ] **Step 3: Riscrivi telegram-notification.processor.ts**

```typescript
import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import axios from 'axios';
import type {
  SendApprovalNotificationPayload,
  SendRejectionNotificationPayload,
  NotificationJobResult,
  JobPayload,
} from '@domusbet/shared-types';
import { JobName } from '@domusbet/shared-types';
import type { Logger } from 'pino';

// ─── Config ──────────────────────────────────────────────────────────────────

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID ?? '';
const BOT_USERNAME = process.env.BOT_USERNAME ?? '';
const WORKER_API_URL = process.env.WORKER_API_URL ?? 'http://localhost:3001';
const WORKER_API_INTERNAL_SECRET = process.env.WORKER_API_INTERNAL_SECRET ?? '';
const REDIS_TEMPLATE_KEY_PREFIX = 'bot:msg:';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TelegramSendMessageResponse {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
}

interface TelegramInviteLinkResponse {
  ok: boolean;
  result?: { invite_link: string };
  description?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeMdV2(text: string): string {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

/**
 * Renders an approval notification template.
 * Text variables (firstName, domusbetUsername, points, totalPoints) are escaped for MarkdownV2.
 * URL variables (linkBot, linkCanale) are injected raw — they must be used in [text](url) syntax.
 */
export function renderApprovalTemplate(
  template: string,
  vars: {
    firstName: string;
    domusbetUsername: string;
    points: number;
    totalPoints: number;
    linkBot?: string;
    linkCanale?: string;
  },
): string {
  const escaped: Record<string, string> = {
    firstName: escapeMdV2(vars.firstName),
    domusbetUsername: escapeMdV2(vars.domusbetUsername),
    points: escapeMdV2(String(vars.points)),
    totalPoints: escapeMdV2(String(vars.totalPoints)),
  };

  // Step 1: replace escaped text variables
  let result = template.replace(/\{(\w+)\}/g, (match, key: string) =>
    escaped[key] !== undefined ? escaped[key] : match,
  );

  // Step 2: inject URL variables raw (no escaping — used inside MarkdownV2 link parens)
  if (vars.linkBot) result = result.replace(/\{linkBot\}/g, vars.linkBot);
  if (vars.linkCanale) result = result.replace(/\{linkCanale\}/g, vars.linkCanale);

  return result;
}

// ─── Template fetching ───────────────────────────────────────────────────────

async function fetchTemplate(key: string, redis: Redis): Promise<string | null> {
  try {
    const cached = await redis.get(`${REDIS_TEMPLATE_KEY_PREFIX}${key}`);
    if (cached) return cached;
  } catch {
    // Redis unavailable — fall through to API
  }

  try {
    const res = await axios.get<{ content: string; isActive: boolean }>(
      `${WORKER_API_URL}/api/internal/bot-messages/${key}`,
      { headers: { 'x-internal-secret': WORKER_API_INTERNAL_SECRET } },
    );
    if (res.data?.isActive) return res.data.content;
  } catch {
    // API also unavailable
  }

  return null;
}

// ─── Telegram API helpers ─────────────────────────────────────────────────────

async function sendTelegramMessage(chatId: string, text: string): Promise<number> {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not configured');

  const res = await axios.post<TelegramSendMessageResponse>(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    { chat_id: chatId, text, parse_mode: 'MarkdownV2' },
  );

  if (!res.data.ok) {
    throw new Error(`Telegram sendMessage failed: ${res.data.description ?? 'unknown'}`);
  }
  return res.data.result?.message_id ?? 0;
}

async function createChannelInviteLink(): Promise<{ link: string; linkId: string }> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
    throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID not configured');
  }

  const res = await axios.post<TelegramInviteLinkResponse>(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/createChatInviteLink`,
    { chat_id: TELEGRAM_CHANNEL_ID, creates_join_request: false },
  );

  if (!res.data.ok || !res.data.result?.invite_link) {
    throw new Error(`createChatInviteLink failed: ${res.data.description ?? 'unknown'}`);
  }

  return { link: res.data.result.invite_link, linkId: res.data.result.invite_link };
}

// ─── Channel link: get or create via internal API ────────────────────────────

async function getOrCreateChannelLink(telegramId: string, logger: Logger): Promise<string | null> {
  if (!TELEGRAM_CHANNEL_ID) return null;

  const internalHeaders = { 'x-internal-secret': WORKER_API_INTERNAL_SECRET };

  // 1. Check if referrer already has a link stored
  try {
    const res = await axios.get<{ channelInviteLink: string | null }>(
      `${WORKER_API_URL}/api/internal/referrers/${telegramId}/channel-link`,
      { headers: internalHeaders },
    );
    if (res.data.channelInviteLink) return res.data.channelInviteLink;
  } catch (err) {
    logger.warn({ err, telegramId }, 'Failed to fetch channel link from API');
    return null;
  }

  // 2. Generate new invite link via Telegram API
  let link: string;
  let linkId: string;
  try {
    ({ link, linkId } = await createChannelInviteLink());
  } catch (err) {
    logger.error({ err }, 'Failed to create Telegram channel invite link');
    return null;
  }

  // 3. Save to referrer record
  try {
    await axios.patch(
      `${WORKER_API_URL}/api/internal/referrers/${telegramId}/channel-link`,
      { channelInviteLink: link, channelInviteLinkId: linkId },
      { headers: internalHeaders },
    );
  } catch (err) {
    logger.warn({ err, telegramId }, 'Failed to save channel link to API — link was generated but not persisted');
  }

  return link;
}

// ─── Job processors ──────────────────────────────────────────────────────────

async function processApprovalNotification(
  payload: SendApprovalNotificationPayload,
  redis: Redis,
  logger: Logger,
): Promise<NotificationJobResult> {
  const { telegramId, referrerId, firstName, domusbetUsername, points, totalPoints, submissionId } = payload;

  const template = await fetchTemplate('submission_approved', redis);

  // Fallback to hardcoded message if template is not configured
  if (!template) {
    logger.warn({ submissionId }, 'submission_approved template not found, using fallback');
    const fallback = [
      `✅ La tua segnalazione è stata *approvata*\\!`,
      '',
      `👤 Account: \`${escapeMdV2(domusbetUsername)}\``,
      `🏆 Punti: *\\+${points}*`,
      `📊 Totale: *${totalPoints}*`,
    ].join('\n');
    const msgId = await sendTelegramMessage(telegramId, fallback);
    return { success: true, sent: true, telegramMessageId: msgId, message: 'Approval sent (fallback)' };
  }

  // Resolve URL variables only if template uses them
  const needsLinkBot = template.includes('{linkBot}');
  const needsLinkCanale = template.includes('{linkCanale}');

  const linkBot = needsLinkBot && BOT_USERNAME && referrerId
    ? `https://t.me/${BOT_USERNAME}?start=ref_${referrerId}`
    : undefined;

  const linkCanale = needsLinkCanale
    ? (await getOrCreateChannelLink(telegramId, logger)) ?? undefined
    : undefined;

  const text = renderApprovalTemplate(template, {
    firstName: firstName ?? '',
    domusbetUsername,
    points,
    totalPoints,
    linkBot,
    linkCanale,
  });

  logger.info({ telegramId, submissionId }, 'Sending approval notification');
  const messageId = await sendTelegramMessage(telegramId, text);
  logger.info({ telegramId, messageId }, 'Approval notification sent');

  return {
    success: true,
    sent: true,
    telegramMessageId: messageId,
    message: `Approval notification sent to ${telegramId}`,
  };
}

async function processRejectionNotification(
  payload: SendRejectionNotificationPayload,
  redis: Redis,
  logger: Logger,
): Promise<NotificationJobResult> {
  const { telegramId, firstName, domusbetUsername, rejectionReason, submissionId } = payload;

  const template = await fetchTemplate('submission_rejected', redis);

  let text: string;
  if (template) {
    const escaped: Record<string, string> = {
      firstName: escapeMdV2(firstName ?? ''),
      domusbetUsername: escapeMdV2(domusbetUsername),
      rejectionReason: escapeMdV2(rejectionReason),
    };
    text = template.replace(/\{(\w+)\}/g, (match, key: string) =>
      escaped[key] !== undefined ? escaped[key] : match,
    );
  } else {
    logger.warn({ submissionId }, 'submission_rejected template not found, using fallback');
    text = [
      `❌ La tua segnalazione è stata *rifiutata*\\.`,
      '',
      `👤 Account: \`${escapeMdV2(domusbetUsername)}\``,
      `📝 Motivo: _${escapeMdV2(rejectionReason)}_`,
    ].join('\n');
  }

  logger.info({ telegramId, submissionId }, 'Sending rejection notification');
  const messageId = await sendTelegramMessage(telegramId, text);
  logger.info({ telegramId, messageId }, 'Rejection notification sent');

  return {
    success: true,
    sent: true,
    telegramMessageId: messageId,
    message: `Rejection notification sent to ${telegramId}`,
  };
}

export async function processTelegramNotification(
  job: Job<JobPayload>,
  logger: Logger,
  redis: Redis,
): Promise<NotificationJobResult> {
  const { data } = job;

  if (data.job === JobName.SEND_APPROVAL_NOTIFICATION) {
    return processApprovalNotification(data as SendApprovalNotificationPayload, redis, logger);
  }

  if (data.job === JobName.SEND_REJECTION_NOTIFICATION) {
    return processRejectionNotification(data as SendRejectionNotificationPayload, redis, logger);
  }

  logger.warn({ jobName: (data as { job: string }).job }, 'Unknown notification job type');
  return {
    success: false,
    sent: false,
    message: `Unknown notification job: ${(data as { job: string }).job}`,
  };
}
```

- [ ] **Step 4: Esegui il test**

```bash
pnpm --filter @domusbet/worker vitest run src/processors/telegram-notification.processor.test.ts
```

Expected: PASS — tutti e 4 i test verdi.

- [ ] **Step 5: Aggiorna worker.ts per passare redis al processor**

In `apps/worker/src/worker.ts`, modifica il telegramWorker per passare `redis`:

```typescript
  const telegramWorker = new Worker(
    QueueName.TELEGRAM_NOTIFICATIONS,
    async (job) => {
      const jobLogger = logger.child({
        queue: QueueName.TELEGRAM_NOTIFICATIONS,
        jobId: job.id,
        jobName: job.name,
      });

      try {
        return await processTelegramNotification(
          job as Parameters<typeof processTelegramNotification>[0],
          jobLogger,
          redis,
        );
      } catch (error) {
        jobLogger.error({ error }, 'Telegram notification job failed');
        throw error;
      }
    },
    { ...baseOptions, concurrency: 3 }
  );
```

- [ ] **Step 6: Verifica che il worker compili**

```bash
pnpm --filter @domusbet/worker build
```

Expected: senza errori TypeScript.

---

## Task 9: Admin Web — VAR_DESCRIPTIONS per le nuove variabili

**Files:**
- Modify: `apps/admin-web/src/components/bot-messages/bot-messages-content.tsx`

- [ ] **Step 1: Aggiungi le descrizioni**

In `apps/admin-web/src/components/bot-messages/bot-messages-content.tsx`, aggiungi le due voci all'oggetto `VAR_DESCRIPTIONS`:

```typescript
const VAR_DESCRIPTIONS: Record<string, string> = {
  firstName: 'Nome utente Telegram',
  lastName: 'Cognome utente Telegram',
  appName: 'Nome applicazione',
  domusbetUsername: 'Username Domusbet segnalato',
  points: 'Punti guadagnati con questa segnalazione',
  totalPoints: 'Punti totali accumulati dal referrer',
  totalSubmissions: 'Numero totale di segnalazioni',
  approvedSubmissions: 'Segnalazioni approvate',
  pendingSubmissions: 'Segnalazioni in attesa',
  rejectedSubmissions: 'Segnalazioni rifiutate',
  rank: 'Posizione in classifica',
  rejectionReason: 'Motivo del rifiuto (da admin)',
  entries: 'Elenco posizioni classifica (generato automaticamente)',
  errorCode: 'Codice errore tecnico',
  linkBot: 'Link personale al bot — usa come [testo]({linkBot})',
  linkCanale: 'Invite link unico al canale Domusbet — usa come [testo]({linkCanale})',
};
```

---

## Task 10: Seed — Aggiorna template submission_approved

**Files:**
- Modify: `packages/database/prisma/seed.ts`

- [ ] **Step 1: Aggiorna il contenuto del template**

Trova la entry con `key: 'submission_approved'` in `packages/database/prisma/seed.ts` e aggiorna il `content` per includere esempio con i nuovi link:

```typescript
    {
      key: 'submission_approved',
      name: 'Segnalazione Approvata',
      description: 'Inviato quando una segnalazione viene approvata. Variabili link: {linkBot} e {linkCanale} vanno usate nella sintassi [testo]({linkBot}).',
      content: [
        '🎉 *Segnalazione approvata\\!*',
        '',
        'Ottimo {firstName}\\! La tua segnalazione è stata approvata:',
        '👤 Username: *{domusbetUsername}*',
        '',
        '💰 Punti guadagnati: *\\+{points} punti*',
        '📊 Totale punti: *{totalPoints} punti*',
        '',
        '🔗 Condividi il tuo link personale e guadagna altri punti\\!',
        '[\\👉 Link referral]({linkBot})',
        '',
        'Continua così per scalare la classifica\\! 🏆',
      ].join('\n'),
      isActive: true,
    },
```

**Nota:** il seed usa `upsert` con `update: {}` — i template già esistenti in produzione NON vengono sovrascritti. Questa modifica si applica solo alle installazioni fresche. Se vuoi aggiornare un'installazione esistente, usa l'editor "Messaggi Bot" nella dashboard.

- [ ] **Step 2: Esegui il seed in ambiente di sviluppo**

```bash
pnpm db:seed
```

Expected: `Seeded N bot message templates` senza errori.

---

## Verifica finale end-to-end

- [ ] Avvia tutti i servizi: `pnpm dev:api && pnpm dev:worker`
- [ ] Dall'editor "Messaggi Bot" in dashboard, verifica che il template `submission_approved` mostri i chip `{linkBot}` e `{linkCanale}` con le descrizioni corrette
- [ ] Aggiungi `[Il mio link]({linkBot})` al messaggio di approvazione e salva
- [ ] Approva una segnalazione di test — il referrer deve ricevere il messaggio con il link bot sostituito
- [ ] Aggiungi anche `[Entra nel canale]({linkCanale})` e approva un'altra segnalazione — verifica che il link canale venga generato e inviato correttamente (il bot deve essere admin del canale in `TELEGRAM_CHANNEL_ID`)
