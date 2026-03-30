import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ScoresService } from './scores.service';
import { CreateScoreRuleDto } from './dto/create-score-rule.dto';
import { UpdateScoreRuleDto } from './dto/update-score-rule.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminJwtPayload } from '../../common/types/request.types';

@Controller('score-rules')
export class ScoresController {
  constructor(private readonly scoresService: ScoresService) {}

  @Get()
  @Roles('VIEWER')
  findAll() {
    return this.scoresService.findAllRules();
  }

  @Get(':id')
  @Roles('VIEWER')
  findOne(@Param('id') id: string) {
    return this.scoresService.findRuleById(id);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() dto: CreateScoreRuleDto, @CurrentAdmin() admin: AdminJwtPayload) {
    return this.scoresService.createRule(dto, admin.sub);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateScoreRuleDto,
    @CurrentAdmin() admin: AdminJwtPayload,
  ) {
    return this.scoresService.updateRule(id, dto, admin.sub);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentAdmin() admin: AdminJwtPayload) {
    return this.scoresService.deleteRule(id, admin.sub);
  }
}
