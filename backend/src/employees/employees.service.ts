import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthContextCacheService } from '../common/auth-context-cache.service';
import { HierarchyService } from '../common/hierarchy.service';
import { assertStrongPassword } from '../common/password-policy';
import { CurrentUserContext } from '../common/types';
import { MailService } from '../mail/mail.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeesRepository } from './employees.repository';
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
    private readonly repository: EmployeesRepository,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
    private readonly hierarchy: HierarchyService,
    private readonly authContextCache: AuthContextCacheService,
    private readonly mail: MailService,
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

    return this.repository.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            status: true,
            managedSites: {
              where: { tenantId: user.tenantId ?? '__missing__', deletedAt: null },
              select: { id: true, code: true, name: true, address: true },
              orderBy: { name: 'asc' },
            },
            siteAssignments: {
              where: {
                tenantId: user.tenantId ?? '__missing__',
                ...this.hierarchy.activeAssignmentWhere(),
              },
              select: { site: { select: { id: true, code: true, name: true, address: true } } },
              orderBy: { site: { name: 'asc' } },
            },
          },
        },
        mainSite: { select: { id: true, code: true, name: true, address: true } },
      },
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
    });
  }

  async findOne(user: CurrentUserContext, id: string) {
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    const employee = await this.repository.findFirst({
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
    if (dto.role !== UserRole.EMPLOYEE && dto.role !== UserRole.RESOURCE_MANAGER) {
      throw new ForbiddenException("Le RH peut creer uniquement un employe ou un Ressource Manager.");
    }
    const creationRole = dto.role;

    const passwordSetupRequired = !dto.password;
    const rawPassword = dto.password ?? this.generateTemporaryPassword();
    assertStrongPassword(rawPassword, this.config);
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    const employee = await this.repository.createWithUser({
      tenantId: user.tenantId,
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      role: creationRole,
      profileData: {
        employeeNumber: dto.employeeNumber,
        jobTitle: dto.jobTitle,
        contractType: dto.contractType,
        hireDate: new Date(dto.hireDate),
        mainSiteId: dto.mainSiteId,
        annualLeaveBalance: dto.annualLeaveBalance ?? 0,
        hourlyRate: dto.hourlyRate,
        status: dto.status,
      },
    });

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'employee.created',
      entityType: 'EmployeeProfile',
      entityId: employee.id,
      metadata: { employeeNumber: employee.employeeNumber },
    });

    if (passwordSetupRequired) {
      await this.sendPasswordSetupLink(employee.user.id, employee.user.email, `${employee.user.firstName} ${employee.user.lastName}`);
    }

    return employee;
  }

  async update(user: CurrentUserContext, id: string, dto: UpdateEmployeeDto) {
    const employee = await this.repository.findFirst({
      where: { id, ...(this.tenantFilter(user) as Prisma.EmployeeProfileWhereInput) },
      include: { user: { select: { role: true } } },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (
      user.role === UserRole.HR &&
      dto.role &&
      dto.role !== UserRole.EMPLOYEE &&
      dto.role !== UserRole.RESOURCE_MANAGER
    ) {
      throw new ForbiddenException("Le RH peut attribuer uniquement les statuts Employe et Ressource Manager.");
    }
    if (user.role === UserRole.RESOURCE_MANAGER && dto.role) {
      if (
        dto.role !== UserRole.EMPLOYEE &&
        dto.role !== UserRole.MANAGER &&
        dto.role !== UserRole.PROJECT_MANAGER
      ) {
        throw new ForbiddenException('Le Resource Manager peut attribuer uniquement les roles operationnels.');
      }
    }

    assertStrongPassword(dto.password, this.config);
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : undefined;

    const updated = await this.repository.updateWithUser({
      id,
      userId: employee.userId,
      userData:
        user.role === UserRole.HR
          ? {
              email: dto.email?.toLowerCase(),
              passwordHash,
              firstName: dto.firstName,
              lastName: dto.lastName,
              phone: dto.phone,
              role: dto.role,
            }
          : { role: dto.role },
      profileData:
        user.role === UserRole.HR
          ? {
              employeeNumber: dto.employeeNumber,
              jobTitle: dto.jobTitle,
              contractType: dto.contractType,
              hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
              annualLeaveBalance: dto.annualLeaveBalance,
              hourlyRate: dto.hourlyRate,
              status: dto.status,
            }
          : { mainSiteId: dto.mainSiteId },
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
    const employee = await this.repository.findFirst({
      where: { id, ...(this.tenantFilter(user) as Prisma.EmployeeProfileWhereInput) },
      include: { user: { select: { id: true, role: true } } },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (employee.userId === user.userId) {
      throw new ForbiddenException('Vous ne pouvez pas supprimer votre propre compte.');
    }

    if (
      employee.user.role !== UserRole.EMPLOYEE &&
      employee.user.role !== UserRole.MANAGER &&
      employee.user.role !== UserRole.PROJECT_MANAGER &&
      employee.user.role !== UserRole.RESOURCE_MANAGER
    ) {
      throw new ForbiddenException('Le compte RH ne peut pas etre supprime.');
    }

    const deleted = await this.repository.deactivateEmployee(employee, new Date());

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'employee.deactivated',
      entityType: 'User',
      entityId: deleted.id,
      metadata: { role: employee.user.role },
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

  private generateTemporaryPassword() {
    return `${crypto.randomBytes(24).toString('base64url')}Aa1!`;
  }

  private async sendPasswordSetupLink(userId: string, email: string, fullName: string) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
    const resetUrl = `${webOrigin}/reset-password?token=${rawToken}_${userId}`;

    await this.repository.updateUserPasswordReset(userId, {
      passwordResetToken: await bcrypt.hash(rawToken, 10),
      passwordResetExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    void this.mail.sendPasswordReset(email, fullName, resetUrl);
  }
}
