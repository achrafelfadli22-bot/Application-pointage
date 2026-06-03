import { UnauthorizedException } from '@nestjs/common';
import { CurrentUserContext, RequestWithUser } from '../types';

export function getCurrentUserContext(request: RequestWithUser): CurrentUserContext {
  if (!request.user) {
    throw new UnauthorizedException('Authenticated user context is missing');
  }

  return request.user;
}
