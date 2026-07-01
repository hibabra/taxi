import { BadRequestException, ConflictException, GoneException } from '@nestjs/common';

import { AuditService } from '../../audit/audit.service';
import { TenancyService } from '../../tenancy/tenancy.service';
import { ClientsService } from '../clients.service';
import { ClientAddress } from '../entities/client-address.entity';
import { Client } from '../entities/client.entity';

describe('ClientsService', () => {
  const groupementId = 'groupement-1';

  const mockListQueryBuilder = {
    addOrderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  };

  const mockUpdateQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn(),
    set: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  };

  const mockClientRepository = {
    create: jest.fn(),
    createQueryBuilder: jest.fn(() => mockListQueryBuilder),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockAddressRepository = {
    create: jest.fn(),
    createQueryBuilder: jest.fn(() => mockUpdateQueryBuilder),
    remove: jest.fn(),
    save: jest.fn(),
  };

  const mockManager = {
    getRepository: jest.fn((entity: object) => {
      if (entity === Client) return mockClientRepository;
      if (entity === ClientAddress) return mockAddressRepository;
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

  let service: ClientsService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockListQueryBuilder.addOrderBy.mockReturnThis();
    mockListQueryBuilder.andWhere.mockReturnThis();
    mockListQueryBuilder.leftJoinAndSelect.mockReturnThis();
    mockListQueryBuilder.orderBy.mockReturnThis();
    mockListQueryBuilder.skip.mockReturnThis();
    mockListQueryBuilder.take.mockReturnThis();
    mockListQueryBuilder.where.mockReturnThis();
    mockListQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    mockUpdateQueryBuilder.andWhere.mockReturnThis();
    mockUpdateQueryBuilder.set.mockReturnThis();
    mockUpdateQueryBuilder.update.mockReturnThis();
    mockUpdateQueryBuilder.where.mockReturnThis();
    mockUpdateQueryBuilder.execute.mockResolvedValue({ affected: 0 });

    mockClientRepository.create.mockImplementation((value: Partial<Client>) => makeClient(value));
    mockClientRepository.createQueryBuilder.mockReturnValue(mockListQueryBuilder);
    mockClientRepository.findOne.mockResolvedValue(null);
    mockClientRepository.save.mockImplementation((client: Client) => Promise.resolve(client));

    mockAddressRepository.create.mockImplementation((value: Partial<ClientAddress>) =>
      makeAddress(value),
    );
    mockAddressRepository.createQueryBuilder.mockReturnValue(mockUpdateQueryBuilder);
    mockAddressRepository.remove.mockImplementation((address: ClientAddress) =>
      Promise.resolve(address),
    );
    mockAddressRepository.save.mockImplementation((address: ClientAddress) =>
      Promise.resolve(address),
    );

    mockAuditService.log.mockResolvedValue(undefined);

    service = new ClientsService(
      mockTenancyService as unknown as TenancyService,
      mockAuditService as unknown as AuditService,
    );
  });

  it('searches by phone after normalizing varied input formats', async () => {
    mockClientRepository.findOne.mockResolvedValue(makeClient());

    await service.searchByPhone(groupementId, '06 12 34 56 78');
    await service.searchByPhone(groupementId, '+33 6 12 34 56 78');

    expect(mockClientRepository.findOne).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ phoneE164: '+33612345678' }) as unknown,
      }),
    );
    expect(mockClientRepository.findOne).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ phoneE164: '+33612345678' }) as unknown,
      }),
    );
  });

  it('rejects client creation with duplicate phone and exposes existingClientId', async () => {
    mockClientRepository.findOne.mockResolvedValue(makeClient({ id: 'existing-client' }));

    await expect(service.create(groupementId, createClientDto())).rejects.toThrow(
      ConflictException,
    );

    try {
      await service.create(groupementId, createClientDto());
    } catch (error) {
      const response = (error as ConflictException).getResponse();
      expect(response).toEqual(
        expect.objectContaining({
          code: 'CLIENT_PHONE_ALREADY_EXISTS',
          details: [{ existingClientId: 'existing-client' }],
        }),
      );
    }
  });

  it('blacklist requires a non-empty reason', async () => {
    await expect(service.blacklist('client-1', groupementId, { reason: '   ' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('blacklists and unblacklists with explicit audit entries', async () => {
    const client = makeClient();
    mockClientRepository.findOne
      .mockResolvedValueOnce(client)
      .mockResolvedValueOnce(client)
      .mockResolvedValueOnce(client)
      .mockResolvedValueOnce(client);

    await service.blacklist(client.id, groupementId, { reason: 'No show répétés' });
    await service.unblacklist(client.id, groupementId);

    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CLIENT_BLACKLISTED',
        after: expect.objectContaining({ blacklistReason: 'No show répétés' }) as unknown,
        before: expect.objectContaining({ isBlacklisted: false }) as unknown,
      }),
    );
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CLIENT_UNBLACKLISTED',
        after: expect.objectContaining({ isBlacklisted: false }) as unknown,
        before: expect.objectContaining({ isBlacklisted: true }) as unknown,
      }),
    );
  });

  it('refuses updates on archived clients', async () => {
    mockClientRepository.findOne.mockResolvedValue(makeClient({ archivedAt: new Date() }));

    await expect(
      service.update('client-1', groupementId, { fullName: 'Archived Client' }),
    ).rejects.toThrow(GoneException);
  });

  it('adds the first address as default', async () => {
    const client = makeClient({ addresses: [] });
    mockClientRepository.findOne.mockResolvedValue(client);

    await service.addAddress(client.id, groupementId, {
      addressLine1: '12 rue de Sèvres',
      city: 'Sèvres',
      label: 'Domicile',
      postalCode: '92310',
    });

    expect(mockAddressRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: client.id,
        groupementId,
        isDefault: true,
      }),
    );
  });

  it('keeps tenant isolation in the list query', async () => {
    await service.findAll(groupementId, { limit: 20, page: 1 });

    expect(mockTenancyService.withTenantTransaction).toHaveBeenCalled();
    expect(mockListQueryBuilder.where).toHaveBeenCalledWith('c.groupement_id = :groupementId', {
      groupementId,
    });
  });
});

function createClientDto(overrides: Partial<Parameters<ClientsService['create']>[1]> = {}) {
  return {
    fullName: 'Nadia Benali',
    phone: '06 12 34 56 78',
    ...overrides,
  };
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
    groupementId: 'groupement-1',
    id: 'client-1',
    isBlacklisted: false,
    notes: null,
    phoneE164: '+33612345678',
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeAddress(overrides: Partial<ClientAddress> = {}): ClientAddress {
  return {
    addressLine1: '12 rue de Sèvres',
    addressLine2: null,
    city: 'Sèvres',
    client: makeClient(),
    clientId: 'client-1',
    countryCode: 'FR',
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    groupementId: 'groupement-1',
    id: 'address-1',
    isDefault: false,
    label: 'Domicile',
    postalCode: '92310',
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}
