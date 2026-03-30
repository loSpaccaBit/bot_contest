import { Module } from '@nestjs/common';
import { LeaderboardTemplateService } from './leaderboard-template.service';
import { LeaderboardTemplateController } from './leaderboard-template.controller';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';

@Module({
  imports: [LeaderboardModule],
  providers: [LeaderboardTemplateService],
  controllers: [LeaderboardTemplateController],
  exports: [LeaderboardTemplateService],
})
export class LeaderboardTemplateModule {}
