import { Injectable } from '@nestjs/common';
import { AttendanceStatus, LeaveRequestStatus, Prisma, SiteStatus, TimesheetStatus, UserRole } from '@prisma/client';
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

    const [
      activeEmployees,
      presentToday,
      lateToday,
      weeklyMinutes,
      pendingTimesheets,
      pendingLeave,
      activeSites,
      latestPunches,
      pendingLeaveRequests,
      timesheetsToApprove,
    ] = await Promise.all([
      this.prisma.employeeProfile.count({ where: { ...tenantWhere, ...employeeScope, status: 'ACTIVE' } }),
      this.prisma.attendancePunch.count({ where: { ...tenantWhere, ...userScope, punchDate: today, checkInAt: { not: null } } }),
      this.prisma.attendancePunch.count({
        where: {
          ...tenantWhere,
          ...userScope,
          punchDate: today,
          checkInAt: { gt: new Date(`${today.toISOString().slice(0, 10)}T08:15:00.000Z`) },
        },
      }),
      this.prisma.attendancePunch.aggregate({
        where: { ...tenantWhere, ...userScope, punchDate: { gte: weekStart }, durationMinutes: { not: null } },
        _sum: { durationMinutes: true },
      }),
      this.prisma.timesheet.count({
        where: { ...tenantWhere, ...userScope, status: { in: [TimesheetStatus.SUBMITTED, TimesheetStatus.N1_APPROVED] } },
      }),
      this.prisma.leaveRequest.count({
        where: { ...tenantWhere, ...userScope, status: { in: [LeaveRequestStatus.SUBMITTED, LeaveRequestStatus.N1_APPROVED] } },
      }),
      this.prisma.site.count({ where: { ...siteWhere, status: SiteStatus.ACTIVE, deletedAt: null } }),
      this.prisma.attendancePunch.findMany({
        where: { ...tenantWhere, ...userScope },
        include: { user: { select: { firstName: true, lastName: true } }, site: { select: { code: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.leaveRequest.findMany({
        where: { ...tenantWhere, ...userScope, status: { in: [LeaveRequestStatus.SUBMITTED, LeaveRequestStatus.N1_APPROVED] } },
        include: { user: { select: { firstName: true, lastName: true } }, leaveType: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.timesheet.findMany({
        where: { ...tenantWhere, ...userScope, status: { in: [TimesheetStatus.SUBMITTED, TimesheetStatus.N1_APPROVED] } },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { submittedAt: 'desc' },
        take: 8,
      }),
    ]);

    const absentToday = Math.max(0, activeEmployees - presentToday);

    return {
      counters: {
        activeEmployees,
        presentToday,
        absentToday,
        lateToday,
        weeklyHours: Number(((weeklyMinutes._sum.durationMinutes ?? 0) / 60).toFixed(2)),
        pendingTimesheets,
        pendingLeave,
        activeSites,
      },
      latestPunches,
      pendingLeaveRequests,
      timesheetsToApprove,
      statusReference: {
        attendance: AttendanceStatus.SUBMITTED,
        timesheet: TimesheetStatus.SUBMITTED,
      },
    };
  }

  private dateOnly(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private async siteWhere(user: CurrentUserContext): Promise<Prisma.SiteWhereInput> {
    if (user.role === UserRole.SUPER_ADMIN) {
      return {};
    }

    const tenantId = user.tenantId ?? '__missing__';
    if (user.role === UserRole.PROJECT_MANAGER) {
      return { tenantId, project: { projectManagerId: user.userId } };
    }
    if (user.role === UserRole.MANAGER) {
      return { tenantId, managerId: user.userId };
    }
    if (user.role === UserRole.EMPLOYEE) {
      const today = this.dateOnly(new Date());
      return {
        tenantId,
        assignments: {
          some: {
            userId: user.userId,
            startDate: { lte: today },
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
        },
      };
    }

    return { tenantId };
  }
}
