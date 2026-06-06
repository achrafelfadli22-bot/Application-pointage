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

    if (user.role === UserRole.EMPLOYEE) {
      return [user.userId];
    }

    const sites = await this.prisma.site.findMany({
      where: {
        tenantId: user.tenantId,
        deletedAt: null,
        OR: [{ managerId: user.userId }, { project: { projectManagerId: user.userId } }],
      },
      select: { id: true },
    });

    if (!sites.length) {
      return [user.userId];
    }

    const siteIds = sites.map((site) => site.id);
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

    return [
      ...new Set([
        user.userId,
        ...assignments.map((assignment) => assignment.userId),
        ...mainSiteEmployees.map((employee) => employee.userId),
      ]),
    ];
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

    if (
      (user.role !== UserRole.MANAGER && user.role !== UserRole.PROJECT_MANAGER) ||
      !user.tenantId ||
      user.tenantId !== tenantId
    ) {
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
      : (
          await this.prisma.siteAssignment.findMany({
            where: {
              tenantId,
              userId: targetUserId,
              ...this.activeAssignmentWhere(),
            },
            select: { site: { select: { managerId: true, project: { select: { projectManagerId: true } } } } },
          })
        ).map((assignment) => assignment.site);

    return {
      n1Ids: new Set(sites.map((site) => site.managerId).filter(Boolean) as string[]),
      n2Ids: new Set(sites.map((site) => site.project?.projectManagerId).filter(Boolean) as string[]),
    };
  }

  activeAssignmentWhere(): Prisma.SiteAssignmentWhereInput {
    const today = this.dateOnly(new Date());
    return {
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    };
  }

  private dateOnly(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
}
