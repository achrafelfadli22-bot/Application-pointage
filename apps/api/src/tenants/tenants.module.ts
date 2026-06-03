import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { SubscriptionsController } from './subscriptions.controller';

@Module({
  imports: [AuditLogModule],
  controllers: [TenantsController, SubscriptionsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
