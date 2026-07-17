import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUserContext } from '../common/types';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiBearerAuth()
@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.RESOURCE_MANAGER,
    UserRole.HR,
    UserRole.PROJECT_MANAGER,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  )
  findAll(
    @CurrentUser() user: CurrentUserContext,
    @Query('search') search?: string,
    @Query('status') status?: ProjectStatus,
  ) {
    return this.service.findAll(user, { search, status });
  }

  @Post()
  @Roles(UserRole.HR)
  create(@CurrentUser() user: CurrentUserContext, @Body() dto: CreateProjectDto) {
    return this.service.create(user, dto);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.RESOURCE_MANAGER,
    UserRole.HR,
    UserRole.PROJECT_MANAGER,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  )
  findOne(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Put(':id')
  @Roles(UserRole.RESOURCE_MANAGER, UserRole.HR)
  update(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.HR)
  softDelete(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.softDelete(user, id);
  }
}
