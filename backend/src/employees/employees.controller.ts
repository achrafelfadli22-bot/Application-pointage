import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUserContext } from '../common/types';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@ApiBearerAuth()
@ApiTags('Employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.RESOURCE_MANAGER, UserRole.HR, UserRole.PROJECT_MANAGER, UserRole.MANAGER)
  findAll(
    @CurrentUser() user: CurrentUserContext,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('siteId') siteId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(user, { search, role, siteId, status });
  }

  @Post()
  @Roles(UserRole.HR)
  create(@CurrentUser() user: CurrentUserContext, @Body() dto: CreateEmployeeDto) {
    return this.service.create(user, dto);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.RESOURCE_MANAGER, UserRole.HR, UserRole.PROJECT_MANAGER, UserRole.MANAGER, UserRole.EMPLOYEE)
  findOne(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Put(':id')
  @Roles(UserRole.RESOURCE_MANAGER, UserRole.HR)
  update(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.HR)
  softDelete(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.softDelete(user, id);
  }
}
