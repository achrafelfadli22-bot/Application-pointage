import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { LeaveRequestStatus, PlanningStatus, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CurrentUserContext } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanningDto, UpdatePlanningDto } from './dto/planning.dto';

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
    return this.prisma.planning.findMany({
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
    });
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
    return { ...planning, approvedLeaves };
  }

  private async readScope(user: CurrentUserContext): Promise<Prisma.PlanningWhereInput> {
    if (!user.tenantId) throw new ForbiddenException('Tenant scope is required');
    const managedSite = await this.prisma.site.findFirst({
      where: { tenantId: user.tenantId, managerId: user.userId, deletedAt: null },
      select: { id: true },
    });
    if (managedSite) {
      return { tenantId: user.tenantId, createdById: user.userId };
    }
    const managedProject = await this.prisma.project.findFirst({
      where: { tenantId: user.tenantId, projectManagerId: user.userId, deletedAt: null },
      select: { id: true },
    });
    if (managedProject) {
      return {
        tenantId: user.tenantId,
        status: PlanningStatus.PUBLISHED,
        lines: { some: { site: { project: { projectManagerId: user.userId } } } },
      };
    }
    return {
      tenantId: user.tenantId,
      status: PlanningStatus.PUBLISHED,
      lines: { some: { userId: user.userId } },
    };
  }

  private async viewerLineWhere(user: CurrentUserContext): Promise<Prisma.PlanningLineWhereInput | undefined> {
    if (!user.tenantId) return { userId: user.userId };
    const isSiteManager = await this.prisma.site.findFirst({ where: { tenantId: user.tenantId, managerId: user.userId, deletedAt: null }, select: { id: true } });
    if (isSiteManager) return undefined;
    const isProjectManager = await this.prisma.project.findFirst({ where: { tenantId: user.tenantId, projectManagerId: user.userId, deletedAt: null }, select: { id: true } });
    if (isProjectManager) return { site: { project: { projectManagerId: user.userId } } };
    return { userId: user.userId };
  }

  async findViewerPeriod(user: CurrentUserContext, start: string, end: string, projectId?: string) {
    if (!user.tenantId) throw new ForbiddenException('Tenant scope is required');
    const periodStart = new Date(start);
    const periodEnd = new Date(end);
    if (!start || !end || Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd < periodStart) {
      throw new BadRequestException('Periode de consultation invalide.');
    }
    const managedProject = projectId
      ? await this.prisma.project.findFirst({
          where: { id: projectId, tenantId: user.tenantId, projectManagerId: user.userId, deletedAt: null },
          select: { id: true },
        })
      : null;
    const lineWhere: Prisma.PlanningLineWhereInput = managedProject
      ? { site: { project: { id: managedProject.id, projectManagerId: user.userId } } }
      : (await this.viewerLineWhere(user)) ?? { userId: user.userId };
    const plannings = await this.prisma.planning.findMany({
      where: {
        tenantId: user.tenantId,
        status: PlanningStatus.PUBLISHED,
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
    const lines = plannings.flatMap((planning) => planning.lines);
    const plannedUserIds = [...new Set(lines.map((line) => line.userId))];
    const approvedLeaves = plannedUserIds.length
      ? await this.prisma.leaveRequest.findMany({
          where: {
            tenantId: user.tenantId,
            userId: { in: plannedUserIds },
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
    };
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
