import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserContext } from '../common/types';
import { NotificationsService } from './notifications.service';

@ApiBearerAuth()
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  findMine(@CurrentUser() user: CurrentUserContext) {
    return this.service.findMine(user);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: CurrentUserContext) {
    return this.service.markAllRead(user);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.markRead(user, id);
  }
}
