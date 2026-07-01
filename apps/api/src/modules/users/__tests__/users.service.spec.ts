import { ConflictException, GoneException } from '@nestjs/common';

import { UserRole } from '../../auth/types/role.enum';
import { UserInvitation, UserInvitationType } from '../entities/user-invitation.entity';
import { User } from '../entities/user.entity';
import { SEND_INVITATION_EMAIL_JOB, SEND_RESET_PASSWORD_EMAIL_JOB } from '../users.constants';
import { UsersService } from '../users.service';

describe('UsersService', () => {
  const groupementId = 'groupement-1';
  const actor = {
    email: 'admin@taxikiwi.local',
    familyId: 'family-1',
    groupementId,
    id: 'admin-1',
    roles: [UserRole.ADMIN],
    sessionId: 'session-1',
  };

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    where: jest.fn().mockReturnThis(),
  };

  const mockUserRepository = {
    create: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockInvitationRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockManager = {
    getRepository: jest.fn((entity: object) => {
      if (entity === User) return mockUserRepository;
      if (entity === UserInvitation) return mockInvitationRepository;
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

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryBuilder.andWhere.mockReturnThis();
    mockQueryBuilder.where.mockReturnThis();
    mockQueryBuilder.getOne.mockResolvedValue(null);
    mockUserRepository.create.mockImplementation((value: User) => value);
    mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    mockUserRepository.findOne.mockResolvedValue(null);
    mockUserRepository.save.mockImplementation((user: User) => Promise.resolve(user));
    mockInvitationRepository.create.mockImplementation((value: UserInvitation) => value);
    mockInvitationRepository.findOne.mockResolvedValue(null);
    mockInvitationRepository.save.mockImplementation((invitation: UserInvitation) =>
      Promise.resolve(invitation),
    );
    mockInvitationRepository.update.mockResolvedValue({ affected: 0 });
    mockAuthService.hashPassword.mockResolvedValue('hashed-password');

    service = new UsersService(
      mockTenancyService as never,
      mockDataSource as never,
      mockEmailQueue as never,
      mockAuthService as never,
      mockConfigService as never,
    );
  });

  it('creates an invitation and enqueues the invitation email without exposing the token', async () => {
    const savedInvitation = makeInvitation();
    mockInvitationRepository.create.mockReturnValue(savedInvitation);
    mockInvitationRepository.save.mockResolvedValue(savedInvitation);

    const result = await service.createInvitation(groupementId, actor, {
      email: 'Nadia.Benali@TaxiKiwi.local',
      firstName: 'Nadia',
      lastName: 'Benali',
      roles: [UserRole.ADMIN],
    });

    expect(result).toEqual({
      email: 'nadia.benali@taxikiwi.local',
      expiresAt: savedInvitation.expiresAt,
      groupementId,
      id: savedInvitation.id,
      roles: [UserRole.ADMIN],
    });
    expect(mockInvitationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'nadia.benali@taxikiwi.local',
        groupementId,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) as unknown,
      }),
    );
    expect(mockEmailQueue.add).toHaveBeenCalledWith(
      SEND_INVITATION_EMAIL_JOB,
      expect.objectContaining({
        email: 'nadia.benali@taxikiwi.local',
        invitationToken: expect.any(String) as unknown,
      }),
      expect.objectContaining({ attempts: 3 }),
    );
    expect(result).not.toHaveProperty('token');
  });

  it('rejects invitation creation when a user already exists in the tenant', async () => {
    mockQueryBuilder.getOne.mockResolvedValue(makeUser());

    await expect(
      service.createInvitation(groupementId, actor, {
        email: 'nadia.benali@taxikiwi.local',
        firstName: 'Nadia',
        lastName: 'Benali',
        roles: [UserRole.ADMIN],
      }),
    ).rejects.toThrow(ConflictException);

    expect(mockEmailQueue.add).not.toHaveBeenCalled();
  });

  it('accepts a valid invitation and creates the user with the expected roles', async () => {
    const invitation = makeInvitation();
    const savedUser = makeUser({ roles: invitation.roles });
    mockInvitationRepository.findOne.mockResolvedValue(invitation);
    mockUserRepository.create.mockReturnValue(savedUser);
    mockUserRepository.save.mockResolvedValue(savedUser);
    mockInvitationRepository.save.mockResolvedValue(invitation);

    const result = await service.acceptInvitation('raw-token', {
      password: 'StrongPassword12345!',
    });

    expect(mockManager.query).toHaveBeenCalledWith(`SET LOCAL app.invitation_lookup = 'on'`);
    expect(mockAuthService.hashPassword).toHaveBeenCalledWith('StrongPassword12345!');
    expect(mockUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: invitation.email,
        groupementId: invitation.groupementId,
        passwordHash: 'hashed-password',
        roles: [UserRole.ADMIN],
      }),
    );
    expect(invitation.acceptedAt).toBeInstanceOf(Date);
    expect(result.roles).toEqual([UserRole.ADMIN]);
  });

  it('returns Gone for an expired invitation', async () => {
    mockInvitationRepository.findOne.mockResolvedValue(
      makeInvitation({ expiresAt: new Date(Date.now() - 60_000) }),
    );

    await expect(
      service.acceptInvitation('raw-token', { password: 'StrongPassword12345!' }),
    ).rejects.toThrow(GoneException);
  });

  it('returns Gone for an already accepted invitation', async () => {
    mockInvitationRepository.findOne.mockResolvedValue(makeInvitation({ acceptedAt: new Date() }));

    await expect(
      service.acceptInvitation('raw-token', { password: 'StrongPassword12345!' }),
    ).rejects.toThrow(GoneException);
  });

  it('deactivates a user and revokes its sessions', async () => {
    const target = makeUser({ id: 'user-to-disable' });
    mockUserRepository.findOne.mockResolvedValue(target);
    mockUserRepository.save.mockImplementation((user: User) => Promise.resolve(user));

    const result = await service.deactivate('user-to-disable', groupementId, actor);

    expect(result.isActive).toBe(false);
    expect(mockAuthService.revokeUserSessions).toHaveBeenCalledWith('user-to-disable');
  });

  it('creates a password reset token and enqueues the reset email', async () => {
    const target = makeUser({ id: 'user-to-reset' });
    const resetInvitation = makeInvitation({
      email: target.email,
      firstName: target.firstName,
      roles: target.roles,
      type: UserInvitationType.RESET_PASSWORD,
    });
    mockUserRepository.findOne.mockResolvedValue(target);
    mockInvitationRepository.create.mockReturnValue(resetInvitation);
    mockInvitationRepository.save.mockResolvedValue(resetInvitation);

    await service.createPasswordReset('user-to-reset', groupementId, actor);

    expect(mockInvitationRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        email: target.email,
        groupementId,
        type: UserInvitationType.RESET_PASSWORD,
      }),
      expect.objectContaining({ acceptedAt: expect.any(Date) as unknown }),
    );
    expect(mockEmailQueue.add).toHaveBeenCalledWith(
      SEND_RESET_PASSWORD_EMAIL_JOB,
      expect.objectContaining({ email: target.email, resetToken: expect.any(String) as unknown }),
      expect.objectContaining({ attempts: 3 }),
    );
  });
});

function makeUser(overrides: Partial<User> = {}): User {
  return {
    createdAt: new Date('2026-01-01T00:00:00Z'),
    email: 'nadia.benali@taxikiwi.local',
    firstName: 'Nadia',
    groupementId: 'groupement-1',
    id: 'user-1',
    isActive: true,
    lastLoginAt: null,
    lastName: 'Benali',
    passwordHash: 'hash',
    passwordUpdatedAt: new Date('2026-01-01T00:00:00Z'),
    phoneE164: '+33612345678',
    roles: [UserRole.ADMIN],
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeInvitation(overrides: Partial<UserInvitation> = {}): UserInvitation {
  return {
    acceptedAt: null,
    acceptedUserId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    email: 'nadia.benali@taxikiwi.local',
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    firstName: 'Nadia',
    groupementId: 'groupement-1',
    id: 'invitation-1',
    invitedByUserId: 'admin-1',
    lastName: 'Benali',
    phoneE164: '+33612345678',
    roles: [UserRole.ADMIN],
    tokenHash: 'a'.repeat(64),
    type: UserInvitationType.INVITATION,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}
