import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
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
    @Query('userId') userId?: string,
  ) {
    return this.service.findAll(user, { search, userId });
  }

  @Post()
  @Roles(UserRole.HR)
  create(@CurrentUser() user: CurrentUserContext, @Body() dto: CreateSiteDto) {
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
  @Roles(UserRole.HR)
  update(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.HR)
  softDelete(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.softDelete(user, id);
  }

  @Post(':id/assignments')
  @Roles(UserRole.RESOURCE_MANAGER)
  assign(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: CreateSiteAssignmentDto) {
    return this.service.assign(user, id, dto);
  }
}
