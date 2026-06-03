import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SiteStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUserContext } from '../common/types';
import { CreateSiteAssignmentDto } from './dto/create-site-assignment.dto';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SitesService } from './sites.service';

@ApiBearerAuth()
@ApiTags('Sites')
@Controller('sites')
export class SitesController {
  constructor(private readonly service: SitesService) {}

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
    @Query('status') status?: SiteStatus,
  ) {
    return this.service.findAll(user, { search, status });
  }

  @Post()
  @Roles(UserRole.RESOURCE_MANAGER)
  create(@CurrentUser() user: CurrentUserContext, @Body() dto: CreateSiteDto) {
    return this.service.create(user, dto);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.RESOURCE_MANAGER, UserRole.HR, UserRole.PROJECT_MANAGER, UserRole.MANAGER)
  findOne(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Put(':id')
  @Roles(UserRole.RESOURCE_MANAGER)
  update(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.RESOURCE_MANAGER)
  softDelete(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.softDelete(user, id);
  }

  @Post(':id/assignments')
  @Roles(UserRole.RESOURCE_MANAGER, UserRole.HR, UserRole.MANAGER)
  assign(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: CreateSiteAssignmentDto) {
    return this.service.assign(user, id, dto);
  }
}
