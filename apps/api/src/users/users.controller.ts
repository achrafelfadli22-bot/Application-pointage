import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUserContext } from '../common/types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiBearerAuth()
@ApiTags('Users')
@Controller('users')
@Roles(UserRole.SUPER_ADMIN, UserRole.RESOURCE_MANAGER)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  findAll(@CurrentUser() user: CurrentUserContext) {
    return this.service.findAll(user);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserContext, @Body() dto: CreateUserDto) {
    return this.service.create(user, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.service.update(user, id, dto);
  }
}
