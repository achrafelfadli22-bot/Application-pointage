import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectTimesheetLineDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  reason!: string;
}
