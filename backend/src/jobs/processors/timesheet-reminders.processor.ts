import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';

type ReminderPayload = {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
};

@Processor('timesheet-reminders')
export class TimesheetRemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(TimesheetRemindersProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {
    super();
  }

  async process(job: Job<ReminderPayload>): Promise<{ sent: number }> {
    const { tenantId, periodStart, periodEnd } = job.data;
    this.logger.log(
      `[timesheet-reminders] Processing job ${job.id} — tenant=${tenantId} period=${periodStart}/${periodEnd}`,
    );

    // Trouver tous les employés actifs du tenant
    const employees = await this.prisma.user.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        role: { in: ['EMPLOYEE', 'MANAGER'] },
        deletedAt: null,
      },
      select: { id: true, firstName: true, lastName: true },
    });

    // Pour chaque employé, vérifier si une feuille de temps SUBMITTED/APPROVED existe
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    const existing = await this.prisma.timesheet.findMany({
      where: {
        tenantId,
        periodStart: start,
        periodEnd: end,
        status: { in: ['SUBMITTED', 'APPROVED'] },
      },
      select: { userId: true },
    });

    const submittedUserIds = new Set(existing.map((ts) => ts.userId));
    const pending = employees.filter((e) => !submittedUserIds.has(e.id));

    this.logger.log(
      `[timesheet-reminders] ${pending.length} employees with pending timesheet`,
    );

    const startLabel = start.toLocaleDateString('fr-FR');
    const endLabel = end.toLocaleDateString('fr-FR');

    // Créer une notification + envoyer un email pour chaque employé en retard
    const results = await Promise.allSettled(
      pending.map(async (employee) => {
        await this.prisma.notification.create({
          data: {
            tenantId,
            userId: employee.id,
            title: 'Feuille de temps en attente',
            message: `Votre feuille de temps pour la période ${startLabel} – ${endLabel} n'a pas encore été soumise.`,
            type: 'TIMESHEET_REMINDER',
          },
        });

        const user = await this.prisma.user.findUnique({
          where: { id: employee.id },
          select: { email: true, firstName: true, lastName: true },
        });
        if (user) {
          void this.mail.sendTimesheetReminder(
            user.email,
            `${user.firstName} ${user.lastName}`,
            startLabel,
            endLabel,
          );
        }
      }),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    this.logger.log(`[timesheet-reminders] Job ${job.id} done — ${succeeded}/${pending.length} notifications sent`);
    return { sent: succeeded };
  }
}
