import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany<T extends Prisma.EmployeeProfileFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.EmployeeProfileFindManyArgs>,
  ) {
    return this.prisma.employeeProfile.findMany(args);
  }

  findFirst<T extends Prisma.EmployeeProfileFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.EmployeeProfileFindFirstArgs>,
  ) {
    return this.prisma.employeeProfile.findFirst(args);
  }

  createWithUser(params: {
    tenantId: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: UserRole;
    profileData: Omit<Prisma.EmployeeProfileUncheckedCreateInput, 'tenantId' | 'userId'>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          tenantId: params.tenantId,
          email: params.email,
          passwordHash: params.passwordHash,
          firstName: params.firstName,
          lastName: params.lastName,
          phone: params.phone,
          role: params.role,
        },
      });

      return tx.employeeProfile.create({
        data: {
          tenantId: params.tenantId,
          userId: createdUser.id,
          ...params.profileData,
        },
        include: { user: true, mainSite: true },
      });
    });
  }

  updateWithUser(params: {
    id: string;
    userId: string;
    userData: Prisma.UserUpdateInput;
    profileData: Prisma.EmployeeProfileUncheckedUpdateInput;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: params.userId },
        data: params.userData,
      });

      return tx.employeeProfile.update({
        where: { id: params.id },
        data: params.profileData,
        include: { user: true, mainSite: true },
      });
    });
  }

  updateUserPasswordReset(
    userId: string,
    data: Pick<Prisma.UserUpdateInput, 'passwordResetToken' | 'passwordResetExpiry'>,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  deactivateEmployee(employee: { id: string; tenantId: string; userId: string }, deletedAt: Date) {
    return this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: employee.userId },
        data: { deletedAt, status: 'INACTIVE' },
      });

      await tx.employeeProfile.update({
        where: { id: employee.id },
        data: { status: 'INACTIVE' },
      });

      await tx.site.updateMany({
        where: { tenantId: employee.tenantId, managerId: employee.userId, deletedAt: null },
        data: { managerId: null },
      });

      await tx.siteAssignment.updateMany({
        where: {
          tenantId: employee.tenantId,
          userId: employee.userId,
          OR: [{ endDate: null }, { endDate: { gt: deletedAt } }],
        },
        data: { endDate: deletedAt },
      });

      return updatedUser;
    });
  }
}
