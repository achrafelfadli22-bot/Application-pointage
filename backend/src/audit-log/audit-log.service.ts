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

export type AuditLogQuery = {
  take?: number;
  cursor?: string;
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

  async findAll(user: CurrentUserContext, query: AuditLogQuery = {}) {
    const take = Math.min(Math.max(Number(query.take ?? 50) || 50, 1), 100);
    const rows = await this.prisma.auditLog.findMany({
      where: user.role === 'SUPER_ADMIN' ? {} : { tenantId: user.tenantId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    const next = rows.length > take ? rows.pop() : null;

    return {
      data: rows,
      nextCursor: next?.id ?? null,
    };
  }
}
