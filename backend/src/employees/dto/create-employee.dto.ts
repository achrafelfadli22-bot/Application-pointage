import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeStatus, UserRole } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'Optional. When omitted, a secure temporary password is generated and a setup link is sent.' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty()
  @IsString()
  employeeNumber!: string;

  @ApiProperty()
  @IsString()
  jobTitle!: string;

  @ApiProperty()
  @IsString()
  contractType!: string;

  @ApiProperty()
  @IsDateString()
  hireDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mainSiteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualLeaveBalance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;
}
