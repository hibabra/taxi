import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { REFRESH_TOKEN_COOKIE_NAME } from '../auth.constants';
import { AuthUsersRepository } from '../repositories/auth-users.repository';
import { JwtRefreshStrategy } from '../strategies/jwt-refresh.strategy';
import { JwtStrategy } from '../strategies/jwt.strategy';
import {
  AccessTokenPayload,
  AuthUserRecord,
  RefreshTokenPayload,
} from '../types/auth-user.interface';
import { UserRole } from '../types/role.enum';

describe('JWT strategies', () => {
  it('validates an active access-token user', async () => {
    const usersRepository = {
      findById: jest.fn(() => Promise.resolve(createAuthUser())),
    };
    const strategy = new JwtStrategy(
      createConfigService(),
      usersRepository as unknown as AuthUsersRepository,
    );

    await expect(strategy.validate(createAccessPayload())).resolves.toMatchObject({
      email: 'admin@taxikiwi.local',
      id: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
      roles: [UserRole.ADMIN],
    });
  });

  it('rejects an access token older than the last password change', async () => {
    const usersRepository = {
      findById: jest.fn(() =>
        Promise.resolve(
          createAuthUser({
            passwordUpdatedAt: new Date('2026-04-30T12:00:00.000Z'),
          }),
        ),
      ),
    };
    const strategy = new JwtStrategy(
      createConfigService(),
      usersRepository as unknown as AuthUsersRepository,
    );

    await expect(
      strategy.validate({
        ...createAccessPayload(),
        iat: Math.floor(new Date('2026-04-30T11:59:00.000Z').getTime() / 1000),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an access token when the groupement is disabled', async () => {
    const usersRepository = {
      findById: jest.fn(() => Promise.resolve(createAuthUser({ groupementIsActive: false }))),
    };
    const strategy = new JwtStrategy(
      createConfigService(),
      usersRepository as unknown as AuthUsersRepository,
    );

    await expect(strategy.validate(createAccessPayload())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('extracts refresh-token identity from the HttpOnly cookie', () => {
    const strategy = new JwtRefreshStrategy(createConfigService());
    const payload: RefreshTokenPayload = {
      familyId: '9d3f53d2-2db1-4ba7-a745-338ec0f18b42',
      jti: 'e28a1fe8-7192-4734-a297-2845c5290375',
      sub: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
      type: 'refresh',
    };
    const request = {
      cookies: {
        [REFRESH_TOKEN_COOKIE_NAME]: 'refresh-token',
      },
    } as Parameters<JwtRefreshStrategy['validate']>[0];

    expect(strategy.validate(request, payload)).toEqual({
      familyId: payload.familyId,
      refreshToken: 'refresh-token',
      tokenId: payload.jti,
      userId: payload.sub,
    });
  });

  it('rejects refresh validation without a cookie', () => {
    const strategy = new JwtRefreshStrategy(createConfigService());
    const payload: RefreshTokenPayload = {
      familyId: '9d3f53d2-2db1-4ba7-a745-338ec0f18b42',
      jti: 'e28a1fe8-7192-4734-a297-2845c5290375',
      sub: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
      type: 'refresh',
    };

    expect(() =>
      strategy.validate({} as Parameters<JwtRefreshStrategy['validate']>[0], payload),
    ).toThrow(UnauthorizedException);
  });
});

function createConfigService(): ConfigService {
  const values = {
    'jwt.accessSecret': 'test-access-secret-that-is-long-enough-32',
    'jwt.refreshSecret': 'test-refresh-secret-that-is-long-enough-32',
  };

  return {
    getOrThrow: <T>(key: keyof typeof values): T => values[key] as T,
  } as ConfigService;
}

function createAccessPayload(): AccessTokenPayload {
  return {
    email: 'admin@taxikiwi.local',
    familyId: '9d3f53d2-2db1-4ba7-a745-338ec0f18b42',
    groupementId: 'c0f8bf75-b9a7-4adc-a702-9c43fbf0f015',
    iat: Math.floor(new Date('2026-04-30T12:01:00.000Z').getTime() / 1000),
    roles: [UserRole.ADMIN],
    sessionId: 'e28a1fe8-7192-4734-a297-2845c5290375',
    sub: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
    type: 'access',
  };
}

function createAuthUser(overrides: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return {
    email: 'admin@taxikiwi.local',
    groupementId: 'c0f8bf75-b9a7-4adc-a702-9c43fbf0f015',
    groupementIsActive: true,
    id: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
    isActive: true,
    passwordHash: '$argon2id$hash',
    passwordUpdatedAt: null,
    roles: [UserRole.ADMIN],
    ...overrides,
  };
}
