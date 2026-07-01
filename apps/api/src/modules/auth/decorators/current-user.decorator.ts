import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedUser, RefreshTokenRequestUser } from '../types/auth-user.interface';

type AuthRequest = {
  user?: AuthenticatedUser | RefreshTokenRequestUser;
};

export const CurrentUser = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): AuthenticatedUser | RefreshTokenRequestUser | undefined =>
    context.switchToHttp().getRequest<AuthRequest>().user,
);
