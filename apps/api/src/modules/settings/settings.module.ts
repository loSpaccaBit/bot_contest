import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController, InternalSettingsController } from './settings.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [SettingsService],
  controllers: [SettingsController, InternalSettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
