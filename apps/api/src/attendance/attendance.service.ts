import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AttendanceStatus, Prisma, UserRole, WorkLocation } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { HierarchyService } from '../common/hierarchy.service';
import { haversineDistanceMeters } from '../common/utils/haversine';
import { MailService } from '../mail/mail.service';
import { CurrentUserContext } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mail: MailService,
    private readonly hierarchy: HierarchyService,
  ) {}

  async checkIn(user: CurrentUserContext, dto: CheckInDto) {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant scope is required');
    }

    if (dto.workLocation === WorkLocation.SITE && !dto.siteId) {
      throw new BadRequestException('siteId is required for site attendance');
    }

    const openPunch = await this.prisma.attendancePunch.findFirst({
      where: {
        tenantId: user.tenantId,
        userId: user.userId,
        checkOutAt: null,
        status: { not: AttendanceStatus.REJECTED },
      },
    });

    if (openPunch) {
      throw new BadRequestException('An open check-in already exists');
    }

    const site = dto.siteId
      ? await this.prisma.site.findFirstOrThrow({
          where: { id: dto.siteId, tenantId: user.tenantId, deletedAt: null },
        })
      : null;

    const isGpsAnomaly = this.isGpsAnomaly(site, dto.latitude, dto.longitude);
    const now = new Date();

    const punch = await this.prisma.attendancePunch.create({
      data: {
        tenantId: user.tenantId,
        userId: user.userId,
        siteId: site?.id,
        punchDate: this.dateOnly(now),
        checkInAt: now,
        workLocation: dto.workLocation,
        checkInLatitude: dto.latitude,
        checkInLongitude: dto.longitude,
        isGpsAnomaly,
        employeeComment: dto.employeeComment,
        status: AttendanceStatus.DRAFT,
      },
      include: { site: true, user: { select: { firstName: true, lastName: true, email: true } } },
    });

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'attendance.check_in',
      entityType: 'AttendancePunch',
      entityId: punch.id,
      metadata: { siteId: site?.id, isGpsAnomaly },
    });

    // Email de confirmation de pointage (best-effort, non bloquant)
    void this.mail.sendCheckInConfirmation(
      punch.user.email,
      `${punch.user.firstName} ${punch.user.lastName}`,
      punch.site?.name ?? 'Hors site',
      now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    );

    return punch;
  }

  async checkOut(user: CurrentUserContext, dto: CheckOutDto) {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant scope is required');
    }

    const punch = await this.prisma.attendancePunch.findFirst({
      where: {
        tenantId: user.tenantId,
        userId: user.userId,
        checkOutAt: null,
        status: { not: AttendanceStatus.REJECTED },
      },
      include: { site: true },
      orderBy: { checkInAt: 'desc' },
    });

    if (!punch?.checkInAt) {
      throw new BadRequestException('Cannot check out without an open check-in');
    }

    const now = new Date();
    const durationMinutes = Math.max(0, Math.round((now.getTime() - punch.checkInAt.getTime()) / 60000));
    const isGpsAnomaly = punch.isGpsAnomaly || this.isGpsAnomaly(punch.site, dto.latitude, dto.longitude);

    const updated = await this.prisma.attendancePunch.update({
      where: { id: punch.id },
      data: {
        checkOutAt: now,
        durationMinutes,
        checkOutLatitude: dto.latitude,
        checkOutLongitude: dto.longitude,
        employeeComment: dto.employeeComment ?? punch.employeeComment,
        isGpsAnomaly,
      },
      include: { site: true, user: { select: { firstName: true, lastName: true, email: true } } },
    });

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'attendance.check_out',
      entityType: 'AttendancePunch',
      entityId: updated.id,
      metadata: { durationMinutes, isGpsAnomaly },
    });

    return updated;
  }

  async findAll(
    user: CurrentUserContext,
    filters: { siteId?: string; userId?: string; status?: AttendanceStatus; gpsAnomaly?: boolean },
  ) {
    return this.prisma.attendancePunch.findMany({
      where: {
        ...this.tenantWhere(user),
        siteId: filters.siteId,
        userId: await this.scopedUserIdFilter(user, filters.userId),
        status: filters.status,
        isGpsAnomaly: filters.gpsAnomaly,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        site: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ punchDate: 'desc' }, { checkInAt: 'desc' }],
      take: 250,
    });
  }

  async today(user: CurrentUserContext) {
    return this.prisma.attendancePunch.findMany({
      where: {
        ...(await this.attendanceScope(user, true)),
        punchDate: this.dateOnly(new Date()),
      },
      include: {
        site: { select: { id: true, code: true, name: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { checkInAt: 'desc' },
    });
  }

  submit(user: CurrentUserContext, id: string) {
    return this.transition(user, id, AttendanceStatus.SUBMITTED, 'attendance.submitted');
  }

  approve(user: CurrentUserContext, id: string) {
    return this.transition(user, id, AttendanceStatus.APPROVED, 'attendance.approved');
  }

  reject(user: CurrentUserContext, id: string, comment: string) {
    return this.transition(user, id, AttendanceStatus.REJECTED, 'attendance.rejected', comment);
  }

  private async transition(
    user: CurrentUserContext,
    id: string,
    status: AttendanceStatus,
    action: string,
    comment?: string,
  ) {
    const punch = await this.prisma.attendancePunch.findFirstOrThrow({
      where: { id, ...(await this.attendanceScope(user)) },
    });

    if (status === AttendanceStatus.SUBMITTED && punch.userId !== user.userId) {
      throw new ForbiddenException('Only owner can submit attendance');
    }
    this.assertTransition(punch.status, status);

    const effectiveStatus = await this.resolveApprovalStatus(user, punch, status);
    const effectiveAction = effectiveStatus === AttendanceStatus.N1_APPROVED ? 'attendance.n1_approved' : action;

    const updated = await this.prisma.attendancePunch.update({
      where: { id },
      data: {
        status: effectiveStatus,
        approvedById: effectiveStatus === AttendanceStatus.APPROVED ? user.userId : punch.approvedById,
        approvedAt: effectiveStatus === AttendanceStatus.APPROVED ? new Date() : punch.approvedAt,
        managerComment: comment ?? punch.managerComment,
      },
    });

    await this.prisma.approvalAction.create({
      data: {
        tenantId: punch.tenantId,
        entityType: 'ATTENDANCE_PUNCH',
        entityId: punch.id,
        actionById: user.userId,
        oldStatus: punch.status,
        newStatus: effectiveStatus,
        comment,
      },
    });

    await this.auditLog.log({
      tenantId: punch.tenantId,
      userId: user.userId,
      action: effectiveAction,
      entityType: 'AttendancePunch',
      entityId: punch.id,
      metadata: { oldStatus: punch.status, newStatus: effectiveStatus },
    });

    return updated;
  }

  private isGpsAnomaly(
    site: { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null; gpsRadiusMeters: number } | null,
    latitude?: number,
    longitude?: number,
  ) {
    if (!site?.latitude || !site.longitude || latitude === undefined || longitude === undefined) {
      return false;
    }

    const distance = haversineDistanceMeters(
      { latitude, longitude },
      { latitude: Number(site.latitude), longitude: Number(site.longitude) },
    );

    return distance > site.gpsRadiusMeters;
  }

  private async resolveApprovalStatus(
    user: CurrentUserContext,
    punch: { tenantId: string; userId: string; siteId: string | null; status: AttendanceStatus },
    requestedStatus: AttendanceStatus,
  ) {
    if (requestedStatus !== AttendanceStatus.APPROVED && requestedStatus !== AttendanceStatus.REJECTED) {
      return requestedStatus;
    }

    const level = await this.hierarchy.approvalLevelFor(user, punch.tenantId, punch.userId, [punch.siteId]);
    if (!level) {
      throw new ForbiddenException('Only N+1, N+2, HR, or resource manager can validate this attendance');
    }

    if (requestedStatus === AttendanceStatus.REJECTED) {
      return AttendanceStatus.REJECTED;
    }

    if (level === 'ADMIN' || level === 'BOTH') {
      return AttendanceStatus.APPROVED;
    }

    if (punch.status === AttendanceStatus.SUBMITTED && level === 'N1') {
      return AttendanceStatus.N1_APPROVED;
    }

    if (punch.status === AttendanceStatus.N1_APPROVED && level === 'N2') {
      return AttendanceStatus.APPROVED;
    }

    if (punch.status === AttendanceStatus.SUBMITTED && level === 'N2') {
      throw new BadRequestException('N+1 approval is required before N+2 approval');
    }

    throw new BadRequestException('This attendance punch is not waiting for your approval level');
  }

  private assertTransition(currentStatus: AttendanceStatus, nextStatus: AttendanceStatus) {
    if (
      nextStatus === AttendanceStatus.SUBMITTED &&
      currentStatus !== AttendanceStatus.DRAFT &&
      currentStatus !== AttendanceStatus.REOPENED
    ) {
      throw new BadRequestException('Only draft or reopened attendance can be submitted');
    }

    if (
      (nextStatus === AttendanceStatus.APPROVED || nextStatus === AttendanceStatus.REJECTED) &&
      currentStatus !== AttendanceStatus.SUBMITTED &&
      currentStatus !== AttendanceStatus.N1_APPROVED
    ) {
      throw new BadRequestException('Only submitted attendance can be approved or rejected');
    }
  }

  private async attendanceScope(user: CurrentUserContext, includeEmployeeSelf = false): Promise<Prisma.AttendancePunchWhereInput> {
    if (user.role === UserRole.SUPER_ADMIN) {
      return {};
    }

    if (user.role === UserRole.EMPLOYEE || includeEmployeeSelf) {
      return { tenantId: user.tenantId ?? '__missing__', userId: user.userId };
    }

    const tenantId = user.tenantId ?? '__missing__';
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    return managedUserIds ? { tenantId, userId: { in: managedUserIds } } : { tenantId };
  }

  private tenantWhere(user: CurrentUserContext): Prisma.AttendancePunchWhereInput {
    return user.role === UserRole.SUPER_ADMIN ? {} : { tenantId: user.tenantId ?? '__missing__' };
  }

  private async scopedUserIdFilter(user: CurrentUserContext, requestedUserId?: string) {
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    if (!managedUserIds) {
      return requestedUserId;
    }
    if (requestedUserId) {
      return managedUserIds.includes(requestedUserId) ? requestedUserId : '__forbidden__';
    }
    return { in: managedUserIds };
  }

  private dateOnly(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
}
