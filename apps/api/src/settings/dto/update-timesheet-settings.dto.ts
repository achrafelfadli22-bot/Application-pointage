import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateTimesheetSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  timesheetPeriodDays?: number;
}
