import { Module } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController, InternalLeaderboardController } from './leaderboard.controller';

@Module({
  providers: [LeaderboardService],
  controllers: [LeaderboardController, InternalLeaderboardController],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
