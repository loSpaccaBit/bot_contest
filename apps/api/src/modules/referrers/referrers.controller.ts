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

class SaveChannelLinkDto {
  @IsString()
  channelInviteLink!: string;

  @IsString()
  channelInviteLinkId!: string;
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
