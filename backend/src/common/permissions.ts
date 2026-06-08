import { UserRole } from '@prisma/client';

export const rolePermissions: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['platform:*', 'tenants:*', 'subscriptions:*', 'reports:global'],
  RESOURCE_MANAGER: ['tenant:*', 'users:*', 'employees:*', 'projects:*', 'sites:*', 'reports:*', 'settings:*'],
  HR: ['employees:*', 'leave:*', 'reports:hr', 'reports:payroll', 'settings:leave'],
  PROJECT_MANAGER: ['team:read', 'projects:read', 'attendance:approve', 'timesheets:approve', 'leave:approve', 'reports:project', 'reports:site'],
  MANAGER: ['team:read', 'attendance:approve', 'timesheets:approve', 'leave:approve', 'reports:site'],
  EMPLOYEE: ['attendance:self', 'timesheets:self', 'leave:self', 'profile:self'],
};

export function permissionsForRole(role: UserRole) {
  return rolePermissions[role] ?? [];
}

export function canApproveTenantWide(role: UserRole) {
  return role === 'RESOURCE_MANAGER' || role === 'HR';
}
