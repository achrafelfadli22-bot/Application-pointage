'use client';

import type { ApiResponse } from '@pointage360/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export type LoginPayload = {
  email: string;
  password: string;
};

export type SessionPayload = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    role: string;
    tenantId: string | null;
  };
  tenant?: { id: string; name: string; slug: string; status?: string } | null;
  role: string;
  permissions: string[];
};

function storage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export const tokenStore = {
  get accessToken() {
    return storage()?.getItem('pointage360.accessToken') ?? null;
  },
  get refreshToken() {
    return storage()?.getItem('pointage360.refreshToken') ?? null;
  },
  get session() {
    const raw = storage()?.getItem('pointage360.session');
    return raw ? (JSON.parse(raw) as SessionPayload) : null;
  },
  set(session: SessionPayload) {
    storage()?.setItem('pointage360.accessToken', session.accessToken);
    storage()?.setItem('pointage360.refreshToken', session.refreshToken);
    storage()?.setItem('pointage360.session', JSON.stringify(session));
  },
  clear() {
    storage()?.removeItem('pointage360.accessToken');
    storage()?.removeItem('pointage360.refreshToken');
    storage()?.removeItem('pointage360.session');
  },
};

async function refreshToken() {
  if (!tokenStore.refreshToken) {
    return false;
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokenStore.refreshToken }),
  });

  if (!response.ok) {
    tokenStore.clear();
    return false;
  }

  const payload = (await response.json()) as ApiResponse<SessionPayload>;
  if (!payload.data) {
    tokenStore.clear();
    return false;
  }

  tokenStore.set(payload.data);
  return true;
}

function redirectToTenantSuspended() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/tenant-suspended') return;
  window.location.assign('/tenant-suspended');
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');

  if (tokenStore.accessToken) {
    headers.set('Authorization', `Bearer ${tokenStore.accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && retry && (await refreshToken())) {
    return apiRequest<T>(path, options, false);
  }

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    if (response.status === 403 && payload.error?.toLowerCase().includes('tenant')) {
      redirectToTenantSuspended();
    }
    throw new Error(payload.error ?? 'Erreur API');
  }

  return payload.data as T;
}

export const api = {
  login: (payload: LoginPayload) =>
    apiRequest<SessionPayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () => apiRequest<SessionPayload>('/auth/me'),
  logout: () => apiRequest<{ message: string }>('/auth/logout', { method: 'POST' }),
  dashboard: () => apiRequest('/dashboard/summary'),
  employees: () => apiRequest('/employees'),
  employee: (id: string) => apiRequest(`/employees/${id}`),
  projects: () => apiRequest('/projects'),
  project: (id: string) => apiRequest(`/projects/${id}`),
  createProject: (data: Record<string, unknown>) =>
    apiRequest('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  sites: () => apiRequest('/sites'),
  site: (id: string) => apiRequest(`/sites/${id}`),
  attendance: () => apiRequest('/attendance'),
  attendanceToday: () => apiRequest('/attendance/today'),
  checkIn: (data: Record<string, unknown>) =>
    apiRequest('/attendance/check-in', { method: 'POST', body: JSON.stringify(data) }),
  checkOut: (data: Record<string, unknown>) =>
    apiRequest('/attendance/check-out', { method: 'POST', body: JSON.stringify(data) }),
  submitAttendance: (id: string) =>
    apiRequest(`/attendance/${id}/submit`, { method: 'POST' }),
  approveAttendance: (id: string) =>
    apiRequest(`/attendance/${id}/approve`, { method: 'POST' }),
  rejectAttendance: (id: string, comment: string) =>
    apiRequest(`/attendance/${id}/reject`, { method: 'POST', body: JSON.stringify({ comment }) }),
  timesheets: () => apiRequest('/timesheets'),
  timesheet: (id: string) => apiRequest(`/timesheets/${id}`),
  createTimesheet: (data: Record<string, unknown>) =>
    apiRequest('/timesheets', { method: 'POST', body: JSON.stringify(data) }),
  submitTimesheet: (id: string) =>
    apiRequest(`/timesheets/${id}/submit`, { method: 'POST' }),
  approveTimesheet: (id: string) =>
    apiRequest(`/timesheets/${id}/approve`, { method: 'POST' }),
  updateTimesheet: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/timesheets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  rejectTimesheet: (id: string, reason: string) =>
    apiRequest(`/timesheets/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  reopenTimesheet: (id: string) =>
    apiRequest(`/timesheets/${id}/reopen`, { method: 'POST' }),
  leaveTypes: () => apiRequest('/leave/types'),
  leaveBalances: (userId?: string) =>
    apiRequest(`/leave/balances${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`),
  leaveRequests: () => apiRequest('/leave/requests'),
  createLeaveRequest: (data: Record<string, unknown>) =>
    apiRequest('/leave/requests', { method: 'POST', body: JSON.stringify(data) }),
  submitLeaveRequest: (id: string) =>
    apiRequest(`/leave/requests/${id}/submit`, { method: 'POST' }),
  approveLeaveRequest: (id: string) =>
    apiRequest(`/leave/requests/${id}/approve`, { method: 'POST' }),
  rejectLeaveRequest: (id: string, reason: string) =>
    apiRequest(`/leave/requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  cancelLeaveRequest: (id: string) =>
    apiRequest(`/leave/requests/${id}/cancel`, { method: 'POST' }),
  uploadLeaveAttachment: async (id: string, file: File) => {
    const headers = new Headers();
    if (tokenStore.accessToken) {
      headers.set('Authorization', `Bearer ${tokenStore.accessToken}`);
    }
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(`${API_URL}/leave/requests/${id}/attachment`, {
      method: 'POST',
      headers,
      body,
    });
    const payload = (await response.json()) as ApiResponse<unknown>;
    if (!response.ok || !payload.success) throw new Error(payload.error ?? 'Upload failed');
    return payload.data;
  },
  reports: (name: string) => apiRequest(`/reports/${name}`),
  settingsCompany: () => apiRequest('/settings/company'),
  updateSettingsCompany: (data: Record<string, unknown>) =>
    apiRequest('/settings/company', { method: 'PUT', body: JSON.stringify(data) }),
  settingsHolidays: () => apiRequest('/settings/holidays'),
  createHoliday: (data: Record<string, unknown>) =>
    apiRequest('/settings/holidays', { method: 'POST', body: JSON.stringify(data) }),
  updateHoliday: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/settings/holidays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHoliday: (id: string) =>
    apiRequest(`/settings/holidays/${id}`, { method: 'DELETE' }),
  settingsLeaveTypes: () => apiRequest('/settings/leave-types'),
  createLeaveType: (data: Record<string, unknown>) =>
    apiRequest('/settings/leave-types', { method: 'POST', body: JSON.stringify(data) }),
  updateLeaveType: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/settings/leave-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  settingsTimesheetTaskTypes: () => apiRequest('/settings/timesheet-task-types'),
  updateSettingsTimesheetTaskTypes: (data: Record<string, unknown>) =>
    apiRequest('/settings/timesheet-task-types', { method: 'PUT', body: JSON.stringify(data) }),
  createEmployee: (data: Record<string, unknown>) =>
    apiRequest('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  createSite: (data: Record<string, unknown>) =>
    apiRequest('/sites', { method: 'POST', body: JSON.stringify(data) }),
  updateSite: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/sites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  assignSite: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/sites/${id}/assignments`, { method: 'POST', body: JSON.stringify(data) }),
  notifications: () => apiRequest('/notifications'),
  markNotificationRead: (id: string) =>
    apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }),
  tenants: () => apiRequest('/tenants'),
  suspendTenant: (id: string) =>
    apiRequest(`/tenants/${id}/suspend`, { method: 'PATCH' }),
  reactivateTenant: (id: string, status: 'ACTIVE' | 'TRIAL' = 'ACTIVE') =>
    apiRequest(`/tenants/${id}/reactivate`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  subscriptions: () => apiRequest('/subscriptions'),
  createSubscriptionPlan: (data: Record<string, unknown>) =>
    apiRequest('/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
  updateSubscriptionPlan: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  settingsAttendance: () => apiRequest('/settings/attendance'),
  updateSettingsAttendance: (data: Record<string, unknown>) =>
    apiRequest('/settings/attendance', { method: 'PUT', body: JSON.stringify(data) }),
  auditLogs: (take = 100) => apiRequest(`/audit-logs?take=${take}`),
  forgotPassword: (email: string) =>
    apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  markAllNotificationsRead: () =>
    apiRequest('/notifications/read-all', { method: 'PATCH' }),
};
