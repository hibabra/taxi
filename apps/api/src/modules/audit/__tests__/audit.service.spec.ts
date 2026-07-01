import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { TenantContext } from '../../tenancy/tenant-context';
import { TenancyService } from '../../tenancy/tenancy.service';
import { AuditService } from '../audit.service';
import { AuditLog } from '../entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;

  const mockRepository = {
    create: jest.fn().mockImplementation((data: Partial<AuditLog>) => data),
    createQueryBuilder: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const mockQueryRunner = {
    manager: {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    },
    query: jest.fn().mockResolvedValue(undefined),
  };
  const mockTenancyService = {
    withTenantTransaction: jest
      .fn()
      .mockImplementation((callback: (queryRunner: typeof mockQueryRunner) => Promise<unknown>) =>
        callback(mockQueryRunner),
      ),
  };

  const mockTenant = {
    groupementId: '550e8400-e29b-41d4-a716-446655440000',
    userId: '660e8400-e29b-41d4-a716-446655440001',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepository,
        },
        {
          provide: TenancyService,
          useValue: mockTenancyService,
        },
      ],
    }).compile();

    service = module.get(AuditService);
  });

  it('creates an audit log entry with tenant context', async () => {
    await TenantContext.run(mockTenant, async () => {
      await service.log({
        action: 'DRIVER_CREATED',
        after: { firstName: 'Jean', lastName: 'Dupont' },
        resourceId: 'some-driver-id',
        resourceType: 'Driver',
      });
    });

    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DRIVER_CREATED',
        groupementId: mockTenant.groupementId,
        userId: mockTenant.userId,
      }),
    );
    expect(mockRepository.save).toHaveBeenCalled();
  });

  it('redacts sensitive fields from before/after captures', async () => {
    await TenantContext.run(mockTenant, async () => {
      await service.log({
        action: 'USER_UPDATED',
        after: { email: 'test@test.com', passwordHash: 'argon2id$secret' },
        before: { email: 'old@test.com', passwordHash: 'argon2id$old' },
      });
    });

    const calls = mockRepository.create.mock.calls as Array<[Partial<AuditLog>]>;
    const createCall = calls[0]?.[0];

    expect(createCall?.before).toEqual({
      email: 'old@test.com',
      passwordHash: '[REDACTED]',
    });
    expect(createCall?.after).toEqual({
      email: 'test@test.com',
      passwordHash: '[REDACTED]',
    });
  });

  it('does not throw when save fails (audit never blocks business logic)', async () => {
    mockRepository.save.mockRejectedValueOnce(new Error('DB error'));

    await TenantContext.run(mockTenant, async () => {
      // Should NOT throw
      await expect(service.log({ action: 'SOME_ACTION' })).resolves.toBeUndefined();
    });
  });

  it('uses explicit userId/groupementId overrides when provided', async () => {
    await service.log({
      action: 'AUTH_LOGIN',
      groupementId: 'override-groupement',
      userId: 'override-user',
    });

    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        groupementId: 'override-groupement',
        userId: 'override-user',
      }),
    );
  });

  it('returns audit entries enriched with readable actor and groupement names', async () => {
    const auditLog = Object.assign(new AuditLog(), {
      action: 'USER_UPDATED',
      createdAt: new Date('2026-05-03T12:00:00.000Z'),
      groupementId: mockTenant.groupementId,
      id: 'audit-id',
      userId: mockTenant.userId,
    });
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      getRawAndEntities: jest.fn().mockResolvedValue({
        entities: [auditLog],
        raw: [
          {
            actor_email: 'amina@example.com',
            actor_first_name: 'Amina',
            actor_last_name: 'Diallo',
            groupement_code: 'TAXI-KIWI',
            groupement_name: 'Taxi Kiwi',
          },
        ],
      }),
      leftJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
    };

    mockRepository.createQueryBuilder.mockReturnValueOnce(queryBuilder);

    const result = await service.findAll({
      action: 'USER_UPDATED',
      limit: 20,
      page: 1,
    });

    expect(mockTenancyService.withTenantTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.query).toHaveBeenCalledWith(`SET LOCAL app.auth_lookup = 'on'`);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('audit.action = :action', {
      action: 'USER_UPDATED',
    });
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          actorEmail: 'amina@example.com',
          actorName: 'Amina Diallo',
          groupementCode: 'TAXI-KIWI',
          groupementName: 'Taxi Kiwi',
        }),
      ],
      total: 1,
    });
  });
});
