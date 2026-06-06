import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUserContext } from '../common/types';
import { ReportFilterDto } from './dto/report-filter.dto';
import { ReportsService } from './reports.service';

@ApiBearerAuth()
@ApiTags('Reports')
@Controller('reports')
@Roles(UserRole.SUPER_ADMIN, UserRole.RESOURCE_MANAGER, UserRole.HR, UserRole.PROJECT_MANAGER, UserRole.MANAGER)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('attendance')
  attendance(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.attendance(user, filters);
  }

  @Get('hours-by-employee')
  hoursByEmployee(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.hoursByEmployee(user, filters);
  }

  @Get('hours-by-site')
  hoursBySite(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.hoursBySite(user, filters);
  }

  @Get('timesheets')
  @Roles(UserRole.SUPER_ADMIN, UserRole.RESOURCE_MANAGER, UserRole.HR, UserRole.PROJECT_MANAGER, UserRole.MANAGER, UserRole.EMPLOYEE)
  timesheets(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.timesheets(user, filters);
  }

  @Get('leave')
  leave(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.leave(user, filters);
  }

  @Get('gps-anomalies')
  gpsAnomalies(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.gpsAnomalies(user, filters);
  }

  @Get('payroll-export')
  payrollExport(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.payrollExport(user, filters);
  }
}
