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
import { AdminsService } from './admins.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminJwtPayload } from '../../common/types/request.types';

@Controller('admins')
@Roles('SUPER_ADMIN')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.adminsService.findAll({ page, limit, search, role });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminsService.findById(id);
  }

  @Post()
  create(
    @Body() dto: CreateAdminDto,
    @CurrentAdmin() admin: AdminJwtPayload,
  ) {
    return this.adminsService.create(dto, admin.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
    @CurrentAdmin() admin: AdminJwtPayload,
  ) {
    return this.adminsService.update(id, dto, admin.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
  ) {
    return this.adminsService.delete(id, admin.sub);
  }
}
