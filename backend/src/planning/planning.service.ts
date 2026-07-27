import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { LeaveRequestStatus, PlanningStatus, Prisma, UserRole } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CurrentUserContext } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanningDto, SavePlanningPeriodDto, UpdatePlanningDto } from './dto/planning.dto';

@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService, private readonly auditLog: AuditLogService) {}

  private async managerScope(user: CurrentUserContext) {
    if (!user.tenantId) {
      throw new ForbiddenException('Seul un chef de site peut gerer la planification.');
    }
    const managedSite = await this.prisma.site.findFirst({
      where: { tenantId: user.tenantId, managerId: user.userId, deletedAt: null },
      select: { id: true },
    });
    if (!managedSite) throw new ForbiddenException('Seul un chef de site peut gerer la planification.');
    return { tenantId: user.tenantId, createdById: user.userId };
  }

  async findAll(user: CurrentUserContext) {
    const lineWhere = await this.viewerLineWhere(user);
    const [plannings, managedSite] = await Promise.all([
      this.prisma.planning.findMany({
      where: await this.readScope(user),
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        lines: {
          where: lineWhere,
          select: {
            site: { select: { project: { select: { id: true, code: true, name: true } } } },
            entries: { select: { hours: true } },
          },
        },
      },
      orderBy: { periodStart: 'desc' },
      }),
      this.prisma.site.findFirst({
        where: { tenantId: user.tenantId ?? '__missing__', managerId: user.userId, deletedAt: null },
        select: { id: true },
      }),
    ]);
    return plannings.map((planning) => ({
      ...planning,
      permissions: { canManage: Boolean(managedSite) && planning.createdById === user.userId },
    }));
  }

  async scopeOptions(user: CurrentUserContext) {
    if (!user.tenantId) throw new ForbiddenException('Tenant scope is required');
    const tenantId = user.tenantId;
    const [sites, settings, managedProject] = await Promise.all([
      this.prisma.site.findMany({
        where: { tenantId, managerId: user.userId, deletedAt: null },
        include: {
          project: { select: { id: true, code: true, name: true } },
          assignments: {
            include: { user: { select: { id: true, firstName: true, lastName: true, status: true } } },
            orderBy: { startDate: 'desc' },
          },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.tenantSettings.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
        select: { timesheetPeriodDays: true },
      }),
      this.prisma.project.findFirst({
        where: { tenantId, projectManagerId: user.userId, deletedAt: null },
        select: { id: true },
      }),
    ]);
    const projectMap = new Map<string, { id: string; code: string; name: string }>();
    for (const site of sites) {
      if (site.project) projectMap.set(site.project.id, site.project);
    }
    const projects = [...projectMap.values()].sort((a, b) => a.code.localeCompare(b.code));
    return {
      projects,
      sites,
      isProjectManager: Boolean(managedProject),
      canViewAll: user.role === UserRole.RESOURCE_MANAGER || user.role === UserRole.HR,
      timesheetPeriod: settings.timesheetPeriodDays === 30 ? 'MONTHLY' : 'WEEKLY',
      timesheetPeriodDays: settings.timesheetPeriodDays,
    };
  }

  async findOne(user: CurrentUserContext, id: string) {
    const lineWhere = await this.viewerLineWhere(user);
    const planning = await this.prisma.planning.findFirstOrThrow({
      where: { id, ...(await this.readScope(user)) },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        lines: {
          where: lineWhere,
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            site: { select: { id: true, code: true, name: true, project: { select: { id: true, code: true, name: true } } } },
            entries: { orderBy: { entryDate: 'asc' } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    const availableAssignments = await this.prisma.siteAssignment.findMany({
      where: {
        tenantId: planning.tenantId,
        site: { managerId: user.userId, deletedAt: null },
        startDate: { lte: planning.periodEnd },
        OR: [{ endDate: null }, { endDate: { gte: planning.periodStart } }],
      },
      select: { userId: true },
    });
    const userIds = [...new Set([
      ...planning.lines.map((line) => line.userId),
      ...availableAssignments.map((assignment) => assignment.userId),
    ])];
    const approvedLeaves = userIds.length
      ? await this.prisma.leaveRequest.findMany({
          where: {
            tenantId: planning.tenantId,
            userId: { in: userIds },
            status: LeaveRequestStatus.APPROVED,
            startDate: { lte: planning.periodEnd },
            endDate: { gte: planning.periodStart },
          },
          select: { userId: true, startDate: true, endDate: true },
        })
      : [];
    const canManage = planning.createdById === user.userId && Boolean(
      await this.prisma.site.findFirst({
        where: { tenantId: planning.tenantId, managerId: user.userId, deletedAt: null },
        select: { id: true },
      }),
    );
    return { ...planning, approvedLeaves, permissions: { canManage } };
  }

  private async readScope(user: CurrentUserContext): Promise<Prisma.PlanningWhereInput> {
    if (!user.tenantId) throw new ForbiddenException('Tenant scope is required');
    const isTenantViewer = user.role === UserRole.RESOURCE_MANAGER || user.role === UserRole.HR;
    const [managedSite, managedProject] = await Promise.all([
      this.prisma.site.findFirst({
        where: { tenantId: user.tenantId, managerId: user.userId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.project.findFirst({
        where: { tenantId: user.tenantId, projectManagerId: user.userId, deletedAt: null },
        select: { id: true },
      }),
    ]);

    const visible: Prisma.PlanningWhereInput[] = [];
    if (managedSite) visible.push({ createdById: user.userId });
    if (isTenantViewer) {
      visible.push({ status: PlanningStatus.PUBLISHED });
    } else {
      const lineScopes: Prisma.PlanningLineWhereInput[] = [];
      if (managedSite) lineScopes.push({ site: { managerId: user.userId } });
      if (managedProject) lineScopes.push({ site: { project: { projectManagerId: user.userId } } });
      if (lineScopes.length) {
        visible.push({
          status: PlanningStatus.PUBLISHED,
          lines: { some: lineScopes.length === 1 ? lineScopes[0]! : { OR: lineScopes } },
        });
      }
    }
    if (!visible.length) {
      visible.push({ status: PlanningStatus.PUBLISHED, lines: { some: { userId: user.userId } } });
    }
    return { tenantId: user.tenantId, OR: visible };
  }

  private async viewerLineWhere(user: CurrentUserContext): Promise<Prisma.PlanningLineWhereInput | undefined> {
    if (!user.tenantId) return { userId: user.userId };
    if (user.role === UserRole.RESOURCE_MANAGER || user.role === UserRole.HR) return undefined;
    const [isSiteManager, isProjectManager] = await Promise.all([
      this.prisma.site.findFirst({ where: { tenantId: user.tenantId, managerId: user.userId, deletedAt: null }, select: { id: true } }),
      this.prisma.project.findFirst({ where: { tenantId: user.tenantId, projectManagerId: user.userId, deletedAt: null }, select: { id: true } }),
    ]);
    const scopes: Prisma.PlanningLineWhereInput[] = [];
    if (isSiteManager) scopes.push({ site: { managerId: user.userId } });
    if (isProjectManager) scopes.push({ site: { project: { projectManagerId: user.userId } } });
    if (scopes.length) return scopes.length === 1 ? scopes[0]! : { OR: scopes };
    return { userId: user.userId };
  }

  async findViewerPeriod(user: CurrentUserContext, start: string, end: string, projectId?: string) {
    if (!user.tenantId) throw new ForbiddenException('Tenant scope is required');
    const periodStart = new Date(start);
    const periodEnd = new Date(end);
    if (!start || !end || Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd < periodStart) {
      throw new BadRequestException('Periode de consultation invalide.');
    }
    const isTenantViewer = user.role === UserRole.RESOURCE_MANAGER || user.role === UserRole.HR;
    const requestedProject = projectId
      ? await this.prisma.project.findFirst({
          where: {
            id: projectId,
            tenantId: user.tenantId,
            deletedAt: null,
            ...(isTenantViewer
              ? {}
              : {
                  OR: [
                    { projectManagerId: user.userId },
                    { sites: { some: { managerId: user.userId, deletedAt: null } } },
                  ],
                }),
          },
          select: { id: true },
        })
      : null;
    if (projectId && !requestedProject) {
      throw new ForbiddenException('Vous ne pouvez pas consulter la planification de ce projet.');
    }
    const viewerWhere = await this.viewerLineWhere(user);
    const lineWhere: Prisma.PlanningLineWhereInput = requestedProject
      ? {
          AND: [
            { site: { projectId: requestedProject.id } },
            ...(viewerWhere ? [viewerWhere] : []),
          ],
        }
      : viewerWhere ?? {};
    const plannings = await this.prisma.planning.findMany({
      where: {
        tenantId: user.tenantId,
        OR: [
          { status: PlanningStatus.PUBLISHED },
          { createdById: user.userId },
        ],
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
        lines: { some: lineWhere },
      },
      include: {
        lines: {
          where: lineWhere,
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            site: { select: { id: true, code: true, name: true, project: { select: { id: true, code: true, name: true } } } },
            entries: {
              where: { entryDate: { gte: periodStart, lte: periodEnd } },
              orderBy: { entryDate: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { periodStart: 'asc' },
    });
    const managedSiteIds = new Set((await this.prisma.site.findMany({
      where: { tenantId: user.tenantId, managerId: user.userId, deletedAt: null },
      select: { id: true },
    })).map((site) => site.id));
    const lines = plannings.flatMap((planning) => planning.lines.map((line) => ({
      ...line,
      permissions: { canEdit: planning.createdById === user.userId && managedSiteIds.has(line.siteId) },
    })));
    const editableAssignmentUserIds = managedSiteIds.size
      ? (await this.prisma.siteAssignment.findMany({
          where: {
            tenantId: user.tenantId,
            siteId: { in: [...managedSiteIds] },
            startDate: { lte: periodEnd },
            OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
          },
          select: { userId: true },
        })).map((assignment) => assignment.userId)
      : [];
    const visibleUserIds = [...new Set([
      ...lines.map((line) => line.userId),
      ...editableAssignmentUserIds,
    ])];
    const approvedLeaves = visibleUserIds.length
      ? await this.prisma.leaveRequest.findMany({
          where: {
            tenantId: user.tenantId,
            userId: { in: visibleUserIds },
            status: LeaveRequestStatus.APPROVED,
            startDate: { lte: periodEnd },
            endDate: { gte: periodStart },
          },
          select: { userId: true, startDate: true, endDate: true },
        })
      : [];
    return {
      id: `employee-period-${start}-${end}`,
      periodStart,
      periodEnd,
      status: PlanningStatus.PUBLISHED,
      project: projectId ? lines.find((line) => line.site.project)?.site.project ?? null : null,
      lines,
      approvedLeaves,
      permissions: { canAdd: managedSiteIds.size > 0 },
    };
  }

  async saveViewerPeriod(user: CurrentUserContext, dto: SavePlanningPeriodDto) {
    if (!user.tenantId) throw new ForbiddenException('Tenant scope is required');
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd < periodStart) {
      throw new BadRequestException('Période de planification invalide.');
    }

    const managedSites = await this.prisma.site.findMany({
      where: { tenantId: user.tenantId, managerId: user.userId, deletedAt: null },
      select: { id: true },
    });
    const managedSiteIds = new Set(managedSites.map((site) => site.id));
    if (!managedSiteIds.size) {
      throw new ForbiddenException('Seul un chef de site peut modifier la planification.');
    }
    const uniqueLines = [...new Map(dto.lines.map((line) => {
      const entriesSignature = [...line.entries]
        .sort((a, b) => a.entryDate.localeCompare(b.entryDate))
        .map((entry) => `${entry.entryDate}:${entry.hours}:${entry.comment ?? ''}`)
        .join('|');
      const signature = [
        line.siteId,
        line.userId,
        line.activity ?? '',
        line.taskName.trim(),
        entriesSignature,
      ].join('::');
      return [signature, line] as const;
    })).values()];

    for (const line of uniqueLines) {
      if (!managedSiteIds.has(line.siteId)) {
        throw new ForbiddenException('Vous ne pouvez modifier que les lignes de vos sites.');
      }
      const assignment = await this.prisma.siteAssignment.findFirst({
        where: {
          tenantId: user.tenantId,
          siteId: line.siteId,
          userId: line.userId,
          startDate: { lte: periodEnd },
          OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
        },
        select: { id: true },
      });
      if (!assignment) throw new BadRequestException("Cet employé n'est pas affecté au site sélectionné.");
      for (const entry of line.entries) {
        const entryDate = new Date(entry.entryDate);
        if (entryDate < periodStart || entryDate > periodEnd) {
          throw new BadRequestException('Une date se trouve hors de la période.');
        }
      }
    }

    const planning = await this.prisma.planning.upsert({
      where: {
        tenantId_createdById_periodStart_periodEnd: {
          tenantId: user.tenantId,
          createdById: user.userId,
          periodStart,
          periodEnd,
        },
      },
      create: {
        tenantId: user.tenantId,
        createdById: user.userId,
        periodStart,
        periodEnd,
        status: PlanningStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      update: { status: PlanningStatus.PUBLISHED, publishedAt: new Date() },
    });

    await this.prisma.$transaction(async (tx) => {
      // L'ancienne interface pouvait créer plusieurs feuilles du même auteur
      // qui chevauchaient la période. Elles ne doivent plus alimenter la vue
      // consolidée une fois la période courante sauvegardée.
      await tx.planning.deleteMany({
        where: {
          tenantId: user.tenantId!,
          createdById: user.userId,
          id: { not: planning.id },
          periodStart: { lte: periodEnd },
          periodEnd: { gte: periodStart },
        },
      });
      await tx.planningLine.deleteMany({ where: { planningId: planning.id } });
      for (const line of uniqueLines) {
        await tx.planningLine.create({
          data: {
            tenantId: user.tenantId!,
            planningId: planning.id,
            userId: line.userId,
            siteId: line.siteId,
            taskName: line.taskName,
            activity: line.activity,
            entries: {
              create: line.entries.map((entry) => ({
                tenantId: user.tenantId!,
                entryDate: new Date(entry.entryDate),
                hours: entry.hours,
                comment: entry.comment,
              })),
            },
          },
        });
      }
    });
    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'planning.period.saved',
      entityType: 'Planning',
      entityId: planning.id,
    });
    return this.findViewerPeriod(user, dto.periodStart, dto.periodEnd);
  }

  async create(user: CurrentUserContext, dto: CreatePlanningDto) {
    const scope = await this.managerScope(user);
    const periodStart = new Date(dto.periodStart);
    const settings = await this.prisma.tenantSettings.upsert({
      where: { tenantId: scope.tenantId },
      create: { tenantId: scope.tenantId },
      update: {},
      select: { timesheetPeriodDays: true },
    });
    let periodEnd: Date;
    if (settings.timesheetPeriodDays === 30) {
      const year = periodStart.getUTCFullYear();
      const month = periodStart.getUTCMonth();
      const day = periodStart.getUTCDate();
      if (day === 1) {
        periodEnd = new Date(Date.UTC(year, month + 1, 0));
      } else {
        const lastDayOfNextMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
        periodEnd = new Date(Date.UTC(year, month + 1, Math.min(day - 1, lastDayOfNextMonth)));
      }
    } else {
      periodEnd = new Date(periodStart);
      periodEnd.setUTCDate(periodStart.getUTCDate() + 6);
    }

    const existingPlanning = await this.prisma.planning.findUnique({
      where: {
        tenantId_createdById_periodStart_periodEnd: {
          tenantId: scope.tenantId,
          createdById: scope.createdById,
          periodStart,
          periodEnd,
        },
      },
    });
    if (existingPlanning) return existingPlanning;

    const planning = await this.prisma.planning.create({
      data: { ...scope, periodStart, periodEnd },
    });
    await this.auditLog.log({
      tenantId: scope.tenantId,
      userId: user.userId,
      action: 'planning.created',
      entityType: 'Planning',
      entityId: planning.id,
    });
    return planning;
  }

  async update(user: CurrentUserContext, id: string, dto: UpdatePlanningDto) {
    const planning = await this.prisma.planning.findFirstOrThrow({ where: { id, ...(await this.managerScope(user)) } });
    if (planning.status !== PlanningStatus.DRAFT) {
      throw new BadRequestException('Une planification publiee est en lecture seule.');
    }

    const plannedUserIds = [...new Set(dto.lines.map((line) => line.userId))];
    const approvedLeaves = plannedUserIds.length
      ? await this.prisma.leaveRequest.findMany({
          where: {
            tenantId: planning.tenantId,
            userId: { in: plannedUserIds },
            status: LeaveRequestStatus.APPROVED,
            startDate: { lte: planning.periodEnd },
            endDate: { gte: planning.periodStart },
          },
          select: { userId: true, startDate: true, endDate: true },
        })
      : [];
    const isApprovedLeaveDay = (userId: string, date: Date) =>
      approvedLeaves.some((leave) =>
        leave.userId === userId && leave.startDate <= date && leave.endDate >= date);

    for (const line of dto.lines) {
      if (!line.taskName.trim()) throw new BadRequestException("L'activite est obligatoire.");
      const site = await this.prisma.site.findFirst({
        where: { id: line.siteId, tenantId: planning.tenantId, managerId: user.userId, deletedAt: null },
        select: { id: true },
      });
      if (!site) throw new ForbiddenException("Vous ne pouvez planifier que pour l'un de vos sites.");

      const assignment = await this.prisma.siteAssignment.findFirst({
        where: {
          tenantId: planning.tenantId,
          siteId: line.siteId,
          userId: line.userId,
          startDate: { lte: planning.periodEnd },
          OR: [{ endDate: null }, { endDate: { gte: planning.periodStart } }],
        },
        select: { id: true },
      });
      if (!assignment) throw new BadRequestException("L'employe doit etre affecte au site pendant la periode planifiee.");

      for (const entry of line.entries) {
        const date = new Date(entry.entryDate);
        if (date < planning.periodStart || date > planning.periodEnd) {
          throw new BadRequestException('Une date planifiee est hors de la periode.');
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.planningLine.deleteMany({ where: { planningId: id } });
      for (const line of dto.lines) {
        await tx.planningLine.create({
          data: {
            tenantId: planning.tenantId,
            planningId: id,
            userId: line.userId,
            siteId: line.siteId,
            taskName: line.taskName.trim(),
            activity: line.activity,
            entries: {
              create: line.entries.map((entry) => {
                const entryDate = new Date(entry.entryDate);
                return {
                  tenantId: planning.tenantId,
                  entryDate,
                  hours: isApprovedLeaveDay(line.userId, entryDate) ? 0 : entry.hours,
                  comment: entry.comment,
                };
              }),
            },
          },
        });
      }
    });

    await this.auditLog.log({ tenantId: planning.tenantId, userId: user.userId, action: 'planning.updated', entityType: 'Planning', entityId: id });
    return this.findOne(user, id);
  }

  async publish(user: CurrentUserContext, id: string) {
    const planning = await this.prisma.planning.findFirstOrThrow({
      where: { id, ...(await this.managerScope(user)) },
      include: { lines: { include: { entries: true } } },
    });
    if (!planning.lines.length || !planning.lines.some((line) => line.entries.some((entry) => Number(entry.hours) > 0))) {
      throw new BadRequestException('Ajoutez au moins une heure planifiee avant de publier.');
    }
    const result = await this.prisma.planning.update({
      where: { id },
      data: { status: PlanningStatus.PUBLISHED, publishedAt: new Date() },
    });
    await this.auditLog.log({ tenantId: planning.tenantId, userId: user.userId, action: 'planning.published', entityType: 'Planning', entityId: id });
    return result;
  }

  async reopen(user: CurrentUserContext, id: string) {
    const planning = await this.prisma.planning.findFirstOrThrow({ where: { id, ...(await this.managerScope(user)) } });
    const result = await this.prisma.planning.update({
      where: { id },
      data: { status: PlanningStatus.DRAFT, publishedAt: null },
    });
    await this.auditLog.log({ tenantId: planning.tenantId, userId: user.userId, action: 'planning.reopened', entityType: 'Planning', entityId: id });
    return result;
  }

  async remove(user: CurrentUserContext, id: string) {
    const planning = await this.prisma.planning.findFirstOrThrow({ where: { id, ...(await this.managerScope(user)) } });
    await this.prisma.planning.delete({ where: { id } });
    await this.auditLog.log({ tenantId: planning.tenantId, userId: user.userId, action: 'planning.deleted', entityType: 'Planning', entityId: id });
    return { id, deleted: true };
  }
}
