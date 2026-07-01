import { BadRequestException, ConflictException } from '@nestjs/common';

import { AuditService } from '../../audit/audit.service';
import { AuthService } from '../../auth/auth.service';
import { UserRole } from '../../auth/types/role.enum';
import { Groupement } from '../../groupements/entities/groupement.entity';
import { TenancyService } from '../../tenancy/tenancy.service';
import { User } from '../../users/entities/user.entity';
import { SEND_DRIVER_INVITATION_EMAIL_JOB } from '../../users/users.constants';
import { DRIVER_PHONE_DUPLICATE_WARNING } from '../drivers.constants';
import { DriversService } from '../drivers.service';
import { DriverInvitation } from '../entities/driver-invitation.entity';
import { Driver } from '../entities/driver.entity';
import { DriverStatus } from '../types/driver-status.enum';

describe('DriversService', () => {
  const groupementId = 'groupement-1';

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  };

  const mockUserQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    where: jest.fn().mockReturnThis(),
  };

  const mockDriverRepository = {
    create: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepository = {
    create: jest.fn(),
    createQueryBuilder: jest.fn(() => mockUserQueryBuilder),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockInvitationRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockGroupementRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockManager = {
    getRepository: jest.fn((entity: object) => {
      if (entity === Driver) return mockDriverRepository;
      if (entity === DriverInvitation) return mockInvitationRepository;
      if (entity === User) return mockUserRepository;
      if (entity === Groupement) return mockGroupementRepository;
      throw new Error('Unexpected repository');
    }),
    query: jest.fn(),
  };

  const mockTenancyService = {
    withTenantTransaction: jest.fn(
      (callback: (queryRunner: { manager: typeof mockManager }) => unknown) =>
        callback({ manager: mockManager }),
    ),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((callback: (manager: typeof mockManager) => unknown) =>
      callback(mockManager),
    ),
  };

  const mockEmailQueue = {
    add: jest.fn(),
  };

  const mockAuthService = {
    hashPassword: jest.fn(),
    revokeUserSessions: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'queue.defaultJobAttempts') return 3;
      if (key === 'queue.defaultBackoffMs') return 5000;
      throw new Error(`Unexpected config key ${key}`);
    }),
  };

  let service: DriversService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryBuilder.andWhere.mockReturnThis();
    mockQueryBuilder.orderBy.mockReturnThis();
    mockQueryBuilder.skip.mockReturnThis();
    mockQueryBuilder.take.mockReturnThis();
    mockQueryBuilder.where.mockReturnThis();
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    mockUserQueryBuilder.andWhere.mockReturnThis();
    mockUserQueryBuilder.where.mockReturnThis();
    mockUserQueryBuilder.getOne.mockResolvedValue(null);
    mockDriverRepository.create.mockImplementation((value: Partial<Driver>) => makeDriver(value));
    mockDriverRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    mockDriverRepository.findOne.mockResolvedValue(null);
    mockDriverRepository.save.mockImplementation((driver: Driver) => Promise.resolve(driver));
    mockInvitationRepository.create.mockImplementation((value: Partial<DriverInvitation>) =>
      makeInvitation(value),
    );
    mockInvitationRepository.findOne.mockResolvedValue(null);
    mockInvitationRepository.save.mockImplementation((invitation: DriverInvitation) =>
      Promise.resolve(invitation),
    );
    mockUserRepository.create.mockImplementation((value: Partial<User>) => makeUser(value));
    mockUserRepository.createQueryBuilder.mockReturnValue(mockUserQueryBuilder);
    mockUserRepository.findOne.mockResolvedValue(null);
    mockUserRepository.save.mockImplementation((user: User) => Promise.resolve(user));
    mockGroupementRepository.findOne.mockResolvedValue({
      driverIdentifierNext: 1,
      id: groupementId,
    });
    mockGroupementRepository.save.mockImplementation((groupement: Groupement) =>
      Promise.resolve(groupement),
    );
    mockAuditService.log.mockResolvedValue(undefined);
    mockAuthService.hashPassword.mockResolvedValue('hashed-password');
    mockAuthService.revokeUserSessions.mockResolvedValue(undefined);

    service = new DriversService(
      mockTenancyService as unknown as TenancyService,
      mockAuditService as unknown as AuditService,
      mockDataSource as never,
      mockEmailQueue as never,
      mockAuthService as unknown as AuthService,
      mockConfigService as never,
    );
  });

  it('creates a driver and persists the normalized E.164 phone', async () => {
    const result = await service.create(groupementId, createDriverDto({ phone: '06 12 34 56 78' }));

    expect(result.phoneE164).toBe('+33612345678');
    expect(result.driverIdentifier).toBe('T1');
    expect(mockDriverRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        driverIdentifier: 'T1',
        groupementId,
        matricule: 'TX-0042',
        phoneE164: '+33612345678',
        status: DriverStatus.ACTIVE,
      }),
    );
  });

  it('rejects a duplicate matricule in the same groupement', async () => {
    mockDriverRepository.findOne.mockResolvedValueOnce(makeDriver({ matricule: 'TX-0042' }));

    await expect(service.create(groupementId, createDriverDto())).rejects.toThrow(
      ConflictException,
    );
  });

  it('creates a group admin driver invitation for the first admin', async () => {
    const actor = makeActor();

    const result = await service.createGroupAdminInvitation(groupementId, actor, {
      email: 'Karim.Mansouri@TaxiKiwi.local',
      licenseCity: 'Sèvres',
      licenseNumber: 'lic-92310-0001',
    });

    expect(mockManager.query).toHaveBeenCalledWith(
      `SELECT set_config('app.current_groupement_id', $1, true)`,
      [groupementId],
    );
    expect(mockInvitationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'karim.mansouri@taxikiwi.local',
        groupementId,
        isGroupAdmin: true,
        invitedByUserId: actor.id,
        licenseNumber: 'LIC-92310-0001',
      }),
    );
    expect(result.isGroupAdmin).toBe(true);
    expect(mockEmailQueue.add).toHaveBeenCalledWith(
      SEND_DRIVER_INVITATION_EMAIL_JOB,
      expect.objectContaining({
        email: 'karim.mansouri@taxikiwi.local',
        invitationToken: expect.any(String) as unknown,
      }),
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('accepts a group admin driver invitation as DRIVER plus ADMIN', async () => {
    const invitation = makeInvitation({ isGroupAdmin: true });
    mockInvitationRepository.findOne.mockResolvedValue(invitation);

    const result = await service.acceptInvitation('raw-token', {
      firstName: 'Karim',
      lastName: 'Mansouri',
      password: 'StrongPassword12345!',
      phone: '06 12 34 56 78',
      vehicleMake: 'Toyota',
      vehicleModel: 'Prius',
      vehicleRegistration: 'AB-123-CD',
      vehicleYear: 2022,
    });

    expect(mockUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: [UserRole.DRIVER, UserRole.ADMIN],
      }),
    );
    expect(mockDriverRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        isGroupAdmin: true,
      }),
    );
    expect(result.isGroupAdmin).toBe(true);
  });

  it('allows the same matricule when no driver exists in the current groupement', async () => {
    await expect(service.create(groupementId, createDriverDto())).resolves.toMatchObject({
      matricule: 'TX-0042',
    });
  });

  it('rejects linking a user from another groupement or an inactive user', async () => {
    mockUserRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create(groupementId, createDriverDto({ userId: 'user-1' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('logs an audit warning when another driver already uses the same phone', async () => {
    mockDriverRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeDriver({ id: 'existing-driver', phoneE164: '+33612345678' }));

    await service.create(groupementId, createDriverDto());

    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: DRIVER_PHONE_DUPLICATE_WARNING,
        after: expect.objectContaining({
          existingDriverId: 'existing-driver',
          phoneE164: '+33612345678',
        }) as unknown,
        groupementId,
        resourceType: 'Driver',
      }),
    );
  });

  it('suspends then reactivates an active driver', async () => {
    const driver = makeDriver({ status: DriverStatus.ACTIVE });
    mockDriverRepository.findOne.mockResolvedValueOnce(driver);

    const suspended = await service.suspend(driver.id, groupementId, {
      reason: 'Documents à renouveler',
    });

    expect(suspended.status).toBe(DriverStatus.SUSPENDED);
    expect(suspended.statusReason).toBe('Documents à renouveler');

    mockDriverRepository.findOne.mockResolvedValueOnce(driver);
    const reactivated = await service.reactivate(driver.id, groupementId);

    expect(reactivated.status).toBe(DriverStatus.ACTIVE);
    expect(reactivated.statusReason).toBeNull();
  });

  it('refuses reactivation after OFFBOARDED transition', async () => {
    const driver = makeDriver({ status: DriverStatus.ACTIVE });
    mockDriverRepository.findOne.mockResolvedValueOnce(driver);

    const offboarded = await service.offboard(driver.id, groupementId);

    expect(offboarded.status).toBe(DriverStatus.OFFBOARDED);
    mockDriverRepository.findOne.mockResolvedValueOnce(driver);

    await expect(service.reactivate(driver.id, groupementId)).rejects.toThrow(ConflictException);
  });

  it('keeps tenant isolation in the list query', async () => {
    await service.findAll(groupementId, { limit: 20, page: 1 });

    expect(mockTenancyService.withTenantTransaction).toHaveBeenCalled();
    expect(mockQueryBuilder.where).toHaveBeenCalledWith('d.groupement_id = :groupementId', {
      groupementId,
    });
  });
});

function createDriverDto(overrides: Partial<Parameters<DriversService['create']>[1]> = {}) {
  return {
    firstName: 'Karim',
    lastName: 'Mansouri',
    matricule: 'TX-0042',
    phone: '06 12 34 56 78',
    vehicleMake: 'Toyota',
    vehicleModel: 'Prius',
    vehicleRegistration: 'ab-123-cd',
    vehicleYear: 2022,
    ...overrides,
  };
}

function makeDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    driverIdentifier: 'T1',
    firstName: 'Karim',
    groupementId: 'groupement-1',
    id: 'driver-1',
    isGroupAdmin: false,
    joinedAt: new Date('2026-05-01T00:00:00.000Z'),
    lastName: 'Mansouri',
    licenseCity: null,
    licenseNumber: null,
    matricule: 'TX-0042',
    mobileActivatedAt: null,
    offboardedAt: null,
    phoneE164: '+33612345678',
    status: DriverStatus.ACTIVE,
    statusChangedAt: new Date('2026-05-01T00:00:00.000Z'),
    statusReason: null,
    suspendedAt: null,
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    userId: null,
    vehicleMake: 'Toyota',
    vehicleModel: 'Prius',
    vehicleRegistration: 'AB-123-CD',
    vehicleYear: 2022,
    ...overrides,
  };
}

function makeInvitation(overrides: Partial<DriverInvitation> = {}): DriverInvitation {
  return {
    acceptedAt: null,
    acceptedDriverId: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    email: 'karim.mansouri@taxikiwi.local',
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    groupementId: 'groupement-1',
    id: 'invitation-1',
    invitedByUserId: 'admin-1',
    isGroupAdmin: false,
    licenseCity: 'Sèvres',
    licenseNumber: 'LIC-92310-0001',
    tokenHash: 'a'.repeat(64),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    email: 'karim.mansouri@taxikiwi.local',
    firstName: 'Karim',
    groupementId: 'groupement-1',
    id: 'user-1',
    isActive: true,
    lastLoginAt: null,
    lastName: 'Mansouri',
    passwordHash: 'hashed-password',
    passwordUpdatedAt: new Date('2026-05-01T00:00:00.000Z'),
    phoneE164: '+33612345678',
    roles: [UserRole.DRIVER],
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeActor() {
  return {
    email: 'super-admin@taxikiwi.local',
    familyId: 'family-1',
    groupementId: null,
    id: 'super-admin-1',
    roles: [UserRole.SUPER_ADMIN],
    sessionId: 'session-1',
  };
}
