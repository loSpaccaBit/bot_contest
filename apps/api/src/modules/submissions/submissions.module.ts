import { Module, forwardRef } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController, InternalSubmissionsController } from './submissions.controller';
import { AuditModule } from '../audit/audit.module';
import { ReferrersModule } from '../referrers/referrers.module';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [
    AuditModule,
    forwardRef(() => ReferrersModule),
    QueuesModule,
  ],
  providers: [SubmissionsService],
  controllers: [SubmissionsController, InternalSubmissionsController],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
