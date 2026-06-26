import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, TimesheetStatus, UserRole, WorkLocation } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { HierarchyService } from '../common/hierarchy.service';
import { CurrentUserContext } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { TimesheetLineDto } from './dto/timesheet-line-entry.dto';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto';
import { TimesheetsRepository } from './timesheets.repository';

@Injectable()
export class TimesheetsService {
  constructor(
    private readonly repository: TimesheetsRepository,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly hierarchy: HierarchyService,
  ) {}

  async findAll(user: CurrentUserContext, filters: { status?: TimesheetStatus; periodStart?: string; periodEnd?: string }) {
    return this.repository.findMany({
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
    if (ownerId !== user.userId) {
      const managedUserIds = await this.hierarchy.managedUserIds(user);
      if (managedUserIds && !managedUserIds.includes(ownerId)) {
        throw new ForbiddenException('Vous pouvez creer des feuilles de temps uniquement pour votre equipe.');
      }
    }

    return this.repository.create({
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
    const timesheet = await this.repository.findFirstOrThrow({
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

    return {
      ...timesheet,
      calendarEvents: await this.calendarEventsFor(timesheet),
      permissions: {
        canEdit: await this.canUpdateTimesheet(user, timesheet),
      },
    };
  }

  async update(user: CurrentUserContext, id: string, dto: UpdateTimesheetDto) {
    const timesheet = await this.repository.findFirstOrThrow({
      where: { id, ...(await this.scope(user)) },
      include: { lines: true },
    });

    if (!(await this.canUpdateTimesheet(user, timesheet))) {
      throw new ForbiddenException('Vous ne pouvez pas modifier cette feuille de temps dans son etat actuel.');
    }

    await this.repository.transaction(async (tx) => {
      await this.repository.deleteLines(tx, id);
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

  private async canUpdateTimesheet(
    user: CurrentUserContext,
    timesheet: {
      tenantId: string;
      userId: string;
      status: TimesheetStatus;
      lines: Array<{ siteId: string | null }>;
    },
  ) {
    if (timesheet.status === TimesheetStatus.DRAFT || timesheet.status === TimesheetStatus.REOPENED) {
      if (timesheet.userId === user.userId) {
        return true;
      }

      if (user.role === UserRole.EMPLOYEE) {
        return false;
      }

      return [UserRole.SUPER_ADMIN, UserRole.RESOURCE_MANAGER, UserRole.HR, UserRole.PROJECT_MANAGER, UserRole.MANAGER].includes(
        user.role,
      );
    }

    if (timesheet.status === TimesheetStatus.SUBMITTED) {
      if (timesheet.userId === user.userId) {
        return false;
      }

      const level = await this.hierarchy.approvalLevelFor(
        user,
        timesheet.tenantId,
        timesheet.userId,
        timesheet.lines.map((line) => line.siteId),
      );

      return level === 'N1' || level === 'BOTH';
    }

    return false;
  }

  async remove(user: CurrentUserContext, id: string) {
    const timesheet = await this.repository.findFirstOrThrow({
      where: {
        id,
        ...(user.role === UserRole.SUPER_ADMIN ? {} : { tenantId: user.tenantId ?? '__missing__' }),
      },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        status: true,
        periodStart: true,
        periodEnd: true,
      },
    });

    if (timesheet.userId !== user.userId) {
      throw new ForbiddenException('Vous pouvez supprimer uniquement vos propres feuilles de temps.');
    }

    if (timesheet.status !== TimesheetStatus.DRAFT) {
      throw new BadRequestException('Seules les feuilles de temps en brouillon peuvent etre supprimees.');
    }

    await this.repository.delete({ where: { id } });

    await this.auditLog.log({
      tenantId: timesheet.tenantId,
      userId: user.userId,
      action: 'timesheet.deleted',
      entityType: 'Timesheet',
      entityId: id,
      metadata: {
        periodStart: timesheet.periodStart.toISOString().slice(0, 10),
        periodEnd: timesheet.periodEnd.toISOString().slice(0, 10),
      },
    });

    return { id, deleted: true };
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
    const timesheet = await this.repository.findFirstOrThrow({
      where: { id, ...(await this.scope(user)) },
      include: { user: true, lines: { select: { siteId: true, entries: { select: { hours: true } } } } },
    });

    if (nextStatus === TimesheetStatus.SUBMITTED && timesheet.userId !== user.userId) {
      const managedUserIds = await this.hierarchy.managedUserIds(user);
      if (managedUserIds && !managedUserIds.includes(timesheet.userId)) {
        throw new ForbiddenException('Vous pouvez soumettre uniquement les feuilles de temps de votre perimetre.');
      }
    }

    if (
      (nextStatus === TimesheetStatus.APPROVED || nextStatus === TimesheetStatus.REJECTED) &&
      timesheet.userId === user.userId
    ) {
      throw new ForbiddenException('Vous ne pouvez pas valider votre propre feuille de temps.');
    }

    this.assertTransition(timesheet.status, nextStatus);

    if (nextStatus === TimesheetStatus.SUBMITTED || nextStatus === TimesheetStatus.APPROVED) {
      this.assertHasWorkEntries(timesheet);
    }

    const effectiveStatus = await this.resolveApprovalStatus(user, timesheet, nextStatus);
    const effectiveAction = effectiveStatus === TimesheetStatus.N1_APPROVED ? 'timesheet.n1_approved' : action;

    const updated = await this.repository.update({
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

    await this.repository.createApprovalAction({
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
        title: effectiveStatus === TimesheetStatus.APPROVED ? 'Feuille de temps approuvee' : 'Feuille de temps rejetee',
        message: `Votre feuille de temps ${timesheet.periodStart.toISOString().slice(0, 10)} - ${timesheet.periodEnd
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
      await this.repository.findSiteForLine(tx, line.siteId, tenantId);
    }

    await this.repository.createLine(tx, {
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
      throw new ForbiddenException('Le Ressource Manager ne valide pas les feuilles de temps.');
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

  private assertHasWorkEntries(timesheet: { lines: Array<{ entries?: Array<{ hours: unknown }> }> }) {
    if (!timesheet.lines.length) {
      throw new BadRequestException('La feuille de temps ne contient aucune ligne. Ajoutez au moins une ligne avant soumission ou validation.');
    }

    const totalHours = timesheet.lines.reduce(
      (lineSum, line) => lineSum + (line.entries ?? []).reduce((entrySum, entry) => entrySum + Number(entry.hours ?? 0), 0),
      0,
    );

    if (totalHours <= 0) {
      throw new BadRequestException('La feuille de temps ne contient aucune heure saisie. Ajoutez des heures avant soumission ou validation.');
    }
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

  private async calendarEventsFor(timesheet: {
    tenantId: string;
    userId: string;
    periodStart: Date;
    periodEnd: Date;
  }) {
    const [holidays, approvedLeaves] = await Promise.all([
      this.repository.findCalendarHolidays(timesheet.tenantId, timesheet.periodStart, timesheet.periodEnd),
      this.repository.findApprovedLeavesForUser(
        timesheet.tenantId,
        timesheet.userId,
        timesheet.periodStart,
        timesheet.periodEnd,
      ),
    ]);

    const holidayEvents = holidays.map((holiday) => ({
      id: holiday.id,
      type: 'HOLIDAY' as const,
      date: this.dateKey(holiday.date),
      label: holiday.name,
      country: holiday.country,
      isRecurring: holiday.isRecurring,
    }));

    const leaveEvents = approvedLeaves.flatMap((leave) => {
      const startDate = leave.startDate > timesheet.periodStart ? leave.startDate : timesheet.periodStart;
      const endDate = leave.endDate < timesheet.periodEnd ? leave.endDate : timesheet.periodEnd;

      return this.dateKeysBetween(startDate, endDate).map((date) => ({
        id: leave.id,
        type: 'LEAVE' as const,
        date,
        label: leave.leaveType.name,
        code: leave.leaveType.code,
        isPaid: leave.leaveType.isPaid,
        durationDays: Number(leave.durationDays),
        startHalfDay: leave.startHalfDay,
        endHalfDay: leave.endHalfDay,
      }));
    });

    const byDate: Record<string, Array<(typeof holidayEvents)[number] | (typeof leaveEvents)[number]>> = {};
    for (const event of [...holidayEvents, ...leaveEvents]) {
      byDate[event.date] ??= [];
      byDate[event.date]!.push(event);
    }

    return {
      holidays: holidayEvents,
      approvedLeaves: leaveEvents,
      byDate,
    };
  }

  private dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private dateKeysBetween(startDate: Date, endDate: Date) {
    const keys: string[] = [];
    const current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

    while (current <= end && keys.length < 370) {
      keys.push(this.dateKey(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return keys;
  }

  private async scope(user: CurrentUserContext): Promise<Prisma.TimesheetWhereInput> {
    if (user.role === UserRole.SUPER_ADMIN) {
      return {};
    }

    const tenantId = user.tenantId ?? '__missing__';
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    return managedUserIds ? { tenantId, userId: { in: [...new Set([user.userId, ...managedUserIds])] } } : { tenantId };
  }
}
