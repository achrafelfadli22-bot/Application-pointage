import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUserContext } from '../common/types';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ReactivateTenantDto } from './dto/reactivate-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';

@ApiBearerAuth()
@ApiTags('Tenants')
@Controller('tenants')
@Roles(UserRole.SUPER_ADMIN)
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@CurrentUser() user: CurrentUserContext, @Body() dto: CreateTenantDto) {
    return this.service.create(user, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/suspend')
  suspend(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.suspend(user, id);
  }

  @Patch(':id/reactivate')
  reactivate(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto?: ReactivateTenantDto) {
    return this.service.reactivate(user, id, dto?.status);
  }

  @Delete(':id')
  softDelete(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.softDelete(user, id);
  }
}
