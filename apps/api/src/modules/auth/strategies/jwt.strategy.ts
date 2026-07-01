import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthUsersRepository } from '../repositories/auth-users.repository';
import { AccessTokenPayload, AuthenticatedUser } from '../types/auth-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersRepository: AuthUsersRepository,
  ) {
    super({
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.usersRepository.findById(payload.sub);

    if (!user?.isActive || !user.groupementIsActive) {
      throw new UnauthorizedException('Invalid access token');
    }

    if (isTokenOlderThanPassword(payload.iat, user.passwordUpdatedAt)) {
      throw new UnauthorizedException('Access token expired after password change');
    }

    return {
      driverId: user.driverId ?? null,
      driverIdentifier: user.driverIdentifier ?? null,
      email: user.email,
      familyId: payload.familyId,
      groupementId: user.groupementId,
      groupementName: user.groupementName,
      id: user.id,
      isGroupAdmin: user.isGroupAdmin ?? false,
      roles: user.roles,
      sessionId: payload.sessionId,
    };
  }
}

function isTokenOlderThanPassword(
  issuedAt: number | undefined,
  passwordUpdatedAt: Date | null,
): boolean {
  if (!issuedAt || !passwordUpdatedAt) {
    return false;
  }

  return passwordUpdatedAt.getTime() > issuedAt * 1000;
}
