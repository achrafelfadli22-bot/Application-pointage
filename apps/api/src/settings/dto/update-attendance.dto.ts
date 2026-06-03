import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateAttendanceDto {
  @IsOptional()
  @IsString()
  workDayStartTime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  lateToleranceMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  gpsToleranceMeters?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  overtimeTriggerHours?: number;
}
