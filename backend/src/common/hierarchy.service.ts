import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserContext } from './types';

export type ApprovalLevel = 'ADMIN' | 'N1' | 'N2' | 'BOTH';

@Injectable()
export class HierarchyService {
  constructor(private readonly prisma: PrismaService) {}

  async managedUserIds(user: CurrentUserContext) {
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.RESOURCE_MANAGER || user.role === UserRole.HR) {
      return undefined;
    }

    if (!user.tenantId) {
      return [user.userId];
    }

    const sites = await this.prisma.site.findMany({
      where: this.managedSitesWhere(user),
      select: { id: true, managerId: true, project: { select: { projectManagerId: true } } },
    });

    if (!sites.length) {
      return [];
    }

    const siteIds = sites.map((site) => site.id);
    const siteManagerIds = new Set(sites.map((site) => site.managerId).filter(Boolean) as string[]);

    const assignments = await this.prisma.siteAssignment.findMany({
      where: {
        tenantId: user.tenantId,
        siteId: { in: siteIds },
        ...this.activeAssignmentWhere(),
      },
      select: { userId: true },
    });

    const mainSiteEmployees = await this.prisma.employeeProfile.findMany({
      where: {
        tenantId: user.tenantId,
        mainSiteId: { in: siteIds },
        user: { deletedAt: null },
      },
      select: { userId: true },
    });

    const projectSiteManagerIds = sites.some((site) => site.project?.projectManagerId === user.userId)
      ? [...siteManagerIds]
      : [];

    return [
      ...new Set([
        ...projectSiteManagerIds,
        ...assignments.map((assignment) => assignment.userId),
        ...mainSiteEmployees.map((employee) => employee.userId),
      ]),
    ].filter((id) => id !== user.userId);
  }

  async managedSiteIds(user: CurrentUserContext) {
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.RESOURCE_MANAGER || user.role === UserRole.HR) {
      return undefined;
    }

    if (!user.tenantId) {
      return [];
    }

    const sites = await this.prisma.site.findMany({
      where: {
        tenantId: user.tenantId,
        deletedAt: null,
        OR: [
          { managerId: user.userId },
          { project: { projectManagerId: user.userId } },
          {
            assignments: {
              some: {
                userId: user.userId,
                ...this.activeAssignmentWhere(),
              },
            },
          },
          { employeeProfiles: { some: { userId: user.userId } } },
        ],
      },
      select: { id: true },
    });

    return sites.map((site) => site.id);
  }

  async approvalLevelFor(
    user: CurrentUserContext,
    tenantId: string,
    targetUserId: string,
    siteIds: Array<string | null | undefined> = [],
  ): Promise<ApprovalLevel | null> {
    if (user.role === UserRole.RESOURCE_MANAGER || user.role === UserRole.HR) {
      return 'ADMIN';
    }

    if (!user.tenantId || user.tenantId !== tenantId) {
      return null;
    }

    const hierarchy = await this.approverIdsFor(tenantId, targetUserId, siteIds);
    const isN1 = hierarchy.n1Ids.has(user.userId);
    const isN2 = hierarchy.n2Ids.has(user.userId);

    if (isN1 && isN2) {
      return 'BOTH';
    }
    if (isN1) {
      return 'N1';
    }
    if (isN2) {
      return 'N2';
    }

    return null;
  }

  async approverIdsFor(tenantId: string, targetUserId: string, siteIds: Array<string | null | undefined> = []) {
    const ids = [...new Set(siteIds.filter(Boolean) as string[])];
    const sites = ids.length
      ? await this.prisma.site.findMany({
          where: { tenantId, id: { in: ids }, deletedAt: null },
          select: { managerId: true, project: { select: { projectManagerId: true } } },
        })
      : await this.defaultApprovalSitesFor(tenantId, targetUserId);

    const n1Ids = new Set<string>();
    const n2Ids = new Set<string>();

    for (const site of sites) {
      const managerId = site.managerId;
      const projectManagerId = site.project?.projectManagerId;

      if (managerId && managerId !== targetUserId) {
        n1Ids.add(managerId);
        if (projectManagerId && projectManagerId !== targetUserId) {
          n2Ids.add(projectManagerId);
        }
        continue;
      }

      if (projectManagerId && projectManagerId !== targetUserId) {
        n1Ids.add(projectManagerId);
      }
    }

    return { n1Ids, n2Ids };
  }

  async isProjectManagerForUser(tenantId: string, targetUserId: string, approverId: string) {
    const site = await this.prisma.site.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        project: { projectManagerId: approverId },
        OR: [
          { assignments: { some: { userId: targetUserId, ...this.activeAssignmentWhere() } } },
          { employeeProfiles: { some: { userId: targetUserId } } },
        ],
      },
      select: { id: true },
    });
    return Boolean(site);
  }

  private async defaultApprovalSitesFor(tenantId: string, targetUserId: string) {
    const [assignments, employee] = await Promise.all([
      this.prisma.siteAssignment.findMany({
        where: {
          tenantId,
          userId: targetUserId,
          ...this.activeAssignmentWhere(),
        },
        select: { site: { select: { managerId: true, project: { select: { projectManagerId: true } } } } },
      }),
      this.prisma.employeeProfile.findFirst({
        where: {
          tenantId,
          userId: targetUserId,
          user: { deletedAt: null },
          mainSite: { deletedAt: null },
        },
        select: { mainSite: { select: { managerId: true, project: { select: { projectManagerId: true } } } } },
      }),
    ]);

    return [...assignments.map((assignment) => assignment.site), ...(employee?.mainSite ? [employee.mainSite] : [])];
  }

  activeAssignmentWhere(): Prisma.SiteAssignmentWhereInput {
    const today = this.dateOnly(new Date());
    return {
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    };
  }

  private managedSitesWhere(user: CurrentUserContext): Prisma.SiteWhereInput {
    const tenantId = user.tenantId ?? '__missing__';

    return {
      tenantId,
      deletedAt: null,
      OR: [{ managerId: user.userId }, { project: { projectManagerId: user.userId } }],
    };
  }

  private dateOnly(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
}
