import { ConfigService } from '@nestjs/config';

import { REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_PATH } from '../auth.constants';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { AuthenticatedUser, RefreshTokenRequestUser } from '../types/auth-user.interface';
import { UserRole } from '../types/role.enum';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<AuthService, 'changePassword' | 'login' | 'logout' | 'me' | 'refresh'>
  >;
  let response: {
    clearCookie: jest.Mock<void, [string, { path: string }]>;
    setCookie: jest.Mock<
      void,
      [
        string,
        string,
        {
          httpOnly: true;
          maxAge: number;
          path: string;
          sameSite: 'strict';
          secure: boolean;
        },
      ]
    >;
  };

  beforeEach(() => {
    authService = {
      changePassword: jest.fn(
        (user: AuthenticatedUser, currentPassword: string, newPassword: string) => {
          void user;
          void currentPassword;
          void newPassword;
          return Promise.resolve();
        },
      ),
      login: jest.fn((email: string, password: string) => {
        void email;
        void password;
        return Promise.resolve(createSession('login-refresh-token'));
      }),
      logout: jest.fn((user: AuthenticatedUser) => {
        void user;
        return Promise.resolve();
      }),
      me: jest.fn((user: AuthenticatedUser) => ({
        email: user.email,
        groupementId: user.groupementId,
        id: user.id,
        roles: user.roles,
      })),
      refresh: jest.fn((refreshUser: RefreshTokenRequestUser) => {
        void refreshUser;
        return Promise.resolve(createSession('rotated-refresh-token'));
      }),
    };
    response = {
      clearCookie: jest.fn((name: string, options: { path: string }) => {
        void name;
        void options;
      }),
      setCookie: jest.fn(
        (
          name: string,
          value: string,
          options: {
            httpOnly: true;
            maxAge: number;
            path: string;
            sameSite: 'strict';
            secure: boolean;
          },
        ) => {
          void name;
          void value;
          void options;
        },
      ),
    };
    controller = new AuthController(authService as unknown as AuthService, createConfigService());
  });

  it('sets the refresh cookie and returns only the public session payload on login', async () => {
    const result = await controller.login(
      { email: 'admin@taxikiwi.local', password: 'CorrectPassword123!' },
      response,
    );

    expect(result).toEqual({
      accessToken: 'access-token',
      expiresIn: 900,
      tokenType: 'Bearer',
      user: {
        email: 'admin@taxikiwi.local',
        groupementId: 'c0f8bf75-b9a7-4adc-a702-9c43fbf0f015',
        id: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
        roles: [UserRole.ADMIN],
      },
    });
    expect(response.setCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE_NAME,
      'login-refresh-token',
      {
        httpOnly: true,
        maxAge: 7_776_000,
        path: REFRESH_TOKEN_COOKIE_PATH,
        sameSite: 'strict',
        secure: false,
      },
    );
  });

  it('rotates the refresh cookie on refresh', async () => {
    const refreshUser: RefreshTokenRequestUser = {
      familyId: '9d3f53d2-2db1-4ba7-a745-338ec0f18b42',
      refreshToken: 'previous-refresh-token',
      tokenId: 'e28a1fe8-7192-4734-a297-2845c5290375',
      userId: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
    };

    const result = await controller.refresh(refreshUser, response);

    expect(result.accessToken).toBe('access-token');
    expect(response.setCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE_NAME,
      'rotated-refresh-token',
      expect.objectContaining({ path: REFRESH_TOKEN_COOKIE_PATH }),
    );
  });

  it('revokes the current session and clears the refresh cookie on logout', async () => {
    const user = createAuthenticatedUser();

    await controller.logout(user, response);

    expect(authService.logout).toHaveBeenCalledWith(user);
    expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, {
      path: REFRESH_TOKEN_COOKIE_PATH,
    });
  });

  it('changes the password and clears the refresh cookie', async () => {
    const user = createAuthenticatedUser();

    await controller.changePassword(
      user,
      {
        currentPassword: 'CorrectPassword123!',
        newPassword: 'NewPassword12345!',
      },
      response,
    );

    expect(authService.changePassword).toHaveBeenCalledWith(
      user,
      'CorrectPassword123!',
      'NewPassword12345!',
    );
    expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, {
      path: REFRESH_TOKEN_COOKIE_PATH,
    });
  });

  it('returns the current authenticated user', () => {
    const user = createAuthenticatedUser();

    expect(controller.me(user)).toEqual({
      email: user.email,
      groupementId: user.groupementId,
      id: user.id,
      roles: user.roles,
    });
  });
});

function createConfigService(): ConfigService {
  const values = {
    'cookie.sameSite': 'strict',
    'cookie.secure': false,
    'jwt.refreshTtl': '90d',
  };

  return {
    getOrThrow: <T>(key: keyof typeof values): T => values[key] as T,
  } as ConfigService;
}

function createSession(refreshToken: string) {
  return {
    accessToken: 'access-token',
    expiresIn: 900,
    refreshToken,
    tokenType: 'Bearer' as const,
    user: {
      email: 'admin@taxikiwi.local',
      groupementId: 'c0f8bf75-b9a7-4adc-a702-9c43fbf0f015',
      id: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
      roles: [UserRole.ADMIN],
    },
  };
}

function createAuthenticatedUser(): AuthenticatedUser {
  return {
    email: 'admin@taxikiwi.local',
    familyId: '9d3f53d2-2db1-4ba7-a745-338ec0f18b42',
    groupementId: 'c0f8bf75-b9a7-4adc-a702-9c43fbf0f015',
    id: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
    roles: [UserRole.ADMIN],
    sessionId: 'e28a1fe8-7192-4734-a297-2845c5290375',
  };
}
