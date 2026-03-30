import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { InternalApiGuard } from '../../common/guards/internal-api.guard';
import { AdminJwtPayload } from '../../common/types/request.types';

@Controller('settings')
@Roles('VIEWER')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  @Patch(':key')
  @Roles('SUPER_ADMIN')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentAdmin() admin: AdminJwtPayload,
  ) {
    return this.settingsService.update(key, dto, admin.sub);
  }
}

// Internal (bot/worker) endpoints
@Controller('internal/settings')
export class InternalSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @UseGuards(InternalApiGuard)
  @Get()
  getAll(@Query('keys') keysParam?: string) {
    if (keysParam) {
      const keys = keysParam.split(',').map((k) => k.trim());
      return this.settingsService.bulkGet(keys);
    }
    return this.settingsService.findAll();
  }

  @Public()
  @UseGuards(InternalApiGuard)
  @Get(':key')
  getByKey(@Param('key') key: string) {
    return this.settingsService.findByKey(key);
  }
}
