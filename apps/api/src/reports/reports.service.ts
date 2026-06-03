import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { HierarchyService } from '../common/hierarchy.service';
import { CurrentUserContext } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { ReportFilterDto } from './dto/report-filter.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly hierarchy: HierarchyService,
  ) {}

  async attendance(user: CurrentUserContext, filters: ReportFilterDto) {
    return this.prisma.attendancePunch.findMany({
      where: await this.attendanceWhere(user, filters),
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        site: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ punchDate: 'desc' }, { checkInAt: 'desc' }],
    });
  }

  async hoursByEmployee(user: CurrentUserContext, filters: ReportFilterDto) {
    const grouped = await this.prisma.attendancePunch.groupBy({
      by: ['userId'],
      where: await this.attendanceWhere(user, filters),
      _sum: { durationMinutes: true },
      _count: { id: true },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: grouped.map((row) => row.userId) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    return grouped.map((row) => ({
      user: users.find((item) => item.id === row.userId),
      durationMinutes: row._sum.durationMinutes ?? 0,
      hours: Number(((row._sum.durationMinutes ?? 0) / 60).toFixed(2)),
      punches: row._count.id,
    }));
  }

  async hoursBySite(user: CurrentUserContext, filters: ReportFilterDto) {
    const grouped = await this.prisma.attendancePunch.groupBy({
      by: ['siteId'],
      where: await this.attendanceWhere(user, filters),
      _sum: { durationMinutes: true },
      _count: { id: true },
    });
    const sites = await this.prisma.site.findMany({
      where: { id: { in: grouped.map((row) => row.siteId).filter(Boolean) as string[] } },
      select: { id: true, code: true, name: true, city: true },
    });

    return grouped.map((row) => ({
      site: sites.find((item) => item.id === row.siteId) ?? null,
      durationMinutes: row._sum.durationMinutes ?? 0,
      hours: Number(((row._sum.durationMinutes ?? 0) / 60).toFixed(2)),
      punches: row._count.id,
    }));
  }

  async timesheets(user: CurrentUserContext, filters: ReportFilterDto) {
    return this.prisma.timesheet.findMany({
      where: {
        ...this.tenantWhere(user),
        userId: await this.userIdFilter(user, filters.userId),
        status: filters.status as never,
        periodStart: filters.startDate ? { gte: new Date(filters.startDate) } : undefined,
        periodEnd: filters.endDate ? { lte: new Date(filters.endDate) } : undefined,
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        lines: { include: { entries: true, site: { select: { code: true, name: true } } } },
      },
      orderBy: { periodStart: 'desc' },
    });
  }

  async leave(user: CurrentUserContext, filters: ReportFilterDto) {
    return this.prisma.leaveRequest.findMany({
      where: {
        ...this.tenantWhere(user),
        userId: await this.userIdFilter(user, filters.userId),
        status: filters.status as never,
        startDate: filters.startDate ? { gte: new Date(filters.startDate) } : undefined,
        endDate: filters.endDate ? { lte: new Date(filters.endDate) } : undefined,
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        leaveType: true,
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async gpsAnomalies(user: CurrentUserContext, filters: ReportFilterDto) {
    return this.prisma.attendancePunch.findMany({
      where: {
        ...(await this.attendanceWhere(user, filters)),
        isGpsAnomaly: true,
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        site: { select: { code: true, name: true, latitude: true, longitude: true, gpsRadiusMeters: true } },
      },
      orderBy: { punchDate: 'desc' },
    });
  }

  async payrollExport(user: CurrentUserContext, filters: ReportFilterDto) {
    const rows = await this.hoursByEmployee(user, filters);
    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'report.export',
      entityType: 'PayrollExport',
      metadata: filters as Prisma.InputJsonValue,
    });

    const csv = [
      'employee,email,hours,durationMinutes,punches',
      ...rows.map((row) => {
        const employee = row.user ? `${row.user.firstName} ${row.user.lastName}` : 'Unknown';
        return `${employee},${row.user?.email ?? ''},${row.hours},${row.durationMinutes},${row.punches}`;
      }),
    ].join('\n');

    return {
      filename: `payroll-export-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: 'text/csv',
      content: csv,
    };
  }

  private async attendanceWhere(user: CurrentUserContext, filters: ReportFilterDto): Promise<Prisma.AttendancePunchWhereInput> {
    return {
      ...this.tenantWhere(user),
      siteId: filters.siteId,
      userId: await this.userIdFilter(user, filters.userId),
      status: filters.status as never,
      punchDate: {
        gte: filters.startDate ? new Date(filters.startDate) : undefined,
        lte: filters.endDate ? new Date(filters.endDate) : undefined,
      },
    };
  }

  private async userIdFilter(user: CurrentUserContext, requestedUserId?: string) {
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    if (!managedUserIds) {
      return requestedUserId;
    }
    if (requestedUserId) {
      return managedUserIds.includes(requestedUserId) ? requestedUserId : '__forbidden__';
    }
    return { in: managedUserIds };
  }

  private tenantWhere(user: CurrentUserContext) {
    return user.role === UserRole.SUPER_ADMIN ? {} : { tenantId: user.tenantId ?? '__missing__' };
  }
}
