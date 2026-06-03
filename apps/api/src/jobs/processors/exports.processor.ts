import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Readable } from 'stream';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';

type ExportPayload = {
  tenantId: string;
  type: 'attendance' | 'timesheets' | 'leave' | 'payroll';
  from?: string;
  to?: string;
  requestedByUserId?: string;
};

@Processor('exports')
export class ExportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<ExportPayload>): Promise<{ key: string; url: string }> {
    const { tenantId, type, from, to } = job.data;
    this.logger.log(`[exports] Processing job ${job.id} — type=${type} tenant=${tenantId}`);

    const rows = await this.fetchRows(tenantId, type, from, to);
    const csv = this.toCsv(rows);
    const filename = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    const key = this.storage.documentKey(tenantId, 'exports', filename);

    const buf = Buffer.from(csv, 'utf-8');
    const readable = Readable.from(buf);

    await this.storage.client.putObject(this.storage.bucket, key, readable, buf.length, {
      'Content-Type': 'text/csv',
    });

    const url = await this.storage.client.presignedGetObject(this.storage.bucket, key, 3600);
    this.logger.log(`[exports] Job ${job.id} done — key=${key}`);
    return { key, url };
  }

  // ─── Data fetchers ────────────────────────────────────────────────────────

  private async fetchRows(
    tenantId: string,
    type: ExportPayload['type'],
    from?: string,
    to?: string,
  ): Promise<Record<string, string | number | boolean | null>[]> {
    const dateFilter =
      from && to
        ? { gte: new Date(from), lte: new Date(to) }
        : undefined;

    if (type === 'attendance') {
      const records = await this.prisma.attendancePunch.findMany({
        where: {
          tenantId,
          ...(dateFilter ? { punchDate: dateFilter } : {}),
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          site: { select: { code: true, name: true } },
        },
        orderBy: { punchDate: 'asc' },
        take: 5000,
      });
      return records.map((r) => ({
        date: r.punchDate.toISOString().slice(0, 10),
        employee: `${r.user.firstName} ${r.user.lastName}`,
        email: r.user.email,
        site: r.site?.name ?? '',
        site_code: r.site?.code ?? '',
        check_in: r.checkInAt?.toISOString() ?? '',
        check_out: r.checkOutAt?.toISOString() ?? '',
        duration_minutes: r.durationMinutes ?? '',
        location: r.workLocation,
        gps_anomaly: r.isGpsAnomaly ? 'true' : 'false',
        status: r.status,
      }));
    }

    if (type === 'timesheets') {
      const records = await this.prisma.timesheet.findMany({
        where: {
          tenantId,
          ...(dateFilter ? { periodStart: dateFilter } : {}),
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          lines: { include: { entries: true } },
        },
        orderBy: { periodStart: 'asc' },
        take: 5000,
      });
      const rows: Record<string, string | number | boolean | null>[] = [];
      for (const ts of records) {
        const totalHours = ts.lines
          .flatMap((l) => l.entries)
          .reduce((acc, e) => acc + Number(e.hours), 0);
        rows.push({
          period_start: ts.periodStart.toISOString().slice(0, 10),
          period_end: ts.periodEnd.toISOString().slice(0, 10),
          employee: `${ts.user.firstName} ${ts.user.lastName}`,
          email: ts.user.email,
          total_hours: totalHours,
          status: ts.status,
          submitted_at: ts.submittedAt?.toISOString() ?? '',
          approved_at: ts.approvedAt?.toISOString() ?? '',
        });
      }
      return rows;
    }

    if (type === 'leave') {
      const records = await this.prisma.leaveRequest.findMany({
        where: {
          tenantId,
          ...(dateFilter ? { startDate: dateFilter } : {}),
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          leaveType: { select: { name: true, code: true } },
        },
        orderBy: { startDate: 'asc' },
        take: 5000,
      });
      return records.map((r) => ({
        employee: `${r.user.firstName} ${r.user.lastName}`,
        email: r.user.email,
        leave_type: r.leaveType.name,
        leave_code: r.leaveType.code,
        start_date: r.startDate.toISOString().slice(0, 10),
        end_date: r.endDate.toISOString().slice(0, 10),
        duration_days: Number(r.durationDays),
        status: r.status,
        submitted_at: r.submittedAt?.toISOString() ?? '',
        approved_at: r.approvedAt?.toISOString() ?? '',
      }));
    }

    // payroll — heures totales par employé et par période (timesheets approuvées ou soumises)
    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        tenantId,
        status: { in: ['APPROVED', 'SUBMITTED'] },
        ...(dateFilter ? { periodStart: dateFilter } : {}),
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        lines: { include: { entries: true } },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { periodStart: 'asc' }],
      take: 5000,
    });
    return timesheets.map((ts) => {
      const totalHours = ts.lines
        .flatMap((l) => l.entries)
        .reduce((acc, e) => acc + Number(e.hours), 0);
      return {
        employee: `${ts.user.firstName} ${ts.user.lastName}`,
        email: ts.user.email,
        period_start: ts.periodStart.toISOString().slice(0, 10),
        period_end: ts.periodEnd.toISOString().slice(0, 10),
        total_hours: totalHours,
        status: ts.status,
        submitted_at: ts.submittedAt?.toISOString() ?? '',
        approved_at: ts.approvedAt?.toISOString() ?? '',
      };
    });
  }

  // ─── CSV serializer ───────────────────────────────────────────────────────

  private toCsv(rows: Record<string, string | number | boolean | null>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]!);
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','),
      ),
    ];
    return lines.join('\n');
  }
}
