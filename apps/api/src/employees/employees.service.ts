import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthContextCacheService } from '../common/auth-context-cache.service';
import { HierarchyService } from '../common/hierarchy.service';
import { assertStrongPassword } from '../common/password-policy';
import { CurrentUserContext } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

type EmployeeFilters = {
  search?: string;
  role?: UserRole;
  siteId?: string;
  status?: string;
};

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
    private readonly hierarchy: HierarchyService,
    private readonly authContextCache: AuthContextCacheService,
  ) {}

  async findAll(user: CurrentUserContext, filters: EmployeeFilters) {
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    const where: Prisma.EmployeeProfileWhereInput = {
      ...(this.tenantFilter(user) as Prisma.EmployeeProfileWhereInput),
      userId: managedUserIds ? { in: managedUserIds } : undefined,
      status: filters.status as never,
      mainSiteId: filters.siteId,
      user: {
        deletedAt: null,
        role: filters.role,
        OR: filters.search
          ? [
              { firstName: { contains: filters.search, mode: 'insensitive' } },
              { lastName: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
    };

    return this.prisma.employeeProfile.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, status: true } },
        mainSite: { select: { id: true, code: true, name: true, city: true } },
      },
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
    });
  }

  async findOne(user: CurrentUserContext, id: string) {
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    const employee = await this.prisma.employeeProfile.findFirst({
      where: {
        id,
        ...(this.tenantFilter(user) as Prisma.EmployeeProfileWhereInput),
        userId: managedUserIds ? { in: managedUserIds } : undefined,
      },
      include: {
        user: true,
        mainSite: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (user.role === UserRole.EMPLOYEE && employee.userId !== user.userId) {
      throw new ForbiddenException('Employees can only read their own profile');
    }

    return employee;
  }

  async create(user: CurrentUserContext, dto: CreateEmployeeDto) {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant scope is required');
    }
    this.assertTenantUserRole(dto.role);

    const rawPassword = dto.password ?? 'Password123!';
    assertStrongPassword(rawPassword, this.config);
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    const employee = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          tenantId: user.tenantId,
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: dto.role,
        },
      });

      return tx.employeeProfile.create({
        data: {
          tenantId: user.tenantId!,
          userId: createdUser.id,
          employeeNumber: dto.employeeNumber,
          jobTitle: dto.jobTitle,
          contractType: dto.contractType,
          hireDate: new Date(dto.hireDate),
          mainSiteId: dto.mainSiteId,
          annualLeaveBalance: dto.annualLeaveBalance ?? 0,
          hourlyRate: dto.hourlyRate,
          status: dto.status,
        },
        include: { user: true, mainSite: true },
      });
    });

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'employee.created',
      entityType: 'EmployeeProfile',
      entityId: employee.id,
      metadata: { employeeNumber: employee.employeeNumber },
    });

    return employee;
  }

  async update(user: CurrentUserContext, id: string, dto: UpdateEmployeeDto) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id, ...(this.tenantFilter(user) as Prisma.EmployeeProfileWhereInput) },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (dto.role) {
      this.assertTenantUserRole(dto.role);
    }

    assertStrongPassword(dto.password, this.config);
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: employee.userId },
        data: {
          email: dto.email?.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: dto.role,
        },
      });

      return tx.employeeProfile.update({
        where: { id },
        data: {
          employeeNumber: dto.employeeNumber,
          jobTitle: dto.jobTitle,
          contractType: dto.contractType,
          hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
          mainSiteId: dto.mainSiteId,
          annualLeaveBalance: dto.annualLeaveBalance,
          hourlyRate: dto.hourlyRate,
          status: dto.status,
        },
        include: { user: true, mainSite: true },
      });
    });

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'employee.updated',
      entityType: 'EmployeeProfile',
      entityId: id,
    });

    await this.authContextCache.clearUser(employee.userId);

    return updated;
  }

  async softDelete(user: CurrentUserContext, id: string) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id, ...(this.tenantFilter(user) as Prisma.EmployeeProfileWhereInput) },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const deleted = await this.prisma.user.update({
      where: { id: employee.userId },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'employee.deactivated',
      entityType: 'User',
      entityId: deleted.id,
    });

    await this.authContextCache.clearUser(deleted.id);

    return deleted;
  }

  private tenantFilter(user: CurrentUserContext) {
    return user.role === UserRole.SUPER_ADMIN ? {} : { tenantId: user.tenantId };
  }

  private assertTenantUserRole(role: UserRole) {
    if (role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('SUPER_ADMIN cannot be assigned to a tenant employee');
    }
  }
}
