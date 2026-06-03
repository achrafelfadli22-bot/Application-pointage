import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, ProjectStatus, UserRole, UserStatus } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { HierarchyService } from '../common/hierarchy.service';
import { CurrentUserContext } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly hierarchy: HierarchyService,
  ) {}

  findAll(user: CurrentUserContext, filters: { search?: string; status?: ProjectStatus }) {
    return this.prisma.project.findMany({
      where: {
        ...this.scope(user, true),
        deletedAt: null,
        status: filters.status,
        OR: filters.search
          ? [
              { code: { contains: filters.search, mode: 'insensitive' } },
              { name: { contains: filters.search, mode: 'insensitive' } },
              { clientName: { contains: filters.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        projectManager: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        _count: { select: { sites: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  findOne(user: CurrentUserContext, id: string) {
    return this.prisma.project.findFirstOrThrow({
      where: { id, ...this.scope(user), deletedAt: null },
      include: {
        projectManager: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        sites: {
          where: { deletedAt: null },
          include: {
            manager: { select: { id: true, firstName: true, lastName: true, email: true } },
            _count: { select: { assignments: true, attendancePunches: true } },
          },
          orderBy: { code: 'asc' },
        },
      },
    });
  }

  async create(user: CurrentUserContext, dto: CreateProjectDto) {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant scope is required');
    }

    await this.assertProjectManager(user.tenantId, dto.projectManagerId);

    const project = await this.prisma.project.create({
      data: {
        tenantId: user.tenantId,
        code: dto.code,
        name: dto.name,
        clientName: dto.clientName,
        projectManagerId: dto.projectManagerId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : undefined,
        status: dto.status,
      },
    });

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'project.created',
      entityType: 'Project',
      entityId: project.id,
      metadata: { code: project.code, projectManagerId: project.projectManagerId },
    });

    return project;
  }

  async update(user: CurrentUserContext, id: string, dto: UpdateProjectDto) {
    const existing = await this.assertProject(user, id);
    if (dto.projectManagerId) {
      await this.assertProjectManager(existing.tenantId, dto.projectManagerId);
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        clientName: dto.clientName,
        projectManagerId: dto.projectManagerId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : undefined,
        status: dto.status,
      },
    });

    await this.auditLog.log({
      tenantId: existing.tenantId,
      userId: user.userId,
      action: 'project.updated',
      entityType: 'Project',
      entityId: id,
    });

    return project;
  }

  async softDelete(user: CurrentUserContext, id: string) {
    const existing = await this.assertProject(user, id);
    const project = await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProjectStatus.SUSPENDED },
    });

    await this.auditLog.log({
      tenantId: existing.tenantId,
      userId: user.userId,
      action: 'project.deleted',
      entityType: 'Project',
      entityId: id,
    });

    return project;
  }

  private assertProject(user: CurrentUserContext, id: string) {
    return this.prisma.project.findFirstOrThrow({
      where: { id, ...this.scope(user), deletedAt: null },
    });
  }

  private async assertProjectManager(tenantId: string, userId: string) {
    const candidate = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        deletedAt: null,
        status: UserStatus.ACTIVE,
        role: UserRole.PROJECT_MANAGER,
      },
    });

    if (!candidate) {
      throw new BadRequestException('Le chef de projet doit etre un utilisateur actif avec le role Chef de projet.');
    }
  }

  private scope(user: CurrentUserContext, includeOwnAssignments = false): Prisma.ProjectWhereInput {
    if (user.role === UserRole.SUPER_ADMIN) {
      return {};
    }

    const tenantId = user.tenantId ?? '__missing__';
    const ownAssignedProjectsScope: Prisma.ProjectWhereInput = {
      sites: {
        some: {
          deletedAt: null,
          assignments: {
            some: {
              userId: user.userId,
              ...this.hierarchy.activeAssignmentWhere(),
            },
          },
        },
      },
    };

    if (user.role === UserRole.PROJECT_MANAGER) {
      return includeOwnAssignments
        ? { tenantId, OR: [{ projectManagerId: user.userId }, ownAssignedProjectsScope] }
        : { tenantId, projectManagerId: user.userId };
    }
    if (user.role === UserRole.MANAGER) {
      return includeOwnAssignments
        ? {
            tenantId,
            OR: [{ sites: { some: { managerId: user.userId, deletedAt: null } } }, ownAssignedProjectsScope],
          }
        : { tenantId, sites: { some: { managerId: user.userId, deletedAt: null } } };
    }
    if (user.role === UserRole.EMPLOYEE) {
      return { tenantId, ...ownAssignedProjectsScope };
    }

    return { tenantId };
  }
}
