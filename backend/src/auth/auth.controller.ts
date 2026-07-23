import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUserContext } from '../common/types';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 10 tentatives par minute, max 30 sur 15 min — anti brute-force
  @Public()
  @Throttle({ short: { ttl: 60_000, limit: 10 }, medium: { ttl: 900_000, limit: 30 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ short: { ttl: 60_000, limit: 20 }, medium: { ttl: 900_000, limit: 60 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // 5 demandes de reset par minute — très restrictif
  @Public()
  @Throttle({ short: { ttl: 60_000, limit: 5 }, medium: { ttl: 3_600_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Throttle({ short: { ttl: 60_000, limit: 10 }, medium: { ttl: 3_600_000, limit: 20 } })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@CurrentUser() user: CurrentUserContext) {
    return this.authService.logout(user.userId);
  }

  @ApiBearerAuth()
  @SkipThrottle()
  @Get('me')
  me(@CurrentUser() user: CurrentUserContext) {
    return this.authService.me(user.userId);
  }

  @ApiBearerAuth()
  @Put('profile')
  updateProfile(@CurrentUser() user: CurrentUserContext, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.userId, dto);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  changePassword(@CurrentUser() user: CurrentUserContext, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto);
  }
}
