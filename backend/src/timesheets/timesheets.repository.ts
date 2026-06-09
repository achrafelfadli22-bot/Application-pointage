import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TimesheetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany<T extends Prisma.TimesheetFindManyArgs>(args: Prisma.SelectSubset<T, Prisma.TimesheetFindManyArgs>) {
    return this.prisma.timesheet.findMany(args);
  }

  create<T extends Prisma.TimesheetCreateArgs>(args: Prisma.SelectSubset<T, Prisma.TimesheetCreateArgs>) {
    return this.prisma.timesheet.create(args);
  }

  findFirstOrThrow<T extends Prisma.TimesheetFindFirstOrThrowArgs>(
    args: Prisma.SelectSubset<T, Prisma.TimesheetFindFirstOrThrowArgs>,
  ) {
    return this.prisma.timesheet.findFirstOrThrow(args);
  }

  update<T extends Prisma.TimesheetUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.TimesheetUpdateArgs>) {
    return this.prisma.timesheet.update(args);
  }

  delete<T extends Prisma.TimesheetDeleteArgs>(args: Prisma.SelectSubset<T, Prisma.TimesheetDeleteArgs>) {
    return this.prisma.timesheet.delete(args);
  }

  createApprovalAction(args: Prisma.ApprovalActionCreateArgs) {
    return this.prisma.approvalAction.create(args);
  }

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn);
  }

  deleteLines(tx: Prisma.TransactionClient, timesheetId: string) {
    return tx.timesheetLine.deleteMany({ where: { timesheetId } });
  }

  findSiteForLine(tx: Prisma.TransactionClient, id: string, tenantId: string) {
    return tx.site.findFirstOrThrow({ where: { id, tenantId, deletedAt: null } });
  }

  createLine(tx: Prisma.TransactionClient, args: Prisma.TimesheetLineCreateArgs) {
    return tx.timesheetLine.create(args);
  }
}
