import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsRepository } from './timesheets.repository';
import { TimesheetsService } from './timesheets.service';

@Module({
  imports: [AuditLogModule, NotificationsModule],
  controllers: [TimesheetsController],
  providers: [TimesheetsRepository, TimesheetsService],
  exports: [TimesheetsService],
})
export class TimesheetsModule {}
