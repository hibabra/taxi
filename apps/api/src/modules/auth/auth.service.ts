import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';

import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { EntityManager, IsNull, Repository } from 'typeorm';

import { AuditService } from '../audit/audit.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthUsersRepository } from './repositories/auth-users.repository';
import {
  AuthenticatedUser,
  AuthUserRecord,
  RefreshTokenRequestUser,
} from './types/auth-user.interface';

type AuthSession = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  tokenType: 'Bearer';
  user: PublicAuthUser;
};

type PublicAuthUser = {
  id: string;
  email: string;
  groupementId: string | null;
  groupementName?: string | null;
  roles: AuthUserRecord['roles'];
  driverId?: string | null;
  driverIdentifier?: string | null;
  isGroupAdmin?: boolean;
};

@Injectable()
export class AuthService {
  private fakePasswordHash?: Promise<string>;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersRepository: AuthUsersRepository,
    private readonly auditService: AuditService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      memoryCost: this.configService.getOrThrow<number>('argon.memoryCost'),
      parallelism: this.configService.getOrThrow<number>('argon.parallelism'),
      timeCost: this.configService.getOrThrow<number>('argon.timeCost'),
      type: argon2.argon2id,
    });
  }

  async verifyPassword(passwordHash: string, password: string): Promise<boolean> {
    return argon2.verify(passwordHash, password);
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const user = await this.usersRepository.findByEmail(normalizeEmail(email));
    const passwordHash = user?.passwordHash ?? (await this.getFakePasswordHash());
    const passwordMatches = await this.verifyPassword(passwordHash, password);

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('User account is disabled');
    }

    if (!user.groupementIsActive) {
      throw new ForbiddenException('Groupement is disabled');
    }

    return this.issueLoginSession(user, 'EMAIL_PASSWORD');
  }

  async loginWithGroupementIdentifier(
    groupementCode: string,
    identifier: string,
    password: string,
  ): Promise<AuthSession> {
    const user = await this.usersRepository.findByGroupementCodeAndDriverIdentifier(
      normalizeGroupementCode(groupementCode),
      normalizeDriverIdentifier(identifier),
    );
    const passwordHash = user?.passwordHash ?? (await this.getFakePasswordHash());
    const passwordMatches = await this.verifyPassword(passwordHash, password);

    if (!user || !passwordMatches || !user.driverId) {
      throw new UnauthorizedException('Invalid groupement identifier or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('User account is disabled');
    }

    if (!user.groupementIsActive) {
      throw new ForbiddenException('Groupement is disabled');
    }

    return this.issueLoginSession(user, 'GROUPEMENT_IDENTIFIER');
  }

  async refresh(refreshUser: RefreshTokenRequestUser): Promise<AuthSession> {
    const result = await this.refreshTokensRepository.manager.transaction(async (manager) => {
      const tokenRepository = manager.getRepository(RefreshToken);
      const tokenHash = this.hashRefreshToken(refreshUser.refreshToken);
      const storedToken = await tokenRepository.findOne({
        lock: { mode: 'pessimistic_write' },
        where: {
          id: refreshUser.tokenId,
          tokenHash,
        },
      });

      if (!storedToken || storedToken.userId !== refreshUser.userId) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (storedToken.familyId !== refreshUser.familyId) {
        await this.revokeTokenFamily(storedToken.familyId, manager, new Date());
        throw new UnauthorizedException('Invalid refresh token family');
      }

      if (storedToken.revokedAt) {
        await this.revokeTokenFamily(storedToken.familyId, manager, new Date(), storedToken.id);
        await this.auditService.log({
          action: 'AUTH_TOKEN_REUSE_DETECTED',
          after: { familyId: storedToken.familyId },
          resourceId: storedToken.id,
          resourceType: 'RefreshToken',
          userId: storedToken.userId,
        });
        throw new UnauthorizedException('Refresh token reuse detected');
      }

      const now = new Date();

      if (storedToken.expiresAt.getTime() <= now.getTime()) {
        storedToken.revokedAt = now;
        await tokenRepository.save(storedToken);
        throw new UnauthorizedException('Refresh token expired');
      }

      const user = await this.usersRepository.findById(storedToken.userId);

      if (!user?.isActive || !user.groupementIsActive) {
        await this.revokeTokenFamily(storedToken.familyId, manager, now);
        throw new UnauthorizedException('Invalid refresh token');
      }

      storedToken.revokedAt = now;
      const session = await this.issueSession(user, storedToken.familyId, manager);
      storedToken.replacedByTokenId = session.userSessionId;
      await tokenRepository.save(storedToken);

      return { session, user };
    });

    await this.auditService.log({
      action: 'AUTH_REFRESH',
      groupementId: result.user.groupementId,
      resourceId: result.session.userSessionId,
      resourceType: 'AuthSession',
      userId: result.user.id,
    });

    return result.session;
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    await this.refreshTokensRepository.update(
      { id: user.sessionId, userId: user.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    await this.auditService.log({
      action: 'AUTH_LOGOUT',
      groupementId: user.groupementId,
      resourceId: user.sessionId,
      resourceType: 'AuthSession',
      userId: user.id,
    });
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.revokeUserTokens(userId);
  }

  async changePassword(
    user: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const storedUser = await this.usersRepository.findById(user.id);
    const passwordHash = storedUser?.passwordHash ?? (await this.getFakePasswordHash());
    const passwordMatches = await this.verifyPassword(passwordHash, currentPassword);

    if (!storedUser || !passwordMatches) {
      throw new UnauthorizedException('Invalid current password');
    }

    const newPasswordHash = await this.hashPassword(newPassword);
    await this.usersRepository.updatePassword(storedUser.id, newPasswordHash, new Date());
    await this.revokeUserTokens(storedUser.id);
    await this.auditService.log({
      action: 'AUTH_PASSWORD_CHANGED',
      groupementId: storedUser.groupementId,
      resourceType: 'User',
      resourceId: storedUser.id,
      userId: storedUser.id,
    });
  }

  me(user: AuthenticatedUser): PublicAuthUser {
    const response: PublicAuthUser = {
      email: user.email,
      groupementId: user.groupementId,
      groupementName: user.groupementName,
      id: user.id,
      roles: user.roles,
    };

    if (user.driverId) {
      response.driverId = user.driverId;
      response.driverIdentifier = user.driverIdentifier ?? null;
      response.isGroupAdmin = user.isGroupAdmin ?? false;
    }

    return response;
  }

  hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private async issueSession(
    user: AuthUserRecord,
    familyId: string = randomUUID(),
    manager: EntityManager = this.refreshTokensRepository.manager,
  ): Promise<AuthSession & { userSessionId: string }> {
    const sessionId = randomUUID();
    const accessTokenTtl = this.configService.getOrThrow<string>('jwt.accessTtl');
    const refreshTokenTtl = this.configService.getOrThrow<string>('jwt.refreshTtl');
    const accessToken = await this.jwtService.signAsync(
      {
        email: user.email,
        familyId,
        driverId: user.driverId ?? null,
        driverIdentifier: user.driverIdentifier ?? null,
        groupementId: user.groupementId,
        groupementName: user.groupementName,
        isGroupAdmin: user.isGroupAdmin ?? false,
        roles: user.roles,
        sessionId,
        sub: user.id,
        type: 'access',
      },
      {
        expiresIn: accessTokenTtl,
        secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      {
        familyId,
        jti: sessionId,
        sub: user.id,
        type: 'refresh',
      },
      {
        expiresIn: refreshTokenTtl,
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      },
    );

    await manager.save(RefreshToken, {
      expiresAt: addSeconds(new Date(), parseDurationToSeconds(refreshTokenTtl)),
      familyId,
      id: sessionId,
      replacedByTokenId: null,
      reuseDetectedAt: null,
      revokedAt: null,
      tokenHash: this.hashRefreshToken(refreshToken),
      userId: user.id,
    });

    return {
      accessToken,
      expiresIn: parseDurationToSeconds(accessTokenTtl),
      refreshToken,
      tokenType: 'Bearer',
      user: serializeUser(user),
      userSessionId: sessionId,
    };
  }

  private async issueLoginSession(
    user: AuthUserRecord,
    method: 'EMAIL_PASSWORD' | 'GROUPEMENT_IDENTIFIER',
  ): Promise<AuthSession & { userSessionId: string }> {
    const session = await this.refreshTokensRepository.manager.transaction(async (manager) => {
      await this.usersRepository.updateLastLoginAt(user.id, new Date(), manager);
      return this.issueSession(user, randomUUID(), manager);
    });

    await this.auditService.log({
      action: 'AUTH_LOGIN',
      after: { method },
      groupementId: user.groupementId,
      resourceId: session.userSessionId,
      resourceType: 'AuthSession',
      userId: user.id,
    });

    return session;
  }

  private async revokeUserTokens(userId: string): Promise<void> {
    await this.refreshTokensRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async revokeTokenFamily(
    familyId: string,
    manager: EntityManager,
    revokedAt: Date,
    reusedTokenId?: string,
  ): Promise<void> {
    await manager
      .getRepository(RefreshToken)
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt })
      .where('family_id = :familyId', { familyId })
      .andWhere('revoked_at IS NULL')
      .execute();

    if (reusedTokenId) {
      await manager
        .getRepository(RefreshToken)
        .createQueryBuilder()
        .update(RefreshToken)
        .set({ reuseDetectedAt: revokedAt })
        .where('id = :reusedTokenId', { reusedTokenId })
        .execute();
    }
  }

  private getFakePasswordHash(): Promise<string> {
    this.fakePasswordHash ??= this.hashPassword('taxikiwi-fake-password-for-constant-time-login');
    return this.fakePasswordHash;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function serializeUser(user: AuthUserRecord): PublicAuthUser {
  const serialized: PublicAuthUser = {
    email: user.email,
    groupementId: user.groupementId,
    groupementName: user.groupementName,
    id: user.id,
    roles: user.roles,
  };

  if (user.driverId) {
    serialized.driverId = user.driverId;
    serialized.driverIdentifier = user.driverIdentifier ?? null;
    serialized.isGroupAdmin = user.isGroupAdmin ?? false;
  }

  return serialized;
}

function normalizeGroupementCode(groupementCode: string): string {
  return groupementCode.trim().toUpperCase();
}

function normalizeDriverIdentifier(identifier: string): string {
  return identifier.trim().toUpperCase();
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function parseDurationToSeconds(duration: string): number {
  const match = /^(?<amount>\d+)(?<unit>[smhd])?$/.exec(duration);

  if (!match?.groups) {
    throw new Error(`Invalid duration: ${duration}`);
  }

  const amount = Number(match.groups.amount);
  const unit = match.groups.unit ?? 's';

  switch (unit) {
    case 's':
      return amount;
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 60 * 60;
    case 'd':
      return amount * 24 * 60 * 60;
    default:
      throw new Error(`Invalid duration unit: ${unit}`);
  }
}
