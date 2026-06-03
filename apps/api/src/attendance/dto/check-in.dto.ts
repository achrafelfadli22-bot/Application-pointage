import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkLocation } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

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
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeComment?: string;
}
