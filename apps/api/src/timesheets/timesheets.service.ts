import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, TimesheetStatus, UserRole, WorkLocation } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { HierarchyService } from '../common/hierarchy.service';
import { CurrentUserContext } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { TimesheetLineDto } from './dto/timesheet-line-entry.dto';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto';

@Injectable()
export class TimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly hierarchy: HierarchyService,
  ) {}

  async findAll(user: CurrentUserContext, filters: { status?: TimesheetStatus; periodStart?: string; periodEnd?: string }) {
    return this.prisma.timesheet.findMany({
      where: {
        ...(await this.scope(user)),
        status: filters.status,
        periodStart: filters.periodStart ? { gte: new Date(filters.periodStart) } : undefined,
        periodEnd: filters.periodEnd ? { lte: new Date(filters.periodEnd) } : undefined,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        lines: { include: { entries: true, site: { select: { id: true, code: true, name: true } } } },
      },
      orderBy: { periodStart: 'desc' },
      take: 150,
    });
  }

  async create(user: CurrentUserContext, dto: CreateTimesheetDto) {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant scope is required');
    }

    const ownerId = dto.userId && user.role !== UserRole.EMPLOYEE ? dto.userId : user.userId;
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    if (managedUserIds && !managedUserIds.includes(ownerId)) {
      throw new ForbiddenException('You can create timesheets only for your own team');
    }

    return this.prisma.timesheet.create({
      data: {
        tenantId: user.tenantId,
        userId: ownerId,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
      },
      include: { lines: { include: { entries: true } } },
    });
  }

  async findOne(user: CurrentUserContext, id: string) {
    return this.prisma.timesheet.findFirstOrThrow({
      where: { id, ...(await this.scope(user)) },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        rejectedBy: { select: { id: true, firstName: true, lastName: true } },
        lines: {
          include: {
            site: { select: { id: true, code: true, name: true, project: { select: { id: true, code: true, name: true } } } },
            entries: { orderBy: { entryDate: 'asc' } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async update(user: CurrentUserContext, id: string, dto: UpdateTimesheetDto) {
    const timesheet = await this.prisma.timesheet.findFirstOrThrow({
      where: { id, ...(await this.scope(user)) },
      include: { lines: true },
    });

    if (timesheet.status !== TimesheetStatus.DRAFT && timesheet.status !== TimesheetStatus.REOPENED) {
      throw new BadRequestException('Approved or submitted timesheets are locked');
    }

    if (user.role === UserRole.EMPLOYEE && timesheet.userId !== user.userId) {
      throw new ForbiddenException('Employees can update only their own timesheets');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.timesheetLine.deleteMany({ where: { timesheetId: id } });
      for (const line of dto.lines) {
        await this.createLineWithEntries(tx, timesheet.tenantId, id, line);
      }
    });

    await this.auditLog.log({
      tenantId: timesheet.tenantId,
      userId: user.userId,
      action: 'timesheet.updated',
      entityType: 'Timesheet',
      entityId: id,
    });

    return this.findOne(user, id);
  }

  submit(user: CurrentUserContext, id: string) {
    return this.transition(user, id, TimesheetStatus.SUBMITTED, 'timesheet.submitted');
  }

  approve(user: CurrentUserContext, id: string) {
    return this.transition(user, id, TimesheetStatus.APPROVED, 'timesheet.approved');
  }

  reject(user: CurrentUserContext, id: string, reason: string) {
    return this.transition(user, id, TimesheetStatus.REJECTED, 'timesheet.rejected', reason);
  }

  reopen(user: CurrentUserContext, id: string) {
    return this.transition(user, id, TimesheetStatus.REOPENED, 'timesheet.reopened');
  }

  private async transition(
    user: CurrentUserContext,
    id: string,
    nextStatus: TimesheetStatus,
    action: string,
    comment?: string,
  ) {
    const timesheet = await this.prisma.timesheet.findFirstOrThrow({
      where: { id, ...(await this.scope(user)) },
      include: { user: true, lines: { select: { siteId: true } } },
    });

    if (nextStatus === TimesheetStatus.SUBMITTED && timesheet.userId !== user.userId) {
      throw new ForbiddenException('Only owner can submit the timesheet');
    }
    this.assertTransition(timesheet.status, nextStatus);

    const effectiveStatus = await this.resolveApprovalStatus(user, timesheet, nextStatus);
    const effectiveAction = effectiveStatus === TimesheetStatus.N1_APPROVED ? 'timesheet.n1_approved' : action;

    const updated = await this.prisma.timesheet.update({
      where: { id },
      data: {
        status: effectiveStatus,
        submittedAt: effectiveStatus === TimesheetStatus.SUBMITTED ? new Date() : timesheet.submittedAt,
        approvedById: effectiveStatus === TimesheetStatus.APPROVED ? user.userId : timesheet.approvedById,
        approvedAt: effectiveStatus === TimesheetStatus.APPROVED ? new Date() : timesheet.approvedAt,
        rejectedById: effectiveStatus === TimesheetStatus.REJECTED ? user.userId : null,
        rejectedAt: effectiveStatus === TimesheetStatus.REJECTED ? new Date() : null,
        rejectionReason: effectiveStatus === TimesheetStatus.REJECTED ? comment : null,
      },
      include: { user: true },
    });

    await this.prisma.approvalAction.create({
      data: {
        tenantId: timesheet.tenantId,
        entityType: 'TIMESHEET',
        entityId: timesheet.id,
        actionById: user.userId,
        oldStatus: timesheet.status,
        newStatus: effectiveStatus,
        comment,
      },
    });

    await this.auditLog.log({
      tenantId: timesheet.tenantId,
      userId: user.userId,
      action: effectiveAction,
      entityType: 'Timesheet',
      entityId: id,
      metadata: { oldStatus: timesheet.status, newStatus: effectiveStatus },
    });

    if (effectiveStatus === TimesheetStatus.APPROVED || effectiveStatus === TimesheetStatus.REJECTED) {
      await this.notifications.create({
        tenantId: timesheet.tenantId,
        userId: timesheet.userId,
        title: effectiveStatus === TimesheetStatus.APPROVED ? 'Timesheet approuvee' : 'Timesheet rejetee',
        message: `Votre timesheet ${timesheet.periodStart.toISOString().slice(0, 10)} - ${timesheet.periodEnd
          .toISOString()
          .slice(0, 10)} a change de statut.`,
        type: `TIMESHEET_${effectiveStatus}`,
      });
    }

    return updated;
  }

  private async createLineWithEntries(
    tx: Prisma.TransactionClient,
    tenantId: string,
    timesheetId: string,
    line: TimesheetLineDto,
  ) {
    if (line.workLocation === WorkLocation.SITE && !line.siteId) {
      throw new BadRequestException('siteId is required for site timesheet lines');
    }

    if (line.siteId) {
      await tx.site.findFirstOrThrow({
        where: { id: line.siteId, tenantId, deletedAt: null },
      });
    }

    await tx.timesheetLine.create({
      data: {
        tenantId,
        timesheetId,
        siteId: line.siteId,
        taskName: line.taskName,
        billingType: line.billingType,
        activity: line.activity,
        workLocation: line.workLocation,
        placeOfWork: line.placeOfWork,
        entries: {
          create: line.entries.map((entry) => ({
            tenantId,
            entryDate: new Date(entry.entryDate),
            hours: entry.hours,
            comment: entry.comment,
          })),
        },
      },
    });
  }

  private async resolveApprovalStatus(
    user: CurrentUserContext,
    timesheet: {
      tenantId: string;
      userId: string;
      status: TimesheetStatus;
      lines: Array<{ siteId: string | null }>;
    },
    requestedStatus: TimesheetStatus,
  ) {
    if (requestedStatus !== TimesheetStatus.APPROVED && requestedStatus !== TimesheetStatus.REJECTED) {
      return requestedStatus;
    }

    if (user.role === UserRole.RESOURCE_MANAGER) {
      throw new ForbiddenException('Le Ressource Manager ne valide pas les timesheets.');
    }

    const level = await this.hierarchy.approvalLevelFor(
      user,
      timesheet.tenantId,
      timesheet.userId,
      timesheet.lines.map((line) => line.siteId),
    );

    if (!level) {
      throw new ForbiddenException('Only N+1, N+2, or HR can validate this timesheet');
    }

    if (requestedStatus === TimesheetStatus.REJECTED) {
      return TimesheetStatus.REJECTED;
    }

    if (level === 'ADMIN' || level === 'BOTH') {
      return TimesheetStatus.APPROVED;
    }

    if (timesheet.status === TimesheetStatus.SUBMITTED && level === 'N1') {
      return TimesheetStatus.N1_APPROVED;
    }

    if (timesheet.status === TimesheetStatus.N1_APPROVED && level === 'N2') {
      return TimesheetStatus.APPROVED;
    }

    if (timesheet.status === TimesheetStatus.SUBMITTED && level === 'N2') {
      throw new BadRequestException('N+1 approval is required before N+2 approval');
    }

    throw new BadRequestException('This timesheet is not waiting for your approval level');
  }

  private assertTransition(currentStatus: TimesheetStatus, nextStatus: TimesheetStatus) {
    if (
      nextStatus === TimesheetStatus.SUBMITTED &&
      currentStatus !== TimesheetStatus.DRAFT &&
      currentStatus !== TimesheetStatus.REOPENED
    ) {
      throw new BadRequestException('Only draft or reopened timesheets can be submitted');
    }

    if (
      (nextStatus === TimesheetStatus.APPROVED || nextStatus === TimesheetStatus.REJECTED) &&
      currentStatus !== TimesheetStatus.SUBMITTED &&
      currentStatus !== TimesheetStatus.N1_APPROVED
    ) {
      throw new BadRequestException('Only submitted timesheets can be approved or rejected');
    }

    if (
      nextStatus === TimesheetStatus.REOPENED &&
      currentStatus !== TimesheetStatus.APPROVED &&
      currentStatus !== TimesheetStatus.REJECTED
    ) {
      throw new BadRequestException('Only approved or rejected timesheets can be reopened');
    }
  }

  private async scope(user: CurrentUserContext): Promise<Prisma.TimesheetWhereInput> {
    if (user.role === UserRole.SUPER_ADMIN) {
      return {};
    }

    const tenantId = user.tenantId ?? '__missing__';
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    return managedUserIds ? { tenantId, userId: { in: managedUserIds } } : { tenantId };
  }
}
