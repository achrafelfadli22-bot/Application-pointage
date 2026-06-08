import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly service: HealthService) {}

  @Public()
  @Get()
  check(@Res({ passthrough: true }) response: Response) {
    return this.ready(response);
  }

  @Public()
  @Get('live')
  live() {
    return this.service.live();
  }

  @Public()
  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response) {
    const result = await this.service.check();
    if (result.status !== 'ok') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }
}
