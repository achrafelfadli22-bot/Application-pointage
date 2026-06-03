import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { CurrentUserContext } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { UpdateTimesheetTaskTypesDto } from './dto/update-timesheet-task-types.dto';

const DEFAULT_TIMESHEET_TASK_TYPES = [
  { value: 'EXECUTION', label: 'Execution travaux', isActive: true },
  { value: 'PREPARATION', label: 'Preparation', isActive: true },
  { value: 'REUNION_CHANTIER', label: 'Reunion chantier', isActive: true },
  { value: 'CONTROLE_QUALITE', label: 'Controle qualite', isActive: true },
  { value: 'ADMINISTRATIF', label: 'Administratif', isActive: true },
  { value: 'AUTRE', label: 'Autre', isActive: true },
];

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  company(user: CurrentUserContext) {
    return this.prisma.tenant.findFirstOrThrow({ where: { id: this.requireTenant(user), deletedAt: null } });
  }

  updateCompany(user: CurrentUserContext, dto: UpdateCompanyDto) {
    return this.prisma.tenant.update({
      where: { id: this.requireTenant(user) },
      data: dto,
    });
  }

  holidays(user: CurrentUserContext) {
    return this.prisma.holiday.findMany({
      where: { tenantId: this.requireTenant(user) },
      orderBy: { date: 'asc' },
    });
  }

  createHoliday(user: CurrentUserContext, dto: CreateHolidayDto) {
    return this.prisma.holiday.create({
      data: {
        tenantId: this.requireTenant(user),
        name: dto.name,
        date: new Date(dto.date),
        country: dto.country,
        isRecurring: dto.isRecurring ?? false,
      },
    });
  }

  async updateHoliday(user: CurrentUserContext, id: string, dto: UpdateHolidayDto) {
    await this.prisma.holiday.findFirstOrThrow({ where: { id, tenantId: this.requireTenant(user) } });
    return this.prisma.holiday.update({
      where: { id },
      data: {
        name: dto.name,
        date: dto.date ? new Date(dto.date) : undefined,
        country: dto.country,
        isRecurring: dto.isRecurring,
      },
    });
  }

  async deleteHoliday(user: CurrentUserContext, id: string) {
    await this.prisma.holiday.findFirstOrThrow({ where: { id, tenantId: this.requireTenant(user) } });
    return this.prisma.holiday.delete({ where: { id } });
  }

  leaveTypes(user: CurrentUserContext) {
    return this.prisma.leaveType.findMany({
      where: { tenantId: this.requireTenant(user) },
      orderBy: { name: 'asc' },
    });
  }

  createLeaveType(user: CurrentUserContext, dto: CreateLeaveTypeDto) {
    return this.prisma.leaveType.create({
      data: {
        tenantId: this.requireTenant(user),
        code: dto.code,
        name: dto.name,
        isPaid: dto.isPaid ?? true,
        annualAllowanceDays: dto.annualAllowanceDays ?? 0,
        requiresApproval: dto.requiresApproval ?? true,
        status: dto.status,
      },
    });
  }

  async updateLeaveType(user: CurrentUserContext, id: string, dto: UpdateLeaveTypeDto) {
    await this.prisma.leaveType.findFirstOrThrow({ where: { id, tenantId: this.requireTenant(user) } });
    return this.prisma.leaveType.update({ where: { id }, data: dto });
  }

  async timesheetTaskTypes(user: CurrentUserContext) {
    const tenantId = this.requireTenant(user);
    const settings = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, timesheetTaskTypes: DEFAULT_TIMESHEET_TASK_TYPES },
      update: {},
    });

    return this.normalizeTimesheetTaskTypes(settings.timesheetTaskTypes);
  }

  async updateTimesheetTaskTypes(user: CurrentUserContext, dto: UpdateTimesheetTaskTypesDto) {
    const tenantId = this.requireTenant(user);
    const types = this.normalizeTimesheetTaskTypes(dto.types, true);

    const settings = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, timesheetTaskTypes: types },
      update: { timesheetTaskTypes: types },
    });

    return this.normalizeTimesheetTaskTypes(settings.timesheetTaskTypes);
  }

  // ─── Paramètres de pointage ────────────────────────────────────────────────

  async attendanceSettings(user: CurrentUserContext) {
    const tenantId = this.requireTenant(user);
    // upsert: return existing or default record
    return this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }

  async updateAttendanceSettings(user: CurrentUserContext, dto: UpdateAttendanceDto) {
    const tenantId = this.requireTenant(user);
    return this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        workDayStartTime:     dto.workDayStartTime     ?? '08:00',
        lateToleranceMinutes: dto.lateToleranceMinutes ?? 15,
        gpsToleranceMeters:   dto.gpsToleranceMeters   ?? 150,
        overtimeTriggerHours: dto.overtimeTriggerHours ?? 8,
      },
      update: {
        ...(dto.workDayStartTime     !== undefined && { workDayStartTime:     dto.workDayStartTime }),
        ...(dto.lateToleranceMinutes !== undefined && { lateToleranceMinutes: dto.lateToleranceMinutes }),
        ...(dto.gpsToleranceMeters   !== undefined && { gpsToleranceMeters:   dto.gpsToleranceMeters }),
        ...(dto.overtimeTriggerHours !== undefined && { overtimeTriggerHours: dto.overtimeTriggerHours }),
      },
    });
  }

  private requireTenant(user: CurrentUserContext) {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant scope is required');
    }
    return user.tenantId;
  }

  private normalizeTimesheetTaskTypes(input: unknown, strict = false) {
    const raw = Array.isArray(input) && input.length ? input : DEFAULT_TIMESHEET_TASK_TYPES;
    const seen = new Set<string>();
    const normalized: typeof DEFAULT_TIMESHEET_TASK_TYPES = [];

    for (const item of raw) {
      if (!item || typeof item !== 'object') {
        if (strict) throw new BadRequestException('Chaque type doit etre un objet valide.');
        continue;
      }

      const record = item as Record<string, unknown>;
      const value = this.normalizeTaskTypeValue(String(record.value ?? ''));
      const label = String(record.label ?? '').trim();

      if (!value || !label) {
        if (strict) throw new BadRequestException('Chaque type doit avoir un code et un libelle.');
        continue;
      }

      if (seen.has(value)) {
        if (strict) throw new BadRequestException(`Type timesheet duplique: ${value}`);
        continue;
      }

      seen.add(value);
      normalized.push({
        value,
        label,
        isActive: record.isActive !== false,
      });
    }

    if (!normalized.length) {
      if (strict) throw new BadRequestException('Au moins un type timesheet est requis.');
      return DEFAULT_TIMESHEET_TASK_TYPES;
    }

    return normalized;
  }

  private normalizeTaskTypeValue(value: string) {
    return value
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }
}
