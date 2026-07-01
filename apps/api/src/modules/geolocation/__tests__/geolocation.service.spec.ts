import { NotFoundException } from '@nestjs/common';

import { DriverAvailabilityStatus } from '../types/driver-availability.enum';
import { GeolocationService } from '../geolocation.service';
import { Driver } from '../../drivers/entities/driver.entity';
import { DriverPosition } from '../entities/driver-position.entity';

describe('GeolocationService', () => {
  const groupementId = 'groupement-1';
  const driverId = 'driver-1';

  // ── Mock Redis ───────────────────────────────────────────
  const mockRedis = {
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    mget: jest.fn().mockResolvedValue([]),
    sadd: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
  };

  // ── Mock Repositories ────────────────────────────────────
  const mockDriverRepository = {
    findOne: jest.fn(),
  };

  const mockPositionRepository = {
    save: jest.fn(),
  };

  const mockManager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Driver) return mockDriverRepository;
      if (entity === DriverPosition) return mockPositionRepository;
      throw new Error('Unexpected repository');
    }),
  };

  const mockDataSource = {
    manager: mockManager,
  };

  // ── Mock Gateway ─────────────────────────────────────────
  const mockGateway = {
    emitPositionUpdate: jest.fn(),
  };

  let service: GeolocationService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDriverRepository.findOne.mockResolvedValue(makeDriver());
    mockPositionRepository.save.mockResolvedValue(undefined);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    mockRedis.mget.mockResolvedValue([]);
    mockRedis.sadd.mockResolvedValue(1);
    mockRedis.smembers.mockResolvedValue([]);

    service = new GeolocationService(
      mockDataSource as never,
      mockRedis as never,
      mockGateway as never,
    );
  });

  // ── updatePosition ───────────────────────────────────────
  it('stocke la position dans Redis et PostgreSQL', async () => {
    const result = await service.updatePosition(driverId, groupementId, {
      latitude: 48.8566,
      longitude: 2.3522,
    });

    expect(result.latitude).toBe(48.8566);
    expect(result.longitude).toBe(2.3522);
    expect(result.driverId).toBe(driverId);
    expect(result.groupementId).toBe(groupementId);

    // Redis appelé
    expect(mockRedis.setex).toHaveBeenCalledTimes(2); // position + status
    expect(mockRedis.sadd).toHaveBeenCalled();

    // PostgreSQL appelé
    expect(mockPositionRepository.save).toHaveBeenCalled();
  });

  it('émet un event WebSocket après chaque position', async () => {
    await service.updatePosition(driverId, groupementId, {
      latitude: 48.8566,
      longitude: 2.3522,
    });

    expect(mockGateway.emitPositionUpdate).toHaveBeenCalledWith(
      groupementId,
      expect.objectContaining({
        driverId,
        latitude: 48.8566,
        longitude: 2.3522,
      }),
    );
  });

  it('utilise le statut envoyé si fourni', async () => {
    const result = await service.updatePosition(driverId, groupementId, {
      latitude: 48.8566,
      longitude: 2.3522,
      status: DriverAvailabilityStatus.STATION,
    });

    expect(result.status).toBe(DriverAvailabilityStatus.STATION);
  });

  it('utilise le statut Redis existant si aucun statut envoyé', async () => {
    mockRedis.get.mockResolvedValueOnce(DriverAvailabilityStatus.COURSE);

    const result = await service.updatePosition(driverId, groupementId, {
      latitude: 48.8566,
      longitude: 2.3522,
    });

    expect(result.status).toBe(DriverAvailabilityStatus.COURSE);
  });

  it('utilise LIBRE par défaut si aucun statut dans Redis', async () => {
    mockRedis.get.mockResolvedValueOnce(null);

    const result = await service.updatePosition(driverId, groupementId, {
      latitude: 48.8566,
      longitude: 2.3522,
    });

    expect(result.status).toBe(DriverAvailabilityStatus.LIBRE);
  });

  it('lève NotFoundException si le chauffeur est introuvable', async () => {
    mockDriverRepository.findOne.mockResolvedValue(null);

    await expect(
      service.updatePosition(driverId, groupementId, {
        latitude: 48.8566,
        longitude: 2.3522,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // ── updateStatus ─────────────────────────────────────────
  it('change le statut du chauffeur dans Redis', async () => {
    const result = await service.updateStatus(
      driverId,
      groupementId,
      DriverAvailabilityStatus.LIBRE,
    );

    expect(result.driverId).toBe(driverId);
    expect(result.status).toBe(DriverAvailabilityStatus.LIBRE);
    expect(mockRedis.setex).toHaveBeenCalled();
  });

  it('lève NotFoundException si chauffeur introuvable pour updateStatus', async () => {
    mockDriverRepository.findOne.mockResolvedValue(null);

    await expect(
      service.updateStatus(driverId, groupementId, DriverAvailabilityStatus.LIBRE),
    ).rejects.toThrow(NotFoundException);
  });

  // ── getPosition ──────────────────────────────────────────
  it('retourne null si aucune position dans Redis', async () => {
    mockRedis.get.mockResolvedValue(null);

    const result = await service.getPosition(driverId, groupementId);

    expect(result).toBeNull();
  });

  it('retourne la position depuis Redis', async () => {
    const position = makePosition();
    mockRedis.get.mockResolvedValue(JSON.stringify(position));

    const result = await service.getPosition(driverId, groupementId);

    expect(result?.driverId).toBe(driverId);
    expect(result?.latitude).toBe(48.8566);
  });

  // ── getAllPositions ───────────────────────────────────────
  it('retourne une liste vide si aucun chauffeur connecté', async () => {
    mockRedis.smembers.mockResolvedValue([]);

    const result = await service.getAllPositions(groupementId);

    expect(result).toHaveLength(0);
  });

  it('retourne toutes les positions des chauffeurs connectés', async () => {
    mockRedis.smembers.mockResolvedValue([driverId, 'driver-2']);
    mockRedis.mget.mockResolvedValue([
      JSON.stringify(makePosition({ driverId })),
      JSON.stringify(makePosition({ driverId: 'driver-2' })),
    ]);

    const result = await service.getAllPositions(groupementId);

    expect(result).toHaveLength(2);
    expect(result[0].driverId).toBe(driverId);
    expect(result[1].driverId).toBe('driver-2');
  });

  it('ignore les positions null dans Redis', async () => {
    mockRedis.smembers.mockResolvedValue([driverId, 'driver-2']);
    mockRedis.mget.mockResolvedValue([
      JSON.stringify(makePosition({ driverId })),
      null, // driver-2 expiré dans Redis
    ]);

    const result = await service.getAllPositions(groupementId);

    expect(result).toHaveLength(1);
  });
});

// ── Helpers ──────────────────────────────────────────────────
function makeDriver(overrides: Partial<Driver> = {}): Partial<Driver> {
  return {
    id: 'driver-1',
    groupementId: 'groupement-1',
    firstName: 'Karim',
    lastName: 'Mansouri',
    ...overrides,
  };
}

function makePosition(
  overrides: Partial<{
    driverId: string;
    groupementId: string;
    latitude: number;
    longitude: number;
    status: DriverAvailabilityStatus;
    recordedAt: string;
  }> = {},
) {
  return {
    driverId: 'driver-1',
    groupementId: 'groupement-1',
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: null,
    speed: null,
    heading: null,
    status: DriverAvailabilityStatus.LIBRE,
    recordedAt: new Date().toISOString(),
    ...overrides,
  };
}
