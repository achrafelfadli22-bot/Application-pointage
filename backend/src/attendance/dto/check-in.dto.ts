import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkLocation } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CheckInDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiProperty({ enum: WorkLocation })
  @IsEnum(WorkLocation)
  workLocation!: WorkLocation;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeComment?: string;
}
