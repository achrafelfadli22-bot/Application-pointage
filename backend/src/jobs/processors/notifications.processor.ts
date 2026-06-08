import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

type NotificationPayload = {
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  type: string;
};

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<NotificationPayload>): Promise<{ id: string }> {
    const { tenantId, userId, title, message, type } = job.data;
    this.logger.log(
      `[notifications] Processing job ${job.id} — user=${userId} type=${type}`,
    );

    // Dédoublonnage : éviter d'envoyer deux fois la même notif dans les 60 dernières secondes
    const since = new Date(Date.now() - 60_000);
    const existing = await this.prisma.notification.findFirst({
      where: { tenantId, userId, type, title, createdAt: { gte: since } },
    });

    if (existing) {
      this.logger.warn(
        `[notifications] Duplicate skipped for user=${userId} type=${type} title="${title}"`,
      );
      return { id: existing.id };
    }

    const notification = await this.prisma.notification.create({
      data: { tenantId, userId, title, message, type },
    });

    this.logger.log(`[notifications] Created notification id=${notification.id}`);
    return { id: notification.id };
  }
}
