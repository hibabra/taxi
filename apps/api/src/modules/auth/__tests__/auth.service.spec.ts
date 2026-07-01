import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EntityManager, Repository } from 'typeorm';

import { AuditService } from '../../audit/audit.service';
import { AuthService } from '../auth.service';
import { RefreshToken } from '../entities/refresh-token.entity';
import { AuthUsersRepository } from '../repositories/auth-users.repository';
import { AuthenticatedUser, AuthUserRecord } from '../types/auth-user.interface';
import { UserRole } from '../types/role.enum';

const configValues: Record<string, string | number | boolean> = {
  'argon.memoryCost': 8192,
  'argon.parallelism': 1,
  'argon.timeCost': 1,
  'jwt.accessSecret': 'test-access-secret-that-is-long-enough-32',
  'jwt.accessTtl': '15m',
  'jwt.refreshSecret': 'test-refresh-secret-that-is-long-enough-32',
  'jwt.refreshTtl': '90d',
};

describe('AuthService', () => {
  let service: AuthService;
  let manager: InMemoryEntityManager;
  let tokenRepository: InMemoryTokenRepository;
  let refreshTokensRepository: Repository<RefreshToken>;
  let refreshTokenUpdate: jest.Mock<
    Promise<{ affected: number; generatedMaps: never[]; raw: never[] }>,
    [Record<string, unknown>, Partial<RefreshToken>]
  >;
  let usersRepository: {
    findByEmail: jest.Mock<Promise<AuthUserRecord | null>, [string]>;
    findByGroupementCodeAndDriverIdentifier: jest.Mock<
      Promise<AuthUserRecord | null>,
      [string, string]
    >;
    findById: jest.Mock<Promise<AuthUserRecord | null>, [string]>;
    updateLastLoginAt: jest.Mock<Promise<void>, [string, Date, EntityManager?]>;
    updatePassword: jest.Mock<Promise<void>, [string, string, Date]>;
  };
  let auditService: {
    log: jest.Mock<Promise<void>, [Record<string, unknown>]>;
  };

  beforeEach(() => {
    tokenRepository = new InMemoryTokenRepository();
    manager = new InMemoryEntityManager(tokenRepository);
    refreshTokenUpdate = jest.fn(
      (criteria: Record<string, unknown>, partial: Partial<RefreshToken>) => {
        void criteria;
        void partial;
        return Promise.resolve({ affected: 1, generatedMaps: [] as never[], raw: [] as never[] });
      },
    );
    refreshTokensRepository = {
      manager: manager as unknown as EntityManager,
      update: refreshTokenUpdate,
    } as unknown as Repository<RefreshToken>;
    usersRepository = {
      findByEmail: jest.fn((email: string) => {
        void email;
        return Promise.resolve(null as AuthUserRecord | null);
      }),
      findByGroupementCodeAndDriverIdentifier: jest.fn((code: string, identifier: string) => {
        void code;
        void identifier;
        return Promise.resolve(null as AuthUserRecord | null);
      }),
      findById: jest.fn((id: string) => {
        void id;
        return Promise.resolve(null as AuthUserRecord | null);
      }),
      updateLastLoginAt: jest.fn((id: string, date: Date, manager?: EntityManager) => {
        void id;
        void date;
        void manager;
        return Promise.resolve();
      }),
      updatePassword: jest.fn((id: string, hash: string, date: Date) => {
        void id;
        void hash;
        void date;
        return Promise.resolve();
      }),
    };
    auditService = {
      log: jest.fn((payload: Record<string, unknown>) => {
        void payload;
        return Promise.resolve();
      }),
    };

    service = new AuthService(
      refreshTokensRepository,
      createConfigService(),
      new JwtService(),
      usersRepository as unknown as AuthUsersRepository,
      auditService as unknown as AuditService,
    );
  });

  it('hashes and verifies passwords with Argon2id', async () => {
    const passwordHash = await service.hashPassword('CorrectPassword123!');

    expect(passwordHash).toContain('$argon2id$');
    await expect(service.verifyPassword(passwordHash, 'CorrectPassword123!')).resolves.toBe(true);
    await expect(service.verifyPassword(passwordHash, 'WrongPassword123!')).resolves.toBe(false);
  });

  it('issues access and refresh tokens on valid login', async () => {
    const user = await createAuthUser(service);
    usersRepository.findByEmail.mockResolvedValue(user);

    const session = await service.login(user.email, 'CorrectPassword123!');

    expect(session.tokenType).toBe('Bearer');
    expect(session.expiresIn).toBe(900);
    expect(session.user).toMatchObject({
      email: user.email,
      id: user.id,
      roles: [UserRole.ADMIN],
    });
    expect(manager.savedTokens).toHaveLength(1);
    expect(manager.savedTokens[0].tokenHash).toBe(service.hashRefreshToken(session.refreshToken));
    expect(manager.savedTokens[0].tokenHash).not.toBe(session.refreshToken);
    expect(usersRepository.updateLastLoginAt).toHaveBeenCalledWith(
      user.id,
      expect.any(Date),
      expect.any(Object),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTH_LOGIN',
        after: { method: 'EMAIL_PASSWORD' },
        groupementId: user.groupementId,
        userId: user.id,
      }),
    );
  });

  it('rejects an unknown email after running the fake password verification path', async () => {
    await expect(
      service.login('missing@taxikiwi.local', 'CorrectPassword123!'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login when the groupement is disabled', async () => {
    const user = await createAuthUser(service, { groupementIsActive: false });
    usersRepository.findByEmail.mockResolvedValue(user);

    await expect(service.login(user.email, 'CorrectPassword123!')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(usersRepository.updateLastLoginAt).not.toHaveBeenCalled();
  });

  it('issues a session for a chauffeur using groupement code and driver identifier', async () => {
    const user = await createAuthUser(service, {
      driverId: 'driver-1',
      driverIdentifier: 'T1',
      isGroupAdmin: false,
      roles: [UserRole.DRIVER],
    });
    usersRepository.findByGroupementCodeAndDriverIdentifier.mockResolvedValue(user);

    const session = await service.loginWithGroupementIdentifier(
      'taxi-kiwi',
      't1',
      'CorrectPassword123!',
    );

    expect(usersRepository.findByGroupementCodeAndDriverIdentifier).toHaveBeenCalledWith(
      'TAXI-KIWI',
      'T1',
    );
    expect(session.user).toMatchObject({
      driverId: 'driver-1',
      driverIdentifier: 'T1',
      roles: [UserRole.DRIVER],
    });
    expect(usersRepository.updateLastLoginAt).toHaveBeenCalledWith(
      user.id,
      expect.any(Date),
      expect.any(Object),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTH_LOGIN',
        after: { method: 'GROUPEMENT_IDENTIFIER' },
        userId: user.id,
      }),
    );
  });

  it('rotates refresh tokens and revokes the previous token', async () => {
    const user = await createAuthUser(service);
    usersRepository.findByEmail.mockResolvedValue(user);
    usersRepository.findById.mockResolvedValue(user);
    const firstSession = await service.login(user.email, 'CorrectPassword123!');
    const firstRefreshToken = manager.savedTokens[0];
    tokenRepository.tokenForFindOne = firstRefreshToken;

    const nextSession = await service.refresh({
      familyId: firstRefreshToken.familyId,
      refreshToken: firstSession.refreshToken,
      tokenId: firstRefreshToken.id,
      userId: user.id,
    });

    expect(nextSession.accessToken).not.toBe(firstSession.accessToken);
    expect(manager.savedTokens).toHaveLength(2);
    expect(firstRefreshToken.revokedAt).toBeInstanceOf(Date);
    expect(firstRefreshToken.replacedByTokenId).toBe(manager.savedTokens[1].id);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTH_REFRESH',
        userId: user.id,
      }),
    );
  });

  it('revokes a whole family when a consumed refresh token is reused', async () => {
    const user = await createAuthUser(service);
    const reusedToken = Object.assign(new RefreshToken(), {
      expiresAt: new Date(Date.now() + 60_000),
      familyId: '9d3f53d2-2db1-4ba7-a745-338ec0f18b42',
      id: 'e28a1fe8-7192-4734-a297-2845c5290375',
      replacedByTokenId: null,
      reuseDetectedAt: null,
      revokedAt: new Date(),
      tokenHash: service.hashRefreshToken('already-used-refresh-token'),
      userId: user.id,
    });
    tokenRepository.tokenForFindOne = reusedToken;

    await expect(
      service.refresh({
        familyId: reusedToken.familyId,
        refreshToken: 'already-used-refresh-token',
        tokenId: reusedToken.id,
        userId: user.id,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokenRepository.executedUpdates.some((update) => update.revokedAt instanceof Date)).toBe(
      true,
    );
    expect(
      tokenRepository.executedUpdates.some((update) => update.reuseDetectedAt instanceof Date),
    ).toBe(true);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTH_TOKEN_REUSE_DETECTED',
        userId: user.id,
      }),
    );
  });

  it('changes a password and revokes active sessions', async () => {
    const user = await createAuthUser(service);
    const currentUser: AuthenticatedUser = {
      email: user.email,
      familyId: '9d3f53d2-2db1-4ba7-a745-338ec0f18b42',
      groupementId: user.groupementId,
      id: user.id,
      roles: user.roles,
      sessionId: 'e28a1fe8-7192-4734-a297-2845c5290375',
    };
    usersRepository.findById.mockResolvedValue(user);

    await service.changePassword(currentUser, 'CorrectPassword123!', 'NewPassword12345!');

    expect(usersRepository.updatePassword).toHaveBeenCalledWith(
      user.id,
      expect.stringContaining('$argon2id$'),
      expect.any(Date),
    );
    expect(refreshTokenUpdate).toHaveBeenCalledTimes(1);
    const [criteria, partialEntity] = refreshTokenUpdate.mock.calls[0];
    expect(criteria.userId).toBe(user.id);
    expect(partialEntity.revokedAt).toBeInstanceOf(Date);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTH_PASSWORD_CHANGED',
        userId: user.id,
      }),
    );
  });

  it('logs logout after revoking the current session', async () => {
    const user: AuthenticatedUser = {
      email: 'admin@taxikiwi.local',
      familyId: '9d3f53d2-2db1-4ba7-a745-338ec0f18b42',
      groupementId: 'c0f8bf75-b9a7-4adc-a702-9c43fbf0f015',
      id: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
      roles: [UserRole.ADMIN],
      sessionId: 'e28a1fe8-7192-4734-a297-2845c5290375',
    };

    await service.logout(user);

    const revokedAtMatcher = expect.any(Date) as Date;

    expect(refreshTokenUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: user.sessionId, userId: user.id }),
      expect.objectContaining({ revokedAt: revokedAtMatcher }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTH_LOGOUT',
        resourceId: user.sessionId,
        userId: user.id,
      }),
    );
  });
});

async function createAuthUser(
  service: AuthService,
  overrides: Partial<AuthUserRecord> = {},
): Promise<AuthUserRecord> {
  return {
    email: 'admin@taxikiwi.local',
    groupementId: 'c0f8bf75-b9a7-4adc-a702-9c43fbf0f015',
    groupementIsActive: true,
    id: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
    isActive: true,
    passwordHash: await service.hashPassword('CorrectPassword123!'),
    passwordUpdatedAt: null,
    roles: [UserRole.ADMIN],
    ...overrides,
  };
}

function createConfigService(): ConfigService {
  return {
    getOrThrow: <T>(key: string): T => configValues[key] as T,
  } as ConfigService;
}

class InMemoryEntityManager {
  readonly savedTokens: RefreshToken[] = [];

  constructor(private readonly tokenRepository: InMemoryTokenRepository) {}

  save(entity: typeof RefreshToken, value: Partial<RefreshToken>): Promise<RefreshToken> {
    void entity;
    const token = Object.assign(new RefreshToken(), value);
    this.savedTokens.push(token);
    return Promise.resolve(token);
  }

  getRepository(entity: typeof RefreshToken): InMemoryTokenRepository {
    void entity;
    return this.tokenRepository;
  }

  transaction<T>(callback: (manager: EntityManager) => Promise<T>): Promise<T> {
    return callback(this as unknown as EntityManager);
  }
}

class InMemoryTokenRepository {
  readonly executedUpdates: Array<Partial<RefreshToken>> = [];
  tokenForFindOne: RefreshToken | null = null;

  findOne(): Promise<RefreshToken | null> {
    return Promise.resolve(this.tokenForFindOne);
  }

  save(token: RefreshToken): Promise<RefreshToken> {
    return Promise.resolve(token);
  }

  createQueryBuilder(): InMemoryUpdateQueryBuilder {
    return new InMemoryUpdateQueryBuilder(this);
  }
}

class InMemoryUpdateQueryBuilder {
  private values: Partial<RefreshToken> = {};

  constructor(private readonly repository: InMemoryTokenRepository) {}

  update(entity: typeof RefreshToken): this {
    void entity;
    return this;
  }

  set(values: Partial<RefreshToken>): this {
    this.values = values;
    return this;
  }

  where(condition: string, parameters?: Record<string, unknown>): this {
    void condition;
    void parameters;
    return this;
  }

  andWhere(condition: string): this {
    void condition;
    return this;
  }

  execute(): Promise<{ affected: number }> {
    this.repository.executedUpdates.push(this.values);
    return Promise.resolve({ affected: 1 });
  }
}
