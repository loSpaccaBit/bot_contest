import { Module, forwardRef } from '@nestjs/common';
import { ReferrersService } from './referrers.service';
import { ReferrersController, InternalReferrersController } from './referrers.controller';
import { AuditModule } from '../audit/audit.module';
import { SubmissionsModule } from '../submissions/submissions.module';

@Module({
  imports: [
    AuditModule,
    forwardRef(() => SubmissionsModule),
  ],
  providers: [ReferrersService],
  controllers: [ReferrersController, InternalReferrersController],
  exports: [ReferrersService],
})
export class ReferrersModule {}
