import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { ExportsProcessor } from './processors/exports.processor';
import { NotificationsProcessor } from './processors/notifications.processor';
import { ReportsProcessor } from './processors/reports.processor';
import { TimesheetRemindersProcessor } from './processors/timesheet-reminders.processor';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'exports' },
      { name: 'notifications' },
      { name: 'timesheet-reminders' },
      { name: 'reports' },
    ),
    StorageModule,
  ],
  providers: [
    JobsService,
    ExportsProcessor,
    NotificationsProcessor,
    TimesheetRemindersProcessor,
    ReportsProcessor,
  ],
  exports: [JobsService],
})
export class JobsModule {}
