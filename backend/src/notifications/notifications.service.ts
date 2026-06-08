import { Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUserContext } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationInput = {
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  type: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: NotificationInput) {
    return this.prisma.notification.create({ data: input });
  }

  findMine(user: CurrentUserContext) {
    return this.prisma.notification.findMany({
      where: { tenantId: user.tenantId ?? '__missing__', userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(user: CurrentUserContext, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, tenantId: user.tenantId ?? '__missing__', userId: user.userId },
      data: { isRead: true },
    });

    if (result.count === 0) {
      throw new NotFoundException('Notification introuvable');
    }

    return this.prisma.notification.findUniqueOrThrow({ where: { id } });
  }

  async markAllRead(user: CurrentUserContext) {
    const result = await this.prisma.notification.updateMany({
      where: {
        tenantId: user.tenantId ?? '__missing__',
        userId: user.userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { updated: result.count };
  }
}
