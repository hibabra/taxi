import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { RefreshTokenRequestUser } from '../types/auth-user.interface';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  handleRequest<TUser = RefreshTokenRequestUser>(error: Error | null, user: TUser | false): TUser {
    if (error) {
      throw error;
    }

    if (!user) {
      throw new UnauthorizedException('Refresh token required');
    }

    return user;
  }
}
