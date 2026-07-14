import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

type ReportPayload = {
  tenantId: string;
  reportType:
    | 'attendance-daily'
    | 'hours-by-employee'
    | 'hours-by-site'
    | 'leave-summary'
    | 'gps-anomalies';
  from: string;
  to: string;
};

type ReportResult = {
  reportType: string;
  from: string;
  to: string;
  generatedAt: string;
  data: unknown[];
};

@Processor('reports')
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ReportPayload>): Promise<ReportResult> {
    const { tenantId, reportType, from, to } = job.data;
    this.logger.log(
      `[reports] Processing job ${job.id} — type=${reportType} tenant=${tenantId}`,
    );

    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    let data: unknown[] = [];

    switch (reportType) {
      case 'attendance-daily':
        data = await this.attendanceDaily(tenantId, dateFrom, dateTo);
        break;
      case 'hours-by-employee':
        data = await this.hoursByEmployee(tenantId, dateFrom, dateTo);
        break;
      case 'hours-by-site':
        data = await this.hoursBySite(tenantId, dateFrom, dateTo);
        break;
      case 'leave-summary':
        data = await this.leaveSummary(tenantId, dateFrom, dateTo);
        break;
      case 'gps-anomalies':
        data = await this.gpsAnomalies(tenantId, dateFrom, dateTo);
        break;
    }

    const result: ReportResult = {
      reportType,
      from,
      to,
      generatedAt: new Date().toISOString(),
      data,
    };

    this.logger.log(`[reports] Job ${job.id} done — ${data.length} rows`);
    return result;
  }

  // ─── Report implementations ───────────────────────────────────────────────

  private async attendanceDaily(tenantId: string, from: Date, to: Date) {
    const punches = await this.prisma.attendancePunch.findMany({
      where: { tenantId, punchDate: { gte: from, lte: to } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        site: { select: { code: true, name: true } },
      },
      orderBy: { punchDate: 'asc' },
    });

    return punches.map((p) => ({
      date: p.punchDate.toISOString().slice(0, 10),
      employee: `${p.user.firstName} ${p.user.lastName}`,
      site: p.site?.name ?? '',
      check_in: p.checkInAt?.toISOString().slice(11, 16) ?? null,
      check_out: p.checkOutAt?.toISOString().slice(11, 16) ?? null,
      duration_minutes: p.durationMinutes ?? null,
      status: p.status,
    }));
  }

  private async hoursByEmployee(tenantId: string, from: Date, to: Date) {
    const entries = await this.prisma.timesheetDayEntry.findMany({
      where: { tenantId, entryDate: { gte: from, lte: to } },
      include: {
        timesheetLine: {
          include: {
            timesheet: {
              include: { user: { select: { firstName: true, lastName: true, email: true } } },
            },
          },
        },
      },
    });

    const byEmployee = new Map<
      string,
      { name: string; email: string; total_hours: number; billable_hours: number }
    >();

    for (const entry of entries) {
      const user = entry.timesheetLine.timesheet.user;
      const key = user.email;
      if (!byEmployee.has(key)) {
        byEmployee.set(key, {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          total_hours: 0,
          billable_hours: 0,
        });
      }
      const rec = byEmployee.get(key)!;
      const hours = Number(entry.hours);
      rec.total_hours += hours;
      if (entry.timesheetLine.billingType === 'BILLABLE') {
        rec.billable_hours += hours;
      }
    }

    return Array.from(byEmployee.values()).sort((a, b) =>
      b.total_hours - a.total_hours,
    );
  }

  private async hoursBySite(tenantId: string, from: Date, to: Date) {
    const lines = await this.prisma.timesheetLine.findMany({
      where: { tenantId, timesheet: { periodStart: { gte: from }, periodEnd: { lte: to } } },
      include: {
        site: { select: { code: true, name: true } },
        entries: true,
      },
    });

    const bySite = new Map<
      string,
      { code: string; name: string; total_hours: number; billable_hours: number }
    >();

    for (const line of lines) {
      const key = line.siteId ?? '__no_site__';
      if (!bySite.has(key)) {
        bySite.set(key, {
          code: line.site?.code ?? '',
          name: line.site?.name ?? '(Sans site)',
          total_hours: 0,
          billable_hours: 0,
        });
      }
      const rec = bySite.get(key)!;
      for (const entry of line.entries) {
        const h = Number(entry.hours);
        rec.total_hours += h;
        if (line.billingType === 'BILLABLE') rec.billable_hours += h;
      }
    }

    return Array.from(bySite.values()).sort((a, b) => b.total_hours - a.total_hours);
  }

  private async leaveSummary(tenantId: string, from: Date, to: Date) {
    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        startDate: { gte: from },
        endDate: { lte: to },
        status: 'APPROVED',
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        leaveType: { select: { name: true, code: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    return requests.map((r) => ({
      employee: `${r.user.firstName} ${r.user.lastName}`,
      leave_type: r.leaveType.name,
      leave_code: r.leaveType.code,
      start_date: r.startDate.toISOString().slice(0, 10),
      end_date: r.endDate.toISOString().slice(0, 10),
      duration_days: Number(r.durationDays),
    }));
  }

  private async gpsAnomalies(tenantId: string, from: Date, to: Date) {
    const punches = await this.prisma.attendancePunch.findMany({
      where: { tenantId, punchDate: { gte: from, lte: to }, isGpsAnomaly: true },
      include: {
        user: { select: { firstName: true, lastName: true } },
        site: { select: { code: true, name: true } },
      },
      orderBy: { punchDate: 'asc' },
    });

    return punches.map((p) => ({
      date: p.punchDate.toISOString().slice(0, 10),
      employee: `${p.user.firstName} ${p.user.lastName}`,
      site: p.site?.name ?? '',
      check_in_lat: p.checkInLatitude?.toString() ?? null,
      check_in_lng: p.checkInLongitude?.toString() ?? null,
      status: p.status,
    }));
  }
}
