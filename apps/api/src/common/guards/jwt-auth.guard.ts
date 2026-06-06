import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { permissionsForRole } from '../permissions';
import { AuthContextCacheService } from '../auth-context-cache.service';
import { CurrentUserContext } from '../types';
import { PrismaService } from '../../prisma/prisma.service';

type JwtPayload = {
  sub: string;
  typ: 'access' | 'refresh';
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authContextCache: AuthContextCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: CurrentUserContext }>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const cachedUser = await this.authContextCache.getUser(payload.sub);
    if (cachedUser) {
      request.user = cachedUser;
      return true;
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        deletedAt: null,
        status: UserStatus.ACTIVE,
      },
      include: { tenant: { select: { id: true, status: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User is not active');
    }

    const currentUser: CurrentUserContext = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      permissions: permissionsForRole(user.role),
      email: user.email,
      fullName: `${user.firstName} ${user.lastName}`,
    };
    request.user = currentUser;

    await Promise.all([
      this.authContextCache.setUser(currentUser),
      user.tenant ? this.authContextCache.setTenant(user.tenant) : Promise.resolve(),
    ]);

    return true;
  }
}
