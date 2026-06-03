import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CurrentUserContext } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';

export type AuditLogInput = {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? undefined,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  findAll(user: CurrentUserContext, take = 50) {
    return this.prisma.auditLog.findMany({
      where: user.role === 'SUPER_ADMIN' ? {} : { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }
}
