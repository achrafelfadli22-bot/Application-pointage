import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUserContext } from '../common/types';
import { AuditLogService } from './audit-log.service';

@ApiBearerAuth()
@ApiTags('Audit Logs')
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  @Roles(UserRole.HR)
  findAll(
    @CurrentUser() user: CurrentUserContext,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.service.findAll(user, { take: Number(take ?? 50), cursor });
  }
}
