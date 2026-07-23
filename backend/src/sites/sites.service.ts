import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { HierarchyService } from '../common/hierarchy.service';
import { CurrentUserContext } from '../common/types';
import { CreateSiteAssignmentDto } from './dto/create-site-assignment.dto';
import { CreateSiteDto } from './dto/create-site.dto';
import { SitesRepository } from './sites.repository';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  constructor(
    private readonly repository: SitesRepository,
    private readonly auditLog: AuditLogService,
    private readonly hierarchy: HierarchyService,
  ) {}

  findAll(user: CurrentUserContext, filters: { search?: string; userId?: string }) {
    return this.repository.findMany({
      where: {
        ...this.tenantFilter(user, true),
        deletedAt: null,
        OR: filters.search
          ? [
              { code: { contains: filters.search, mode: 'insensitive' } },
              { name: { contains: filters.search, mode: 'insensitive' } },
              { address: { contains: filters.search, mode: 'insensitive' } },
            ]
          : undefined,
        AND: filters.userId
          ? [{
              OR: [
                {
                  assignments: {
                    some: {
                      userId: filters.userId,
                      ...this.hierarchy.activeAssignmentWhere(),
                    },
                  },
                },
                { managerId: filters.userId },
                { project: { projectManagerId: filters.userId } },
              ],
            }]
          : undefined,
      },
      include: {
        project: { select: { id: true, code: true, name: true, projectManagerId: true } },
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { assignments: true, attendancePunches: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  findOne(user: CurrentUserContext, id: string) {
    return this.repository.findFirstOrThrow({
      where: { id, ...this.tenantFilter(user), deletedAt: null },
      include: {
        project: {
          include: {
            projectManager: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                employeeProfile: { select: { id: true } },
              },
            },
          },
          orderBy: { startDate: 'desc' },
        },
        attendancePunches: {
          take: 20,
          orderBy: { punchDate: 'desc' },
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  }

  async create(user: CurrentUserContext, dto: CreateSiteDto) {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant scope is required');
    }

    if (dto.projectId) {
      await this.assertProject(user.tenantId, dto.projectId);
    }
    await this.assertActiveEmployee(user.tenantId, dto.managerId);

    const site = await this.repository.create({
      data: {
        tenantId: user.tenantId,
        projectId: dto.projectId,
        code: dto.code,
        name: dto.name,
        address: dto.address,
        managerId: dto.managerId,
      },
    });

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'site.created',
      entityType: 'Site',
      entityId: site.id,
      metadata: { code: site.code },
    });

    return site;
  }

  async update(user: CurrentUserContext, id: string, dto: UpdateSiteDto) {
    const existing = await this.assertSite(user, id);
    if (user.role === UserRole.HR && dto.projectId) {
      await this.assertProject(existing.tenantId, dto.projectId);
    }
    if (dto.managerId) await this.assertActiveEmployee(existing.tenantId, dto.managerId);

    const site = await this.repository.update({
      where: { id },
      data: {
        managerId: dto.managerId === undefined ? undefined : dto.managerId || null,
        projectId: dto.projectId,
        code: dto.code,
        name: dto.name,
        address: dto.address,
      },
    });

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'site.updated',
      entityType: 'Site',
      entityId: id,
    });

    return site;
  }

  async softDelete(user: CurrentUserContext, id: string) {
    await this.assertSite(user, id);
    return this.repository.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async assign(user: CurrentUserContext, id: string, dto: CreateSiteAssignmentDto) {
    const site = await this.assertSite(user, id);
    const canAssignAsManager =
      user.role !== UserRole.MANAGER ||
      site.managerId === user.userId ||
      site.project?.projectManagerId === user.userId;
    if (!canAssignAsManager) {
      throw new ForbiddenException('Managers can assign employees only to their own sites or projects');
    }

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : undefined;
    if (Number.isNaN(startDate.getTime()) || (endDate && Number.isNaN(endDate.getTime()))) {
      throw new BadRequestException('Invalid assignment date');
    }
    if (endDate && endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Un chef de site est déjà implicitement affecté à son site — pas besoin d'une affectation resource séparée
    if (site.managerId === dto.userId) {
      throw new BadRequestException(
        'Ce membre est déjà chef de site de ce site. Il est implicitement affecté en tant que responsable et n\'a pas besoin d\'une affectation ressource supplémentaire.',
      );
    }

    const employee = await this.repository.findActiveEmployee({
      where: {
        tenantId: site.tenantId,
        userId: dto.userId,
        status: 'ACTIVE',
        user: { deletedAt: null, status: UserStatus.ACTIVE },
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    if (!employee) {
      throw new BadRequestException('Only an active employee from this tenant can be assigned');
    }

    const existing = await this.repository.findActiveAssignment({
      where: {
        tenantId: site.tenantId,
        siteId: id,
        userId: dto.userId,
        OR: [{ endDate: null }, { endDate: { gte: startDate } }],
      },
    });

    if (existing) {
      throw new BadRequestException('This employee already has an active assignment on this site');
    }

    const assignment = await this.repository.createAssignmentAndSetMainSite({
      employeeProfileId: employee.id,
      assignmentData: {
        tenantId: site.tenantId,
        siteId: id,
        userId: dto.userId,
        startDate,
        endDate,
        roleOnSite: dto.roleOnSite,
      },
    });

    await this.auditLog.log({
      tenantId: site.tenantId,
      userId: user.userId,
      action: 'site.assignment.created',
      entityType: 'SiteAssignment',
      entityId: assignment.id,
      metadata: {
        siteId: id,
        userId: dto.userId,
        roleOnSite: dto.roleOnSite,
      },
    });

    return assignment;
  }

  private async assertSite(user: CurrentUserContext, id: string) {
    return this.repository.findFirstOrThrow({
      where: { id, ...this.tenantFilter(user), deletedAt: null },
      include: { project: { select: { id: true, projectManagerId: true } } },
    });
  }

  private async assertProject(tenantId: string, projectId: string) {
    return this.repository.findProjectOrThrow({
      where: { id: projectId, tenantId, deletedAt: null },
    });
  }

  private async assertActiveEmployee(tenantId: string, userId: string) {
    const employee = await this.repository.findActiveEmployee({
      where: {
        tenantId,
        userId,
        status: 'ACTIVE',
        user: { deletedAt: null, status: UserStatus.ACTIVE },
      },
    });
    if (!employee) {
      throw new BadRequestException('Le chef de site doit être un employé actif.');
    }
  }

  private tenantFilter(user: CurrentUserContext, includeOwnAssignments = false): Prisma.SiteWhereInput {
    if (user.role === UserRole.SUPER_ADMIN) return {};

    const tenantId = user.tenantId ?? '__missing__';
    if (user.role === UserRole.RESOURCE_MANAGER || user.role === UserRole.HR) return { tenantId };
    const ownAssignedSitesScope: Prisma.SiteWhereInput = {
      OR: [
        {
          assignments: {
            some: {
              userId: user.userId,
              ...this.hierarchy.activeAssignmentWhere(),
            },
          },
        },
        { employeeProfiles: { some: { userId: user.userId } } },
      ],
    };

    const operationalScope: Prisma.SiteWhereInput[] = [
      { project: { projectManagerId: user.userId } },
      { managerId: user.userId },
    ];
    if (includeOwnAssignments) operationalScope.push(ownAssignedSitesScope);
    return { tenantId, OR: operationalScope };
  }
}
