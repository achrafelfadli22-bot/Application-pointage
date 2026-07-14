import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

  // ─── Nouveaux rapports métier ─────────────────────────────────────────────────

  @Get('monthly-attendance')
  @ApiOperation({
    summary: 'Synthèse mensuelle de présence par employé',
    description:
      'Agrège les pointages par employé : jours travaillés, heures totales, retards, anomalies GPS, taux de présence. Seuil de retard depuis TenantSettings.',
  })
  monthlyAttendance(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.monthlyAttendance(user, filters);
  }

  @Get('site-workload')
  @ApiOperation({
    summary: 'Charge par site / projet',
    description:
      'Heures timesheets approuvées par site : heures facturables vs internes, headcount, taux de facturation, anomalies GPS.',
  })
  siteWorkload(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.siteWorkload(user, filters);
  }

  @Get('leave-balances')
  @ApiOperation({
    summary: 'Bilan congés par employé',
    description:
      "Soldes de congés par employé et type pour une année donnée : ouverture, acquis, utilisés, en attente, restants, taux d'utilisation.",
  })
  leaveBalances(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.leaveBalances(user, filters);
  }

  @Get('payroll-export')
  @ApiOperation({
    summary: 'Export paie enrichi (CSV)',
    description:
      'CSV RFC 4180 par employé : heures normales, heures sup (seuil overtimeTriggerHours), heures facturables, congés payés/non payés, jours fériés, brut estimé.',
  })
  payrollExport(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.payrollExport(user, filters);
  }

  @Get('late-gps-anomalies')
  @ApiOperation({
    summary: 'Retards & anomalies GPS',
    description:
      'Retards par employé (seuil TenantSettings), anomalies GPS par site, pointages ouverts sans check-out.',
  })
  lateAndGpsAnomalies(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.lateAndGpsAnomalies(user, filters);
  }

  @Get('hr-dashboard')
  @ApiOperation({
    summary: 'Tableau de bord RH mensuel',
    description:
      'Effectif, présence, congés par type, timesheets (soumission/approbation), conformité (sans timesheet, pointages ouverts).',
  })
  hrDashboard(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.hrDashboard(user, filters);
  }

  // ─── Anciens rapports conservés avec pagination ───────────────────────────────

  @Get('attendance')
  @ApiOperation({ summary: 'Liste brute des pointages (paginée, max 500)' })
  attendance(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.attendance(user, filters);
  }

  @Get('hours-by-employee')
  @ApiOperation({ summary: 'Heures totales agrégées par employé' })
  hoursByEmployee(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.hoursByEmployee(user, filters);
  }

  @Get('hours-by-site')
  @ApiOperation({ summary: 'Heures totales agrégées par site' })
  hoursBySite(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.hoursBySite(user, filters);
  }

  @Get('timesheets')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.RESOURCE_MANAGER,
    UserRole.HR,
    UserRole.PROJECT_MANAGER,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({ summary: 'Liste brute des timesheets (paginée, max 500)' })
  timesheets(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.timesheets(user, filters);
  }

  @Get('leave')
  @ApiOperation({ summary: 'Liste brute des demandes de congé (paginée, max 500)' })
  leave(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.leave(user, filters);
  }

  @Get('gps-anomalies')
  @ApiOperation({ summary: 'Liste brute des pointages avec anomalie GPS (paginée, max 500)' })
  gpsAnomalies(@CurrentUser() user: CurrentUserContext, @Query() filters: ReportFilterDto) {
    return this.service.gpsAnomalies(user, filters);
  }
}
