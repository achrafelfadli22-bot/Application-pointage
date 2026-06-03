import { UserRole } from '@prisma/client';

export type CurrentUserContext = {
  userId: string;
  tenantId: string | null;
  role: UserRole;
  permissions: string[];
  email: string;
  fullName: string;
};

export type RequestWithUser = Request & {
  user?: CurrentUserContext;
};
