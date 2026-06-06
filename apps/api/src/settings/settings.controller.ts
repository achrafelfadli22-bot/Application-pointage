import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUserContext } from '../common/types';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { UpdateSiteOptionsDto } from './dto/update-site-options.dto';
import { UpdateTimesheetSettingsDto } from './dto/update-timesheet-settings.dto';
import { UpdateTimesheetTaskTypesDto } from './dto/update-timesheet-task-types.dto';
import { SettingsService } from './settings.service';

@ApiBearerAuth()
@ApiTags('Settings')
@Controller('settings')
@Roles(UserRole.RESOURCE_MANAGER, UserRole.HR)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get('company')
  company(@CurrentUser() user: CurrentUserContext) {
    return this.service.company(user);
  }

  @Put('company')
  updateCompany(@CurrentUser() user: CurrentUserContext, @Body() dto: UpdateCompanyDto) {
    return this.service.updateCompany(user, dto);
  }

  @Get('holidays')
  holidays(@CurrentUser() user: CurrentUserContext) {
    return this.service.holidays(user);
  }

  @Post('holidays')
  createHoliday(@CurrentUser() user: CurrentUserContext, @Body() dto: CreateHolidayDto) {
    return this.service.createHoliday(user, dto);
  }

  @Put('holidays/:id')
  updateHoliday(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: UpdateHolidayDto) {
    return this.service.updateHoliday(user, id, dto);
  }

  @Delete('holidays/:id')
  deleteHoliday(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.deleteHoliday(user, id);
  }

  @Get('leave-types')
  leaveTypes(@CurrentUser() user: CurrentUserContext) {
    return this.service.leaveTypes(user);
  }

  @Post('leave-types')
  createLeaveType(@CurrentUser() user: CurrentUserContext, @Body() dto: CreateLeaveTypeDto) {
    return this.service.createLeaveType(user, dto);
  }

  @Put('leave-types/:id')
  updateLeaveType(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.service.updateLeaveType(user, id, dto);
  }

  @Get('timesheet-task-types')
  @Roles(UserRole.RESOURCE_MANAGER, UserRole.HR, UserRole.PROJECT_MANAGER, UserRole.MANAGER, UserRole.EMPLOYEE)
  timesheetTaskTypes(@CurrentUser() user: CurrentUserContext) {
    return this.service.timesheetTaskTypes(user);
  }

  @Put('timesheet-task-types')
  @Roles(UserRole.RESOURCE_MANAGER)
  updateTimesheetTaskTypes(@CurrentUser() user: CurrentUserContext, @Body() dto: UpdateTimesheetTaskTypesDto) {
    return this.service.updateTimesheetTaskTypes(user, dto);
  }

  @Get('timesheet')
  @Roles(UserRole.RESOURCE_MANAGER, UserRole.HR, UserRole.PROJECT_MANAGER, UserRole.MANAGER, UserRole.EMPLOYEE)
  timesheetSettings(@CurrentUser() user: CurrentUserContext) {
    return this.service.timesheetSettings(user);
  }

  @Put('timesheet')
  @Roles(UserRole.RESOURCE_MANAGER)
  updateTimesheetSettings(@CurrentUser() user: CurrentUserContext, @Body() dto: UpdateTimesheetSettingsDto) {
    return this.service.updateTimesheetSettings(user, dto);
  }

  @Get('site-options')
  @Roles(UserRole.RESOURCE_MANAGER, UserRole.HR, UserRole.PROJECT_MANAGER, UserRole.MANAGER, UserRole.EMPLOYEE)
  siteOptions(@CurrentUser() user: CurrentUserContext) {
    return this.service.siteOptions(user);
  }

  @Put('site-options')
  @Roles(UserRole.RESOURCE_MANAGER)
  updateSiteOptions(@CurrentUser() user: CurrentUserContext, @Body() dto: UpdateSiteOptionsDto) {
    return this.service.updateSiteOptions(user, dto);
  }

  @Get('attendance')
  attendanceSettings(@CurrentUser() user: CurrentUserContext) {
    return this.service.attendanceSettings(user);
  }

  @Put('attendance')
  updateAttendanceSettings(@CurrentUser() user: CurrentUserContext, @Body() dto: UpdateAttendanceDto) {
    return this.service.updateAttendanceSettings(user, dto);
  }
}
