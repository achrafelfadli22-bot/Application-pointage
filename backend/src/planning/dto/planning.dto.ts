import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class CreatePlanningDto {
  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;
}

export class PlanningEntryDto {
  @ApiProperty()
  @IsDateString()
  entryDate!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(24)
  hours!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class PlanningLineDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty()
  @IsString()
  siteId!: string;

  @ApiProperty()
  @IsString()
  taskName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activity?: string;

  @ApiProperty({ type: [PlanningEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanningEntryDto)
  entries!: PlanningEntryDto[];
}

export class UpdatePlanningDto {
  @ApiProperty({ type: [PlanningLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanningLineDto)
  lines!: PlanningLineDto[];
}
