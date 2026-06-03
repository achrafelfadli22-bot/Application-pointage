import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

export class TimesheetTaskTypeDto {
  @ApiProperty()
  @IsString()
  value!: string;

  @ApiProperty()
  @IsString()
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTimesheetTaskTypesDto {
  @ApiProperty({ type: [TimesheetTaskTypeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimesheetTaskTypeDto)
  types!: TimesheetTaskTypeDto[];
}
