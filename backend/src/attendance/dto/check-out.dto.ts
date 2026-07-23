import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CheckOutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeComment?: string;
}
