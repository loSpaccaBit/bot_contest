import { Module } from '@nestjs/common';
import { BotMessagesService } from './bot-messages.service';
import { BotMessagesController, InternalBotMessagesController } from './bot-messages.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [BotMessagesService],
  controllers: [BotMessagesController, InternalBotMessagesController],
  exports: [BotMessagesService],
})
export class BotMessagesModule {}
