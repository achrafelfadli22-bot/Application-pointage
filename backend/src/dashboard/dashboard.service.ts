import { Injectable } from '@nestjs/common';
import { LeaveRequestStatus, Prisma, SiteStatus, TimesheetStatus, UserRole } from '@prisma/client';
import { HierarchyService } from '../common/hierarchy.service';
import { CurrentUserContext } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hierarchy: HierarchyService,
  ) {}

  async summary(user: CurrentUserContext) {
    const tenantWhere = user.role === UserRole.SUPER_ADMIN ? {} : { tenantId: user.tenantId ?? '__missing__' };
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    const userScope = managedUserIds ? { userId: { in: managedUserIds } } : {};
    const employeeScope = managedUserIds ? { userId: { in: managedUserIds } } : {};
    const siteWhere = await this.siteWhere(user);

    const today = this.dateOnly(new Date());
    const weekStart = new Date(today);
    weekStart.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
    const chartStart = new Date(today);
    chartStart.setUTCDate(today.getUTCDate() - 6);

    const timesheetWhere: Prisma.TimesheetWhereInput = { ...tenantWhere, ...userScope };
    const entryWhere: Prisma.TimesheetDayEntryWhereInput = {
      ...tenantWhere,
      entryDate: { gte: weekStart, lte: today },
      timesheetLine: { timesheet: userScope },
    };

    const [
      activeEmployees,
      weeklyHours,
      statusGroups,
      pendingLeave,
      activeSites,
      latestTimesheets,
      chartEntries,
      pendingLeaveRequests,
    ] = await Promise.all([
      this.prisma.employeeProfile.count({ where: { ...tenantWhere, ...employeeScope, status: 'ACTIVE' } }),
      this.prisma.timesheetDayEntry.aggregate({ where: entryWhere, _sum: { hours: true } }),
      this.prisma.timesheet.groupBy({
        by: ['status'],
        where: timesheetWhere,
        _count: { _all: true },
      }),
      this.prisma.leaveRequest.count({
        where: {
          ...tenantWhere,
          ...userScope,
          status: { in: [LeaveRequestStatus.SUBMITTED, LeaveRequestStatus.N1_APPROVED] },
        },
      }),
      this.prisma.site.count({ where: { ...siteWhere, status: SiteStatus.ACTIVE, deletedAt: null } }),
      this.prisma.timesheet.findMany({
        where: timesheetWhere,
        include: {
          user: { select: { firstName: true, lastName: true } },
          lines: {
            select: {
              entries: { select: { hours: true } },
              site: { select: { code: true, name: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      this.prisma.timesheetDayEntry.findMany({
        where: {
          ...tenantWhere,
          entryDate: { gte: chartStart, lte: today },
          timesheetLine: { timesheet: userScope },
        },
        select: { entryDate: true, hours: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          ...tenantWhere,
          ...userScope,
          status: { in: [LeaveRequestStatus.SUBMITTED, LeaveRequestStatus.N1_APPROVED] },
        },
        include: { user: { select: { firstName: true, lastName: true } }, leaveType: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const statusCount = Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all]));
    const hoursByDate = new Map<string, number>();
    for (const entry of chartEntries) {
      const key = entry.entryDate.toISOString().slice(0, 10);
      hoursByDate.set(key, (hoursByDate.get(key) ?? 0) + Number(entry.hours));
    }

    const hoursByDay = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(chartStart);
      date.setUTCDate(chartStart.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, hours: Number((hoursByDate.get(key) ?? 0).toFixed(2)) };
    });

    return {
      counters: {
        activeEmployees,
        weeklyHours: Number(weeklyHours._sum.hours ?? 0),
        pendingTimesheets:
          (statusCount[TimesheetStatus.SUBMITTED] ?? 0) + (statusCount[TimesheetStatus.N1_APPROVED] ?? 0),
        approvedTimesheets: statusCount[TimesheetStatus.APPROVED] ?? 0,
        rejectedTimesheets: statusCount[TimesheetStatus.REJECTED] ?? 0,
        draftTimesheets:
          (statusCount[TimesheetStatus.DRAFT] ?? 0) + (statusCount[TimesheetStatus.REOPENED] ?? 0),
        pendingLeave,
        activeSites,
      },
      statusBreakdown: Object.values(TimesheetStatus).map((status) => ({
        status,
        count: statusCount[status] ?? 0,
      })),
      hoursByDay,
      latestTimesheets: latestTimesheets.map((timesheet) => ({
        id: timesheet.id,
        periodStart: timesheet.periodStart,
        periodEnd: timesheet.periodEnd,
        status: timesheet.status,
        updatedAt: timesheet.updatedAt,
        user: timesheet.user,
        totalHours: timesheet.lines.reduce(
          (total, line) => total + line.entries.reduce((lineTotal, entry) => lineTotal + Number(entry.hours), 0),
          0,
        ),
        sites: Array.from(
          new Set(timesheet.lines.map((line) => line.site?.name).filter((name): name is string => Boolean(name))),
        ),
      })),
      pendingLeaveRequests,
    };
  }

  private dateOnly(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private async siteWhere(user: CurrentUserContext): Promise<Prisma.SiteWhereInput> {
    if (user.role === UserRole.SUPER_ADMIN) return {};
    const tenantId = user.tenantId ?? '__missing__';
    if (user.role === UserRole.PROJECT_MANAGER) return { tenantId, project: { projectManagerId: user.userId } };
    if (user.role === UserRole.MANAGER) return { tenantId, managerId: user.userId };
    if (user.role === UserRole.EMPLOYEE) {
      const today = this.dateOnly(new Date());
      return {
        tenantId,
        assignments: {
          some: { userId: user.userId, startDate: { lte: today }, OR: [{ endDate: null }, { endDate: { gte: today } }] },
        },
      };
    }
    return { tenantId };
  }
}
