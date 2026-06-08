import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { TenantsService } from './tenants.service';

@ApiBearerAuth()
@ApiTags('Subscriptions')
@Controller('subscriptions')
@Roles(UserRole.SUPER_ADMIN)
export class SubscriptionsController {
  constructor(private readonly service: TenantsService) {}

  @Get()
  findPlans() {
    return this.service.findPlans();
  }

  @Post()
  createPlan(@Body() dto: CreateSubscriptionPlanDto) {
    return this.service.createPlan(dto);
  }

  @Put(':id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdateSubscriptionPlanDto) {
    return this.service.updatePlan(id, dto);
  }
}
