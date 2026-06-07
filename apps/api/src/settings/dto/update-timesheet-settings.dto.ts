import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum TimesheetPeriodType {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export class UpdateTimesheetSettingsDto {
  @ApiPropertyOptional({ enum: TimesheetPeriodType, description: 'WEEKLY = 7 jours, MONTHLY = 30 jours' })
  @IsOptional()
  @IsEnum(TimesheetPeriodType)
  timesheetPeriod?: TimesheetPeriodType;
}
