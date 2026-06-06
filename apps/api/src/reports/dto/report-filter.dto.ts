import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReportStatusFilter {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  COMPLETED = 'COMPLETED',
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  N1_APPROVED = 'N1_APPROVED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REOPENED = 'REOPENED',
  CANCELLED = 'CANCELLED',
}

export class ReportFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ enum: ReportStatusFilter })
  @IsOptional()
  @IsEnum(ReportStatusFilter)
  status?: ReportStatusFilter;
}
