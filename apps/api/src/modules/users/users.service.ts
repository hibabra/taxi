import { createHash, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { DataSource, EntityManager, IsNull, MoreThan } from 'typeorm';

import { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/types/auth-user.interface';
import { UserRole } from '../auth/types/role.enum';
import { TenancyService } from '../tenancy/tenancy.service';
import { AcceptUserInvitationDto } from './dto/accept-user-invitation.dto';
import { CreateUserInvitationDto } from './dto/create-user-invitation.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserInvitationResponseDto } from './dto/user-invitation-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserInvitation, UserInvitationType } from './entities/user-invitation.entity';
import { User } from './entities/user.entity';
import {
  INVITATION_TOKEN_TTL_HOURS,
  RESET_PASSWORD_TOKEN_TTL_HOURS,
  SEND_INVITATION_EMAIL_JOB,
  SEND_RESET_PASSWORD_EMAIL_JOB,
  USERS_EMAIL_QUEUE,
} from './users.constants';
import { UsersEmailJobPayload } from './users-email.types';

export interface ListUsersOptions {
  isActive?: boolean;
  limit: number;
  page: number;
  role?: UserRole;
  search?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly tenancyService: TenancyService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectQueue(USERS_EMAIL_QUEUE)
    private readonly emailQueue: Queue<UsersEmailJobPayload>,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  async findAll(
    groupementId: string,
    options: ListUsersOptions,
  ): Promise<{ data: UserResponseDto[]; total: number }> {
    return this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const qb = queryRunner.manager
        .getRepository(User)
        .createQueryBuilder('u')
        .where('u.groupement_id = :groupementId', { groupementId });

      if (options.isActive !== undefined) {
        qb.andWhere('u.is_active = :isActive', { isActive: options.isActive });
      }

      if (options.role) {
        qb.andWhere(':role = ANY(u.roles)', { role: options.role });
      }

      if (options.search) {
        qb.andWhere(
          '(u.first_name ILIKE :search OR u.last_name ILIKE :search OR u.email ILIKE :search)',
          { search: `%${options.search}%` },
        );
      }

      qb.orderBy('u.created_at', 'DESC');
      qb.skip((options.page - 1) * options.limit);
      qb.take(options.limit);

      const [data, total] = await qb.getManyAndCount();
      return { data: data.map(serializeUser), total };
    });
  }

  async findOne(id: string, groupementId: string): Promise<UserResponseDto> {
    const user = await this.findUserOrFail(id, groupementId);
    return serializeUser(user);
  }

  async createInvitation(
    groupementId: string,
    actor: AuthenticatedUser,
    dto: CreateUserInvitationDto,
  ): Promise<UserInvitationResponseDto> {
    this.assertAssignableRoles(dto.roles);

    const email = normalizeEmail(dto.email);
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = addHours(new Date(), INVITATION_TOKEN_TTL_HOURS);

    const invitation = await this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const invitationRepository = queryRunner.manager.getRepository(UserInvitation);

      const existingUser = await findUserByEmail(queryRunner.manager, groupementId, email);
      if (existingUser) {
        throw new ConflictException('Un utilisateur avec cet email existe déjà');
      }

      const pendingInvitation = await invitationRepository.findOne({
        where: {
          acceptedAt: IsNull(),
          email,
          expiresAt: MoreThan(new Date()),
          groupementId,
          type: UserInvitationType.INVITATION,
        },
      });

      if (pendingInvitation) {
        throw new ConflictException('Une invitation active existe déjà pour cet email');
      }

      const createdInvitation = invitationRepository.create({
        email,
        expiresAt,
        firstName: dto.firstName.trim(),
        groupementId,
        invitedByUserId: actor.id,
        lastName: dto.lastName.trim(),
        phoneE164: dto.phoneE164 ?? null,
        roles: dto.roles,
        tokenHash,
        type: UserInvitationType.INVITATION,
      });

      return invitationRepository.save(createdInvitation);
    });

    await this.emailQueue.add(
      SEND_INVITATION_EMAIL_JOB,
      {
        email: invitation.email,
        expiresAt: invitation.expiresAt.toISOString(),
        firstName: invitation.firstName,
        groupementId,
        invitationToken: token,
        lastName: invitation.lastName,
        roles: invitation.roles,
      },
      this.defaultJobOptions(),
    );

    this.logger.log({ email, groupementId, invitationId: invitation.id }, 'User invited');

    return serializeInvitation(invitation);
  }

  async acceptInvitation(token: string, dto: AcceptUserInvitationDto): Promise<UserResponseDto> {
    const tokenHash = hashToken(token);
    const now = new Date();

    const user = await this.dataSource.transaction(async (manager) => {
      await manager.query(`SET LOCAL app.invitation_lookup = 'on'`);

      const invitationRepository = manager.getRepository(UserInvitation);
      const userRepository = manager.getRepository(User);
      const invitation = await invitationRepository.findOne({
        lock: { mode: 'pessimistic_write' },
        where: { tokenHash, type: UserInvitationType.INVITATION },
      });

      this.assertUsableToken(invitation, now, 'invitation');

      const existingUser = await findUserByEmail(
        manager,
        invitation.groupementId,
        invitation.email,
      );
      if (existingUser) {
        throw new ConflictException('Un utilisateur avec cet email existe déjà');
      }

      const passwordHash = await this.authService.hashPassword(dto.password);
      const createdUser = userRepository.create({
        email: invitation.email,
        firstName: invitation.firstName,
        groupementId: invitation.groupementId,
        isActive: true,
        lastName: invitation.lastName,
        passwordHash,
        passwordUpdatedAt: now,
        phoneE164: invitation.phoneE164,
        roles: invitation.roles,
      });
      const savedUser = await userRepository.save(createdUser);

      invitation.acceptedAt = now;
      invitation.acceptedUserId = savedUser.id;
      await invitationRepository.save(invitation);

      return savedUser;
    });

    this.logger.log({ groupementId: user.groupementId, userId: user.id }, 'Invitation accepted');

    return serializeUser(user);
  }

  async update(
    id: string,
    groupementId: string,
    actor: AuthenticatedUser,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    if (dto.roles) {
      this.assertAssignableRoles(dto.roles);

      if (actor.id === id) {
        throw new BadRequestException('Vous ne pouvez pas modifier vos propres rôles');
      }
    }

    const user = await this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const repository = queryRunner.manager.getRepository(User);
      const target = await repository.findOne({ where: { groupementId, id } });

      if (!target) {
        throw new NotFoundException(`Utilisateur ${id} introuvable`);
      }

      if (dto.firstName !== undefined) target.firstName = dto.firstName.trim();
      if (dto.lastName !== undefined) target.lastName = dto.lastName.trim();
      if (dto.phoneE164 !== undefined) target.phoneE164 = dto.phoneE164;
      if (dto.roles !== undefined) target.roles = mergeAssignableRoles(target.roles, dto.roles);

      return repository.save(target);
    });

    this.logger.log({ groupementId, userId: id }, 'User updated');

    return serializeUser(user);
  }

  async deactivate(
    id: string,
    groupementId: string,
    actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    if (actor.id === id) {
      throw new BadRequestException('Vous ne pouvez pas désactiver votre propre compte');
    }

    const user = await this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const repository = queryRunner.manager.getRepository(User);
      const target = await repository.findOne({ where: { groupementId, id } });

      if (!target) {
        throw new NotFoundException(`Utilisateur ${id} introuvable`);
      }

      if (!target.isActive) {
        throw new ConflictException('Cet utilisateur est déjà désactivé');
      }

      target.isActive = false;
      return repository.save(target);
    });

    await this.authService.revokeUserSessions(id);
    this.logger.warn({ groupementId, userId: id }, 'User deactivated');

    return serializeUser(user);
  }

  async createPasswordReset(
    id: string,
    groupementId: string,
    actor: AuthenticatedUser,
  ): Promise<UserInvitationResponseDto> {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = addHours(new Date(), RESET_PASSWORD_TOKEN_TTL_HOURS);

    const invitation = await this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const repository = queryRunner.manager.getRepository(User);
      const invitationRepository = queryRunner.manager.getRepository(UserInvitation);
      const user = await repository.findOne({ where: { groupementId, id } });

      if (!user) {
        throw new NotFoundException(`Utilisateur ${id} introuvable`);
      }

      if (!user.isActive) {
        throw new ConflictException('Impossible de réinitialiser un compte désactivé');
      }

      await invitationRepository.update(
        {
          acceptedAt: IsNull(),
          email: user.email,
          groupementId,
          type: UserInvitationType.RESET_PASSWORD,
        },
        { acceptedAt: new Date() },
      );

      return invitationRepository.save(
        invitationRepository.create({
          email: user.email,
          expiresAt,
          firstName: user.firstName,
          groupementId,
          invitedByUserId: actor.id,
          lastName: user.lastName,
          phoneE164: user.phoneE164,
          roles: user.roles,
          tokenHash,
          type: UserInvitationType.RESET_PASSWORD,
        }),
      );
    });

    await this.emailQueue.add(
      SEND_RESET_PASSWORD_EMAIL_JOB,
      {
        email: invitation.email,
        expiresAt: invitation.expiresAt.toISOString(),
        firstName: invitation.firstName,
        groupementId,
        resetToken: token,
      },
      this.defaultJobOptions(),
    );

    this.logger.log({ groupementId, userId: id }, 'Password reset requested');

    return serializeInvitation(invitation);
  }

  async acceptPasswordReset(token: string, dto: ResetPasswordDto): Promise<void> {
    const tokenHash = hashToken(token);
    const now = new Date();
    let userId: string | null = null;

    await this.dataSource.transaction(async (manager) => {
      await manager.query(`SET LOCAL app.invitation_lookup = 'on'`);

      const invitationRepository = manager.getRepository(UserInvitation);
      const userRepository = manager.getRepository(User);
      const invitation = await invitationRepository.findOne({
        lock: { mode: 'pessimistic_write' },
        where: { tokenHash, type: UserInvitationType.RESET_PASSWORD },
      });

      this.assertUsableToken(invitation, now, 'réinitialisation de mot de passe');

      const user = await userRepository.findOne({
        where: {
          email: invitation.email,
          groupementId: invitation.groupementId,
          isActive: true,
        },
      });

      if (!user) {
        throw new GoneException('Ce token de réinitialisation n’est plus utilisable');
      }

      user.passwordHash = await this.authService.hashPassword(dto.password);
      user.passwordUpdatedAt = now;
      await userRepository.save(user);

      invitation.acceptedAt = now;
      invitation.acceptedUserId = user.id;
      await invitationRepository.save(invitation);

      userId = user.id;
    });

    if (userId) {
      await this.authService.revokeUserSessions(userId);
    }
  }

  private async findUserOrFail(id: string, groupementId: string): Promise<User> {
    return this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const user = await queryRunner.manager.getRepository(User).findOne({
        where: { groupementId, id },
      });

      if (!user) {
        throw new NotFoundException(`Utilisateur ${id} introuvable`);
      }

      return user;
    });
  }

  private assertUsableToken(
    invitation: UserInvitation | null,
    now: Date,
    tokenLabel: string,
  ): asserts invitation is UserInvitation {
    if (!invitation) {
      throw new GoneException(`Ce token de ${tokenLabel} n’est plus utilisable`);
    }

    if (invitation.acceptedAt) {
      throw new GoneException(`Ce token de ${tokenLabel} a déjà été utilisé`);
    }

    if (invitation.expiresAt.getTime() <= now.getTime()) {
      throw new GoneException(`Ce token de ${tokenLabel} a expiré`);
    }
  }

  private assertAssignableRoles(roles: UserRole[]): void {
    const uniqueRoles = new Set(roles);

    if (uniqueRoles.size !== 1 || !uniqueRoles.has(UserRole.ADMIN)) {
      throw new BadRequestException(
        'Seul le rôle ADMIN de groupement peut être attribué via les invitations utilisateurs',
      );
    }
  }

  private defaultJobOptions() {
    return {
      attempts: this.configService.getOrThrow<number>('queue.defaultJobAttempts'),
      backoff: {
        delay: this.configService.getOrThrow<number>('queue.defaultBackoffMs'),
        type: 'exponential',
      },
      removeOnComplete: true,
    };
  }
}

async function findUserByEmail(
  manager: EntityManager,
  groupementId: string,
  email: string,
): Promise<User | null> {
  return manager
    .getRepository(User)
    .createQueryBuilder('u')
    .where('u.groupement_id = :groupementId', { groupementId })
    .andWhere('lower(u.email) = :email', { email: normalizeEmail(email) })
    .getOne();
}

function serializeUser(user: User): UserResponseDto {
  return {
    createdAt: user.createdAt,
    email: user.email,
    firstName: user.firstName,
    groupementId: user.groupementId,
    id: user.id,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    lastName: user.lastName,
    phoneE164: user.phoneE164,
    roles: user.roles,
    updatedAt: user.updatedAt,
  };
}

function serializeInvitation(invitation: UserInvitation): UserInvitationResponseDto {
  return {
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    groupementId: invitation.groupementId,
    id: invitation.id,
    roles: invitation.roles,
  };
}

function mergeAssignableRoles(currentRoles: UserRole[], requestedRoles: UserRole[]): UserRole[] {
  const nextRoles = new Set(requestedRoles);

  if (currentRoles.includes(UserRole.DRIVER)) {
    nextRoles.add(UserRole.DRIVER);
  }

  return [UserRole.DRIVER, UserRole.ADMIN].filter((role) => nextRoles.has(role));
}

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
