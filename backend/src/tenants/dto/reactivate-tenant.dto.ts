import { ApiPropertyOptional } from '@nestjs/swagger';
import { TenantStatus } from '@prisma/client';
import { IsIn, IsOptional } from 'class-validator';

export type ReactivateTenantStatus = 'ACTIVE' | 'TRIAL';

export class ReactivateTenantDto {
  @ApiPropertyOptional({ enum: [TenantStatus.ACTIVE, TenantStatus.TRIAL] })
  @IsOptional()
  @IsIn([TenantStatus.ACTIVE, TenantStatus.TRIAL])
  status?: ReactivateTenantStatus;
}
