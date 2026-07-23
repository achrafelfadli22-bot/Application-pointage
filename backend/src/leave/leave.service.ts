import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { LeaveRequestStatus, Prisma, UserRole } from '@prisma/client';
import { Readable } from 'stream';
import { AuditLogService } from '../audit-log/audit-log.service';
import { HierarchyService } from '../common/hierarchy.service';
import { CurrentUserContext } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
    private readonly hierarchy: HierarchyService,
  ) {}

  findTypes(user: CurrentUserContext) {
    return this.prisma.leaveType.findMany({
      where: { tenantId: user.tenantId ?? '__missing__', status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  async findBalances(user: CurrentUserContext, userId?: string) {
    return this.prisma.leaveBalance.findMany({
      where: {
        tenantId: user.tenantId ?? '__missing__',
        userId: await this.scopedUserIdFilter(user, userId),
      },
      include: { leaveType: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { year: 'desc' },
    });
  }

  async findRequests(user: CurrentUserContext, status?: LeaveRequestStatus, view?: 'mine' | 'managed') {
    const requestScope: Prisma.LeaveRequestWhereInput = view === 'mine'
      ? { tenantId: user.tenantId ?? '__missing__', userId: user.userId }
      : view === 'managed'
        ? { AND: [await this.scope(user), { userId: { not: user.userId } }] }
        : await this.scope(user);
    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        ...requestScope,
        status,
      },
      include: {
        leaveType: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });
    return Promise.all(requests.map(async (request) => ({
      ...request,
      attachmentUrl: request.attachmentKey
        ? await this.storage.presignedGetObject(request.attachmentKey, 15 * 60)
        : null,
      approvalPermissions: {
        canApproveReject:
          (request.status === LeaveRequestStatus.SUBMITTED &&
            await this.hierarchy.isProjectManagerForUser(request.tenantId, request.userId, user.userId)) ||
          (request.status === LeaveRequestStatus.N1_APPROVED && user.role === UserRole.RESOURCE_MANAGER),
      },
    })));
  }

  async createRequest(user: CurrentUserContext, dto: CreateLeaveRequestDto) {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant scope is required');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const durationDays = await this.calculateDurationDays(
      user.tenantId,
      startDate,
      endDate,
      dto.startHalfDay,
      dto.endHalfDay,
    );
    await this.prisma.leaveType.findFirstOrThrow({
      where: { id: dto.leaveTypeId, tenantId: user.tenantId, status: 'ACTIVE' },
    });

    return this.prisma.leaveRequest.create({
      data: {
        tenantId: user.tenantId,
        userId: user.userId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        durationDays,
        startHalfDay: dto.startHalfDay ?? false,
        endHalfDay: dto.endHalfDay ?? false,
        comment: dto.comment,
      },
      include: { leaveType: true },
    });
  }

  submit(user: CurrentUserContext, id: string) {
    return this.transition(user, id, LeaveRequestStatus.SUBMITTED, 'leave.submitted');
  }

  approve(user: CurrentUserContext, id: string) {
    return this.transition(user, id, LeaveRequestStatus.APPROVED, 'leave.approved');
  }

  reject(user: CurrentUserContext, id: string, reason: string) {
    return this.transition(user, id, LeaveRequestStatus.REJECTED, 'leave.rejected', reason);
  }

  cancel(user: CurrentUserContext, id: string) {
    return this.transition(user, id, LeaveRequestStatus.CANCELLED, 'leave.cancelled');
  }

  async uploadAttachment(
    user: CurrentUserContext,
    id: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const request = await this.prisma.leaveRequest.findFirstOrThrow({
      where: { id, ...(await this.scope(user)) },
    });

    if (request.userId !== user.userId && user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('Not authorized to upload attachment for this request');
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF, JPEG, PNG and WebP files are allowed');
    }

    const key = this.storage.documentKey(
      request.tenantId,
      'leave',
      `${id}-${file.originalname}`,
    );

    const readable = Readable.from(file.buffer);
    await this.storage.putObject(
      key,
      readable,
      file.size,
      { 'Content-Type': file.mimetype },
    );

    const url = await this.storage.presignedGetObject(
      key,
      7 * 24 * 3600, // 7 days
    );

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { attachmentKey: key, attachmentUrl: url },
    });

    await this.auditLog.log({
      tenantId: request.tenantId,
      userId: user.userId,
      action: 'leave.attachment.uploaded',
      entityType: 'LeaveRequest',
      entityId: id,
      metadata: { key, mimetype: file.mimetype, size: file.size },
    });

    return updated;
  }

  private async transition(
    user: CurrentUserContext,
    id: string,
    nextStatus: LeaveRequestStatus,
    action: string,
    comment?: string,
  ) {
    const request = await this.prisma.leaveRequest.findFirstOrThrow({
      where: { id, ...(await this.scope(user)) },
      include: { leaveType: true },
    });

    if (nextStatus === LeaveRequestStatus.SUBMITTED && request.userId !== user.userId) {
      throw new ForbiddenException('Only owner can submit leave request');
    }

    if (nextStatus === LeaveRequestStatus.CANCELLED && request.userId !== user.userId && user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('Employees can cancel only their own request');
    }
    this.assertTransition(request.status, nextStatus);

    const oldStatus = request.status;
    const effectiveStatus = await this.resolveApprovalStatus(user, request, nextStatus);
    const effectiveAction = effectiveStatus === LeaveRequestStatus.N1_APPROVED ? 'leave.n1_approved' : action;
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.applyBalanceTransition(tx, request, effectiveStatus);

      const updatedRequest = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: effectiveStatus,
          submittedAt: effectiveStatus === LeaveRequestStatus.SUBMITTED ? new Date() : request.submittedAt,
          approvedById: effectiveStatus === LeaveRequestStatus.APPROVED ? user.userId : request.approvedById,
          approvedAt: effectiveStatus === LeaveRequestStatus.APPROVED ? new Date() : request.approvedAt,
          rejectedById: effectiveStatus === LeaveRequestStatus.REJECTED ? user.userId : null,
          rejectedAt: effectiveStatus === LeaveRequestStatus.REJECTED ? new Date() : null,
          rejectionReason: effectiveStatus === LeaveRequestStatus.REJECTED ? comment : null,
        },
        include: { leaveType: true, user: true },
      });

      if (effectiveStatus === LeaveRequestStatus.APPROVED) {
        await tx.planningDayEntry.updateMany({
          where: {
            tenantId: request.tenantId,
            entryDate: { gte: request.startDate, lte: request.endDate },
            planningLine: { userId: request.userId },
          },
          data: { hours: 0 },
        });
      }
      return updatedRequest;
    });

    await this.prisma.approvalAction.create({
      data: {
        tenantId: request.tenantId,
        entityType: 'LEAVE_REQUEST',
        entityId: request.id,
        actionById: user.userId,
        oldStatus,
        newStatus: effectiveStatus,
        comment,
      },
    });

    await this.auditLog.log({
      tenantId: request.tenantId,
      userId: user.userId,
      action: effectiveAction,
      entityType: 'LeaveRequest',
      entityId: id,
      metadata: { oldStatus, newStatus: effectiveStatus, durationDays: Number(request.durationDays) },
    });

    if (effectiveStatus === LeaveRequestStatus.APPROVED || effectiveStatus === LeaveRequestStatus.REJECTED) {
      await this.notifications.create({
        tenantId: request.tenantId,
        userId: request.userId,
        title: effectiveStatus === LeaveRequestStatus.APPROVED ? 'Conge approuve' : 'Conge rejete',
        message: `Votre demande ${request.leaveType.name} a change de statut.`,
        type: `LEAVE_${effectiveStatus}`,
      });

      // Email transactionnel à l'employé
      const employee = await this.prisma.user.findUnique({
        where: { id: request.userId },
        select: { email: true, firstName: true, lastName: true },
      });
      if (employee) {
        const fullName = `${employee.firstName} ${employee.lastName}`;
        const start = request.startDate.toLocaleDateString('fr-FR');
        const end = request.endDate.toLocaleDateString('fr-FR');
        if (effectiveStatus === LeaveRequestStatus.APPROVED) {
          void this.mail.sendLeaveApproved(employee.email, fullName, request.leaveType.name, start, end);
        } else {
          void this.mail.sendLeaveRejected(employee.email, fullName, request.leaveType.name, start, end, comment);
        }
      }
    }

    // Email aux approbateurs lors de la soumission
    if (effectiveStatus === LeaveRequestStatus.SUBMITTED) {
      const employee = await this.prisma.user.findUnique({
        where: { id: request.userId },
        select: { firstName: true, lastName: true },
      });
      if (employee && request.tenantId) {
        const hierarchy = await this.hierarchy.approverIdsFor(request.tenantId, request.userId);
        const approverIds = [...new Set([...hierarchy.n1Ids, ...hierarchy.n2Ids])];
        const approvers = await this.prisma.user.findMany({
          where: approverIds.length
            ? { id: { in: approverIds }, tenantId: request.tenantId, status: 'ACTIVE' }
            : { tenantId: request.tenantId, role: { in: ['RESOURCE_MANAGER', 'HR'] }, status: 'ACTIVE' },
          select: { email: true, firstName: true, lastName: true },
          take: 5,
        });
        const employeeName = `${employee.firstName} ${employee.lastName}`;
        const start = request.startDate.toLocaleDateString('fr-FR');
        const end = request.endDate.toLocaleDateString('fr-FR');
        for (const approver of approvers) {
          void this.mail.sendLeaveSubmittedToApprover(
            approver.email,
            `${approver.firstName} ${approver.lastName}`,
            employeeName,
            request.leaveType.name,
            start,
            end,
            Number(request.durationDays),
          );
        }
      }
    }

    return updated;
  }

  private async applyBalanceTransition(
    tx: Prisma.TransactionClient,
    request: {
      tenantId: string;
      userId: string;
      leaveTypeId: string;
      startDate: Date;
      durationDays: Prisma.Decimal;
      status: LeaveRequestStatus;
    },
    nextStatus: LeaveRequestStatus,
  ) {
    const year = request.startDate.getUTCFullYear();
    const balance = await tx.leaveBalance.findFirst({
      where: {
        tenantId: request.tenantId,
        userId: request.userId,
        leaveTypeId: request.leaveTypeId,
        year,
      },
    });

    if (!balance) {
      return;
    }

    const duration = Number(request.durationDays);
    let pendingDays = Number(balance.pendingDays);
    let usedDays = Number(balance.usedDays);

    if (request.status === LeaveRequestStatus.DRAFT && nextStatus === LeaveRequestStatus.SUBMITTED) {
      pendingDays += duration;
    }

    if (
      (request.status === LeaveRequestStatus.SUBMITTED || request.status === LeaveRequestStatus.N1_APPROVED) &&
      nextStatus === LeaveRequestStatus.APPROVED
    ) {
      pendingDays -= duration;
      usedDays += duration;
    }

    if (
      (request.status === LeaveRequestStatus.SUBMITTED || request.status === LeaveRequestStatus.N1_APPROVED) &&
      (nextStatus === LeaveRequestStatus.REJECTED || nextStatus === LeaveRequestStatus.CANCELLED)
    ) {
      pendingDays -= duration;
    }

    const remainingDays = Number(balance.openingBalance) + Number(balance.accruedDays) - usedDays - pendingDays;

    await tx.leaveBalance.update({
      where: { id: balance.id },
      data: {
        pendingDays: Math.max(0, pendingDays),
        usedDays: Math.max(0, usedDays),
        remainingDays,
      },
    });
  }

  private async calculateDurationDays(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    startHalfDay?: boolean,
    endHalfDay?: boolean,
  ) {
    const holidays = await this.prisma.holiday.findMany({
      where: { tenantId, date: { gte: startDate, lte: endDate } },
      select: { date: true },
    });
    const holidayKeys = new Set(holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)));

    let days = 0;
    for (let cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const day = cursor.getUTCDay();
      const key = cursor.toISOString().slice(0, 10);
      if (day !== 0 && day !== 6 && !holidayKeys.has(key)) {
        days += 1;
      }
    }

    if (startHalfDay) {
      days -= 0.5;
    }
    if (endHalfDay && endDate.toISOString() !== startDate.toISOString()) {
      days -= 0.5;
    }

    return Math.max(0.5, days);
  }

  private async resolveApprovalStatus(
    user: CurrentUserContext,
    request: { tenantId: string; userId: string; status: LeaveRequestStatus },
    requestedStatus: LeaveRequestStatus,
  ) {
    if (requestedStatus !== LeaveRequestStatus.APPROVED && requestedStatus !== LeaveRequestStatus.REJECTED) {
      return requestedStatus;
    }

    const isAssignedProjectManager = request.status === LeaveRequestStatus.SUBMITTED &&
      await this.hierarchy.isProjectManagerForUser(request.tenantId, request.userId, user.userId);

    if (requestedStatus === LeaveRequestStatus.REJECTED) {
      const canReject =
        isAssignedProjectManager ||
        (user.role === UserRole.RESOURCE_MANAGER && request.status === LeaveRequestStatus.N1_APPROVED);
      if (!canReject) {
        throw new ForbiddenException("Vous ne pouvez pas refuser cette demande à cette étape.");
      }
      return LeaveRequestStatus.REJECTED;
    }

    if (isAssignedProjectManager) {
      return LeaveRequestStatus.N1_APPROVED;
    }

    if (user.role === UserRole.RESOURCE_MANAGER && request.status === LeaveRequestStatus.N1_APPROVED) {
      return LeaveRequestStatus.APPROVED;
    }

    if (user.role === UserRole.RESOURCE_MANAGER && request.status === LeaveRequestStatus.SUBMITTED) {
      throw new BadRequestException("L'approbation du chef de projet est requise avant celle du Resource Manager.");
    }

    throw new BadRequestException("Cette demande n'attend pas votre niveau d'approbation.");
  }

  private assertTransition(currentStatus: LeaveRequestStatus, nextStatus: LeaveRequestStatus) {
    if (nextStatus === LeaveRequestStatus.SUBMITTED && currentStatus !== LeaveRequestStatus.DRAFT) {
      throw new BadRequestException('Only draft leave requests can be submitted');
    }

    if (
      (nextStatus === LeaveRequestStatus.APPROVED || nextStatus === LeaveRequestStatus.REJECTED) &&
      currentStatus !== LeaveRequestStatus.SUBMITTED &&
      currentStatus !== LeaveRequestStatus.N1_APPROVED
    ) {
      throw new BadRequestException('Only submitted leave requests can be approved or rejected');
    }

    if (
      nextStatus === LeaveRequestStatus.CANCELLED &&
      currentStatus !== LeaveRequestStatus.DRAFT &&
      currentStatus !== LeaveRequestStatus.SUBMITTED &&
      currentStatus !== LeaveRequestStatus.N1_APPROVED
    ) {
      throw new BadRequestException('Only draft or pending leave requests can be cancelled');
    }
  }

  private async scope(user: CurrentUserContext): Promise<Prisma.LeaveRequestWhereInput> {
    if (user.role === UserRole.SUPER_ADMIN) {
      return {};
    }

    const tenantId = user.tenantId ?? '__missing__';
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    return managedUserIds
      ? { tenantId, userId: { in: [...new Set([user.userId, ...managedUserIds])] } }
      : { tenantId };
  }

  async capabilities(user: CurrentUserContext) {
    if (!user.tenantId) return { canAccessRequests: false, isProjectManager: false };
    const managedProject = await this.prisma.project.findFirst({
      where: { tenantId: user.tenantId, projectManagerId: user.userId, deletedAt: null },
      select: { id: true },
    });
    const isProjectManager = Boolean(managedProject);
    return {
      isProjectManager,
      canAccessRequests: isProjectManager || user.role === UserRole.RESOURCE_MANAGER || user.role === UserRole.HR,
    };
  }

  private async scopedUserIdFilter(user: CurrentUserContext, requestedUserId?: string) {
    const managedUserIds = await this.hierarchy.managedUserIds(user);
    if (!managedUserIds) {
      return requestedUserId;
    }
    const allowedUserIds = [...new Set([user.userId, ...managedUserIds])];
    if (requestedUserId) {
      return allowedUserIds.includes(requestedUserId) ? requestedUserId : '__forbidden__';
    }
    return { in: allowedUserIds };
  }
}
