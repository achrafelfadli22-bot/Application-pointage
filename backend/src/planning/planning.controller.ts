import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserContext } from '../common/types';
import { CreatePlanningDto, UpdatePlanningDto } from './dto/planning.dto';
import { PlanningService } from './planning.service';

@ApiBearerAuth()
@ApiTags('Planning')
@Controller('planning')
export class PlanningController {
  constructor(private readonly service: PlanningService) {}

  @Get()
  findAll(@CurrentUser() user: CurrentUserContext) { return this.service.findAll(user); }

  @Get('scope')
  scope(@CurrentUser() user: CurrentUserContext) { return this.service.scopeOptions(user); }

  @Get('my-period')
  myPeriod(
    @CurrentUser() user: CurrentUserContext,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('projectId') projectId?: string,
  ) { return this.service.findViewerPeriod(user, start, end, projectId); }

  @Post()
  create(@CurrentUser() user: CurrentUserContext, @Body() dto: CreatePlanningDto) { return this.service.create(user, dto); }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) { return this.service.findOne(user, id); }

  @Put(':id')
  update(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: UpdatePlanningDto) { return this.service.update(user, id, dto); }

  @Post(':id/publish')
  publish(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) { return this.service.publish(user, id); }

  @Post(':id/reopen')
  reopen(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) { return this.service.reopen(user, id); }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) { return this.service.remove(user, id); }
}
