import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SitesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany<T extends Prisma.SiteFindManyArgs>(args: Prisma.SelectSubset<T, Prisma.SiteFindManyArgs>) {
    return this.prisma.site.findMany(args);
  }

  findFirstOrThrow<T extends Prisma.SiteFindFirstOrThrowArgs>(args: Prisma.SelectSubset<T, Prisma.SiteFindFirstOrThrowArgs>) {
    return this.prisma.site.findFirstOrThrow(args);
  }

  create<T extends Prisma.SiteCreateArgs>(args: Prisma.SelectSubset<T, Prisma.SiteCreateArgs>) {
    return this.prisma.site.create(args);
  }

  update<T extends Prisma.SiteUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.SiteUpdateArgs>) {
    return this.prisma.site.update(args);
  }

  findProjectOrThrow<T extends Prisma.ProjectFindFirstOrThrowArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProjectFindFirstOrThrowArgs>,
  ) {
    return this.prisma.project.findFirstOrThrow(args);
  }

  findActiveEmployee<T extends Prisma.EmployeeProfileFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.EmployeeProfileFindFirstArgs>,
  ) {
    return this.prisma.employeeProfile.findFirst(args);
  }

  findActiveAssignment<T extends Prisma.SiteAssignmentFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.SiteAssignmentFindFirstArgs>,
  ) {
    return this.prisma.siteAssignment.findFirst(args);
  }

  createAssignmentAndSetMainSite(params: {
    employeeProfileId: string;
    assignmentData: Prisma.SiteAssignmentUncheckedCreateInput;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.siteAssignment.create({
        data: params.assignmentData,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          site: true,
        },
      });

      await tx.employeeProfile.update({
        where: { id: params.employeeProfileId },
        data: { mainSiteId: params.assignmentData.siteId },
      });

      return created;
    });
  }
}
