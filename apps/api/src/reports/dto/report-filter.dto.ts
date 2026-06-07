import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum ReportStatusFilter {
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
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ enum: ReportStatusFilter })
  @IsOptional()
  @IsEnum(ReportStatusFilter)
  status?: ReportStatusFilter;

  /** Année pour le rapport bilan congés (défaut : année en cours) */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  /** Pagination : nombre de résultats (max 500, défaut 100) */
  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number;

  /** Pagination : décalage */
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  skip?: number;
}
