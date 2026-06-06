import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthContextCacheService } from '../common/auth-context-cache.service';
import { assertStrongPassword } from '../common/password-policy';
import { CurrentUserContext } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly authContextCache: AuthContextCacheService,
  ) {}

  findAll(user: CurrentUserContext) {
    return this.prisma.user.findMany({
      where: this.tenantWhere(user),
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        tenantId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
      },
    });
  }

  async create(user: CurrentUserContext, dto: CreateUserDto) {
    this.assertCanAssignRole(user, dto.role);

    assertStrongPassword(dto.password, this.config);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        tenantId: user.role === UserRole.SUPER_ADMIN ? null : user.tenantId,
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: dto.role,
        status: dto.status,
      },
    });
  }

  async update(user: CurrentUserContext, id: string, dto: UpdateUserDto) {
    const target = await this.prisma.user.findFirstOrThrow({
      where: { id, ...this.tenantWhere(user) },
    });

    if (target.role === UserRole.SUPER_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot update platform admin');
    }
    if (dto.role) {
      this.assertCanAssignRole(user, dto.role);
    }

    assertStrongPassword(dto.password, this.config);
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : undefined;

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email?.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: dto.role,
        status: dto.status,
      },
    });

    await this.authContextCache.clearUser(id);

    return updated;
  }

  private tenantWhere(user: CurrentUserContext) {
    return user.role === UserRole.SUPER_ADMIN
      ? { deletedAt: null }
      : { tenantId: user.tenantId, deletedAt: null };
  }

  private assertCanAssignRole(user: CurrentUserContext, role: UserRole) {
    if (role === UserRole.SUPER_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only platform admins can assign the SUPER_ADMIN role');
    }
  }
}
