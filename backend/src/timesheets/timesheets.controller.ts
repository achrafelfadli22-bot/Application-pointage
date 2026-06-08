import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TimesheetStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUserContext } from '../common/types';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto';
import { TimesheetsService } from './timesheets.service';

@ApiBearerAuth()
@ApiTags('Timesheets')
@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly service: TimesheetsService) {}

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserContext,
    @Query('status') status?: TimesheetStatus,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
  ) {
    return this.service.findAll(user, { status, periodStart, periodEnd });
  }

  @Post()
  create(@CurrentUser() user: CurrentUserContext, @Body() dto: CreateTimesheetDto) {
    return this.service.create(user, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Put(':id')
  update(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: UpdateTimesheetDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.remove(user, id);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.submit(user, id);
  }

  @Post(':id/approve')
  @Roles(UserRole.RESOURCE_MANAGER, UserRole.HR, UserRole.PROJECT_MANAGER, UserRole.MANAGER)
  approve(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.approve(user, id);
  }

  @Post(':id/reject')
  @Roles(UserRole.RESOURCE_MANAGER, UserRole.HR, UserRole.PROJECT_MANAGER, UserRole.MANAGER)
  reject(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: RejectTimesheetDto) {
    return this.service.reject(user, id, dto.reason);
  }

  @Post(':id/reopen')
  @Roles(UserRole.RESOURCE_MANAGER, UserRole.HR)
  reopen(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.reopen(user, id);
  }
}
