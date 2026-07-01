import { BadRequestException } from '@nestjs/common';

import { AuditService } from '../../audit/audit.service';
import { Client } from '../../clients/entities/client.entity';
import { Driver } from '../../drivers/entities/driver.entity';
import { DriverStatus } from '../../drivers/types/driver-status.enum';
import { TenancyService } from '../../tenancy/tenancy.service';
import { COURSE_CREATED, COURSE_DELETED, COURSE_UPDATED } from '../courses.constants';
import { CoursesService } from '../courses.service';
import { Course } from '../entities/course.entity';
import { CourseStatus } from '../types/course-status.enum';

const TEST_GROUPEMENT_ID = 'groupement-1';

describe('CoursesService', () => {
  const groupementId = TEST_GROUPEMENT_ID;

  const mockListQueryBuilder = {
    addOrderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  };

  const mockCourseRepository = {
    create: jest.fn(),
    createQueryBuilder: jest.fn(() => mockListQueryBuilder),
    findOne: jest.fn(),
    remove: jest.fn(),
    save: jest.fn(),
  };

  const mockDriverRepository = {
    findOne: jest.fn(),
  };

  const mockClientRepository = {
    findOne: jest.fn(),
  };

  const mockManager = {
    getRepository: jest.fn((entity: object) => {
      if (entity === Course) return mockCourseRepository;
      if (entity === Driver) return mockDriverRepository;
      if (entity === Client) return mockClientRepository;
      throw new Error('Unexpected repository');
    }),
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

  let service: CoursesService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockListQueryBuilder.addOrderBy.mockReturnThis();
    mockListQueryBuilder.andWhere.mockReturnThis();
    mockListQueryBuilder.orderBy.mockReturnThis();
    mockListQueryBuilder.skip.mockReturnThis();
    mockListQueryBuilder.take.mockReturnThis();
    mockListQueryBuilder.where.mockReturnThis();
    mockListQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    mockCourseRepository.create.mockImplementation((value: Partial<Course>) => makeCourse(value));
    mockCourseRepository.createQueryBuilder.mockReturnValue(mockListQueryBuilder);
    mockCourseRepository.findOne.mockResolvedValue(null);
    mockCourseRepository.remove.mockImplementation((course: Course) => Promise.resolve(course));
    mockCourseRepository.save.mockImplementation((course: Course) => Promise.resolve(course));

    mockDriverRepository.findOne.mockResolvedValue(makeDriver());
    mockClientRepository.findOne.mockResolvedValue(makeClient());
    mockAuditService.log.mockResolvedValue(undefined);

    service = new CoursesService(
      mockTenancyService as unknown as TenancyService,
      mockAuditService as unknown as AuditService,
    );
  });

  it('rejects creation when the driver is outside the current groupement', async () => {
    mockDriverRepository.findOne.mockResolvedValue(null);

    await expect(service.create(groupementId, createCourseDto())).rejects.toThrow(
      BadRequestException,
    );

    expect(mockDriverRepository.findOne).toHaveBeenCalledWith({
      where: { groupementId, id: 'driver-1' },
    });
  });

  it('creates a manual course without client_id', async () => {
    const result = await service.create(groupementId, createCourseDto({ clientId: null }));

    expect(result.clientId).toBeNull();
    expect(mockClientRepository.findOne).not.toHaveBeenCalled();
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: COURSE_CREATED,
        after: expect.objectContaining({ clientId: null, driverId: 'driver-1' }) as unknown,
      }),
    );
  });

  it('keeps tenant isolation and applies period filters in the list query', async () => {
    const startedFrom = new Date('2026-05-01T00:00:00.000Z');
    const startedTo = new Date('2026-05-31T23:59:59.999Z');

    await service.findAll(groupementId, {
      limit: 20,
      page: 1,
      startedFrom,
      startedTo,
    });

    expect(mockTenancyService.withTenantTransaction).toHaveBeenCalled();
    expect(mockListQueryBuilder.where).toHaveBeenCalledWith('c.groupement_id = :groupementId', {
      groupementId,
    });
    expect(mockListQueryBuilder.andWhere).toHaveBeenCalledWith('c.started_at >= :startedFrom', {
      startedFrom,
    });
    expect(mockListQueryBuilder.andWhere).toHaveBeenCalledWith('c.started_at <= :startedTo', {
      startedTo,
    });
  });

  it('audits updates with before and after snapshots', async () => {
    const course = makeCourse({ status: CourseStatus.COMPLETED });
    mockCourseRepository.findOne.mockResolvedValue(course);

    await service.update(course.id, groupementId, {
      note: '  Annulation client  ',
      status: CourseStatus.CANCELLED,
    });

    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: COURSE_UPDATED,
        after: expect.objectContaining({
          note: 'Annulation client',
          status: CourseStatus.CANCELLED,
        }) as unknown,
        before: expect.objectContaining({ status: CourseStatus.COMPLETED }) as unknown,
      }),
    );
  });

  it('validates client_id only when it is provided', async () => {
    mockClientRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create(groupementId, createCourseDto({ clientId: 'missing-client' })),
    ).rejects.toThrow(BadRequestException);

    expect(mockClientRepository.findOne).toHaveBeenCalledWith({
      where: { groupementId, id: 'missing-client' },
    });
  });

  it('deletes manual courses with an audit before snapshot', async () => {
    const course = makeCourse();
    mockCourseRepository.findOne.mockResolvedValue(course);

    await service.delete(course.id, groupementId);

    expect(mockCourseRepository.remove).toHaveBeenCalledWith(course);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: COURSE_DELETED,
        before: expect.objectContaining({ id: course.id }) as unknown,
      }),
    );
  });
});

function createCourseDto(overrides: Partial<Parameters<CoursesService['create']>[1]> = {}) {
  return {
    amountEur: 34.5,
    clientId: 'client-1',
    distanceKm: 12.4,
    driverId: 'driver-1',
    dropoffAddress: 'Gare Montparnasse, Paris',
    durationMinutes: 28,
    pickupAddress: '12 rue de Sèvres, 92310 Sèvres',
    startedAt: new Date('2026-05-02T09:30:00.000Z'),
    status: CourseStatus.COMPLETED,
    ...overrides,
  };
}

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    amountEur: 34.5,
    client: makeClient(),
    clientId: 'client-1',
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    distanceKm: 12.4,
    driver: makeDriver(),
    driverId: 'driver-1',
    dropoffAddress: 'Gare Montparnasse, Paris',
    durationMinutes: 28,
    groupementId: TEST_GROUPEMENT_ID,
    id: 'course-1',
    note: null,
    pickupAddress: '12 rue de Sèvres, 92310 Sèvres',
    startedAt: new Date('2026-05-02T09:30:00.000Z'),
    status: CourseStatus.COMPLETED,
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    firstName: 'Karim',
    groupementId: TEST_GROUPEMENT_ID,
    id: 'driver-1',
    joinedAt: new Date('2026-05-01T00:00:00.000Z'),
    lastName: 'Mansouri',
    matricule: 'TX-0042',
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
  } as Driver;
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    addresses: [],
    anonymizationRequestedAt: null,
    archivedAt: null,
    blacklistReason: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    email: null,
    fullName: 'Nadia Benali',
    gender: null,
    groupementId: TEST_GROUPEMENT_ID,
    id: 'client-1',
    isBlacklisted: false,
    notes: null,
    phoneE164: '+33612345678',
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}
