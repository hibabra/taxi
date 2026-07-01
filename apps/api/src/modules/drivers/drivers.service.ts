import { createHash, randomBytes } from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { DataSource, EntityManager, IsNull, MoreThan, Not, QueryFailedError } from 'typeorm';
import { DriverPosition } from './entities/driver-position.entity';
import { PhoneNormalizationError, toE164 } from '../../common/utils/phone.util';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/types/auth-user.interface';
import { UserRole } from '../auth/types/role.enum';
import { Groupement } from '../groupements/entities/groupement.entity';
import { TenancyService } from '../tenancy/tenancy.service';
import { SEND_DRIVER_INVITATION_EMAIL_JOB, USERS_EMAIL_QUEUE } from '../users/users.constants';
import { UsersEmailJobPayload } from '../users/users-email.types';
import { AcceptDriverInvitationDto } from './dto/accept-driver-invitation.dto';
import { CreateDriverInvitationDto } from './dto/create-driver-invitation.dto';
import { User } from '../users/entities/user.entity';
import { CreateDriverDto } from './dto/create-driver.dto';
import { DriverInvitationResponseDto } from './dto/driver-invitation-response.dto';
import { DriverResponseDto } from './dto/driver-response.dto';
import { SuspendDriverDto } from './dto/suspend-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriverInvitation } from './entities/driver-invitation.entity';
import { Driver } from './entities/driver.entity';
import {
  DRIVER_INVITATION_ACCEPTED,
  DRIVER_INVITATION_TOKEN_TTL_HOURS,
  DRIVER_INVITED,
  DRIVER_PHONE_DUPLICATE_WARNING,
} from './drivers.constants';
import { DriverStatus } from './types/driver-status.enum';

export interface ListDriversOptions {
  limit: number;
  matricule?: string;
  page: number;
  search?: string;
  status?: DriverStatus;
}

type DuplicatePhoneWarning = {
  existingDriverId: string;
  newDriverId: string;
  phoneE164: string;
};

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    private readonly tenancyService: TenancyService,
    private readonly auditService: AuditService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectQueue(USERS_EMAIL_QUEUE)
    private readonly emailQueue: Queue<UsersEmailJobPayload>,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  async findAll(
    groupementId: string,
    options: ListDriversOptions,
  ): Promise<{ data: DriverResponseDto[]; total: number }> {
    return this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const qb = queryRunner.manager
        .getRepository(Driver)
        .createQueryBuilder('d')
        .where('d.groupement_id = :groupementId', { groupementId });

      if (options.status) {
        qb.andWhere('d.status = :status', { status: options.status });
      }

      if (options.matricule) {
        qb.andWhere('d.matricule ILIKE :matricule', {
          matricule: `%${options.matricule.trim()}%`,
        });
      }

      if (options.search) {
        qb.andWhere(
          '(d.first_name ILIKE :search OR d.last_name ILIKE :search OR d.matricule ILIKE :search)',
          { search: `%${options.search.trim()}%` },
        );
      }

      qb.orderBy('d.created_at', 'DESC');
      qb.skip((options.page - 1) * options.limit);
      qb.take(options.limit);

      const [data, total] = await qb.getManyAndCount();

      return { data: data.map(serializeDriver), total };
    });
  }

  async findOne(id: string, groupementId: string): Promise<DriverResponseDto> {
    const driver = await this.findDriverOrFail(id, groupementId);
    return serializeDriver(driver);
  }

  async createInvitation(
    groupementId: string,
    actor: AuthenticatedUser,
    dto: CreateDriverInvitationDto,
  ): Promise<DriverInvitationResponseDto> {
    return this.createDriverInvitation(groupementId, actor, dto, { isGroupAdmin: false });
  }

  async createGroupAdminInvitation(
    groupementId: string,
    actor: AuthenticatedUser,
    dto: CreateDriverInvitationDto,
  ): Promise<DriverInvitationResponseDto> {
    return this.createDriverInvitation(groupementId, actor, dto, { isGroupAdmin: true });
  }

  private async createDriverInvitation(
    groupementId: string,
    actor: AuthenticatedUser,
    dto: CreateDriverInvitationDto,
    options: { isGroupAdmin: boolean },
  ): Promise<DriverInvitationResponseDto> {
    const email = normalizeEmail(dto.email);
    const licenseCity = dto.licenseCity.trim();
    const licenseNumber = normalizeLicenseNumber(dto.licenseNumber);
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = addHours(new Date(), DRIVER_INVITATION_TOKEN_TTL_HOURS);

    const invitation = await this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_groupement_id', $1, true)`, [
        groupementId,
      ]);

      const invitationRepository = manager.getRepository(DriverInvitation);

      const existingUser = await findUserByEmail(manager, groupementId, email);
      if (existingUser) {
        throw new ConflictException('Un compte existe déjà avec cet email dans ce groupement');
      }

      const existingLicense = await manager.getRepository(Driver).findOne({
        where: { groupementId, licenseNumber },
      });
      if (existingLicense) {
        throw new ConflictException('Un chauffeur existe déjà avec ce numéro de licence');
      }

      if (options.isGroupAdmin) {
        const existingGroupAdmin = await manager.getRepository(Driver).findOne({
          where: { groupementId, isGroupAdmin: true },
        });

        if (existingGroupAdmin) {
          throw new ConflictException('Ce groupement possède déjà un admin');
        }

        const pendingAdminInvitation = await invitationRepository.findOne({
          where: {
            acceptedAt: IsNull(),
            expiresAt: MoreThan(new Date()),
            groupementId,
            isGroupAdmin: true,
          },
        });

        if (pendingAdminInvitation) {
          throw new ConflictException('Une invitation admin active existe déjà pour ce groupement');
        }
      }

      const pendingInvitation = await invitationRepository.findOne({
        where: {
          acceptedAt: IsNull(),
          email,
          expiresAt: MoreThan(new Date()),
          groupementId,
        },
      });

      if (pendingInvitation) {
        throw new ConflictException('Une invitation chauffeur active existe déjà pour cet email');
      }

      return invitationRepository.save(
        invitationRepository.create({
          email,
          expiresAt,
          groupementId,
          isGroupAdmin: options.isGroupAdmin,
          invitedByUserId: actor.id,
          licenseCity,
          licenseNumber,
          tokenHash,
        }),
      );
    });

    await this.emailQueue.add(
      SEND_DRIVER_INVITATION_EMAIL_JOB,
      {
        email: invitation.email,
        expiresAt: invitation.expiresAt.toISOString(),
        groupementId,
        invitationToken: token,
        licenseCity: invitation.licenseCity,
        licenseNumber: invitation.licenseNumber,
      },
      this.defaultJobOptions(),
    );

    await this.auditService.log({
      action: DRIVER_INVITED,
      after: serializeInvitation(invitation) as unknown as Record<string, unknown>,
      groupementId,
      resourceId: invitation.id,
      resourceType: 'DriverInvitation',
    });

    return serializeInvitation(invitation);
  }

  async acceptInvitation(
    token: string,
    dto: AcceptDriverInvitationDto,
  ): Promise<DriverResponseDto> {
    const tokenHash = hashToken(token);
    const now = new Date();

    const driver = await this.dataSource.transaction(async (manager) => {
      await manager.query(`SET LOCAL app.invitation_lookup = 'on'`);
      await manager.query(`SET LOCAL app.driver_invitation_lookup = 'on'`);

      const invitationRepository = manager.getRepository(DriverInvitation);
      const userRepository = manager.getRepository(User);
      const driverRepository = manager.getRepository(Driver);
      const invitation = await invitationRepository.findOne({
        lock: { mode: 'pessimistic_write' },
        where: { tokenHash },
      });

      this.assertUsableInvitation(invitation, now);

      const existingUser = await findUserByEmail(
        manager,
        invitation.groupementId,
        invitation.email,
      );
      if (existingUser) {
        throw new ConflictException('Un compte existe déjà avec cet email dans ce groupement');
      }

      const existingLicense = await driverRepository.findOne({
        where: {
          groupementId: invitation.groupementId,
          licenseNumber: invitation.licenseNumber,
        },
      });
      if (existingLicense) {
        throw new ConflictException('Un chauffeur existe déjà avec ce numéro de licence');
      }

      if (invitation.isGroupAdmin) {
        const existingGroupAdmin = await driverRepository.findOne({
          where: { groupementId: invitation.groupementId, isGroupAdmin: true },
        });

        if (existingGroupAdmin) {
          throw new ConflictException('Ce groupement possède déjà un admin');
        }
      }

      const passwordHash = await this.authService.hashPassword(dto.password);
      const phoneE164 = normalizePhone(dto.phone, dto.countryCode);
      const savedUser = await userRepository.save(
        userRepository.create({
          email: invitation.email,
          firstName: dto.firstName.trim(),
          groupementId: invitation.groupementId,
          isActive: true,
          lastName: dto.lastName.trim(),
          passwordHash,
          passwordUpdatedAt: now,
          phoneE164,
          roles: invitation.isGroupAdmin ? [UserRole.DRIVER, UserRole.ADMIN] : [UserRole.DRIVER],
        }),
      );

      const driverIdentifier = await this.generateDriverIdentifier(
        manager,
        invitation.groupementId,
      );
      const savedDriver = await driverRepository.save(
        driverRepository.create({
          driverIdentifier,
          firstName: dto.firstName.trim(),
          groupementId: invitation.groupementId,
          isGroupAdmin: invitation.isGroupAdmin,
          joinedAt: now,
          lastName: dto.lastName.trim(),
          licenseCity: invitation.licenseCity,
          licenseNumber: invitation.licenseNumber,
          matricule: driverIdentifier,
          mobileActivatedAt: now,
          offboardedAt: null,
          phoneE164,
          status: DriverStatus.ACTIVE,
          statusChangedAt: now,
          statusReason: null,
          suspendedAt: null,
          userId: savedUser.id,
          vehicleMake: dto.vehicleMake.trim(),
          vehicleModel: dto.vehicleModel.trim(),
          vehicleRegistration: normalizeRegistration(dto.vehicleRegistration),
          vehicleYear: dto.vehicleYear,
        }),
      );

      invitation.acceptedAt = now;
      invitation.acceptedDriverId = savedDriver.id;
      await invitationRepository.save(invitation);

      return savedDriver;
    });

    await this.auditService.log({
      action: DRIVER_INVITATION_ACCEPTED,
      after: serializeDriver(driver) as unknown as Record<string, unknown>,
      groupementId: driver.groupementId,
      resourceId: driver.id,
      resourceType: 'Driver',
    });

    return serializeDriver(driver);
  }

  async create(groupementId: string, dto: CreateDriverDto): Promise<DriverResponseDto> {
    const matricule = normalizeMatricule(dto.matricule);
    const phoneE164 = normalizePhone(dto.phone, dto.countryCode);
    let duplicatePhoneWarning: DuplicatePhoneWarning | null = null;

    const driver = await this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const manager = queryRunner.manager;
      const repository = manager.getRepository(Driver);
      const positionRepository = manager.getRepository(DriverPosition);
      await this.assertMatriculeAvailable(manager, groupementId, matricule);
      await this.assertAssignableUser(manager, groupementId, dto.userId ?? null);

      const existingPhoneDriver = await this.findDriverByPhone(manager, groupementId, phoneE164);
      const now = new Date();
      const driverIdentifier = await this.generateDriverIdentifier(manager, groupementId);
      const createdDriver = repository.create({
        driverIdentifier,
        firstName: dto.firstName.trim(),
        groupementId,
        isGroupAdmin: false,
        joinedAt: dto.joinedAt ?? now,
        lastName: dto.lastName.trim(),
        licenseCity: dto.licenseCity?.trim() || null,
        licenseNumber: dto.licenseNumber ? normalizeLicenseNumber(dto.licenseNumber) : null,
        matricule,
        mobileActivatedAt: dto.userId ? now : null,
        offboardedAt: null,
        phoneE164,
        status: DriverStatus.ACTIVE,
        statusChangedAt: now,
        statusReason: null,
        suspendedAt: null,
        userId: dto.userId ?? null,
        vehicleMake: dto.vehicleMake.trim(),
        vehicleModel: dto.vehicleModel.trim(),
        vehicleRegistration: normalizeRegistration(dto.vehicleRegistration),
        vehicleYear: dto.vehicleYear,
      });

      try {
        
  const savedDriver = await repository.save(createdDriver);

  let duplicatePhoneWarning: {
    existingDriverId: string;
    newDriverId: string;
    phoneE164: string;
  } | null = null;

  if (existingPhoneDriver) {
    duplicatePhoneWarning = {
      existingDriverId: existingPhoneDriver.id,
      newDriverId: savedDriver.id,
      phoneE164,
    };
  }

  return {
    ...savedDriver,
    duplicatePhoneWarning,
  };
} catch (error) {
  this.handlePersistenceError(error, matricule);
}
    });

    await this.logDuplicatePhoneWarning(groupementId, duplicatePhoneWarning);
    this.logger.log({ driverId: driver.id, groupementId, matricule }, 'Driver created');

    return serializeDriver(driver);
  }

  async update(id: string, groupementId: string, dto: UpdateDriverDto): Promise<DriverResponseDto> {
    let duplicatePhoneWarning: DuplicatePhoneWarning | null = null;

    const driver = await this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const manager = queryRunner.manager;
      const repository = manager.getRepository(Driver);
      const target = await this.findDriverOrFailForUpdate(manager, id, groupementId);

      this.assertMutable(target);

      if (dto.matricule !== undefined) {
        const matricule = normalizeMatricule(dto.matricule);
        if (matricule !== target.matricule) {
          await this.assertMatriculeAvailable(manager, groupementId, matricule, target.id);
          target.matricule = matricule;
        }
      }

      if (dto.userId !== undefined && dto.userId !== target.userId) {
        await this.assertAssignableUser(manager, groupementId, dto.userId, target.id);
        target.userId = dto.userId ?? null;
      }

      if (dto.phone !== undefined) {
        const phoneE164 = normalizePhone(dto.phone, dto.countryCode);
        const existingPhoneDriver = await this.findDriverByPhone(
          manager,
          groupementId,
          phoneE164,
          target.id,
        );
        target.phoneE164 = phoneE164;

        if (existingPhoneDriver) {
          duplicatePhoneWarning = {
            existingDriverId: existingPhoneDriver.id,
            newDriverId: target.id,
            phoneE164,
          };
        }
      }

      if (dto.firstName !== undefined) target.firstName = dto.firstName.trim();
      if (dto.lastName !== undefined) target.lastName = dto.lastName.trim();
      if (dto.licenseCity !== undefined) target.licenseCity = dto.licenseCity?.trim() || null;
      if (dto.licenseNumber !== undefined) {
        target.licenseNumber = dto.licenseNumber ? normalizeLicenseNumber(dto.licenseNumber) : null;
      }
      if (dto.joinedAt !== undefined) target.joinedAt = dto.joinedAt;
      if (dto.vehicleMake !== undefined) target.vehicleMake = dto.vehicleMake.trim();
      if (dto.vehicleModel !== undefined) target.vehicleModel = dto.vehicleModel.trim();
      if (dto.vehicleRegistration !== undefined) {
        target.vehicleRegistration = normalizeRegistration(dto.vehicleRegistration);
      }
      if (dto.vehicleYear !== undefined) target.vehicleYear = dto.vehicleYear;

      try {
        return await repository.save(target);
      } catch (error) {
        this.handlePersistenceError(error, target.matricule);
      }
    });

    await this.logDuplicatePhoneWarning(groupementId, duplicatePhoneWarning);
    this.logger.log({ driverId: id, groupementId }, 'Driver updated');

    return serializeDriver(driver);
  }

  async suspend(
    id: string,
    groupementId: string,
    dto: SuspendDriverDto,
  ): Promise<DriverResponseDto> {
    const driver = await this.transitionStatus(
      id,
      groupementId,
      DriverStatus.SUSPENDED,
      dto.reason,
    );
    this.logger.warn({ driverId: id, groupementId }, 'Driver suspended');
    return serializeDriver(driver);
  }

  async reactivate(id: string, groupementId: string): Promise<DriverResponseDto> {
    const driver = await this.transitionStatus(id, groupementId, DriverStatus.ACTIVE);
    this.logger.log({ driverId: id, groupementId }, 'Driver reactivated');
    return serializeDriver(driver);
  }

  async offboard(id: string, groupementId: string): Promise<DriverResponseDto> {
    const driver = await this.transitionStatus(id, groupementId, DriverStatus.OFFBOARDED);
    this.logger.warn({ driverId: id, groupementId }, 'Driver offboarded');
    return serializeDriver(driver);
  }

  private async transitionStatus(
    id: string,
    groupementId: string,
    nextStatus: DriverStatus,
    reason?: string,
  ): Promise<Driver> {
    return this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const manager = queryRunner.manager;
      const repository = manager.getRepository(Driver);
      const driver = await this.findDriverOrFailForUpdate(manager, id, groupementId);
      const now = new Date();

      if (driver.status === DriverStatus.OFFBOARDED) {
        throw new ConflictException(
          'Un chauffeur sorti du groupement ne peut plus changer de statut',
        );
      }

      if (nextStatus === DriverStatus.SUSPENDED) {
        if (driver.status !== DriverStatus.ACTIVE) {
          throw new ConflictException('Seul un chauffeur actif peut être suspendu');
        }

        driver.status = DriverStatus.SUSPENDED;
        driver.statusReason = reason?.trim() || null;
        driver.suspendedAt = now;
      }

      if (nextStatus === DriverStatus.ACTIVE) {
        if (driver.status !== DriverStatus.SUSPENDED) {
          throw new ConflictException('Seul un chauffeur suspendu peut être réactivé');
        }

        driver.status = DriverStatus.ACTIVE;
        driver.statusReason = null;
        driver.suspendedAt = null;
      }

      if (nextStatus === DriverStatus.OFFBOARDED) {
        driver.status = DriverStatus.OFFBOARDED;
        driver.statusReason = null;
        driver.suspendedAt = null;
        driver.offboardedAt = now;
      }

      driver.statusChangedAt = now;

      return repository.save(driver);
    });
  }

  private async findDriverOrFail(id: string, groupementId: string): Promise<Driver> {
    return this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const driver = await queryRunner.manager.getRepository(Driver).findOne({
        where: { groupementId, id },
      });

      if (!driver) {
        throw new NotFoundException(`Chauffeur ${id} introuvable`);
      }

      return driver;
    });
  }

  private async findDriverOrFailForUpdate(
    manager: EntityManager,
    id: string,
    groupementId: string,
  ): Promise<Driver> {
    const driver = await manager.getRepository(Driver).findOne({
      lock: { mode: 'pessimistic_write' },
      where: { groupementId, id },
    });

    if (!driver) {
      throw new NotFoundException(`Chauffeur ${id} introuvable`);
    }

    return driver;
  }

  private async assertMatriculeAvailable(
    manager: EntityManager,
    groupementId: string,
    matricule: string,
    exceptDriverId?: string,
  ): Promise<void> {
    const existing = await manager.getRepository(Driver).findOne({
      where: {
        groupementId,
        id: exceptDriverId ? Not(exceptDriverId) : undefined,
        matricule,
      },
    });

    if (existing) {
      throw new ConflictException(`Un chauffeur avec le matricule ${matricule} existe déjà`);
    }
  }

  private async assertAssignableUser(
    manager: EntityManager,
    groupementId: string,
    userId: string | null,
    exceptDriverId?: string,
  ): Promise<void> {
    if (!userId) {
      return;
    }

    const user = await manager.getRepository(User).findOne({
      where: { groupementId, id: userId, isActive: true },
    });

    if (!user) {
      throw new BadRequestException("Le compte utilisateur lié n'existe pas dans ce groupement");
    }

    const existingDriver = await manager.getRepository(Driver).findOne({
      where: {
        id: exceptDriverId ? Not(exceptDriverId) : undefined,
        userId,
      },
    });

    if (existingDriver) {
      throw new ConflictException('Ce compte utilisateur est déjà lié à un chauffeur');
    }
  }

  private async findDriverByPhone(
    manager: EntityManager,
    groupementId: string,
    phoneE164: string,
    exceptDriverId?: string,
  ): Promise<Driver | null> {
    return manager.getRepository(Driver).findOne({
      where: {
        groupementId,
        id: exceptDriverId ? Not(exceptDriverId) : undefined,
        phoneE164,
      },
    });
  }

  private async generateDriverIdentifier(
    manager: EntityManager,
    groupementId: string,
  ): Promise<string> {
    const repository = manager.getRepository(Groupement);
    const groupement = await repository.findOne({
      loadEagerRelations: false,
      lock: { mode: 'pessimistic_write' },
      where: { id: groupementId },
    });

    if (!groupement) {
      throw new BadRequestException("Le groupement indiqué n'existe pas");
    }

    const next = groupement.driverIdentifierNext || 1;
    groupement.driverIdentifierNext = next + 1;
    await repository.save(groupement);

    return `T${next}`;
  }

  private assertUsableInvitation(
    invitation: DriverInvitation | null,
    now: Date,
  ): asserts invitation is DriverInvitation {
    if (!invitation) {
      throw new GoneException('Cette invitation chauffeur n’est plus utilisable');
    }

    if (invitation.acceptedAt) {
      throw new GoneException('Cette invitation chauffeur a déjà été utilisée');
    }

    if (invitation.expiresAt.getTime() <= now.getTime()) {
      throw new GoneException('Cette invitation chauffeur a expiré');
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

  private assertMutable(driver: Driver): void {
    if (driver.status === DriverStatus.OFFBOARDED) {
      throw new ConflictException('Un chauffeur sorti du groupement ne peut plus être modifié');
    }
  }

  private async logDuplicatePhoneWarning(
    groupementId: string,
    warning: DuplicatePhoneWarning | null,
  ): Promise<void> {
    if (!warning) {
      return;
    }

    this.logger.warn(
      {
        existingDriverId: warning.existingDriverId,
        groupementId,
        newDriverId: warning.newDriverId,
        phoneE164: warning.phoneE164,
      },
      'Duplicate driver phone detected',
    );

    await this.auditService.log({
      action: DRIVER_PHONE_DUPLICATE_WARNING,
      after: warning,
      groupementId,
      resourceId: warning.newDriverId,
      resourceType: 'Driver',
    });
  }

  private handlePersistenceError(error: unknown, matricule: string): never {
    if (isUniqueViolation(error)) {
      throw new ConflictException(`Un chauffeur avec le matricule ${matricule} existe déjà`);
    }

    throw error;
  }
}

function serializeDriver(driver: Driver): DriverResponseDto {
  return {
    createdAt: driver.createdAt,
    driverIdentifier: driver.driverIdentifier,
    firstName: driver.firstName,
    groupementId: driver.groupementId,
    id: driver.id,
    isGroupAdmin: driver.isGroupAdmin,
    joinedAt: driver.joinedAt,
    lastName: driver.lastName,
    licenseCity: driver.licenseCity,
    licenseNumber: driver.licenseNumber,
    matricule: driver.matricule,
    mobileActivatedAt: driver.mobileActivatedAt,
    offboardedAt: driver.offboardedAt,
    phoneE164: driver.phoneE164,
    status: driver.status,
    statusChangedAt: driver.statusChangedAt,
    statusReason: driver.statusReason,
    suspendedAt: driver.suspendedAt,
    updatedAt: driver.updatedAt,
    userId: driver.userId,
    vehicleMake: driver.vehicleMake,
    vehicleModel: driver.vehicleModel,
    vehicleRegistration: driver.vehicleRegistration,
    vehicleYear: driver.vehicleYear,
  };
}

function serializeInvitation(invitation: DriverInvitation): DriverInvitationResponseDto {
  return {
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    groupementId: invitation.groupementId,
    id: invitation.id,
    isGroupAdmin: invitation.isGroupAdmin,
    licenseCity: invitation.licenseCity,
    licenseNumber: invitation.licenseNumber,
  };
}

function normalizePhone(phone: string, countryCode?: string): string {
  try {
    return toE164(phone, countryCode ?? 'FR');
  } catch (error) {
    if (error instanceof PhoneNormalizationError) {
      throw new BadRequestException(error.message);
    }

    throw error;
  }
}

function normalizeMatricule(matricule: string): string {
  return matricule.trim().toUpperCase();
}

function normalizeLicenseNumber(licenseNumber: string): string {
  return licenseNumber.trim().toUpperCase();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeRegistration(registration: string): string {
  return registration.trim().toUpperCase();
}

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
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

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as { code?: string };
  return driverError.code === '23505';
}
