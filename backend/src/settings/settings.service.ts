import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { CurrentUserContext } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { UpdateSiteOptionsDto } from './dto/update-site-options.dto';
import { TimesheetPeriodType, UpdateTimesheetSettingsDto } from './dto/update-timesheet-settings.dto';
import { UpdateTimesheetTaskTypesDto } from './dto/update-timesheet-task-types.dto';

const DEFAULT_TIMESHEET_TASK_TYPES = [
  { value: 'EXECUTION', label: 'Execution travaux', isActive: true },
  { value: 'PREPARATION', label: 'Preparation', isActive: true },
  { value: 'REUNION_SITE', label: 'Reunion site', isActive: true },
  { value: 'CONTROLE_QUALITE', label: 'Controle qualite', isActive: true },
  { value: 'ADMINISTRATIF', label: 'Administratif', isActive: true },
  { value: 'AUTRE', label: 'Autre', isActive: true },
];

const DEFAULT_SITE_ROLE_OPTIONS = [
  'Chef de site',
  'Chef d equipe',
  'Technicien',
  'Electricien',
  'Aide electricien',
  'Controle qualite',
  'HSE',
  'Administratif site',
];

const DEFAULT_JOB_TITLE_OPTIONS = [
  'Ressource Manager',
  'Chef de projet',
  'Chef de site',
  'Ingenieur d etude',
  'Technicien d etude',
  'Technicien',
  'Electricien',
  'Administratif',
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

  async timesheetSettings(user: CurrentUserContext) {
    const tenantId = this.requireTenant(user);
    const settings = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });

    return {
      timesheetPeriod: settings.timesheetPeriodDays === 30 ? TimesheetPeriodType.MONTHLY : TimesheetPeriodType.WEEKLY,
      timesheetPeriodDays: settings.timesheetPeriodDays,
    };
  }

  async updateTimesheetSettings(user: CurrentUserContext, dto: UpdateTimesheetSettingsDto) {
    const tenantId = this.requireTenant(user);
    const periodDays = dto.timesheetPeriod === TimesheetPeriodType.MONTHLY ? 30 : 7;

    const settings = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, timesheetPeriodDays: periodDays },
      update: { timesheetPeriodDays: periodDays },
    });

    return {
      timesheetPeriod: settings.timesheetPeriodDays === 30 ? TimesheetPeriodType.MONTHLY : TimesheetPeriodType.WEEKLY,
      timesheetPeriodDays: settings.timesheetPeriodDays,
    };
  }

  async siteOptions(user: CurrentUserContext) {
    const tenantId = this.requireTenant(user);
    const settings = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, siteRoleOptions: DEFAULT_SITE_ROLE_OPTIONS, jobTitleOptions: DEFAULT_JOB_TITLE_OPTIONS },
      update: {},
    });

    const [projects, sites, employees] = await Promise.all([
      this.prisma.project.findMany({
        where: { tenantId, deletedAt: null, clientName: { not: null } },
        select: { clientName: true },
      }),
      this.prisma.site.findMany({
        where: { tenantId, deletedAt: null },
        select: { clientName: true },
      }),
      this.prisma.employeeProfile.findMany({
        where: { tenantId, user: { deletedAt: null } },
        select: { jobTitle: true },
      }),
    ]);

    const existingClients = [
      ...projects.map((project) => project.clientName),
      ...sites.map((site) => site.clientName),
    ].filter(Boolean) as string[];
    const configuredClients = this.normalizeStringOptions(settings.clientOptions, []);
    const configuredJobTitles = this.normalizeStringOptions(settings.jobTitleOptions, DEFAULT_JOB_TITLE_OPTIONS);
    const existingJobTitles = employees.map((employee) => employee.jobTitle).filter(Boolean);

    return {
      siteRoleOptions: this.normalizeStringOptions(settings.siteRoleOptions, DEFAULT_SITE_ROLE_OPTIONS),
      clientOptions: this.normalizeStringOptions([...configuredClients, ...existingClients], []),
      jobTitleOptions: this.normalizeStringOptions([...configuredJobTitles, ...existingJobTitles], DEFAULT_JOB_TITLE_OPTIONS),
    };
  }

  async updateSiteOptions(user: CurrentUserContext, dto: UpdateSiteOptionsDto) {
    const tenantId = this.requireTenant(user);
    const current = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, siteRoleOptions: DEFAULT_SITE_ROLE_OPTIONS, jobTitleOptions: DEFAULT_JOB_TITLE_OPTIONS },
      update: {},
    });
    const siteRoleOptions =
      dto.siteRoleOptions === undefined
        ? this.normalizeStringOptions(current.siteRoleOptions, DEFAULT_SITE_ROLE_OPTIONS)
        : this.normalizeStringOptions(dto.siteRoleOptions, DEFAULT_SITE_ROLE_OPTIONS, true, 'role sur site');
    const clientOptions =
      dto.clientOptions === undefined
        ? this.normalizeStringOptions(current.clientOptions, [])
        : this.normalizeStringOptions(dto.clientOptions, []);
    const jobTitleOptions =
      dto.jobTitleOptions === undefined
        ? this.normalizeStringOptions(current.jobTitleOptions, DEFAULT_JOB_TITLE_OPTIONS)
        : this.normalizeStringOptions(dto.jobTitleOptions, DEFAULT_JOB_TITLE_OPTIONS, true, 'poste');

    const settings = await this.prisma.tenantSettings.update({
      where: { tenantId },
      data: {
        ...(dto.siteRoleOptions !== undefined && { siteRoleOptions }),
        ...(dto.clientOptions !== undefined && { clientOptions }),
        ...(dto.jobTitleOptions !== undefined && { jobTitleOptions }),
      },
    });

    return {
      siteRoleOptions: this.normalizeStringOptions(settings.siteRoleOptions, DEFAULT_SITE_ROLE_OPTIONS),
      clientOptions: this.normalizeStringOptions(settings.clientOptions, []),
      jobTitleOptions: this.normalizeStringOptions(settings.jobTitleOptions, DEFAULT_JOB_TITLE_OPTIONS),
    };
  }

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

  private normalizeStringOptions(input: unknown, fallback: string[], strict = false, label = 'option') {
    const raw = Array.isArray(input) ? input : fallback;
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const item of raw) {
      const value = String(item ?? '').trim();
      if (!value) continue;

      const key = value.toLocaleLowerCase('fr-FR');
      if (seen.has(key)) continue;

      seen.add(key);
      normalized.push(value);
    }

    if (!normalized.length) {
      if (strict) throw new BadRequestException(`Au moins un ${label} est requis.`);
      return fallback;
    }

    return normalized;
  }
}
