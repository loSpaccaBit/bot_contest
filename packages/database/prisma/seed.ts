import { PrismaClient, AdminRole, SubmissionStatus, SettingType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main(): Promise<void> {
  console.log('Starting database seed...');

  // ============================================================
  // 1. SUPER ADMIN
  // ============================================================
  console.log('Creating super admin...');
  const passwordHash = await bcrypt.hash('Admin@123456', 12);

  const superAdmin = await prisma.admin.upsert({
    where: { email: 'admin@domusbet.it' },
    update: {},
    create: {
      email: 'admin@domusbet.it',
      passwordHash,
      displayName: 'Super Admin',
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(`Super admin created: ${superAdmin.email}`);

  // ============================================================
  // 2. SCORE RULES
  // ============================================================
  console.log('Creating score rules...');

  const registrationRule = await prisma.scoreRule.upsert({
    where: { code: 'REGISTRATION' },
    update: {},
    create: {
      code: 'REGISTRATION',
      name: 'Registrazione',
      description: 'Punti assegnati quando un referral completa la registrazione su Domusbet.',
      points: 1,
      isActive: true,
    },
  });
  console.log(`Score rule created: ${registrationRule.code} (${registrationRule.points} pts)`);

  const depositRule = await prisma.scoreRule.upsert({
    where: { code: 'DEPOSIT' },
    update: {},
    create: {
      code: 'DEPOSIT',
      name: 'Deposito confermato',
      description: 'Punti assegnati quando un referral completa il primo deposito su Domusbet.',
      points: 3,
      isActive: true,
    },
  });
  console.log(`Score rule created: ${depositRule.code} (${depositRule.points} pts)`);

  // ============================================================
  // 3. BOT MESSAGE TEMPLATES
  // ============================================================
  console.log('Creating bot message templates...');

  const botMessageTemplates = [
    {
      key: 'welcome_message',
      name: 'Messaggio di Benvenuto',
      description: 'Inviato quando un utente avvia il bot per la prima volta.',
      content: [
        'Ciao *{firstName}*\\! 👋',
        '',
        'Benvenuto nel programma di affiliazione *Domusbet Referral*\\!',
        '',
        '🎯 *Come funziona:*',
        '\\- Segnala i tuoi amici inviando il loro username Domusbet',
        '\\- Guadagna punti per ogni registrazione e deposito confermato',
        '\\- Scala la classifica e vinci premi esclusivi\\!',
        '',
        '📋 *Comandi disponibili:*',
        '`/mystats` — Vedi le tue statistiche',
        '`/leaderboard` — Vedi la classifica generale',
        '`/help` — Mostra questo messaggio',
        '',
        'Buona fortuna\\! 🚀',
      ].join('\n'),
      isActive: true,
    },
    {
      key: 'submission_received',
      name: 'Segnalazione Ricevuta',
      description: 'Inviato quando una segnalazione viene ricevuta con successo.',
      content: [
        '✅ *Segnalazione ricevuta\\!*',
        '',
        'Ciao {firstName}, abbiamo ricevuto la tua segnalazione per:',
        '👤 Username: *{domusbetUsername}*',
        '',
        'Il nostro team verificherà la segnalazione al più presto\\.',
        'Riceverai una notifica non appena verrà processata\\.',
        '',
        '_Grazie per aver partecipato al programma di affiliazione\\!_',
      ].join('\n'),
      isActive: true,
    },
    {
      key: 'duplicate_submission',
      name: 'Segnalazione Duplicata',
      description: 'Inviato quando un username è già stato segnalato.',
      content: [
        '⚠️ *Username già segnalato*',
        '',
        "Ciao {firstName}, l'username *{domusbetUsername}* è già stato segnalato in precedenza\\.",
        '',
        'Non è possibile segnalare lo stesso utente più di una volta\\.',
        '',
        'Se credi che ci sia un errore, contatta il supporto\\.',
      ].join('\n'),
      isActive: true,
    },
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
    {
      key: 'submission_rejected',
      name: 'Segnalazione Rifiutata',
      description: 'Inviato quando una segnalazione viene rifiutata.',
      content: [
        '❌ *Segnalazione non approvata*',
        '',
        'Ciao {firstName}, purtroppo la tua segnalazione non è stata approvata:',
        '👤 Username: *{domusbetUsername}*',
        '',
        '📝 Motivo: _{rejectionReason}_',
        '',
        'Per ulteriori informazioni, contatta il supporto\\.',
      ].join('\n'),
      isActive: true,
    },
    {
      key: 'leaderboard_message',
      name: 'Classifica',
      description: 'Formato per ogni posizione nella classifica.',
      content: [
        '🏆 *Classifica Domusbet Referral*',
        '',
        '{entries}',
        '',
        '_Aggiornata in tempo reale_',
      ].join('\n'),
      isActive: true,
    },
    {
      key: 'my_stats',
      name: 'Le Mie Statistiche',
      description: 'Inviato quando un utente richiede le sue statistiche.',
      content: [
        '📊 *Le tue statistiche, {firstName}*',
        '',
        '🏅 Posizione in classifica: *\\#{rank}*',
        '💰 Punti totali: *{totalPoints}*',
        '',
        '📋 *Segnalazioni:*',
        '\\- Totale: {totalSubmissions}',
        '\\- Approvate ✅: {approvedSubmissions}',
        '\\- In attesa ⏳: {pendingSubmissions}',
        '',
        'Continua a segnalare per guadagnare più punti\\! 🚀',
      ].join('\n'),
      isActive: true,
    },
    {
      key: 'generic_error',
      name: 'Errore Generico',
      description: 'Inviato quando si verifica un errore imprevisto.',
      content: [
        '😔 *Ops, qualcosa è andato storto\\!*',
        '',
        'Si è verificato un errore imprevisto\\. Riprova tra qualche istante\\.',
        '',
        'Se il problema persiste, contatta il supporto\\.',
        '_Codice errore: {errorCode}_',
      ].join('\n'),
      isActive: true,
    },
    {
      key: 'help_message',
      name: 'Messaggio di Aiuto',
      description: 'Inviato quando l\'utente usa /help.',
      content: [
        '🤖 *Domusbet Referral Bot — Guida*',
        '',
        'Puoi guadagnare punti invitando nuovi utenti su Domusbet\\.',
        '',
        '*Come funziona:*',
        '1\\. Chiedi al tuo amico di registrarsi su Domusbet\\.',
        '2\\. Una volta registrato, inviami il suo nome utente Domusbet qui in chat\\.',
        '3\\. Il nostro team verificherà la registrazione\\.',
        '4\\. Se approvata, riceverai punti e una notifica\\!',
        '',
        '*Comandi disponibili:*',
        '`/mystats` — Visualizza i tuoi punti e invii',
        '`/leaderboard` — Classifica dei migliori affiliati',
        '`/help` — Mostra questo messaggio',
        '',
        '*Come inviare un nome utente:*',
        'Scrivi semplicemente il nome utente Domusbet nel campo di testo e premi invio\\.',
        'Esempio: `mario\\_rossi`',
        '',
        '*Note:*',
        '• Un nome utente può essere inviato una sola volta\\.',
        '• Gli invii vengono verificati manualmente dal nostro team\\.',
        '• Riceverai una notifica per ogni invio approvato o rifiutato\\.',
      ].join('\n'),
      isActive: true,
    },
    {
      key: 'leaderboard_position',
      name: 'Posizione in Classifica',
      description: 'Nota aggiunta in fondo alla classifica con la posizione dell\'utente.',
      content: '📍 *La tua posizione:* \\#{rank} — {totalPoints} punti',
      isActive: true,
    },
    {
      key: 'leaderboard_disabled',
      name: 'Classifica Disabilitata',
      description: 'Inviato quando la classifica non è pubblica.',
      content: '🔒 La classifica non è attualmente disponibile al pubblico\\.',
      isActive: true,
    },
    {
      key: 'leaderboard_empty',
      name: 'Classifica Vuota',
      description: 'Inviato quando non ci sono ancora dati in classifica.',
      content: 'La classifica è ancora vuota\\. Sii il primo\\! 🏆',
      isActive: true,
    },
    {
      key: 'invalid_username',
      name: 'Username Non Valido',
      description: 'Inviato quando il testo inviato non è un username Domusbet valido.',
      content: [
        '❗ Il nome utente `{username}` non è valido\\.',
        '',
        'I nomi utente possono contenere lettere, numeri, trattini bassi \\(_\\) e trattini \\(\\-\\), tra 3 e 32 caratteri\\.',
      ].join('\n'),
      isActive: true,
    },
    {
      key: 'rate_limit',
      name: 'Limite Richieste Raggiunto',
      description: 'Inviato quando l\'utente supera il limite di invii per ora.',
      content: '⏳ Hai superato il limite di *{maxRequests} invii* per ora\\. Riprova tra qualche minuto\\.',
      isActive: true,
    },
  ];

  for (const template of botMessageTemplates) {
    await prisma.botMessageTemplate.upsert({
      where: { key: template.key },
      update: {
        content: template.content,
        name: template.name,
        description: template.description,
      },
      create: template,
    });
    console.log(`Bot message template created: ${template.key}`);
  }

  // ============================================================
  // 4. SYSTEM SETTINGS
  // ============================================================
  console.log('Creating system settings...');

  const systemSettings = [
    {
      key: 'app_name',
      value: 'Domusbet Referral',
      type: SettingType.string,
      description: 'Nome dell\'applicazione mostrato agli utenti.',
    },
    {
      key: 'leaderboard_public',
      value: 'true',
      type: SettingType.boolean,
      description: 'Se true, la classifica è visibile a tutti gli utenti del bot.',
    },
    {
      key: 'max_submissions_per_day',
      value: '10',
      type: SettingType.number,
      description: 'Numero massimo di segnalazioni che un utente può fare al giorno.',
    },
    {
      key: 'contest_description',
      value: 'Invita i tuoi amici su Domusbet e guadagna punti!',
      type: SettingType.string,
      description: 'Descrizione del contest mostrata agli utenti.',
    },
  ];

  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
    console.log(`System setting created: ${setting.key} = ${setting.value}`);
  }

  // ============================================================
  // 5. DEMO REFERRERS
  // ============================================================
  console.log('Creating demo referrers...');

  const referrers = [
    {
      telegramId: '123456789',
      telegramUsername: 'mario_rossi',
      firstName: 'Mario',
      lastName: 'Rossi',
      isActive: true,
    },
    {
      telegramId: '987654321',
      telegramUsername: 'luigi_verdi',
      firstName: 'Luigi',
      lastName: 'Verdi',
      isActive: true,
    },
    {
      telegramId: '555555555',
      telegramUsername: 'anna_bianchi',
      firstName: 'Anna',
      lastName: 'Bianchi',
      isActive: true,
    },
  ];

  const createdReferrers: Array<{ id: string; firstName: string | null; telegramId: string }> = [];

  for (const referrer of referrers) {
    const created = await prisma.referrer.upsert({
      where: { telegramId: referrer.telegramId },
      update: {},
      create: referrer,
    });
    createdReferrers.push(created);
    console.log(`Referrer created: ${referrer.telegramUsername} (${referrer.telegramId})`);
  }

  // ============================================================
  // 6. DEMO SUBMISSIONS
  // ============================================================
  console.log('Creating demo submissions...');

  interface DemoSubmission {
    domusbetUsername: string;
    normalizedDomusbetUsername: string;
    status: SubmissionStatus;
    referrerId: string;
    reviewedById?: string;
    reviewedAt?: Date;
    adminNotes?: string;
    rejectionReason?: string;
  }

  const demoSubmissions: DemoSubmission[] = [
    // Mario's approved submissions
    {
      domusbetUsername: 'giuseppe_ferrari',
      normalizedDomusbetUsername: 'giuseppe_ferrari',
      status: SubmissionStatus.APPROVED,
      referrerId: createdReferrers[0].id,
      reviewedById: superAdmin.id,
      reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      adminNotes: 'Utente verificato e registrato correttamente.',
    },
    {
      domusbetUsername: 'francesca_bruno',
      normalizedDomusbetUsername: 'francesca_bruno',
      status: SubmissionStatus.APPROVED,
      referrerId: createdReferrers[0].id,
      reviewedById: superAdmin.id,
      reviewedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    },
    // Mario's pending submission
    {
      domusbetUsername: 'roberto_esposito',
      normalizedDomusbetUsername: 'roberto_esposito',
      status: SubmissionStatus.PENDING,
      referrerId: createdReferrers[0].id,
    },
    // Luigi's submissions
    {
      domusbetUsername: 'chiara_romano',
      normalizedDomusbetUsername: 'chiara_romano',
      status: SubmissionStatus.APPROVED,
      referrerId: createdReferrers[1].id,
      reviewedById: superAdmin.id,
      reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    },
    {
      domusbetUsername: 'davide_ricci',
      normalizedDomusbetUsername: 'davide_ricci',
      status: SubmissionStatus.REJECTED,
      referrerId: createdReferrers[1].id,
      reviewedById: superAdmin.id,
      reviewedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      rejectionReason: 'Utente non trovato nel sistema Domusbet.',
    },
    // Anna's submission
    {
      domusbetUsername: 'elena_conti',
      normalizedDomusbetUsername: 'elena_conti',
      status: SubmissionStatus.PENDING,
      referrerId: createdReferrers[2].id,
    },
  ];

  for (const submissionData of demoSubmissions) {
    const existing = await prisma.submission.findUnique({
      where: { normalizedDomusbetUsername: submissionData.normalizedDomusbetUsername },
    });

    if (!existing) {
      const submission = await prisma.submission.create({
        data: submissionData,
      });

      // Create the initial CREATED event
      await prisma.submissionEvent.create({
        data: {
          submissionId: submission.id,
          eventType: 'CREATED',
          payload: {
            domusbetUsername: submissionData.domusbetUsername,
          },
          actorType: 'REFERRER',
          actorId: submissionData.referrerId,
        },
      });

      // If reviewed, create a STATUS_CHANGED event
      if (
        submissionData.status !== SubmissionStatus.PENDING &&
        submissionData.reviewedById
      ) {
        await prisma.submissionEvent.create({
          data: {
            submissionId: submission.id,
            eventType: 'STATUS_CHANGED',
            payload: {
              from: 'PENDING',
              to: submissionData.status,
              reason: submissionData.rejectionReason ?? null,
              notes: submissionData.adminNotes ?? null,
            },
            actorType: 'ADMIN',
            actorId: submissionData.reviewedById,
          },
        });
      }

      // Assign points for approved submissions
      if (submissionData.status === SubmissionStatus.APPROVED) {
        await prisma.scoreMovement.create({
          data: {
            referrerId: submissionData.referrerId,
            submissionId: submission.id,
            scoreRuleId: registrationRule.id,
            adminId: submissionData.reviewedById,
            points: registrationRule.points,
            reason: `Punti per segnalazione approvata: ${submissionData.domusbetUsername}`,
          },
        });

        await prisma.submissionEvent.create({
          data: {
            submissionId: submission.id,
            eventType: 'POINTS_ASSIGNED',
            payload: {
              points: registrationRule.points,
              scoreRuleCode: registrationRule.code,
            },
            actorType: 'ADMIN',
            actorId: submissionData.reviewedById,
          },
        });
      }

      console.log(
        `Submission created: ${submissionData.domusbetUsername} [${submissionData.status}]`,
      );
    } else {
      console.log(`Submission already exists: ${submissionData.domusbetUsername}, skipping.`);
    }
  }

  // ============================================================
  // Audit log for seed
  // ============================================================
  await prisma.auditLog.create({
    data: {
      adminId: superAdmin.id,
      action: 'SYSTEM_SEED',
      entityType: 'SYSTEM',
      details: {
        message: 'Database seeded successfully',
        timestamp: new Date().toISOString(),
      },
    },
  });

  console.log('');
  console.log('Database seed completed successfully!');
  console.log('');
  console.log('Super Admin credentials:');
  console.log('  Email:    admin@domusbet.it');
  console.log('  Password: Admin@123456');
  console.log('');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
