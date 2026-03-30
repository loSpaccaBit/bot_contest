import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { BotMessagesService } from './bot-messages.service';
import { UpdateBotMessageDto } from './dto/update-bot-message.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { InternalApiGuard } from '../../common/guards/internal-api.guard';
import { AdminJwtPayload } from '../../common/types/request.types';

@Controller('bot-messages')
@Roles('VIEWER')
export class BotMessagesController {
  constructor(private readonly botMessagesService: BotMessagesService) {}

  @Get()
  findAll() {
    return this.botMessagesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.botMessagesService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBotMessageDto,
    @CurrentAdmin() admin: AdminJwtPayload,
  ) {
    return this.botMessagesService.update(id, dto, admin.sub);
  }
}

// Internal (bot-facing) endpoints
@Controller('internal/bot-messages')
export class InternalBotMessagesController {
  constructor(private readonly botMessagesService: BotMessagesService) {}

  @Public()
  @UseGuards(InternalApiGuard)
  @Get('warm-cache')
  warmCache() {
    return this.botMessagesService.warmRedisCache().then(() => ({ ok: true }));
  }

  @Public()
  @UseGuards(InternalApiGuard)
  @Get(':key')
  getByKey(@Param('key') key: string) {
    return this.botMessagesService.findByKey(key);
  }
}
