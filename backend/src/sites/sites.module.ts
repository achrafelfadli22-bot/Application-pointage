import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SitesController } from './sites.controller';
import { SitesRepository } from './sites.repository';
import { SitesService } from './sites.service';

@Module({
  imports: [AuditLogModule],
  controllers: [SitesController],
  providers: [SitesRepository, SitesService],
  exports: [SitesService],
})
export class SitesModule {}
