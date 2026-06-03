import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue('exports') private readonly exportsQueue: Queue,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @InjectQueue('timesheet-reminders') private readonly remindersQueue: Queue,
    @InjectQueue('reports') private readonly reportsQueue: Queue,
  ) {}

  enqueueExport(payload: Record<string, unknown>) {
    return this.exportsQueue.add('generate-export', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  enqueueNotification(payload: Record<string, unknown>) {
    return this.notificationsQueue.add('send-notification', payload, { attempts: 3 });
  }

  enqueueTimesheetReminder(payload: Record<string, unknown>) {
    return this.remindersQueue.add('timesheet-reminder', payload, { attempts: 3 });
  }

  enqueueReportCalculation(payload: Record<string, unknown>) {
    return this.reportsQueue.add('calculate-report', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
}
