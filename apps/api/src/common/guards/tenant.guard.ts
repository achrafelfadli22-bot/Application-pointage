import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantStatus } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CurrentUserContext } from '../types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: CurrentUserContext }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Missing user context');
    }

    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    if (!user.tenantId) {
      throw new ForbiddenException('Tenant is required');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id: user.tenantId,
        deletedAt: null,
        status: { in: [TenantStatus.ACTIVE, TenantStatus.TRIAL] },
      },
      select: { id: true },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant is suspended or missing');
    }

    return true;
  }
}
