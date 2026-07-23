import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { LeaveRequestStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserContext } from '../common/types';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { LeaveService } from './leave.service';

@ApiBearerAuth()
@ApiTags('Leave')
@Controller('leave')
export class LeaveController {
  constructor(private readonly service: LeaveService) {}

  @Get('types')
  types(@CurrentUser() user: CurrentUserContext) {
    return this.service.findTypes(user);
  }

  @Get('balances')
  balances(@CurrentUser() user: CurrentUserContext, @Query('userId') userId?: string) {
    return this.service.findBalances(user, userId);
  }

  @Get('capabilities')
  capabilities(@CurrentUser() user: CurrentUserContext) {
    return this.service.capabilities(user);
  }

  @Get('requests')
  requests(
    @CurrentUser() user: CurrentUserContext,
    @Query('status') status?: LeaveRequestStatus,
    @Query('scope') scope?: 'mine' | 'managed',
  ) {
    return this.service.findRequests(user, status, scope);
  }

  @Post('requests')
  createRequest(@CurrentUser() user: CurrentUserContext, @Body() dto: CreateLeaveRequestDto) {
    return this.service.createRequest(user, dto);
  }

  @Post('requests/:id/submit')
  submit(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.submit(user, id);
  }

  @Post('requests/:id/approve')
  approve(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.approve(user, id);
  }

  @Post('requests/:id/reject')
  reject(@CurrentUser() user: CurrentUserContext, @Param('id') id: string, @Body() dto: RejectLeaveRequestDto) {
    return this.service.reject(user, id, dto.reason);
  }

  @Post('requests/:id/cancel')
  cancel(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.service.cancel(user, id);
  }

  @Post('requests/:id/attachment')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadAttachment(
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ) {
    return this.service.uploadAttachment(user, id, file);
  }
}
