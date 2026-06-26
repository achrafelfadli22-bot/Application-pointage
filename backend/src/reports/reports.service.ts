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

  // ─── Rapport 1 : Synthèse mensuelle de présence par employé ─────────────────

  async monthlyAttendance(user: CurrentUserContext, filters: ReportFilterDto) {
    const tenantId = user.tenantId ?? '__missing__';
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    const userIdFilter = this.buildUserIdFilter(managedUserIds, filters.userId);

    const startDate = filters.startDate ? new Date(filters.startDate) : this.firstDayOfCurrentMonth();
    const endDate = filters.endDate ? new Date(filters.endDate) : this.lastDayOfCurrentMonth();

    // Paramètres tenant pour calcul de retard
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    const workDayStart = settings?.workDayStartTime ?? '08:00';
    const lateToleranceMinutes = settings?.lateToleranceMinutes ?? 15;
    const lateThresholdMinutes = this.minutesFromTime(workDayStart) + lateToleranceMinutes;

    // Jours ouvrés de la période (hors week-end + jours fériés tenant)
    const holidays = await this.prisma.holiday.findMany({
      where: { tenantId, date: { gte: startDate, lte: endDate } },
      select: { date: true },
    });
    const holidayKeys = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
    const workedDaysCap = this.countWorkingDays(startDate, endDate, holidayKeys);

    const punches = await this.prisma.attendancePunch.findMany({
      where: {
        ...(user.role === UserRole.SUPER_ADMIN ? {} : { tenantId }),
        userId: userIdFilter,
        punchDate: { gte: startDate, lte: endDate },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeProfile: { select: { employeeNumber: true, jobTitle: true, contractType: true } },
          },
        },
      },
    });

    // Congés approuvés de la période
    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        ...(user.role === UserRole.SUPER_ADMIN ? {} : { tenantId }),
        userId: userIdFilter,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { userId: true, durationDays: true },
    });
    const leaveByUser = new Map<string, number>();
    for (const lr of leaves) {
      leaveByUser.set(lr.userId, (leaveByUser.get(lr.userId) ?? 0) + Number(lr.durationDays));
    }

    // Agrégation par employé
    type RowAcc = {
      user: typeof punches[0]['user'];
      totalMinutes: number;
      workedDays: number;
      lateCount: number;
      gpsAnomalies: number;
      approved: number;
      pending: number;
      openPunches: number;
    };
    const byUser = new Map<string, RowAcc>();

    for (const p of punches) {
      if (!byUser.has(p.userId)) {
        byUser.set(p.userId, {
          user: p.user,
          totalMinutes: 0,
          workedDays: 0,
          lateCount: 0,
          gpsAnomalies: 0,
          approved: 0,
          pending: 0,
          openPunches: 0,
        });
      }
      const row = byUser.get(p.userId)!;
      if (p.checkInAt) {
        row.workedDays += 1;
        const checkInMinutes = p.checkInAt.getUTCHours() * 60 + p.checkInAt.getUTCMinutes();
        if (checkInMinutes > lateThresholdMinutes) row.lateCount += 1;
      }
      if (!p.checkOutAt) row.openPunches += 1;
      if (p.durationMinutes) row.totalMinutes += p.durationMinutes;
      if (p.isGpsAnomaly) row.gpsAnomalies += 1;
      if (p.status === 'APPROVED') row.approved += 1;
      else if (p.status === 'SUBMITTED' || p.status === 'N1_APPROVED') row.pending += 1;
    }

    const rows = [...byUser.values()].map((r) => {
      const leaveDays = leaveByUser.get(r.user.id) ?? 0;
      const absentDays = Math.max(0, workedDaysCap - r.workedDays - leaveDays);
      const attendanceRate =
        workedDaysCap > 0 ? Number(((r.workedDays / workedDaysCap) * 100).toFixed(1)) : 0;
      return {
        employee: {
          id: r.user.id,
          name: `${r.user.firstName} ${r.user.lastName}`,
          email: r.user.email,
          employeeNumber: r.user.employeeProfile?.employeeNumber ?? null,
          jobTitle: r.user.employeeProfile?.jobTitle ?? null,
          contractType: r.user.employeeProfile?.contractType ?? null,
        },
        workedDays: r.workedDays,
        totalHours: Number((r.totalMinutes / 60).toFixed(2)),
        avgHoursPerDay: r.workedDays > 0 ? Number((r.totalMinutes / 60 / r.workedDays).toFixed(2)) : 0,
        lateArrivals: r.lateCount,
        gpsAnomalies: r.gpsAnomalies,
        openPunches: r.openPunches,
        leaveDays,
        absentDays,
        attendanceRate,
        punchesApproved: r.approved,
        punchesPending: r.pending,
      };
    });

    rows.sort((a, b) => a.employee.name.localeCompare(b.employee.name));

    const totals = {
      workedDays: rows.reduce((s, r) => s + r.workedDays, 0),
      totalHours: Number(rows.reduce((s, r) => s + r.totalHours, 0).toFixed(2)),
      avgAttendanceRate:
        rows.length > 0
          ? Number((rows.reduce((s, r) => s + r.attendanceRate, 0) / rows.length).toFixed(1))
          : 0,
      totalLateArrivals: rows.reduce((s, r) => s + r.lateArrivals, 0),
      totalGpsAnomalies: rows.reduce((s, r) => s + r.gpsAnomalies, 0),
    };

    return {
      period: { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) },
      workingDaysInPeriod: workedDaysCap,
      lateThreshold: `${workDayStart} + ${lateToleranceMinutes} min`,
      rows,
      totals,
    };
  }

  // ─── Rapport 2 : Charge par chantier / projet ────────────────────────────────

  async siteWorkload(user: CurrentUserContext, filters: ReportFilterDto) {
    const tenantWhere = this.tenantWhere(user);
    const startDate = filters.startDate ? new Date(filters.startDate) : this.firstDayOfCurrentMonth();
    const endDate = filters.endDate ? new Date(filters.endDate) : this.lastDayOfCurrentMonth();

    const lines = await this.prisma.timesheetLine.findMany({
      where: {
        ...tenantWhere,
        siteId: filters.siteId ?? undefined,
        site: filters.projectId ? { projectId: filters.projectId } : undefined,
        entries: { some: { entryDate: { gte: startDate, lte: endDate } } },
      },
      include: {
        site: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            status: true,
            project: { select: { id: true, code: true, name: true, clientName: true } },
            manager: { select: { firstName: true, lastName: true } },
          },
        },
        entries: {
          where: { entryDate: { gte: startDate, lte: endDate } },
          select: { hours: true, entryDate: true },
        },
        timesheet: { select: { userId: true } },
      },
    });

    type SiteAcc = {
      site: typeof lines[0]['site'];
      billableMinutes: number;
      nonBillableMinutes: number;
      userIds: Set<string>;
      weeklyHeadcounts: Map<string, Set<string>>;
    };
    const bySite = new Map<string, SiteAcc>();

    for (const line of lines) {
      const siteKey = line.siteId ?? '__no_site__';
      if (!bySite.has(siteKey)) {
        bySite.set(siteKey, {
          site: line.site,
          billableMinutes: 0,
          nonBillableMinutes: 0,
          userIds: new Set(),
          weeklyHeadcounts: new Map(),
        });
      }
      const row = bySite.get(siteKey)!;
      row.userIds.add(line.timesheet.userId);
      for (const entry of line.entries) {
        const hours = Number(entry.hours);
        if (line.billingType === 'BILLABLE') row.billableMinutes += hours * 60;
        else row.nonBillableMinutes += hours * 60;
        const weekKey = this.isoWeek(entry.entryDate);
        if (!row.weeklyHeadcounts.has(weekKey)) row.weeklyHeadcounts.set(weekKey, new Set());
        row.weeklyHeadcounts.get(weekKey)!.add(line.timesheet.userId);
      }
    }

    // Anomalies GPS par site
    const gpsAnomalies = await this.prisma.attendancePunch.groupBy({
      by: ['siteId'],
      where: { ...tenantWhere, siteId: { not: null }, isGpsAnomaly: true, punchDate: { gte: startDate, lte: endDate } },
      _count: { id: true },
    });
    const anomalyBySite = new Map(gpsAnomalies.map((g) => [g.siteId, g._count.id]));

    const totalPunchesBySite = await this.prisma.attendancePunch.groupBy({
      by: ['siteId'],
      where: { ...tenantWhere, siteId: { not: null }, punchDate: { gte: startDate, lte: endDate } },
      _count: { id: true },
    });
    const totalPunchMap = new Map(totalPunchesBySite.map((g) => [g.siteId, g._count.id]));

    const sites = [...bySite.entries()].map(([siteKey, r]) => {
      const totalMinutes = r.billableMinutes + r.nonBillableMinutes;
      const totalHours = Number((totalMinutes / 60).toFixed(2));
      const billableHours = Number((r.billableMinutes / 60).toFixed(2));
      const nonBillableHours = Number((r.nonBillableMinutes / 60).toFixed(2));
      const headcount = r.userIds.size;
      const avgWeeklyHeadcount =
        r.weeklyHeadcounts.size > 0
          ? Number(
              ([...r.weeklyHeadcounts.values()].reduce((s, set) => s + set.size, 0) /
                r.weeklyHeadcounts.size).toFixed(1),
            )
          : 0;
      const anomalies = anomalyBySite.get(siteKey) ?? 0;
      const totalPunches = totalPunchMap.get(siteKey) ?? 0;

      return {
        site: r.site
          ? {
              id: r.site.id,
              code: r.site.code,
              name: r.site.name,
              city: r.site.city,
              status: r.site.status,
              manager: r.site.manager ? `${r.site.manager.firstName} ${r.site.manager.lastName}` : null,
              project: r.site.project,
            }
          : null,
        totalHours,
        billableHours,
        nonBillableHours,
        billingRate: totalHours > 0 ? Number(((billableHours / totalHours) * 100).toFixed(1)) : 0,
        headcount,
        avgWeeklyHeadcount,
        avgHoursPerEmployee: headcount > 0 ? Number((totalHours / headcount).toFixed(2)) : 0,
        gpsAnomalyRate: totalPunches > 0 ? Number(((anomalies / totalPunches) * 100).toFixed(1)) : 0,
      };
    });

    sites.sort((a, b) => b.totalHours - a.totalHours);

    const grandTotal = {
      totalHours: Number(sites.reduce((s, r) => s + r.totalHours, 0).toFixed(2)),
      billableHours: Number(sites.reduce((s, r) => s + r.billableHours, 0).toFixed(2)),
      nonBillableHours: Number(sites.reduce((s, r) => s + r.nonBillableHours, 0).toFixed(2)),
      billingRate: 0,
    };
    grandTotal.billingRate =
      grandTotal.totalHours > 0
        ? Number(((grandTotal.billableHours / grandTotal.totalHours) * 100).toFixed(1))
        : 0;

    return {
      period: { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) },
      sites,
      totals: grandTotal,
    };
  }

  // ─── Rapport 3 : Bilan congés par employé ────────────────────────────────────

  async leaveBalances(user: CurrentUserContext, filters: ReportFilterDto) {
    const tenantId = user.tenantId ?? '__missing__';
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    const userIdFilter = this.buildUserIdFilter(managedUserIds, filters.userId);
    const year = filters.year ?? new Date().getFullYear();

    const balances = await this.prisma.leaveBalance.findMany({
      where: {
        ...(user.role === UserRole.SUPER_ADMIN ? {} : { tenantId }),
        userId: userIdFilter,
        year,
      },
      include: {
        leaveType: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeProfile: { select: { employeeNumber: true, jobTitle: true } },
          },
        },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { leaveType: { code: 'asc' } }],
    });

    type EmployeeRow = {
      employee: typeof balances[0]['user'];
      balances: Array<{
        leaveType: { code: string; name: string; isPaid: boolean };
        openingBalance: number;
        accrued: number;
        used: number;
        pending: number;
        remaining: number;
        utilizationRate: number;
      }>;
    };
    const byEmployee = new Map<string, EmployeeRow>();

    for (const b of balances) {
      if (!byEmployee.has(b.userId)) {
        byEmployee.set(b.userId, { employee: b.user, balances: [] });
      }
      const total = Number(b.openingBalance) + Number(b.accruedDays);
      const used = Number(b.usedDays);
      byEmployee.get(b.userId)!.balances.push({
        leaveType: { code: b.leaveType.code, name: b.leaveType.name, isPaid: b.leaveType.isPaid },
        openingBalance: Number(b.openingBalance),
        accrued: Number(b.accruedDays),
        used,
        pending: Number(b.pendingDays),
        remaining: Number(b.remainingDays),
        utilizationRate: total > 0 ? Number(((used / total) * 100).toFixed(1)) : 0,
      });
    }

    const rows = [...byEmployee.values()].map((r) => ({
      employee: {
        id: r.employee.id,
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        email: r.employee.email,
        employeeNumber: r.employee.employeeProfile?.employeeNumber ?? null,
        jobTitle: r.employee.employeeProfile?.jobTitle ?? null,
      },
      balances: r.balances,
    }));

    const allBalances = rows.flatMap((r) => r.balances);
    const summary = {
      year,
      avgUtilizationRate:
        allBalances.length > 0
          ? Number((allBalances.reduce((s, b) => s + b.utilizationRate, 0) / allBalances.length).toFixed(1))
          : 0,
      employeesWithNegativeBalance: rows.filter((r) => r.balances.some((b) => b.remaining < 0)).length,
      employeesWithHighPending: rows.filter((r) => r.balances.some((b) => b.pending >= 5)).length,
      totalUsedDays: Number(allBalances.reduce((s, b) => s + b.used, 0).toFixed(2)),
      totalPendingDays: Number(allBalances.reduce((s, b) => s + b.pending, 0).toFixed(2)),
    };

    return { year, rows, summary };
  }

  // ─── Rapport 4 : Export paie enrichi ─────────────────────────────────────────

  async payrollExport(user: CurrentUserContext, filters: ReportFilterDto) {
    const tenantId = user.tenantId ?? '__missing__';
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    const userIdFilter = this.buildUserIdFilter(managedUserIds, filters.userId);

    const startDate = filters.startDate ? new Date(filters.startDate) : this.firstDayOfCurrentMonth();
    const endDate = filters.endDate ? new Date(filters.endDate) : this.lastDayOfCurrentMonth();

    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    const overtimeTriggerHours = settings?.overtimeTriggerHours ?? 8;

    const holidays = await this.prisma.holiday.findMany({
      where: { tenantId, date: { gte: startDate, lte: endDate } },
      select: { date: true },
    });
    const holidayCount = holidays.filter((h) => {
      const d = h.date.getUTCDay();
      return d !== 0 && d !== 6;
    }).length;

    const punches = await this.prisma.attendancePunch.findMany({
      where: {
        ...(user.role === UserRole.SUPER_ADMIN ? {} : { tenantId }),
        userId: userIdFilter,
        punchDate: { gte: startDate, lte: endDate },
        status: 'APPROVED',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeProfile: { select: { employeeNumber: true, jobTitle: true, hourlyRate: true } },
          },
        },
      },
    });

    // Heures timesheets par employé (billable / non-billable)
    const tsEntries = await this.prisma.timesheetDayEntry.findMany({
      where: {
        ...(user.role === UserRole.SUPER_ADMIN ? {} : { tenantId }),
        entryDate: { gte: startDate, lte: endDate },
        timesheetLine: { timesheet: { userId: userIdFilter, status: 'APPROVED' } },
      },
      include: {
        timesheetLine: { select: { billingType: true, timesheet: { select: { userId: true } } } },
      },
    });
    const tsByUser = new Map<string, { billableHours: number; nonBillableHours: number }>();
    for (const e of tsEntries) {
      const uid = e.timesheetLine.timesheet.userId;
      if (!tsByUser.has(uid)) tsByUser.set(uid, { billableHours: 0, nonBillableHours: 0 });
      const row = tsByUser.get(uid)!;
      if (e.timesheetLine.billingType === 'BILLABLE') row.billableHours += Number(e.hours);
      else row.nonBillableHours += Number(e.hours);
    }

    // Congés approuvés
    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        ...(user.role === UserRole.SUPER_ADMIN ? {} : { tenantId }),
        userId: userIdFilter,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: { leaveType: { select: { isPaid: true } } },
    });
    const leaveByUser = new Map<string, { paidDays: number; unpaidDays: number }>();
    for (const lr of leaves) {
      if (!leaveByUser.has(lr.userId)) leaveByUser.set(lr.userId, { paidDays: 0, unpaidDays: 0 });
      const row = leaveByUser.get(lr.userId)!;
      const days = Number(lr.durationDays);
      if (lr.leaveType.isPaid) row.paidDays += days;
      else row.unpaidDays += days;
    }

    // Heures normales vs supplémentaires (par jour par employé)
    type PayRow = {
      user: typeof punches[0]['user'];
      normalMinutes: number;
      overtimeMinutes: number;
      workedDays: number;
    };
    const byUser = new Map<string, PayRow>();
    const punchesByUserDay = new Map<string, number>();

    for (const p of punches) {
      if (!byUser.has(p.userId)) {
        byUser.set(p.userId, { user: p.user, normalMinutes: 0, overtimeMinutes: 0, workedDays: 0 });
      }
      if (p.durationMinutes) {
        const key = `${p.userId}_${p.punchDate.toISOString().slice(0, 10)}`;
        punchesByUserDay.set(key, (punchesByUserDay.get(key) ?? 0) + p.durationMinutes);
      }
    }
    const triggerMinutes = overtimeTriggerHours * 60;
    for (const [key, totalMinutes] of punchesByUserDay.entries()) {
      const userId = key.split('_')[0];
      if (!userId) continue;
      const row = byUser.get(userId);
      if (!row) continue;
      row.workedDays += 1;
      if (totalMinutes > triggerMinutes) {
        row.normalMinutes += triggerMinutes;
        row.overtimeMinutes += totalMinutes - triggerMinutes;
      } else {
        row.normalMinutes += totalMinutes;
      }
    }

    const csvEscape = (value: string | number | null | undefined): string => {
      const str = String(value ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    const dataRows = [...byUser.values()]
      .map((r) => {
        const ts = tsByUser.get(r.user.id) ?? { billableHours: 0, nonBillableHours: 0 };
        const leave = leaveByUser.get(r.user.id) ?? { paidDays: 0, unpaidDays: 0 };
        const normalHours = Number((r.normalMinutes / 60).toFixed(2));
        const overtimeHours = Number((r.overtimeMinutes / 60).toFixed(2));
        const hourlyRate = Number(r.user.employeeProfile?.hourlyRate ?? 0);
        const grossPay =
          hourlyRate > 0
            ? Number(((normalHours + overtimeHours * 1.25) * hourlyRate).toFixed(2))
            : null;
        return {
          employeeNumber: r.user.employeeProfile?.employeeNumber ?? '',
          lastName: r.user.lastName,
          firstName: r.user.firstName,
          email: r.user.email,
          jobTitle: r.user.employeeProfile?.jobTitle ?? '',
          periodStart: startDate.toISOString().slice(0, 10),
          periodEnd: endDate.toISOString().slice(0, 10),
          workedDays: r.workedDays,
          normalHours,
          overtimeHours,
          billableHours: ts.billableHours,
          nonBillableHours: ts.nonBillableHours,
          paidLeaveDays: leave.paidDays,
          unpaidLeaveDays: leave.unpaidDays,
          publicHolidays: holidayCount,
          hourlyRate: hourlyRate || null,
          estimatedGrossPay: grossPay,
        };
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName));

    const headers = [
      'Matricule', 'Nom', 'Prénom', 'Email', 'Poste',
      'Période début', 'Période fin',
      'Jours travaillés', 'Heures normales', 'Heures supplémentaires',
      'Heures facturables', 'Heures internes',
      'Congés payés (j)', 'Congés non payés (j)', 'Jours fériés',
      'Taux horaire', 'Brut estimé',
    ];

    const csv = [
      headers.map(csvEscape).join(','),
      ...dataRows.map((r) =>
        [
          r.employeeNumber, r.lastName, r.firstName, r.email, r.jobTitle,
          r.periodStart, r.periodEnd,
          r.workedDays, r.normalHours, r.overtimeHours,
          r.billableHours, r.nonBillableHours,
          r.paidLeaveDays, r.unpaidLeaveDays, r.publicHolidays,
          r.hourlyRate ?? '', r.estimatedGrossPay ?? '',
        ]
          .map(csvEscape)
          .join(','),
      ),
    ].join('\r\n');

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'report.payroll_export',
      entityType: 'PayrollExport',
      metadata: filters as Prisma.InputJsonValue,
    });

    return {
      filename: `export-paie-${startDate.toISOString().slice(0, 7)}.csv`,
      contentType: 'text/csv; charset=utf-8',
      content: csv,
      summary: {
        employees: dataRows.length,
        totalNormalHours: Number(dataRows.reduce((s, r) => s + r.normalHours, 0).toFixed(2)),
        totalOvertimeHours: Number(dataRows.reduce((s, r) => s + r.overtimeHours, 0).toFixed(2)),
      },
    };
  }

  // ─── Rapport 5 : Retards & anomalies GPS ─────────────────────────────────────

  async lateAndGpsAnomalies(user: CurrentUserContext, filters: ReportFilterDto) {
    const tenantId = user.tenantId ?? '__missing__';
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    const userIdFilter = this.buildUserIdFilter(managedUserIds, filters.userId);

    const startDate = filters.startDate ? new Date(filters.startDate) : this.firstDayOfCurrentMonth();
    const endDate = filters.endDate ? new Date(filters.endDate) : this.lastDayOfCurrentMonth();

    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    const workDayStart = settings?.workDayStartTime ?? '08:00';
    const lateToleranceMinutes = settings?.lateToleranceMinutes ?? 15;
    const lateThresholdMinutes = this.minutesFromTime(workDayStart) + lateToleranceMinutes;

    const punches = await this.prisma.attendancePunch.findMany({
      where: {
        ...(user.role === UserRole.SUPER_ADMIN ? {} : { tenantId }),
        userId: userIdFilter,
        siteId: filters.siteId ?? undefined,
        punchDate: { gte: startDate, lte: endDate },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        site: { select: { id: true, code: true, name: true } },
      },
      orderBy: { punchDate: 'desc' },
    });

    const totalPunches = punches.length;

    type LateAcc = { user: typeof punches[0]['user']; count: number; totalDelayMinutes: number };
    const lateByEmployee = new Map<string, LateAcc>();
    const gpsAnomaliesList: Array<{
      employee: string;
      email: string;
      site: string | null;
      punchDate: string;
      checkInAt: string;
    }> = [];
    type SiteGps = { site: typeof punches[0]['site']; anomalies: number; total: number };
    const gpsBySite = new Map<string, SiteGps>();

    for (const p of punches) {
      if (p.checkInAt) {
        const checkInMinutes = p.checkInAt.getUTCHours() * 60 + p.checkInAt.getUTCMinutes();
        if (checkInMinutes > lateThresholdMinutes) {
          if (!lateByEmployee.has(p.userId))
            lateByEmployee.set(p.userId, { user: p.user, count: 0, totalDelayMinutes: 0 });
          const row = lateByEmployee.get(p.userId)!;
          row.count += 1;
          row.totalDelayMinutes += checkInMinutes - lateThresholdMinutes;
        }
      }

      if (p.siteId) {
        if (!gpsBySite.has(p.siteId)) gpsBySite.set(p.siteId, { site: p.site, anomalies: 0, total: 0 });
        const siteRow = gpsBySite.get(p.siteId)!;
        siteRow.total += 1;
        if (p.isGpsAnomaly) {
          siteRow.anomalies += 1;
          gpsAnomaliesList.push({
            employee: `${p.user.firstName} ${p.user.lastName}`,
            email: p.user.email,
            site: p.site?.name ?? null,
            punchDate: p.punchDate.toISOString().slice(0, 10),
            checkInAt: p.checkInAt?.toISOString() ?? '',
          });
        }
      }
    }

    const openPunches = punches
      .filter((p) => p.checkInAt && !p.checkOutAt)
      .map((p) => ({
        employee: `${p.user.firstName} ${p.user.lastName}`,
        email: p.user.email,
        site: p.site?.name ?? null,
        checkInAt: p.checkInAt!.toISOString(),
        punchDate: p.punchDate.toISOString().slice(0, 10),
      }));

    const totalGpsAnomalies = gpsAnomaliesList.length;

    return {
      period: { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) },
      lateThreshold: `${workDayStart} + ${lateToleranceMinutes} min`,
      lateArrivals: {
        total: [...lateByEmployee.values()].reduce((s, r) => s + r.count, 0),
        byEmployee: [...lateByEmployee.values()]
          .map((r) => ({
            name: `${r.user.firstName} ${r.user.lastName}`,
            email: r.user.email,
            count: r.count,
            avgDelayMinutes: Math.round(r.totalDelayMinutes / r.count),
          }))
          .sort((a, b) => b.count - a.count),
      },
      gpsAnomalies: {
        total: totalGpsAnomalies,
        anomalyRate: totalPunches > 0 ? Number(((totalGpsAnomalies / totalPunches) * 100).toFixed(1)) : 0,
        bySite: [...gpsBySite.values()]
          .map((r) => ({
            site: r.site ? { code: r.site.code, name: r.site.name } : null,
            anomalies: r.anomalies,
            total: r.total,
            rate: r.total > 0 ? Number(((r.anomalies / r.total) * 100).toFixed(1)) : 0,
          }))
          .sort((a, b) => b.anomalies - a.anomalies),
        detail: gpsAnomaliesList.slice(0, filters.take ?? 100),
      },
      openPunches,
    };
  }

  // ─── Rapport 6 : Tableau de bord RH mensuel ──────────────────────────────────

  async hrDashboard(user: CurrentUserContext, filters: ReportFilterDto) {
    const tenantId = user.tenantId ?? '__missing__';
    const tenantWhere = this.tenantWhere(user);
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    const userScope = managedUserIds ? { userId: { in: managedUserIds } } : {};

    const startDate = filters.startDate ? new Date(filters.startDate) : this.firstDayOfCurrentMonth();
    const endDate = filters.endDate ? new Date(filters.endDate) : this.lastDayOfCurrentMonth();

    const holidays = await this.prisma.holiday.findMany({
      where: { ...(user.role === UserRole.SUPER_ADMIN ? {} : { tenantId }), date: { gte: startDate, lte: endDate } },
      select: { date: true },
    });
    const holidayKeys = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
    const workingDays = this.countWorkingDays(startDate, endDate, holidayKeys);

    const [
      activeEmployees,
      newHires,
      punchAgg,
      leaveAgg,
      leaveByType,
      pendingLeave,
      timesheetStats,
      gpsAnomalyCount,
      totalPunches,
    ] = await Promise.all([
      this.prisma.employeeProfile.count({ where: { ...tenantWhere, ...userScope, status: 'ACTIVE' } }),
      this.prisma.employeeProfile.count({
        where: { ...tenantWhere, ...userScope, status: 'ACTIVE', hireDate: { gte: startDate, lte: endDate } },
      }),
      this.prisma.attendancePunch.aggregate({
        where: { ...tenantWhere, ...userScope, punchDate: { gte: startDate, lte: endDate } },
        _sum: { durationMinutes: true },
        _count: { id: true },
      }),
      this.prisma.leaveRequest.aggregate({
        where: { ...tenantWhere, ...userScope, status: 'APPROVED', startDate: { lte: endDate }, endDate: { gte: startDate } },
        _sum: { durationDays: true },
      }),
      this.prisma.leaveRequest.groupBy({
        by: ['leaveTypeId'],
        where: { ...tenantWhere, ...userScope, status: 'APPROVED', startDate: { lte: endDate }, endDate: { gte: startDate } },
        _sum: { durationDays: true },
      }),
      this.prisma.leaveRequest.count({
        where: { ...tenantWhere, ...userScope, status: { in: ['SUBMITTED', 'N1_APPROVED'] } },
      }),
      this.prisma.timesheet.groupBy({
        by: ['status'],
        where: { ...tenantWhere, ...userScope, periodStart: { gte: startDate }, periodEnd: { lte: endDate } },
        _count: { id: true },
      }),
      this.prisma.attendancePunch.count({
        where: { ...tenantWhere, ...userScope, isGpsAnomaly: true, punchDate: { gte: startDate, lte: endDate } },
      }),
      this.prisma.attendancePunch.count({
        where: { ...tenantWhere, ...userScope, punchDate: { gte: startDate, lte: endDate } },
      }),
    ]);

    const leaveTypeIds = leaveByType.map((r) => r.leaveTypeId);
    const leaveTypes = leaveTypeIds.length
      ? await this.prisma.leaveType.findMany({
          where: { id: { in: leaveTypeIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const leaveTypeMap = new Map(leaveTypes.map((lt) => [lt.id, lt]));

    const timesheetTotal = timesheetStats.reduce((s, r) => s + r._count.id, 0);
    const timesheetApproved = timesheetStats.find((r) => r.status === 'APPROVED')?._count.id ?? 0;
    const timesheetPending = timesheetStats
      .filter((r) => r.status === 'SUBMITTED' || r.status === 'N1_APPROVED')
      .reduce((s, r) => s + r._count.id, 0);
    const timesheetRejected = timesheetStats.find((r) => r.status === 'REJECTED')?._count.id ?? 0;

    const totalHours = Number(((punchAgg._sum.durationMinutes ?? 0) / 60).toFixed(2));
    const expectedHoursPerEmployee = workingDays * 8;
    const attendanceRate =
      activeEmployees > 0 && expectedHoursPerEmployee > 0
        ? Number(((totalHours / (activeEmployees * expectedHoursPerEmployee)) * 100).toFixed(1))
        : 0;

    // Employés sans timesheet sur la période
    const usersWithTimesheetRaw = await this.prisma.timesheet.findMany({
      where: { ...tenantWhere, ...userScope, periodStart: { gte: startDate }, periodEnd: { lte: endDate } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const usersWithTimesheetIds = new Set(usersWithTimesheetRaw.map((t) => t.userId));
    const withoutTimesheetCount = managedUserIds
      ? managedUserIds.filter((id) => !usersWithTimesheetIds.has(id)).length
      : 0;

    const openPunchCount = await this.prisma.attendancePunch.groupBy({
      by: ['userId'],
      where: { ...tenantWhere, ...userScope, checkOutAt: null, checkInAt: { not: null } },
    }).then((r) => r.length);

    return {
      period: {
        start: startDate.toISOString().slice(0, 10),
        end: endDate.toISOString().slice(0, 10),
        workingDays,
      },
      workforce: { activeEmployees, newHires },
      attendance: {
        totalHoursWorked: totalHours,
        avgHoursPerEmployee: activeEmployees > 0 ? Number((totalHours / activeEmployees).toFixed(2)) : 0,
        attendanceRate,
        totalGpsAnomalies: gpsAnomalyCount,
        gpsAnomalyRate: totalPunches > 0 ? Number(((gpsAnomalyCount / totalPunches) * 100).toFixed(1)) : 0,
      },
      leave: {
        totalDaysTaken: Number(leaveAgg._sum.durationDays ?? 0),
        pendingRequests: pendingLeave,
        byType: leaveByType
          .map((r) => ({
            code: leaveTypeMap.get(r.leaveTypeId)?.code ?? r.leaveTypeId,
            name: leaveTypeMap.get(r.leaveTypeId)?.name ?? r.leaveTypeId,
            days: Number(r._sum.durationDays ?? 0),
          }))
          .sort((a, b) => b.days - a.days),
      },
      timesheets: {
        total: timesheetTotal,
        approved: timesheetApproved,
        pending: timesheetPending,
        rejected: timesheetRejected,
        submissionRate:
          activeEmployees > 0 ? Number(((timesheetTotal / activeEmployees) * 100).toFixed(1)) : 0,
        approvalRate:
          timesheetTotal > 0 ? Number(((timesheetApproved / timesheetTotal) * 100).toFixed(1)) : 0,
      },
      compliance: {
        employeesWithoutTimesheet: withoutTimesheetCount,
        employeesWithOpenPunch: openPunchCount,
      },
    };
  }

  // ─── Anciens rapports conservés avec pagination ───────────────────────────────

  async attendance(user: CurrentUserContext, filters: ReportFilterDto) {
    const take = Math.min(filters.take ?? 100, 500);
    const skip = filters.skip ?? 0;
    return this.prisma.attendancePunch.findMany({
      where: await this.attendanceWhere(user, filters),
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        site: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ punchDate: 'desc' }, { checkInAt: 'desc' }],
      take,
      skip,
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
    const take = Math.min(filters.take ?? 100, 500);
    const skip = filters.skip ?? 0;
    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        ...this.tenantWhere(user),
        userId: await this.userIdFilter(user, filters.userId),
        status: filters.status as never,
        periodStart: filters.startDate ? { gte: new Date(filters.startDate) } : undefined,
        periodEnd: filters.endDate ? { lte: new Date(filters.endDate) } : undefined,
        lines: filters.siteId ? { some: { siteId: filters.siteId } } : undefined,
      },
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true, email: true,
            employeeProfile: { select: { employeeNumber: true, jobTitle: true } },
          },
        },
        lines: {
          where: filters.siteId ? { siteId: filters.siteId } : undefined,
          include: {
            entries: { orderBy: { entryDate: 'asc' } },
            site: { select: { code: true, name: true, project: { select: { code: true, name: true } } } },
          },
        },
      },
      orderBy: { periodStart: 'desc' },
      take,
      skip,
    });

    return this.withTimesheetMetrics(timesheets);
  }

  async leave(user: CurrentUserContext, filters: ReportFilterDto) {
    const take = Math.min(filters.take ?? 100, 500);
    const skip = filters.skip ?? 0;
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
      take,
      skip,
    });
  }

  async gpsAnomalies(user: CurrentUserContext, filters: ReportFilterDto) {
    const take = Math.min(filters.take ?? 100, 500);
    const skip = filters.skip ?? 0;
    return this.prisma.attendancePunch.findMany({
      where: { ...(await this.attendanceWhere(user, filters)), isGpsAnomaly: true },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        site: { select: { code: true, name: true, latitude: true, longitude: true, gpsRadiusMeters: true } },
      },
      orderBy: { punchDate: 'desc' },
      take,
      skip,
    });
  }

  // ─── Helpers privés ───────────────────────────────────────────────────────────

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
    return this.buildUserIdFilter(managedUserIds, requestedUserId);
  }

  private buildUserIdFilter(
    managedUserIds: string[] | undefined,
    requestedUserId?: string,
  ): Prisma.StringFilter | string | undefined {
    if (!managedUserIds) return requestedUserId;
    if (requestedUserId) {
      return managedUserIds.includes(requestedUserId) ? requestedUserId : '__forbidden__';
    }
    return { in: managedUserIds };
  }

  private tenantWhere(user: CurrentUserContext): Record<string, unknown> {
    return user.role === UserRole.SUPER_ADMIN ? {} : { tenantId: user.tenantId ?? '__missing__' };
  }

  private async withTimesheetMetrics(timesheets: Array<{
    id: string;
    tenantId: string;
    userId: string;
    periodStart: Date;
    periodEnd: Date;
    lines: Array<{
      billingType: string;
      entries: Array<{ entryDate: Date; hours: unknown }>;
    }>;
  }>) {
    if (!timesheets.length) return timesheets;

    const tenantIds = [...new Set(timesheets.map((timesheet) => timesheet.tenantId))];
    const userIds = [...new Set(timesheets.map((timesheet) => timesheet.userId))];
    const minStart = new Date(Math.min(...timesheets.map((timesheet) => timesheet.periodStart.getTime())));
    const maxEnd = new Date(Math.max(...timesheets.map((timesheet) => timesheet.periodEnd.getTime())));

    const [settings, leaves, holidays] = await Promise.all([
      this.prisma.tenantSettings.findMany({
        where: { tenantId: { in: tenantIds } },
        select: { tenantId: true, overtimeTriggerHours: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          tenantId: { in: tenantIds },
          userId: { in: userIds },
          status: 'APPROVED',
          startDate: { lte: maxEnd },
          endDate: { gte: minStart },
        },
        select: {
          tenantId: true,
          userId: true,
          startDate: true,
          endDate: true,
          durationDays: true,
          leaveType: { select: { isPaid: true } },
        },
      }),
      this.prisma.holiday.findMany({
        where: {
          tenantId: { in: tenantIds },
          date: { gte: minStart, lte: maxEnd },
        },
        select: { tenantId: true, date: true },
      }),
    ]);

    const overtimeByTenant = new Map(settings.map((item) => [item.tenantId, item.overtimeTriggerHours || 8]));

    return timesheets.map((timesheet) => {
      const overtimeTriggerHours = overtimeByTenant.get(timesheet.tenantId) ?? 8;
      const metrics = this.calculateTimesheetMetrics({
        timesheet,
        overtimeTriggerHours,
        leaves: leaves.filter(
          (leave) =>
            leave.tenantId === timesheet.tenantId &&
            leave.userId === timesheet.userId &&
            leave.startDate <= timesheet.periodEnd &&
            leave.endDate >= timesheet.periodStart,
        ),
        holidays: holidays.filter(
          (holiday) =>
            holiday.tenantId === timesheet.tenantId &&
            holiday.date >= timesheet.periodStart &&
            holiday.date <= timesheet.periodEnd,
        ),
      });

      return { ...timesheet, metrics };
    });
  }

  private calculateTimesheetMetrics(input: {
    timesheet: {
      lines: Array<{
        billingType: string;
        entries: Array<{ entryDate: Date; hours: unknown }>;
      }>;
      periodStart: Date;
      periodEnd: Date;
    };
    overtimeTriggerHours: number;
    leaves: Array<{ startDate: Date; endDate: Date; durationDays: unknown; leaveType: { isPaid: boolean } }>;
    holidays: Array<{ date: Date }>;
  }) {
    const dayTotals = new Map<string, number>();
    let totalHours = 0;
    let billableHours = 0;
    let nonBillableHours = 0;

    for (const line of input.timesheet.lines) {
      for (const entry of line.entries ?? []) {
        const hours = Number(entry.hours ?? 0);
        const dayKey = entry.entryDate.toISOString().slice(0, 10);
        dayTotals.set(dayKey, Number(((dayTotals.get(dayKey) ?? 0) + hours).toFixed(2)));
        totalHours += hours;
        if (line.billingType === 'BILLABLE') billableHours += hours;
        else nonBillableHours += hours;
      }
    }

    let normalHours = 0;
    let overtimeHours = 0;
    for (const dayHours of dayTotals.values()) {
      const normal = input.overtimeTriggerHours > 0 ? Math.min(dayHours, input.overtimeTriggerHours) : dayHours;
      normalHours += normal;
      overtimeHours += Math.max(0, dayHours - normal);
    }

    const leaveDays = input.leaves.reduce((sum, leave) => {
      const overlapDays = this.overlapCalendarDays(
        input.timesheet.periodStart,
        input.timesheet.periodEnd,
        leave.startDate,
        leave.endDate,
      );
      return sum + Math.min(Number(leave.durationDays ?? 0), overlapDays);
    }, 0);

    const paidLeaveDays = input.leaves.reduce((sum, leave) => {
      if (!leave.leaveType.isPaid) return sum;
      const overlapDays = this.overlapCalendarDays(
        input.timesheet.periodStart,
        input.timesheet.periodEnd,
        leave.startDate,
        leave.endDate,
      );
      return sum + Math.min(Number(leave.durationDays ?? 0), overlapDays);
    }, 0);

    return {
      overtimeTriggerHours: input.overtimeTriggerHours,
      totalHours: Number(totalHours.toFixed(2)),
      normalHours: Number(normalHours.toFixed(2)),
      overtimeHours: Number(overtimeHours.toFixed(2)),
      billableHours: Number(billableHours.toFixed(2)),
      nonBillableHours: Number(nonBillableHours.toFixed(2)),
      leaveDays: Number(leaveDays.toFixed(2)),
      paidLeaveDays: Number(paidLeaveDays.toFixed(2)),
      unpaidLeaveDays: Number((leaveDays - paidLeaveDays).toFixed(2)),
      publicHolidays: input.holidays.length,
      lineCount: input.timesheet.lines.length,
    };
  }

  private overlapCalendarDays(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    const start = new Date(Math.max(aStart.getTime(), bStart.getTime()));
    const end = new Date(Math.min(aEnd.getTime(), bEnd.getTime()));
    if (end < start) return 0;

    const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    return Math.floor((endUtc - startUtc) / 86_400_000) + 1;
  }

  private countWorkingDays(start: Date, end: Date, holidayKeys: Set<string>): number {
    let count = 0;
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = d.getUTCDay();
      if (day !== 0 && day !== 6 && !holidayKeys.has(d.toISOString().slice(0, 10))) count++;
    }
    return count;
  }

  private minutesFromTime(value: string): number {
    const [hourRaw = '8', minuteRaw = '0'] = value.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    return (Number.isFinite(hour) ? hour : 8) * 60 + (Number.isFinite(minute) ? minute : 0);
  }

  private isoWeek(date: Date): string {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  private firstDayOfCurrentMonth(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private lastDayOfCurrentMonth(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  }
}
