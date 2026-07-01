import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { JwtRefreshGuard } from '../guards/jwt-refresh.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AuthenticatedUser } from '../types/auth-user.interface';
import { Permission } from '../types/permission.enum';
import { UserRole } from '../types/role.enum';

describe('Auth guards', () => {
  it('allows public routes without calling passport', () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => true),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);

    expect(guard.canActivate(createExecutionContext())).toBe(true);
  });

  it('allows Swagger documentation routes without bearer auth', () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => false),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);

    expect(guard.canActivate(createExecutionContext(undefined, '/api/docs'))).toBe(true);
  });

  it('throws when the access token guard receives no user', () => {
    const guard = new JwtAuthGuard({ getAllAndOverride: jest.fn() } as unknown as Reflector);

    expect(() => guard.handleRequest(null, false)).toThrow(UnauthorizedException);
  });

  it('throws when the refresh token guard receives no user', () => {
    const guard = new JwtRefreshGuard();

    expect(() => guard.handleRequest(null, false)).toThrow(UnauthorizedException);
  });

  it('allows a user with one of the required roles', () => {
    const guard = new RolesGuard(createReflector([UserRole.ADMIN, UserRole.DRIVER]));

    expect(guard.canActivate(createExecutionContext(createAuthenticatedUser()))).toBe(true);
  });

  it('denies a user without the required role', () => {
    const guard = new RolesGuard(createReflector([UserRole.SUPER_ADMIN]));

    expect(() => guard.canActivate(createExecutionContext(createAuthenticatedUser()))).toThrow(
      ForbiddenException,
    );
  });

  it('does not let SUPER_ADMIN inherit groupement ADMIN routes', () => {
    const guard = new RolesGuard(createReflector([UserRole.ADMIN]));
    const user = createAuthenticatedUser({
      groupementId: null,
      roles: [UserRole.SUPER_ADMIN],
    });

    expect(() => guard.canActivate(createExecutionContext(user))).toThrow(ForbiddenException);
  });

  it('throws when a role-protected route has no authenticated user', () => {
    const guard = new RolesGuard(createReflector([UserRole.ADMIN]));

    expect(() => guard.canActivate(createExecutionContext())).toThrow(ForbiddenException);
  });

  it('allows a user with the required fine permission', () => {
    const guard = new PermissionsGuard(createPermissionsReflector([Permission.DRIVER_READ]));

    expect(guard.canActivate(createExecutionContext(createAuthenticatedUser()))).toBe(true);
  });

  it('denies a user without the required fine permission', () => {
    const guard = new PermissionsGuard(createPermissionsReflector([Permission.GROUPEMENT_DELETE]));
    const user = createAuthenticatedUser({ roles: [UserRole.DRIVER] });

    expect(() => guard.canActivate(createExecutionContext(user))).toThrow(ForbiddenException);
  });
});

function createReflector(roles: UserRole[]): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => (key === ROLES_KEY ? roles : undefined)),
  } as unknown as Reflector;
}

function createPermissionsReflector(permissions: Permission[]): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) =>
      key === PERMISSIONS_KEY ? permissions : undefined,
    ),
  } as unknown as Reflector;
}

function createExecutionContext(user?: AuthenticatedUser, url = '/api/v1/users'): ExecutionContext {
  return {
    getClass: () => class TestController {},
    getHandler: () => function testHandler() {},
    switchToHttp: () => ({
      getRequest: () => ({ url, user }),
    }),
  } as unknown as ExecutionContext;
}

function createAuthenticatedUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    email: 'admin@taxikiwi.local',
    familyId: '9d3f53d2-2db1-4ba7-a745-338ec0f18b42',
    groupementId: 'c0f8bf75-b9a7-4adc-a702-9c43fbf0f015',
    id: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
    roles: [UserRole.ADMIN],
    sessionId: 'e28a1fe8-7192-4734-a297-2845c5290375',
    ...overrides,
  };
}
