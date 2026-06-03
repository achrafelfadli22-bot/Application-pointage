import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RejectTimesheetDto {
  @ApiProperty()
  @IsString()
  reason!: string;
}
