import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsNumber, IsString, Min } from 'class-validator';

export class CreateSubscriptionPlanDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  maxUsers!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  maxSites!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  priceMonthly!: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  features!: string[];
}
