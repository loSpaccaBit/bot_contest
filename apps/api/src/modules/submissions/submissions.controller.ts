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
  UseGuards,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionFromBotDto } from './dto/create-submission.dto';
import { ApproveSubmissionDto } from './dto/approve-submission.dto';
import { RejectSubmissionDto } from './dto/reject-submission.dto';
import { AssignPointsDto } from './dto/assign-points.dto';
import { SubmissionQueryDto } from './dto/submission-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { InternalApiGuard } from '../../common/guards/internal-api.guard';
import { AdminJwtPayload } from '../../common/types/request.types';

@Controller('submissions')
@Roles('VIEWER')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get()
  findAll(@Query() query: SubmissionQueryDto) {
    return this.submissionsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.submissionsService.findById(id);
  }

  @Get(':id/events')
  getEvents(@Param('id') id: string) {
    return this.submissionsService.getSubmissionEvents(id);
  }

  @Patch(':id/approve')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveSubmissionDto,
    @CurrentAdmin() admin: AdminJwtPayload,
  ) {
    return this.submissionsService.approve(id, dto, admin.sub);
  }

  @Patch(':id/reject')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectSubmissionDto,
    @CurrentAdmin() admin: AdminJwtPayload,
  ) {
    return this.submissionsService.reject(id, dto, admin.sub);
  }

  @Post(':id/points')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  assignPoints(
    @Param('id') id: string,
    @Body() dto: AssignPointsDto,
    @CurrentAdmin() admin: AdminJwtPayload,
  ) {
    return this.submissionsService.assignPoints(id, dto, admin.sub);
  }

  @Patch(':id/unapprove')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  unapprove(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
  ) {
    return this.submissionsService.unapprove(id, admin.sub);
  }

  @Delete(':id/points/:movementId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteScoreMovement(
    @Param('id') id: string,
    @Param('movementId') movementId: string,
    @CurrentAdmin() admin: AdminJwtPayload,
  ) {
    return this.submissionsService.deleteScoreMovement(id, movementId, admin.sub);
  }
}

// Internal (bot-facing) routes
@Controller('internal/submissions')
export class InternalSubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Public()
  @UseGuards(InternalApiGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createFromBot(@Body() dto: CreateSubmissionFromBotDto) {
    return this.submissionsService.createFromBot(dto);
  }
}
