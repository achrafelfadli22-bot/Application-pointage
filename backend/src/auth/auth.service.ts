import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MailService } from '../mail/mail.service';
import { assertStrongPassword } from '../common/password-policy';
import { permissionsForRole } from '../common/permissions';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly mail: MailService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { tenant: { include: { subscriptionPlan: true } } },
    });

    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.signTokenPair(user);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 12),
      },
    });

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'login',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email },
    });

    return {
      ...tokens,
      user: this.toProfile(user),
      tenant: user.tenant,
      role: user.role,
      permissions: permissionsForRole(user.role),
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; typ: 'refresh' };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, status: UserStatus.ACTIVE },
      include: { tenant: true },
    });

    if (!user?.refreshTokenHash) {
      throw new ForbiddenException('Refresh token was revoked');
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw new ForbiddenException('Refresh token does not match');
    }

    const tokens = await this.signTokenPair(user);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 12) },
    });

    return {
      ...tokens,
      user: this.toProfile(user),
      tenant: user.tenant,
      role: user.role,
      permissions: permissionsForRole(user.role),
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    return { message: 'Logged out' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      include: { tenant: true, employeeProfile: { include: { mainSite: true } } },
    });

    return {
      user: this.toProfile(user),
      tenant: user.tenant,
      employeeProfile: user.employeeProfile,
      role: user.role,
      permissions: permissionsForRole(user.role),
    };
  }

  // ─── Mot de passe oublié ──────────────────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null, status: UserStatus.ACTIVE },
    });

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone?.trim() || null,
      },
    });

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'auth.profile_updated',
      entityType: 'User',
      entityId: user.id,
    });

    return { user: this.toProfile(updated) };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    assertStrongPassword(dto.newPassword, this.config);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: UserStatus.ACTIVE },
    });
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable ou inactif.');
    }

    const currentPasswordMatches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentPasswordMatches) {
      throw new BadRequestException('Le mot de passe actuel est incorrect.');
    }
    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'ancien.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, 12),
        refreshTokenHash: null,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'auth.password_changed',
      entityType: 'User',
      entityId: user.id,
    });

    return { message: 'Mot de passe modifié avec succès.' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Always return success to avoid email enumeration attacks
    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      return { message: 'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.' };
    }

    // Generate a secure random token (hex 32 bytes = 64 chars)
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: await bcrypt.hash(token, 10),
        passwordResetExpiry: expiry,
      },
    });

    const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
    const resetUrl = `${webOrigin}/reset-password?token=${token}_${user.id}`;

    // Send best-effort (non-blocking)
    void this.mail.sendPasswordReset(user.email, `${user.firstName} ${user.lastName}`, resetUrl);

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'auth.forgot_password',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email },
    });

    return { message: 'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    assertStrongPassword(dto.password, this.config);

    // Token format: <rawToken>_<userId>
    const separatorIdx = dto.token.lastIndexOf('_');
    if (separatorIdx === -1) {
      throw new BadRequestException('Lien de réinitialisation invalide.');
    }

    const rawToken = dto.token.slice(0, separatorIdx);
    const userId   = dto.token.slice(separatorIdx + 1);

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        status: UserStatus.ACTIVE,
        passwordResetExpiry: { gt: new Date() },
      },
    });

    if (!user?.passwordResetToken) {
      throw new BadRequestException('Lien de réinitialisation invalide ou expiré.');
    }

    const tokenMatches = await bcrypt.compare(rawToken, user.passwordResetToken);
    if (!tokenMatches) {
      throw new BadRequestException('Lien de réinitialisation invalide ou expiré.');
    }

    const newHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
        refreshTokenHash: null, // invalidate all sessions
      },
    });

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'auth.reset_password',
      entityType: 'User',
      entityId: user.id,
    });

    return { message: 'Mot de passe réinitialisé avec succès.' };
  }

  // ─── Helpers privés ───────────────────────────────────────────────────────

  private async signTokenPair(user: User): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: user.id, typ: 'access' },
        {
          secret: this.config.get<string>('JWT_ACCESS_SECRET'),
          expiresIn: (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m') as never,
        },
      ),
      this.jwtService.signAsync(
        { sub: user.id, typ: 'refresh' },
        {
          secret: this.config.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d') as never,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private toProfile(user: User) {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
