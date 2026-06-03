import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CurrentUserContext } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ReactivateTenantStatus } from './dto/reactivate-tenant.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        subscriptionPlan: true,
        _count: { select: { users: true, sites: true } },
      },
    });
  }

  findOne(id: string) {
    return this.prisma.tenant.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: {
        subscriptionPlan: true,
        users: { select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true } },
        sites: { where: { deletedAt: null } },
      },
    });
  }

  async create(user: CurrentUserContext, dto: CreateTenantDto) {
    const tenant = await this.prisma.tenant.create({
      data: {
        ...dto,
        status: dto.status ?? TenantStatus.TRIAL,
      },
    });

    await this.auditLog.log({
      tenantId: tenant.id,
      userId: user.userId,
      action: 'tenant.created',
      entityType: 'Tenant',
      entityId: tenant.id,
      metadata: { status: tenant.status, slug: tenant.slug },
    });

    return tenant;
  }

  async update(user: CurrentUserContext, id: string, dto: UpdateTenantDto) {
    const before = await this.prisma.tenant.findUniqueOrThrow({ where: { id } });
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: dto,
    });

    await this.auditLog.log({
      tenantId: id,
      userId: user.userId,
      action: 'tenant.updated',
      entityType: 'Tenant',
      entityId: id,
      metadata: {
        oldStatus: before.status,
        newStatus: tenant.status,
        changedFields: Object.keys(dto),
      },
    });

    return tenant;
  }

  async suspend(user: CurrentUserContext, id: string) {
    const before = await this.prisma.tenant.findUniqueOrThrow({ where: { id } });
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.SUSPENDED },
    });

    await this.auditLog.log({
      tenantId: id,
      userId: user.userId,
      action: 'tenant.suspended',
      entityType: 'Tenant',
      entityId: id,
      metadata: { oldStatus: before.status, newStatus: tenant.status },
    });

    return tenant;
  }

  async reactivate(user: CurrentUserContext, id: string, status: ReactivateTenantStatus = TenantStatus.ACTIVE) {
    if (![TenantStatus.ACTIVE, TenantStatus.TRIAL].includes(status)) {
      throw new BadRequestException('A tenant can only be reactivated as ACTIVE or TRIAL');
    }

    const before = await this.prisma.tenant.findUniqueOrThrow({ where: { id } });
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status, deletedAt: null },
    });

    await this.auditLog.log({
      tenantId: id,
      userId: user.userId,
      action: 'tenant.reactivated',
      entityType: 'Tenant',
      entityId: id,
      metadata: { oldStatus: before.status, newStatus: tenant.status },
    });

    return tenant;
  }

  async softDelete(user: CurrentUserContext, id: string) {
    const before = await this.prisma.tenant.findUniqueOrThrow({ where: { id } });
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { deletedAt: new Date(), status: TenantStatus.SUSPENDED },
    });

    await this.auditLog.log({
      tenantId: id,
      userId: user.userId,
      action: 'tenant.deleted',
      entityType: 'Tenant',
      entityId: id,
      metadata: { oldStatus: before.status, newStatus: tenant.status },
    });

    return tenant;
  }

  findPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { priceMonthly: 'asc' },
      include: { _count: { select: { tenants: true } } },
    });
  }

  createPlan(dto: CreateSubscriptionPlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: dto,
    });
  }

  updatePlan(id: string, dto: UpdateSubscriptionPlanDto) {
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: dto,
    });
  }
}
