import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AttendanceStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUserContext } from '../common/types';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { RejectAttendanceDto } from './dto/reject-attendance.dto';

@ApiBearerAuth()
@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post('check-in')
  @Roles(UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.PROJECT_MANAGER, UserRole.HR, UserRole.RESOURCE_MANAGER)
  checkIn(@CurrentUser() user: CurrentUserContext, @Body() dto: CheckInDto) {
    return this.service.checkIn(user, dto);
  }

  @Post('check-out')
  @Roles(UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.PROJECT_MANAGER, UserRole.HR, UserRole.RESOURCE_MANAGER)
  checkOut(@CurrentUser() user: CurrentUserContext, @Body() dto: CheckOutDto) {
    return this.service.checkOut(user, dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.RESOURCE_MANAGER, UserRole.HR, UserRole.PROJECT_MANAGER, UserRole.MANAGER)
  findAll(
    @CurrentUser() user: CurrentUserContext,
    @Query('siteId') siteId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: AttendanceStatus,
    @Query('gpsAnomaly') gpsAnomaly?: string,
  ) {
    return this.service.findAll(user, {
      siteId,
      userId,
      status,
      gpsAnomaly: gpsAnomaly === undefined ? undefined : gpsAnomaly === 'true',
    });
  }

  @Get('today')
  today(@CurrentUser() user: CurrentUserContext) {
    return this.service.today(user);
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
  reject(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: RejectAttendanceDto) {
    return this.service.reject(user, id, dto.comment);
  }
}
