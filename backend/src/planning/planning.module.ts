import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';

@Module({
  imports: [AuditLogModule],
  controllers: [PlanningController],
  providers: [PlanningService],
})
export class PlanningModule {}
