import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingType, WorkLocation } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TimesheetDayEntryDto {
  @ApiProperty()
  @IsDateString()
  entryDate!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  hours!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class TimesheetLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiProperty()
  @IsString()
  taskName!: string;

  @ApiProperty({ enum: BillingType })
  @IsEnum(BillingType)
  billingType!: BillingType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activity?: string;

  @ApiProperty({ enum: WorkLocation })
  @IsEnum(WorkLocation)
  workLocation!: WorkLocation;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placeOfWork?: string;

  @ApiProperty({ type: [TimesheetDayEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimesheetDayEntryDto)
  entries!: TimesheetDayEntryDto[];
}
