import { ConflictException, NotFoundException } from '@nestjs/common';

import { DriverAvailabilityStatus } from '../../geolocation/types/driver-availability.enum';
import { Driver } from '../../drivers/entities/driver.entity';
import { QueueService } from '../queue.service';

describe('QueueService', () => {
  const groupementId = 'groupement-1';
  const driverId = 'driver-1';
  const mockRedis = {
    lrange: jest.fn().mockResolvedValue([]),
    rpush: jest.fn().mockResolvedValue(1),
    lpush: jest.fn().mockResolvedValue(1),
    lpop: jest.fn().mockResolvedValue(null),
    lrem: jest.fn().mockResolvedValue(1),
    setex: jest.fn().mockResolvedValue('OK'),
    mget: jest.fn().mockResolvedValue([]),
  };
  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };

  const mockDriverRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockManager = {
    getRepository: jest.fn(() => mockDriverRepository),
  };

  const mockDataSource = {
    manager: mockManager,
  };

  let service: QueueService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis.lrange.mockResolvedValue([]);
    mockRedis.rpush.mockResolvedValue(1);
    mockRedis.lpush.mockResolvedValue(1);
    mockRedis.lpop.mockResolvedValue(null);
    mockRedis.lrem.mockResolvedValue(1);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.mget.mockResolvedValue([]);
    mockDriverRepository.findOne.mockResolvedValue(makeDriver());
    mockQueryBuilder.getMany.mockResolvedValue([makeDriver()]);

    service = new QueueService(mockDataSource as never, mockRedis as never);
  });
  it('retourne une file vide si aucun chauffeur', async () => {
    mockRedis.lrange.mockResolvedValue([]);

    const result = await service.getQueue(groupementId);

    expect(result.total).toBe(0);
    expect(result.entries).toHaveLength(0);
  });

  it('retourne la file avec les chauffeurs dans l ordre', async () => {
    mockRedis.lrange.mockResolvedValue([driverId]);
    mockRedis.mget.mockResolvedValue([DriverAvailabilityStatus.STATION]);
    mockQueryBuilder.getMany.mockResolvedValue([makeDriver()]);

    const result = await service.getQueue(groupementId);

    expect(result.total).toBe(1);
    expect(result.entries[0].driverId).toBe(driverId);
    expect(result.entries[0].position).toBe(1);
    expect(result.entries[0].driverIdentifier).toBe('S16');
  });
  it('ajoute un chauffeur à la fin de la file', async () => {
    mockRedis.lrange.mockResolvedValue([]);

    await service.joinQueue(driverId, groupementId);

    expect(mockRedis.rpush).toHaveBeenCalledWith(`queue:groupement:${groupementId}`, driverId);
    expect(mockRedis.setex).toHaveBeenCalledWith(
      expect.stringContaining(driverId),
      86400,
      DriverAvailabilityStatus.STATION,
    );
  });

  it('lève ConflictException si le chauffeur est déjà dans la file', async () => {
    mockRedis.lrange.mockResolvedValue([driverId]);

    await expect(service.joinQueue(driverId, groupementId)).rejects.toThrow(ConflictException);
  });

  it('lève NotFoundException si le chauffeur est introuvable', async () => {
    mockDriverRepository.findOne.mockResolvedValue(null);

    await expect(service.joinQueue(driverId, groupementId)).rejects.toThrow(NotFoundException);
  });
  it('retire un chauffeur de la file', async () => {
    mockRedis.lrange.mockResolvedValue([driverId]);

    await service.leaveQueue(driverId, groupementId);

    expect(mockRedis.lrem).toHaveBeenCalledWith(`queue:groupement:${groupementId}`, 1, driverId);
  });

  it('lève NotFoundException si le chauffeur n est pas dans la file', async () => {
    mockRedis.lrange.mockResolvedValue([]);

    await expect(service.leaveQueue(driverId, groupementId)).rejects.toThrow(NotFoundException);
  });
  it('remet le chauffeur en tête de file', async () => {
    mockRedis.lrange.mockResolvedValue([driverId]);

    await service.repositionFirst(driverId, groupementId);

    expect(mockRedis.lrem).toHaveBeenCalled();
    expect(mockRedis.lpush).toHaveBeenCalledWith(`queue:groupement:${groupementId}`, driverId);
  });
  it('retire le premier chauffeur et le met en COURSE', async () => {
    mockRedis.lpop.mockResolvedValue(driverId);

    const result = await service.dequeueFirst(groupementId);

    expect(result).toBe(driverId);
    expect(mockRedis.setex).toHaveBeenCalledWith(
      expect.stringContaining(driverId),
      86400,
      DriverAvailabilityStatus.COURSE,
    );
  });

  it('retourne null si la file est vide', async () => {
    mockRedis.lpop.mockResolvedValue(null);

    const result = await service.dequeueFirst(groupementId);

    expect(result).toBeNull();
  });
});
function makeDriver(overrides: Partial<Driver> = {}): Partial<Driver> {
  return {
    id: 'driver-1',
    groupementId: 'groupement-1',
    firstName: 'Brahim',
    lastName: 'Mansouri',
    driverIdentifier: 'S16',
    ...overrides,
  };
}
