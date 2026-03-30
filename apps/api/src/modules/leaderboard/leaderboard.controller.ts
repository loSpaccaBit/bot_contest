import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { InternalApiGuard } from '../../common/guards/internal-api.guard';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @Roles('VIEWER')
  async getLeaderboard(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.leaderboardService.getLeaderboard({
      page: Number(page) || undefined,
      limit: Number(limit) || undefined,
    });
    return {
      entries: result.items,
      totalParticipants: result.total,
      generatedAt: new Date(),
    };
  }
}

// Internal (bot-facing) endpoints
@Controller('internal/leaderboard')
export class InternalLeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Public()
  @UseGuards(InternalApiGuard)
  @Get()
  async getLeaderboard(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.leaderboardService.getLeaderboard({
      page: Number(page) || undefined,
      limit: Number(limit) || undefined,
    });
    return {
      entries: result.items,
      totalParticipants: result.total,
      generatedAt: new Date(),
    };
  }

  @Public()
  @UseGuards(InternalApiGuard)
  @Get('position/:telegramId')
  async getReferrerPosition(@Param('telegramId') telegramId: string) {
    const entry = await this.leaderboardService.getReferrerRank(telegramId);
    if (!entry) {
      throw new NotFoundException(`Referrer ${telegramId} not found in leaderboard`);
    }
    return {
      rank: entry.rank,
      totalPoints: entry.totalPoints,
      telegramId: entry.telegramId,
    };
  }

  @Public()
  @UseGuards(InternalApiGuard)
  @Get('me/:telegramId')
  getReferrerRank(@Param('telegramId') telegramId: string) {
    return this.leaderboardService.getReferrerRank(telegramId);
  }
}
