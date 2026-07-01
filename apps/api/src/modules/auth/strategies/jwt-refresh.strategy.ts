import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { REFRESH_TOKEN_COOKIE_NAME } from '../auth.constants';
import { RefreshTokenPayload, RefreshTokenRequestUser } from '../types/auth-user.interface';

/**
 * Type minimal pour la requête Fastify.
 * On n'importe PAS depuis 'express' car le projet utilise Fastify.
 * Passport normalise la requête, donc ce type suffit.
 */
type FastifyRequestWithCookies = {
  cookies?: Record<string, string | undefined>;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromExtractors([extractRefreshTokenFromCookie]),
      passReqToCallback: true,
      secretOrKey: configService.getOrThrow<string>('jwt.refreshSecret'),
    });
  }

  validate(
    request: FastifyRequestWithCookies,
    payload: RefreshTokenPayload,
  ): RefreshTokenRequestUser {
    const refreshToken = extractRefreshTokenFromCookie(request);

    if (!refreshToken || payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      familyId: payload.familyId,
      refreshToken,
      tokenId: payload.jti,
      userId: payload.sub,
    };
  }
}

function extractRefreshTokenFromCookie(request: FastifyRequestWithCookies): string | null {
  const cookies = (request as { cookies?: unknown }).cookies;

  if (!cookies || typeof cookies !== 'object') {
    return null;
  }

  const refreshToken = (cookies as Record<string, unknown>)[REFRESH_TOKEN_COOKIE_NAME];

  return typeof refreshToken === 'string' ? refreshToken : null;
}
