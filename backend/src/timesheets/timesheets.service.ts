import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, TimesheetLineStatus, TimesheetStatus, UserRole, WorkLocation } from '@prisma/client';
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
            site: {
              select: {
                id: true,
                code: true,
                name: true,
                managerId: true,
                project: { select: { id: true, code: true, name: true, projectManagerId: true } },
              },
            },
            entries: { orderBy: { entryDate: 'asc' } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return {
      ...timesheet,
      lines: timesheet.lines.map((line) => ({
        ...line,
        approvalPermissions: this.lineApprovalPermissions(user, timesheet.userId, line),
      })),
      calendarEvents: await this.calendarEventsFor(timesheet),
      permissions: {
        canEdit: await this.canUpdateTimesheet(user, timesheet),
        ...this.globalApprovalPermissions(user, timesheet),
      },
    };
  }

  async update(user: CurrentUserContext, id: string, dto: UpdateTimesheetDto) {
    const timesheet = await this.repository.findFirstOrThrow({
      where: { id, ...(await this.scope(user)) },
      include: {
        user: { select: { role: true } },
        lines: { include: { site: { include: { project: true } } } },
      },
    });

    if (!(await this.canUpdateTimesheet(user, timesheet))) {
      throw new ForbiddenException('Vous ne pouvez pas modifier cette feuille de temps dans son etat actuel.');
    }

    const replaceWholeSheet =
      (timesheet.status === TimesheetStatus.DRAFT || timesheet.status === TimesheetStatus.REOPENED) &&
      timesheet.userId === user.userId;

    await this.repository.transaction(async (tx) => {
      if (replaceWholeSheet) {
        await this.repository.deleteLines(tx, id);
        for (const line of dto.lines) {
          await this.createLineWithEntries(tx, timesheet.tenantId, id, line);
        }
        return;
      }

      for (const line of dto.lines) {
        if (!line.id) continue;
        const existing = timesheet.lines.find((item) => item.id === line.id);
        if (!existing) continue;
        const permission = this.lineApprovalPermissions(user, timesheet.userId, existing);
        if (!permission.canEdit) continue;
        if ((line.siteId ?? null) !== existing.siteId) {
          throw new ForbiddenException("Un validateur ne peut pas changer le site d'une ligne.");
        }

        await this.repository.updateLineInTransaction(tx, existing.id, {
          taskName: line.taskName,
          billingType: line.billingType,
          activity: line.activity,
          workLocation: line.workLocation,
          placeOfWork: line.placeOfWork,
          approvalStatus:
            existing.approvalStatus === TimesheetLineStatus.REJECTED
              ? TimesheetLineStatus.SUBMITTED
              : existing.approvalStatus,
          rejectionReason: existing.approvalStatus === TimesheetLineStatus.REJECTED ? null : existing.rejectionReason,
          rejectedById: existing.approvalStatus === TimesheetLineStatus.REJECTED ? null : existing.rejectedById,
          rejectedAt: existing.approvalStatus === TimesheetLineStatus.REJECTED ? null : existing.rejectedAt,
          entries: {
            deleteMany: {},
            create: line.entries.map((entry) => ({
              tenantId: timesheet.tenantId,
              entryDate: new Date(entry.entryDate),
              hours: entry.hours,
              comment: entry.comment,
            })),
          },
        });
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
      id: string;
      tenantId: string;
      userId: string;
      user?: { role: UserRole };
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

    if (
      timesheet.status === TimesheetStatus.SUBMITTED ||
      timesheet.status === TimesheetStatus.N1_APPROVED ||
      timesheet.status === TimesheetStatus.REJECTED
    ) {
      if (timesheet.userId === user.userId) return false;
      const detailed = await this.repository.findFirstOrThrow({
        where: { id: timesheet.id },
        include: {
          user: { select: { role: true } },
          lines: { include: { site: { include: { project: true } } } },
        },
      });
      return detailed.lines.some(
        (line) => this.lineApprovalPermissions(user, timesheet.userId, line).canEdit,
      );
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

  async approve(user: CurrentUserContext, id: string) {
    const timesheet = await this.timesheetForGlobalDecision(user, id);
    const permissions = this.globalApprovalPermissions(user, timesheet);
    if (!permissions.canApproveGlobal) {
      throw new ForbiddenException("Aucune ligne de votre perimetre n'est prete a etre validee.");
    }

    const isSiteStage = permissions.approvalStage === 'SITE';
    const scopedLines = timesheet.lines.filter((line) =>
      isSiteStage
        ? line.site?.managerId === user.userId &&
          line.site.managerId !== timesheet.userId &&
          line.approvalStatus === TimesheetLineStatus.SUBMITTED
        : line.site?.project?.projectManagerId === user.userId &&
          (line.site.managerId === timesheet.userId
            ? line.approvalStatus === TimesheetLineStatus.SUBMITTED
            : line.approvalStatus === TimesheetLineStatus.SITE_APPROVED),
    );
    const nextStatus = isSiteStage ? TimesheetLineStatus.SITE_APPROVED : TimesheetLineStatus.APPROVED;

    for (const line of scopedLines) {
      await this.repository.updateLine({
        where: { id: line.id },
        data:
          isSiteStage
            ? {
                approvalStatus: nextStatus,
                siteApprovedById: user.userId,
                siteApprovedAt: new Date(),
                rejectionReason: null,
                rejectedById: null,
                rejectedAt: null,
              }
            : { approvalStatus: nextStatus, projectApprovedById: user.userId, projectApprovedAt: new Date() },
      });
      await this.recordLineDecision(user, timesheet, line.id, line.approvalStatus, nextStatus);
    }

    await this.refreshAggregateStatus(id);
    return this.findOne(user, id);
  }

  async approveLine(user: CurrentUserContext, id: string, lineId: string) {
    const timesheet = await this.timesheetForLineDecision(user, id, lineId);
    const line = timesheet.lines[0]!;
    const permissions = this.lineApprovalPermissions(user, timesheet.userId, line);

    if (!permissions.canApprove) {
      throw new ForbiddenException('Vous ne pouvez pas valider cette ligne ou elle ne correspond pas a votre perimetre.');
    }

    const isSiteStage = permissions.stage === 'SITE';
    const nextStatus = isSiteStage ? TimesheetLineStatus.SITE_APPROVED : TimesheetLineStatus.APPROVED;
    await this.repository.updateLine({
      where: { id: lineId },
      data:
        isSiteStage
          ? { approvalStatus: nextStatus, siteApprovedById: user.userId, siteApprovedAt: new Date() }
          : { approvalStatus: nextStatus, projectApprovedById: user.userId, projectApprovedAt: new Date() },
    });

    await this.recordLineDecision(user, timesheet, lineId, line.approvalStatus, nextStatus);
    await this.refreshAggregateStatus(id);
    return this.findOne(user, id);
  }

  async rejectLine(user: CurrentUserContext, id: string, lineId: string, reason: string) {
    const timesheet = await this.timesheetForLineDecision(user, id, lineId);
    const line = timesheet.lines[0]!;
    const permissions = this.lineApprovalPermissions(user, timesheet.userId, line);

    if (!permissions.canReject) {
      throw new ForbiddenException('Vous ne pouvez pas rejeter cette ligne ou elle ne correspond pas a votre perimetre.');
    }

    await this.repository.updateLine({
      where: { id: lineId },
      data: {
        approvalStatus: TimesheetLineStatus.REJECTED,
        rejectedById: user.userId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });
    await this.recordLineDecision(user, timesheet, lineId, line.approvalStatus, TimesheetLineStatus.REJECTED, reason);
    await this.refreshAggregateStatus(id);
    return this.findOne(user, id);
  }

  async reject(user: CurrentUserContext, id: string, reason: string) {
    const timesheet = await this.timesheetForGlobalDecision(user, id);
    const permissions = this.globalApprovalPermissions(user, timesheet);
    if (!permissions.canRejectGlobal) {
      throw new ForbiddenException("Vous ne pouvez pas refuser cette feuille de temps.");
    }

    const scopedLines = timesheet.lines.filter(
      (line) =>
        line.site?.project?.projectManagerId === user.userId &&
        line.approvalStatus === TimesheetLineStatus.SITE_APPROVED,
    );
    for (const line of scopedLines) {
      await this.repository.updateLine({
        where: { id: line.id },
        data: {
          approvalStatus: TimesheetLineStatus.REJECTED,
          rejectedById: user.userId,
          rejectedAt: new Date(),
          rejectionReason: reason,
          projectApprovedById: null,
          projectApprovedAt: null,
        },
      });
      await this.recordLineDecision(
        user,
        timesheet,
        line.id,
        line.approvalStatus,
        TimesheetLineStatus.REJECTED,
        reason,
      );
    }
    await this.refreshAggregateStatus(id);
    return this.findOne(user, id);
  }

  async reopen(user: CurrentUserContext, id: string) {
    const timesheet = await this.repository.findFirstOrThrow({
      where: { id, ...(await this.scope(user)) },
      select: { status: true },
    });
    if (timesheet.status === TimesheetStatus.APPROVED) {
      throw new ForbiddenException('Une feuille approuvee est disponible uniquement en consultation.');
    }
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
      include: {
        user: true,
        lines: {
          select: {
            siteId: true,
            site: { select: { managerId: true, projectId: true } },
            entries: { select: { hours: true } },
          },
        },
      },
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
    if (nextStatus === TimesheetStatus.SUBMITTED) {
      const invalidLine = timesheet.lines.some((line) => !line.siteId || !line.site?.managerId || !line.site.projectId);
      if (invalidLine) {
        throw new BadRequestException(
          'Chaque ligne doit etre rattachee a un site avec un chef de site et un projet avant soumission.',
        );
      }
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

    if (effectiveStatus === TimesheetStatus.SUBMITTED) {
      await this.repository.updateLines({
        where: { timesheetId: id },
        data: {
          approvalStatus: TimesheetLineStatus.SUBMITTED,
          siteApprovedById: null,
          siteApprovedAt: null,
          projectApprovedById: null,
          projectApprovedAt: null,
          rejectedById: null,
          rejectedAt: null,
          rejectionReason: null,
        },
      });
    }
    if (effectiveStatus === TimesheetStatus.REOPENED) {
      await this.repository.updateLines({
        where: { timesheetId: id },
        data: {
          approvalStatus: TimesheetLineStatus.DRAFT,
          siteApprovedById: null,
          siteApprovedAt: null,
          projectApprovedById: null,
          projectApprovedAt: null,
          rejectedById: null,
          rejectedAt: null,
          rejectionReason: null,
        },
      });
    }

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

  private lineApprovalPermissions(
    user: CurrentUserContext,
    ownerId: string,
    line: {
      approvalStatus: TimesheetLineStatus;
      site: { managerId: string | null; project: { projectManagerId: string } | null } | null;
    },
  ) {
    if (ownerId === user.userId || !line.site?.project) {
      return { canEdit: false, canApprove: false, canReject: false, stage: null };
    }

    const isSiteManager = line.site.managerId === user.userId;
    const isProjectManager = line.site.project.projectManagerId === user.userId;
    const ownerIsSiteManager = line.site.managerId === ownerId;
    const canSiteDecide =
      isSiteManager && !ownerIsSiteManager && line.approvalStatus === TimesheetLineStatus.SUBMITTED;
    const canProjectDecide =
      isProjectManager &&
      (ownerIsSiteManager
        ? line.approvalStatus === TimesheetLineStatus.SUBMITTED
        : line.approvalStatus === TimesheetLineStatus.SITE_APPROVED);

    return {
      canEdit:
        (isSiteManager &&
          (line.approvalStatus === TimesheetLineStatus.SUBMITTED ||
            line.approvalStatus === TimesheetLineStatus.REJECTED)) ||
        (isProjectManager && ownerIsSiteManager && line.approvalStatus === TimesheetLineStatus.SUBMITTED),
      canApprove: canSiteDecide || canProjectDecide,
      canReject: canProjectDecide && !ownerIsSiteManager,
      stage: canSiteDecide ? 'SITE' : canProjectDecide ? 'PROJECT' : null,
    };
  }

  private globalApprovalPermissions(
    user: CurrentUserContext,
    timesheet: {
      userId: string;
      user: { role: UserRole };
      lines: Array<{
        approvalStatus: TimesheetLineStatus;
        site: { managerId: string | null; project: { projectManagerId: string } | null } | null;
      }>;
    },
  ) {
    if (timesheet.userId === user.userId) {
      return { canApproveGlobal: false, canRejectGlobal: false, approvalStage: null };
    }

    const hasSiteLinesToApprove = timesheet.lines.some(
      (line) =>
        line.site?.managerId === user.userId &&
        line.site.managerId !== timesheet.userId &&
        line.approvalStatus === TimesheetLineStatus.SUBMITTED,
    );
    const hasRejectedSiteLines = timesheet.lines.some(
      (line) =>
        line.site?.managerId === user.userId &&
        line.site.managerId !== timesheet.userId &&
        line.approvalStatus === TimesheetLineStatus.REJECTED,
    );
    if (hasSiteLinesToApprove) {
      return {
        canApproveGlobal: !hasRejectedSiteLines,
        canRejectGlobal: false,
        approvalStage: !hasRejectedSiteLines ? 'SITE' : null,
      };
    }

    const projectScopedLines = timesheet.lines.filter(
      (line) => line.site?.project?.projectManagerId === user.userId,
    );
    const hasDirectManagerLines = projectScopedLines.some(
      (line) =>
        line.site?.managerId === timesheet.userId &&
        line.approvalStatus === TimesheetLineStatus.SUBMITTED,
    );
    const hasPreApprovedEmployeeLines = projectScopedLines.some(
      (line) =>
        line.site?.managerId !== timesheet.userId &&
        line.approvalStatus === TimesheetLineStatus.SITE_APPROVED,
    );
    const allLinesReadyForProject =
      timesheet.lines.length > 0 &&
      timesheet.lines.every((line) =>
        line.site?.managerId === timesheet.userId
          ? line.approvalStatus === TimesheetLineStatus.SUBMITTED ||
            line.approvalStatus === TimesheetLineStatus.APPROVED
          : line.approvalStatus === TimesheetLineStatus.SITE_APPROVED ||
            line.approvalStatus === TimesheetLineStatus.APPROVED,
      );
    const hasProjectLinesToApprove = hasDirectManagerLines || hasPreApprovedEmployeeLines;
    if (allLinesReadyForProject && hasProjectLinesToApprove) {
      return {
        canApproveGlobal: true,
        canRejectGlobal: hasPreApprovedEmployeeLines && !hasDirectManagerLines,
        approvalStage: 'PROJECT',
      };
    }

    return { canApproveGlobal: false, canRejectGlobal: false, approvalStage: null };
  }

  private timesheetForGlobalDecision(user: CurrentUserContext, id: string) {
    return this.repository.findFirstOrThrow({
      where: { id, ...(user.role === UserRole.SUPER_ADMIN ? {} : { tenantId: user.tenantId ?? '__missing__' }) },
      include: {
        user: { select: { role: true } },
        lines: { include: { site: { include: { project: true } } } },
      },
    });
  }

  private async timesheetForLineDecision(user: CurrentUserContext, id: string, lineId: string) {
    const timesheet = await this.repository.findFirstOrThrow({
      where: { id, ...(await this.scope(user)) },
      include: {
        user: { select: { role: true } },
        lines: {
          where: { id: lineId },
          include: { site: { include: { project: true } } },
        },
      },
    });
    if (!timesheet.lines.length) {
      throw new BadRequestException('Ligne de feuille de temps introuvable.');
    }
    return timesheet;
  }

  private async recordLineDecision(
    user: CurrentUserContext,
    timesheet: { tenantId: string },
    lineId: string,
    oldStatus: TimesheetLineStatus,
    newStatus: TimesheetLineStatus,
    comment?: string,
  ) {
    await this.repository.createApprovalAction({
      data: {
        tenantId: timesheet.tenantId,
        entityType: 'TIMESHEET_LINE',
        entityId: lineId,
        actionById: user.userId,
        oldStatus,
        newStatus,
        comment,
      },
    });
    await this.auditLog.log({
      tenantId: timesheet.tenantId,
      userId: user.userId,
      action: newStatus === TimesheetLineStatus.REJECTED ? 'timesheet.line.rejected' : 'timesheet.line.approved',
      entityType: 'TimesheetLine',
      entityId: lineId,
      metadata: { oldStatus, newStatus },
    });
  }

  private async refreshAggregateStatus(id: string) {
    const timesheet = await this.repository.findFirstOrThrow({
      where: { id },
      include: { lines: { select: { approvalStatus: true } } },
    });
    const statuses = timesheet.lines.map((line) => line.approvalStatus);
    const status = statuses.every((value) => value === TimesheetLineStatus.APPROVED)
      ? TimesheetStatus.APPROVED
      : statuses.some((value) => value === TimesheetLineStatus.REJECTED)
        ? TimesheetStatus.REJECTED
        : statuses.some((value) => value === TimesheetLineStatus.SITE_APPROVED || value === TimesheetLineStatus.APPROVED)
          ? TimesheetStatus.N1_APPROVED
          : TimesheetStatus.SUBMITTED;
    await this.repository.update({
      where: { id },
      data: {
        status,
        approvedAt: status === TimesheetStatus.APPROVED ? new Date() : null,
        rejectedAt: status === TimesheetStatus.REJECTED ? new Date() : null,
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
    const draftVisibility: Prisma.TimesheetWhereInput = {
      OR: [
        { userId: user.userId },
        { status: { not: TimesheetStatus.DRAFT } },
      ],
    };

    if (user.role === UserRole.SUPER_ADMIN) {
      return draftVisibility;
    }

    const tenantId = user.tenantId ?? '__missing__';
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    const hierarchyScope: Prisma.TimesheetWhereInput = managedUserIds
      ? { userId: { in: [...new Set([user.userId, ...managedUserIds])] } }
      : {};

    return { tenantId, AND: [hierarchyScope, draftVisibility] };
  }
}
