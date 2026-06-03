export const ROLES = ['SUPER_ADMIN', 'RESOURCE_MANAGER', 'HR', 'PROJECT_MANAGER', 'MANAGER', 'EMPLOYEE'] as const;

export type Role = (typeof ROLES)[number];

export type UserContext = {
  userId: string;
  tenantId: string | null;
  role: Role;
  permissions: string[];
  email: string;
  fullName: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  statusCode?: number;
};

export type StatusVariant =
  | 'Draft'
  | 'Not Submitted'
  | 'Submitted'
  | 'Waiting For Approval'
  | 'Approved'
  | 'Rejected'
  | 'Reopened'
  | 'Cancelled'
  | 'Overdue';
