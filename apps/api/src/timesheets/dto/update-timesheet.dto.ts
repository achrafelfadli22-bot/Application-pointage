import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TimesheetLineDto } from './timesheet-line-entry.dto';

export class UpdateTimesheetDto {
  @ApiProperty({ type: [TimesheetLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimesheetLineDto)
  lines!: TimesheetLineDto[];
}
