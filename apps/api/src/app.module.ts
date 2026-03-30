import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminsModule } from './modules/admins/admins.module';
import { ReferrersModule } from './modules/referrers/referrers.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { ScoresModule } from './modules/scores/scores.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { BotMessagesModule } from './modules/bot-messages/bot-messages.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuditModule } from './modules/audit/audit.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { QueuesModule } from './modules/queues/queues.module';
import { RedisModule } from './modules/redis/redis.module';
import { LeaderboardTemplateModule } from './modules/leaderboard-template/leaderboard-template.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
    }),

    LoggerModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                  },
                },
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
        };
      },
      inject: [ConfigService],
    }),

    ThrottlerModule.forRootAsync({
      useFactory: (configService: ConfigService) => [
        {
          name: 'short',
          ttl: 1000,
          limit: configService.get<number>('THROTTLE_SHORT_LIMIT', 10),
        },
        {
          name: 'medium',
          ttl: 10000,
          limit: configService.get<number>('THROTTLE_MEDIUM_LIMIT', 50),
        },
        {
          name: 'long',
          ttl: 60000,
          limit: configService.get<number>('THROTTLE_LONG_LIMIT', 100),
        },
      ],
      inject: [ConfigService],
    }),

    PrismaModule,
    RedisModule,
    QueuesModule,
    AuditModule,

    AuthModule,
    AdminsModule,
    ReferrersModule,
    SubmissionsModule,
    ScoresModule,
    LeaderboardModule,
    BotMessagesModule,
    SettingsModule,
    DashboardModule,
    HealthModule,
    LeaderboardTemplateModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
